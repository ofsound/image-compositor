import type {
  CompositorLayer,
  KaleidoscopeMirrorMode,
  LayerRenderProject,
  ProjectDocument,
  RenderRect,
  RenderSlice,
  SourceAsset,
} from "@/types/project";
import { withAlpha } from "@/lib/color";
import { buildRenderSlices } from "@/lib/generator-registry";
import { lockExportDimensionsToCanvas } from "@/lib/export-sizing";
import {
  createLayerRenderProject,
  DEFAULT_FINISH,
  normalizeProjectDocument,
  syncLegacyProjectFieldsToSelectedLayer,
} from "@/lib/project-defaults";
import { hashToSeed, mulberry32 } from "@/lib/rng";
import { clamp } from "@/lib/utils";

export interface AssetBitmapEntry {
  asset: SourceAsset;
  bitmap: ImageBitmap;
}

interface RenderOptions {
  includeBackground?: boolean;
}

type RenderCanvas = HTMLCanvasElement;
type RenderContext = CanvasRenderingContext2D;
interface TrianglePoint {
  x: number;
  y: number;
}
interface Point3D {
  x: number;
  y: number;
  z: number;
}
const FULL_CIRCLE_RADIANS = Math.PI * 2;
const MAX_RGB_NOISE_DELTA = 28;
const MAX_MONO_NOISE_DELTA = 24;
const SVG_MASK_CACHE_LIMIT = 96;

const bitmapCache = new WeakMap<Blob, Promise<ImageBitmap>>();
const svgImageCache = new Map<string, Promise<HTMLImageElement>>();
const svgMaskCanvasCache = new Map<string, Promise<RenderCanvas | null>>();
const RENDER_CONTEXT_OPTIONS = {
  alpha: true,
  colorSpace: "srgb",
} as CanvasRenderingContext2DSettings & { colorSpace?: "srgb" };
const WORDS_FONT_STACK: Record<LayerRenderProject["words"]["fontFamily"], string> = {
  "dm-sans": '"DM Sans", system-ui, sans-serif',
  "cormorant-garamond": '"Cormorant Garamond", Georgia, serif',
  "jetbrains-mono": '"JetBrains Mono", monospace',
};
const WORDS_FONT_WEIGHT: Record<LayerRenderProject["words"]["fontFamily"], number> = {
  "dm-sans": 600,
  "cormorant-garamond": 600,
  "jetbrains-mono": 500,
};
const WORDS_MIN_FONT_SIZE = 8;
const WORDS_LINE_HEIGHT = 0.92;

function getHollowRatio(project: LayerRenderProject) {
  return clamp(project.layout.hollowRatio, 0, 0.95);
}

function getWordsLines(text: string) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  return lines.some((line) => line.trim().length > 0) ? lines : [];
}

function getWordsFont(
  fontFamily: LayerRenderProject["words"]["fontFamily"],
  fontSize: number,
) {
  return `${WORDS_FONT_WEIGHT[fontFamily]} ${fontSize}px ${WORDS_FONT_STACK[fontFamily]}`;
}

function createWordsMeasurementContext() {
  return getRenderContext(createRenderCanvas(1, 1));
}

function getWordsContentRect(project: LayerRenderProject) {
  return {
    x: project.canvas.inset,
    y: project.canvas.inset,
    width: Math.max(1, project.canvas.width - project.canvas.inset * 2),
    height: Math.max(1, project.canvas.height - project.canvas.inset * 2),
  };
}

function resolveWordsFontSize(
  words: LayerRenderProject["words"],
  lines: string[],
  rect: RenderRect,
) {
  const measureContext = createWordsMeasurementContext();
  const maxFontSize = Math.max(
    WORDS_MIN_FONT_SIZE,
    Math.floor(
      Math.min(
        rect.height / Math.max(lines.length * WORDS_LINE_HEIGHT, 1),
        rect.width,
      ),
    ),
  );

  for (let fontSize = maxFontSize; fontSize >= WORDS_MIN_FONT_SIZE; fontSize -= 2) {
    measureContext.font = getWordsFont(words.fontFamily, fontSize);
    const widestLine = Math.max(
      ...lines.map((line) => measureContext.measureText(line || " ").width),
    );
    const totalHeight = fontSize * WORDS_LINE_HEIGHT * lines.length;

    if (widestLine <= rect.width && totalHeight <= rect.height) {
      return fontSize;
    }
  }

  return WORDS_MIN_FONT_SIZE;
}

function createTextCanvas(
  words: LayerRenderProject["words"],
  fillStyle: string,
  canvasRect: RenderRect,
  contentRect: RenderRect,
) {
  const lines = getWordsLines(words.text);
  if (lines.length === 0) {
    return null;
  }

  const fontSize = resolveWordsFontSize(words, lines, contentRect);
  const lineHeight = fontSize * WORDS_LINE_HEIGHT;
  const totalHeight = lineHeight * lines.length;
  const centerX = contentRect.x + contentRect.width / 2;
  const startY =
    contentRect.y + contentRect.height / 2 - totalHeight / 2 + lineHeight / 2;
  const canvas = createRenderCanvas(canvasRect.width, canvasRect.height);
  const context = getRenderContext(canvas);

  context.font = getWordsFont(words.fontFamily, fontSize);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = fillStyle;

  lines.forEach((line, index) => {
    context.fillText(line || " ", centerX, startY + index * lineHeight);
  });

  return canvas;
}

function createWordsTextCanvas(
  project: LayerRenderProject,
  fillStyle: string,
) {
  return createTextCanvas(
    project.words,
    fillStyle,
    {
      x: 0,
      y: 0,
      width: project.canvas.width,
      height: project.canvas.height,
    },
    getWordsContentRect(project),
  );
}

function getSvgMaskCacheKey(
  project: LayerRenderProject,
  width: number,
  height: number,
  seedKey: string,
) {
  const { svgGeometry } = project;
  return JSON.stringify({
    markup: svgGeometry.markup,
    fit: svgGeometry.fit,
    padding: svgGeometry.padding,
    threshold: svgGeometry.threshold,
    invert: svgGeometry.invert,
    morphology: svgGeometry.morphology,
    repeatEnabled: svgGeometry.repeatEnabled,
    repeatScale: svgGeometry.repeatScale,
    repeatGap: svgGeometry.repeatGap,
    randomRotation: svgGeometry.randomRotation,
    mirrorMode: svgGeometry.mirrorMode,
    width,
    height,
    seedKey,
  });
}

async function loadSvgImage(markup: string) {
  if (!svgImageCache.has(markup)) {
    svgImageCache.set(
      markup,
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(
          new Blob([markup], { type: "image/svg+xml" }),
        );

        const cleanup = () => {
          URL.revokeObjectURL(url);
        };

        image.onload = () => {
          cleanup();
          resolve(image);
        };
        image.onerror = () => {
          cleanup();
          reject(new Error("The SVG geometry image could not be decoded."));
        };
        image.src = url;
      }),
    );
  }
  return svgImageCache.get(markup)!;
}

function getFitRect(
  fit: LayerRenderProject["svgGeometry"]["fit"],
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  if (fit === "stretch") {
    return { x: 0, y: 0, width: targetWidth, height: targetHeight };
  }

  const sourceRatio = sourceWidth / Math.max(sourceHeight, 1);
  const targetRatio = targetWidth / Math.max(targetHeight, 1);
  const scale =
    fit === "cover"
      ? targetRatio > sourceRatio
        ? targetWidth / Math.max(sourceWidth, 1)
        : targetHeight / Math.max(sourceHeight, 1)
      : targetRatio < sourceRatio
        ? targetWidth / Math.max(sourceWidth, 1)
        : targetHeight / Math.max(sourceHeight, 1);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

function getSeededRotation(maxDegrees: number, seedKey: string) {
  if (maxDegrees <= 0) return 0;
  const rng = mulberry32(hashToSeed(seedKey));
  return ((rng.next() * 2 - 1) * maxDegrees * Math.PI) / 180;
}

function applySvgMirror(
  context: RenderContext,
  mode: LayerRenderProject["svgGeometry"]["mirrorMode"],
  x: number,
  y: number,
  width: number,
  height: number,
  alternate = false,
) {
  const mirrorX = mode === "x" || (mode === "alternate" && alternate);
  const mirrorY = mode === "y";
  if (!mirrorX && !mirrorY) return;

  context.translate(x + width / 2, y + height / 2);
  context.scale(mirrorX ? -1 : 1, mirrorY ? -1 : 1);
  context.translate(-(x + width / 2), -(y + height / 2));
}

function drawSvgTile(
  context: RenderContext,
  image: HTMLImageElement,
  project: LayerRenderProject,
  rect: RenderRect,
  seedKey: string,
  alternate = false,
) {
  const rotation = getSeededRotation(
    project.svgGeometry.randomRotation,
    seedKey,
  );

  context.save();
  context.translate(rect.x + rect.width / 2, rect.y + rect.height / 2);
  context.rotate(rotation);
  context.translate(-(rect.x + rect.width / 2), -(rect.y + rect.height / 2));
  applySvgMirror(
    context,
    project.svgGeometry.mirrorMode,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    alternate,
  );
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  context.restore();
}

function drawSvgMaskBitmap(
  context: RenderContext,
  image: HTMLImageElement,
  project: LayerRenderProject,
  width: number,
  height: number,
  seedKey: string,
) {
  const padding = clamp(project.svgGeometry.padding, 0, 0.45);
  const contentX = width * padding;
  const contentY = height * padding;
  const contentWidth = Math.max(1, width - contentX * 2);
  const contentHeight = Math.max(1, height - contentY * 2);

  if (!project.svgGeometry.repeatEnabled) {
    const fitRect = getFitRect(
      project.svgGeometry.fit,
      image.naturalWidth || image.width,
      image.naturalHeight || image.height,
      contentWidth,
      contentHeight,
    );
    drawSvgTile(
      context,
      image,
      project,
      {
        x: contentX + fitRect.x,
        y: contentY + fitRect.y,
        width: fitRect.width,
        height: fitRect.height,
      },
      seedKey,
    );
    return;
  }

  const baseSize = Math.max(1, Math.min(contentWidth, contentHeight));
  const tileSize = Math.max(1, baseSize * clamp(project.svgGeometry.repeatScale, 0.08, 1));
  const gap = baseSize * clamp(project.svgGeometry.repeatGap, 0, 0.8);
  const stride = Math.max(1, tileSize + gap);
  const columns = Math.ceil(contentWidth / stride) + 2;
  const rows = Math.ceil(contentHeight / stride) + 2;
  const startX = contentX - stride;
  const startY = contentY - stride;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = startX + column * stride;
      const y = startY + row * stride;
      const fitRect = getFitRect(
        project.svgGeometry.fit,
        image.naturalWidth || image.width,
        image.naturalHeight || image.height,
        tileSize,
        tileSize,
      );
      drawSvgTile(
        context,
        image,
        project,
        {
          x: x + fitRect.x,
          y: y + fitRect.y,
          width: fitRect.width,
          height: fitRect.height,
        },
        `${seedKey}:${row}:${column}`,
        (row + column) % 2 === 1,
      );
    }
  }
}

function applyAlphaThreshold(
  imageData: ImageData,
  threshold: number,
  invert: boolean,
) {
  const data = imageData.data;
  const thresholdValue = clamp(threshold, 0, 1) * 255;

  for (let index = 0; index < data.length; index += 4) {
    const sourceAlpha = data[index + 3] ?? 0;
    const alpha = invert ? 255 - sourceAlpha : sourceAlpha;
    const solidAlpha = alpha > thresholdValue ? 255 : 0;
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = solidAlpha;
  }
}

function applyMorphologyToAlpha(
  imageData: ImageData,
  width: number,
  height: number,
  amount: number,
) {
  const radius = Math.min(32, Math.round(Math.abs(amount)));
  if (radius === 0) return;

  const grow = amount > 0;
  const source = imageData.data;
  const horizontal = new Uint8ClampedArray(width * height);
  const output = new Uint8ClampedArray(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = grow ? 0 : 255;
      for (
        let sampleX = Math.max(0, x - radius);
        sampleX <= Math.min(width - 1, x + radius);
        sampleX += 1
      ) {
        const alpha = source[(y * width + sampleX) * 4 + 3] ?? 0;
        value = grow ? Math.max(value, alpha) : Math.min(value, alpha);
      }
      horizontal[y * width + x] = value;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = grow ? 0 : 255;
      for (
        let sampleY = Math.max(0, y - radius);
        sampleY <= Math.min(height - 1, y + radius);
        sampleY += 1
      ) {
        const alpha = horizontal[sampleY * width + x] ?? 0;
        value = grow ? Math.max(value, alpha) : Math.min(value, alpha);
      }
      output[y * width + x] = value;
    }
  }

  for (let index = 0; index < output.length; index += 1) {
    source[index * 4 + 3] = output[index]!;
  }
}

async function createSvgMaskCanvas(
  project: LayerRenderProject,
  width: number,
  height: number,
  seedKey: string,
) {
  const { markup } = project.svgGeometry;
  if (!markup) return null;

  const cacheKey = getSvgMaskCacheKey(project, width, height, seedKey);
  if (!svgMaskCanvasCache.has(cacheKey)) {
    svgMaskCanvasCache.set(
      cacheKey,
      (async () => {
        const image = await loadSvgImage(markup);
        const canvas = createRenderCanvas(width, height);
        const context = getRenderContext(canvas);
        drawSvgMaskBitmap(context, image, project, width, height, seedKey);
        const imageData = context.getImageData(0, 0, width, height);
        applyAlphaThreshold(
          imageData,
          project.svgGeometry.threshold,
          project.svgGeometry.invert,
        );
        applyMorphologyToAlpha(
          imageData,
          width,
          height,
          project.svgGeometry.morphology,
        );
        context.putImageData(imageData, 0, 0);
        return canvas;
      })(),
    );
    if (svgMaskCanvasCache.size > SVG_MASK_CACHE_LIMIT) {
      const oldestKey = svgMaskCanvasCache.keys().next().value;
      if (oldestKey) {
        svgMaskCanvasCache.delete(oldestKey);
      }
    }
  }

  return svgMaskCanvasCache.get(cacheKey)!;
}

function orderWordsAssets(
  project: LayerRenderProject,
  assets: SourceAsset[],
) {
  if (assets.length < 2) {
    return [...assets];
  }

  if (project.sourceMapping.strategy === "round-robin") {
    return [...assets];
  }

  if (project.sourceMapping.strategy === "tone-map") {
    const multiplier = project.sourceMapping.luminanceSort === "ascending" ? 1 : -1;
    return [...assets].sort((left, right) => multiplier * (left.luminance - right.luminance));
  }

  if (project.sourceMapping.strategy === "contrast") {
    return [...assets].sort((left, right) => {
      const paletteDelta = right.palette.length - left.palette.length;
      return paletteDelta !== 0 ? paletteDelta : right.luminance - left.luminance;
    });
  }

  const shuffled = [...assets];
  const rng = mulberry32(hashToSeed(`${project.activeSeed}:words:asset-order`));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng.next() * (index + 1));
    const current = shuffled[index]!;
    shuffled[index] = shuffled[swapIndex]!;
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

function createWordsImageFillCanvas(
  project: LayerRenderProject,
  assets: SourceAsset[],
  bitmaps: Map<string, AssetBitmapEntry>,
) {
  const maskCanvas = createWordsTextCanvas(project, "#ffffff");
  if (!maskCanvas) {
    return null;
  }

  const orderedAssets = orderWordsAssets(project, assets).filter((asset) =>
    bitmaps.has(asset.id),
  );
  if (orderedAssets.length === 0) {
    return null;
  }

  const fillCanvas = createRenderCanvas(project.canvas.width, project.canvas.height);
  const fillContext = getRenderContext(fillCanvas);
  const bandWidth = project.canvas.width / orderedAssets.length;

  orderedAssets.forEach((asset, index) => {
    const bitmap = bitmaps.get(asset.id)?.bitmap;
    if (!bitmap) return;
    fillContext.drawImage(
      bitmap,
      index * bandWidth,
      0,
      Math.ceil(bandWidth),
      project.canvas.height,
    );
  });

  fillContext.globalCompositeOperation = "destination-in";
  fillContext.drawImage(maskCanvas, 0, 0);

  return fillCanvas;
}

function applySliceFogOverlay(
  context: RenderContext,
  project: LayerRenderProject,
  fogAmount: number,
  rect: RenderRect,
) {
  if (fogAmount <= 0) {
    return;
  }

  context.fillStyle = withAlpha(
    project.canvas.background,
    Math.min(0.36, fogAmount),
  );
  context.fillRect(rect.x, rect.y, rect.width, rect.height);
}

function renderTextSliceSurface(
  slice: RenderSlice,
  bitmap: ImageBitmap,
  asset: SourceAsset,
  project: LayerRenderProject,
) {
  const targetRect = slice.imageRect ?? slice.rect;
  const width = Math.max(1, Math.ceil(targetRect.width));
  const height = Math.max(1, Math.ceil(targetRect.height));
  const surface = createRenderCanvas(width, height);
  const surfaceContext = getRenderContext(surface);
  const { sourceX, sourceY, sourceWidth, sourceHeight } = getSourceRect(
    slice,
    asset,
    project,
  );
  const maskCanvas = createTextCanvas(
    project.words,
    "#ffffff",
    { x: 0, y: 0, width, height },
    { x: 0, y: 0, width, height },
  );

  if (!maskCanvas) {
    return surface;
  }

  surfaceContext.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
  surfaceContext.globalCompositeOperation = "destination-in";
  surfaceContext.drawImage(maskCanvas, 0, 0);
  surfaceContext.globalCompositeOperation = "source-over";
  applySliceFogOverlay(
    surfaceContext,
    project,
    slice.fogAmount,
    { x: 0, y: 0, width, height },
  );

  return surface;
}

async function renderSvgSliceSurface(
  slice: RenderSlice,
  bitmap: ImageBitmap,
  asset: SourceAsset,
  project: LayerRenderProject,
) {
  const targetRect = slice.imageRect ?? slice.rect;
  const width = Math.max(1, Math.ceil(targetRect.width));
  const height = Math.max(1, Math.ceil(targetRect.height));
  const surface = createRenderCanvas(width, height);
  const surfaceContext = getRenderContext(surface);
  const { sourceX, sourceY, sourceWidth, sourceHeight } = getSourceRect(
    slice,
    asset,
    project,
  );
  const maskCanvas = await createSvgMaskCanvas(
    project,
    width,
    height,
    `${project.activeSeed}:${slice.id}`,
  );

  if (!maskCanvas) {
    return surface;
  }

  surfaceContext.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
  surfaceContext.globalCompositeOperation = "destination-in";
  surfaceContext.drawImage(maskCanvas, 0, 0);
  surfaceContext.globalCompositeOperation = "source-over";
  applySliceFogOverlay(
    surfaceContext,
    project,
    slice.fogAmount,
    { x: 0, y: 0, width, height },
  );

  return surface;
}

function drawWordsCanvas(
  context: RenderContext,
  project: LayerRenderProject,
  contentCanvas: RenderCanvas,
) {
  context.save();
  context.globalAlpha = clamp(project.compositing.opacity, 0, 1);
  context.globalCompositeOperation = project.compositing.blendMode;
  context.filter = `blur(${project.effects.blur}px)`;
  context.drawImage(contentCanvas, 0, 0);
  context.restore();
}

async function renderWordsLayer(
  project: LayerRenderProject,
  assets: SourceAsset[],
  bitmaps: Map<string, AssetBitmapEntry>,
  context: RenderContext,
  canvas: RenderCanvas,
) {
  const contentCanvas =
    project.words.mode === "plain-text"
      ? createWordsTextCanvas(project, project.words.textColor)
      : createWordsImageFillCanvas(project, assets, bitmaps);

  if (!contentCanvas) {
    return;
  }

  const kaleidoscopeSourceCanvas =
    project.effects.kaleidoscopeSegments > 1
      ? createRenderCanvas(project.canvas.width, project.canvas.height)
      : null;
  const kaleidoscopeSourceContext = kaleidoscopeSourceCanvas
    ? getRenderContext(kaleidoscopeSourceCanvas)
    : null;

  drawWordsCanvas(context, project, contentCanvas);
  if (kaleidoscopeSourceContext) {
    drawWordsCanvas(kaleidoscopeSourceContext, project, contentCanvas);
  }

  if (kaleidoscopeSourceCanvas) {
    applyKaleidoscope(context, kaleidoscopeSourceCanvas, project);
  }

  applySharpen(context, canvas, project.effects.sharpen);
}

async function loadBitmap(blob: Blob) {
  if (!bitmapCache.has(blob)) {
    bitmapCache.set(blob, createImageBitmap(blob));
  }
  return bitmapCache.get(blob)!;
}

export function disposeBitmapMap(bitmaps: Map<string, AssetBitmapEntry>) {
  for (const entry of bitmaps.values()) {
    entry.bitmap.close();
  }
}

function drawShapePath(
  context: RenderContext,
  slice: RenderSlice,
  project: LayerRenderProject,
) {
  const bounds = slice.clipRect ?? slice.rect;
  const { x, y, width, height } = bounds;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  context.beginPath();

  if (slice.clipPathPoints && slice.clipPathPoints.length > 2) {
    const [firstPoint, ...remainingPoints] = slice.clipPathPoints;
    context.moveTo(firstPoint!.x, firstPoint!.y);
    for (const point of remainingPoints) {
      context.lineTo(point.x, point.y);
    }
    context.closePath();
    return;
  }

  if (slice.shape === "triangle" || slice.shape === "interlock") {
    context.moveTo(centerX, y);
    context.lineTo(x + width, y + height);
    context.lineTo(x, y + height);
    context.closePath();
    return;
  }

  if (slice.shape === "ring") {
    const outerRadius = Math.min(width, height) / 2;
    const innerRadius = outerRadius * getHollowRatio(project);
    context.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    if (innerRadius > 0.0001) {
      context.moveTo(centerX + innerRadius, centerY);
      context.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, true);
    }
    return;
  }

  if (slice.shape === "blob") {
    const pointCount = 16;
    const radiusX = width / 2;
    const radiusY = height / 2;
    for (let index = 0; index <= pointCount; index += 1) {
      const theta = (Math.PI * 2 * index) / pointCount;
      const radiusScale =
        1 +
        0.14 * Math.sin(theta * 2 + 0.7) +
        0.09 * Math.cos(theta * 3 + 1.9);
      const point = {
        x: centerX + Math.cos(theta) * radiusX * radiusScale,
        y: centerY + Math.sin(theta) * radiusY * radiusScale,
      };

      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    }
    context.closePath();
    return;
  }

  if (slice.shape === "wedge" || slice.shape === "arc") {
    const radius = Math.min(width, height) / 2;
    const sweepRadians = slice.wedgeSweepRadians ?? Math.PI / 3;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + sweepRadians;

    if (sweepRadians >= FULL_CIRCLE_RADIANS - 0.0001) {
      context.arc(centerX, centerY, radius, 0, FULL_CIRCLE_RADIANS);
      if (slice.shape === "arc") {
        const innerRadius = radius * getHollowRatio(project);
        if (innerRadius > 0.0001) {
          context.moveTo(centerX + innerRadius, centerY);
          context.arc(centerX, centerY, innerRadius, 0, FULL_CIRCLE_RADIANS, true);
        }
      } else {
        context.closePath();
      }
      if (slice.shape === "arc") return;
      context.closePath();
      return;
    }

    if (slice.shape === "arc") {
      const innerRadius = radius * getHollowRatio(project);
      context.arc(centerX, centerY, radius, startAngle, endAngle);
      if (innerRadius > 0.0001) {
        context.lineTo(
          centerX + Math.cos(endAngle) * innerRadius,
          centerY + Math.sin(endAngle) * innerRadius,
        );
        context.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      } else {
        context.lineTo(centerX, centerY);
      }
    } else {
      context.moveTo(centerX, centerY);
      context.arc(centerX, centerY, radius, startAngle, endAngle);
    }
    context.closePath();
    return;
  }

  const maxRadius = Math.min(width, height) / 2;
  const radius = clamp(project.layout.rectCornerRadius * maxRadius, 0, maxRadius);
  context.roundRect(x, y, width, height, radius);
}

function clipSliceToInsetArea(
  context: RenderContext,
  slice: RenderSlice,
  project: LayerRenderProject,
) {
  if (slice.shape !== "interlock") return;

  context.beginPath();
  context.rect(
    project.canvas.inset,
    project.canvas.inset,
    project.canvas.width - project.canvas.inset * 2,
    project.canvas.height - project.canvas.inset * 2,
  );
  context.clip();
}

function getSourceRect(
  slice: RenderSlice,
  asset: SourceAsset,
  project: LayerRenderProject,
) {
  const targetRect = slice.imageRect ?? slice.rect;
  if (slice.sourceCrop) {
    return {
      sourceX: slice.sourceCrop.x * asset.width,
      sourceY: slice.sourceCrop.y * asset.height,
      sourceWidth: slice.sourceCrop.width * asset.width,
      sourceHeight: slice.sourceCrop.height * asset.height,
    };
  }

  const zoom = project.sourceMapping.cropZoom;
  const assetRatio = asset.width / asset.height;
  const rectRatio = targetRect.width / targetRect.height;
  let sourceWidth = asset.width;
  let sourceHeight = asset.height;
  let sourceX = 0;
  let sourceY = 0;

  const preserveAspect =
    asset.kind === "image"
      ? asset.fitMode === "natural"
      : project.sourceMapping.preserveAspect;

  if (preserveAspect) {
    if (assetRatio > rectRatio) {
      sourceHeight = asset.height;
      sourceWidth = sourceHeight * rectRatio;
      sourceX = (asset.width - sourceWidth) / 2;
    } else {
      sourceWidth = asset.width;
      sourceHeight = sourceWidth / rectRatio;
      sourceY = (asset.height - sourceHeight) / 2;
    }
  }

  const cropCenterX = sourceX + sourceWidth / 2;
  const cropCenterY = sourceY + sourceHeight / 2;
  sourceWidth /= zoom;
  sourceHeight /= zoom;
  sourceX = clamp(cropCenterX - sourceWidth / 2, 0, asset.width - sourceWidth);
  sourceY = clamp(cropCenterY - sourceHeight / 2, 0, asset.height - sourceHeight);

  return {
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
  };
}

function solveAffineTransform(
  source: [TrianglePoint, TrianglePoint, TrianglePoint],
  destination: [TrianglePoint, TrianglePoint, TrianglePoint],
) {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const denominator =
    s0.x * (s1.y - s2.y) +
    s1.x * (s2.y - s0.y) +
    s2.x * (s0.y - s1.y);

  if (Math.abs(denominator) < 0.0001) {
    return null;
  }

  const a =
    (d0.x * (s1.y - s2.y) +
      d1.x * (s2.y - s0.y) +
      d2.x * (s0.y - s1.y)) /
    denominator;
  const b =
    (d0.y * (s1.y - s2.y) +
      d1.y * (s2.y - s0.y) +
      d2.y * (s0.y - s1.y)) /
    denominator;
  const c =
    (d0.x * (s2.x - s1.x) +
      d1.x * (s0.x - s2.x) +
      d2.x * (s1.x - s0.x)) /
    denominator;
  const d =
    (d0.y * (s2.x - s1.x) +
      d1.y * (s0.x - s2.x) +
      d2.y * (s1.x - s0.x)) /
    denominator;
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denominator;
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denominator;

  return { a, b, c, d, e, f };
}

function drawCanvasTriangle(
  context: RenderContext,
  sourceCanvas: RenderCanvas,
  source: [TrianglePoint, TrianglePoint, TrianglePoint],
  destination: [TrianglePoint, TrianglePoint, TrianglePoint],
) {
  const transform = solveAffineTransform(source, destination);
  if (!transform) return;

  context.save();
  context.beginPath();
  context.moveTo(destination[0].x, destination[0].y);
  context.lineTo(destination[1].x, destination[1].y);
  context.lineTo(destination[2].x, destination[2].y);
  context.closePath();
  context.clip();
  context.transform(
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f,
  );
  context.drawImage(sourceCanvas, 0, 0);
  context.restore();
}

function degToRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function rotateLayerPoint3D(
  point: Point3D,
  rotateX: number,
  rotateY: number,
  rotateZ: number,
): Point3D {
  const cosX = Math.cos(rotateX);
  const sinX = Math.sin(rotateX);
  const xRotated = {
    x: point.x,
    y: point.y * cosX - point.z * sinX,
    z: point.y * sinX + point.z * cosX,
  };
  const cosY = Math.cos(rotateY);
  const sinY = Math.sin(rotateY);
  const yRotated = {
    x: xRotated.x * cosY + xRotated.z * sinY,
    y: xRotated.y,
    z: -xRotated.x * sinY + xRotated.z * cosY,
  };
  const cosZ = Math.cos(rotateZ);
  const sinZ = Math.sin(rotateZ);

  return {
    x: yRotated.x * cosZ - yRotated.y * sinZ,
    y: yRotated.x * sinZ + yRotated.y * cosZ,
    z: yRotated.z,
  };
}

function hasActiveLayer3D(project: LayerRenderProject) {
  return project.finish.layer3DEnabled;
}

function getLayer3DProjectedCorners(project: LayerRenderProject) {
  const { finish, canvas } = project;
  const width = canvas.width;
  const height = canvas.height;
  const minDimension = Math.max(1, Math.min(width, height));
  const pivot = {
    x: clamp(finish.layer3DPivotX, 0, 1) * width,
    y: clamp(finish.layer3DPivotY, 0, 1) * height,
  };
  const pan = {
    x: clamp(finish.layer3DPanX, -1, 1) * width,
    y: clamp(finish.layer3DPanY, -1, 1) * height,
  };
  const scale = clamp(finish.layer3DScale, 0.05, 3);
  const cameraDistance = minDimension * (0.65 + clamp(finish.layer3DCameraDistance, 0, 1) * 4.35);
  const perspective = clamp(finish.layer3DPerspective, 0, 1);
  const zOffset = clamp(finish.layer3DDepth, -1, 1) * minDimension;
  const rotateX = degToRad(clamp(finish.layer3DRotateX, -89, 89));
  const rotateY = degToRad(clamp(finish.layer3DRotateY, -89, 89));
  const rotateZ = degToRad(clamp(finish.layer3DRotateZ, -180, 180));
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  return corners.map((corner) => {
    const localPoint = {
      x: (corner.x - pivot.x) * scale,
      y: (corner.y - pivot.y) * scale,
      z: 0,
    };
    const rotated = rotateLayerPoint3D(localPoint, rotateX, rotateY, rotateZ);
    const effectiveZ = (rotated.z - zOffset) * perspective;
    const safeDepth = Math.max(cameraDistance + effectiveZ, cameraDistance * 0.12);
    const projectionScale = cameraDistance / safeDepth;

    return {
      x: pivot.x + pan.x + rotated.x * projectionScale,
      y: pivot.y + pan.y + rotated.y * projectionScale,
    };
  }) as [TrianglePoint, TrianglePoint, TrianglePoint, TrianglePoint];
}

function applyLayer3DTransform(
  sourceCanvas: RenderCanvas,
  project: LayerRenderProject,
) {
  if (!hasActiveLayer3D(project)) {
    return sourceCanvas;
  }

  const transformedCanvas = createRenderCanvas(sourceCanvas.width, sourceCanvas.height);
  const transformedContext = getRenderContext(transformedCanvas);
  const [p0, p1, p2, p3] = getLayer3DProjectedCorners(project);
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  drawCanvasTriangle(
    transformedContext,
    sourceCanvas,
    [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
    ],
    [p0, p1, p2],
  );
  drawCanvasTriangle(
    transformedContext,
    sourceCanvas,
    [
      { x: 0, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    [p0, p2, p3],
  );

  return transformedCanvas;
}

async function renderSliceSurface(
  slice: RenderSlice,
  bitmap: ImageBitmap,
  asset: SourceAsset,
  project: LayerRenderProject,
) {
  if (slice.shape === "text") {
    return renderTextSliceSurface(slice, bitmap, asset, project);
  }

  if (slice.shape === "svg") {
    return renderSvgSliceSurface(slice, bitmap, asset, project);
  }

  const width = Math.max(1, Math.ceil(slice.rect.width));
  const height = Math.max(1, Math.ceil(slice.rect.height));
  const surface = createRenderCanvas(width, height);
  const surfaceContext = getRenderContext(surface);
  const { sourceX, sourceY, sourceWidth, sourceHeight } = getSourceRect(
    slice,
    asset,
    project,
  );
  const localSlice: RenderSlice = {
    ...slice,
    rect: { x: 0, y: 0, width, height },
    clipRect: null,
    clipPathPoints: null,
    quadPoints: null,
    clipRotation: 0,
    imageRect: null,
    rotation: 0,
    rotationX: 0,
    rotationY: 0,
    scale: 1,
    displacementOffset: { x: 0, y: 0 },
    distortion: 0,
    mirrorAxis: "none",
  };

  surfaceContext.save();
  drawShapePath(surfaceContext, localSlice, project);
  surfaceContext.clip("evenodd");
  surfaceContext.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
  applySliceFogOverlay(
    surfaceContext,
    project,
    slice.fogAmount,
    { x: 0, y: 0, width, height },
  );
  surfaceContext.restore();

  return surface;
}

async function drawWarpedSlice(
  context: RenderContext,
  slice: RenderSlice,
  bitmap: ImageBitmap,
  asset: SourceAsset,
  project: LayerRenderProject,
) {
  if (!slice.quadPoints || slice.quadPoints.length !== 4) {
    return false;
  }

  const surface = await renderSliceSurface(slice, bitmap, asset, project);
  const width = surface.width;
  const height = surface.height;
  const [p0, p1, p2, p3] = slice.quadPoints as [
    TrianglePoint,
    TrianglePoint,
    TrianglePoint,
    TrianglePoint,
  ];
  const displacement = slice.displacementOffset;
  const destinationPoints: [TrianglePoint, TrianglePoint, TrianglePoint, TrianglePoint] = [
    { x: p0.x + displacement.x, y: p0.y + displacement.y },
    { x: p1.x + displacement.x, y: p1.y + displacement.y },
    { x: p2.x + displacement.x, y: p2.y + displacement.y },
    { x: p3.x + displacement.x, y: p3.y + displacement.y },
  ];

  drawCanvasTriangle(
    context,
    surface,
    [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
    ],
    [destinationPoints[0], destinationPoints[1], destinationPoints[2]],
  );
  drawCanvasTriangle(
    context,
    surface,
    [
      { x: 0, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    [destinationPoints[0], destinationPoints[2], destinationPoints[3]],
  );

  return true;
}

function applySharpen(
  context: RenderContext,
  canvas: RenderCanvas,
  amount: number,
) {
  if (amount <= 0) return;
  const width = canvas.width;
  const height = canvas.height;
  const source = context.getImageData(0, 0, width, height);
  const output = context.createImageData(width, height);
  const kernel = [0, -1, 0, -1, 5 + amount * 2, -1, 0, -1, 0];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      for (let channel = 0; channel < 4; channel += 1) {
        let sum = 0;
        let kernelIndex = 0;
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const index = ((y + ky) * width + (x + kx)) * 4 + channel;
            sum += source.data[index]! * kernel[kernelIndex]!;
            kernelIndex += 1;
          }
        }
        output.data[(y * width + x) * 4 + channel] = clamp(sum, 0, 255);
      }
    }
  }

  context.putImageData(output, 0, 0);
}

function hasActiveFinish(project: LayerRenderProject) {
  const { finish } = project;
  return (
    finish.shadowOpacity > 0 ||
    finish.shadowBlur > 0 ||
    finish.shadowOffsetX !== 0 ||
    finish.shadowOffsetY !== 0 ||
    hasActiveLayer3D(project) ||
    finish.brightness !== DEFAULT_FINISH.brightness ||
    finish.contrast !== DEFAULT_FINISH.contrast ||
    finish.saturate !== DEFAULT_FINISH.saturate ||
    finish.hueRotate !== DEFAULT_FINISH.hueRotate ||
    finish.grayscale !== DEFAULT_FINISH.grayscale ||
    finish.invert !== DEFAULT_FINISH.invert ||
    finish.noise > 0 ||
    finish.noiseMonochrome > 0
  );
}

function hasColorAdjustments(project: LayerRenderProject) {
  const { finish } = project;
  return (
    finish.brightness !== DEFAULT_FINISH.brightness ||
    finish.contrast !== DEFAULT_FINISH.contrast ||
    finish.saturate !== DEFAULT_FINISH.saturate ||
    finish.hueRotate !== DEFAULT_FINISH.hueRotate ||
    finish.grayscale !== DEFAULT_FINISH.grayscale ||
    finish.invert !== DEFAULT_FINISH.invert
  );
}

function buildFinishFilter(project: LayerRenderProject) {
  const { finish } = project;
  return [
    `brightness(${Math.max(0, finish.brightness) * 100}%)`,
    `contrast(${Math.max(0, finish.contrast) * 100}%)`,
    `saturate(${Math.max(0, finish.saturate) * 100}%)`,
    `hue-rotate(${finish.hueRotate}deg)`,
    `grayscale(${clamp(finish.grayscale, 0, 1) * 100}%)`,
    `invert(${clamp(finish.invert, 0, 1) * 100}%)`,
  ].join(" ");
}

function applyLayerColorAdjustments(
  sourceCanvas: RenderCanvas,
  project: LayerRenderProject,
) {
  if (!hasColorAdjustments(project)) {
    return sourceCanvas;
  }

  const finishedCanvas = createRenderCanvas(sourceCanvas.width, sourceCanvas.height);
  const finishedContext = getRenderContext(finishedCanvas);
  finishedContext.filter = buildFinishFilter(project);
  finishedContext.drawImage(sourceCanvas, 0, 0);
  finishedContext.filter = "none";
  return finishedCanvas;
}

function hashNoiseSample(
  baseSeed: number,
  x: number,
  y: number,
  channelTag: number,
) {
  let hash = baseSeed >>> 0;
  hash ^= Math.imul((x + 1) >>> 0, 0x9e3779b1);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash ^= Math.imul((y + 1) >>> 0, 0xc2b2ae35);
  hash = Math.imul(hash ^ (hash >>> 13), 0x27d4eb2d);
  hash ^= Math.imul((channelTag + 1) >>> 0, 0x165667b1);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 4294967296;
}

function applyFinishNoise(
  sourceCanvas: RenderCanvas,
  project: LayerRenderProject,
  layerId: string,
) {
  const colorNoiseStrength = clamp(project.finish.noise, 0, 1);
  const monochromeNoiseStrength = clamp(project.finish.noiseMonochrome, 0, 1);

  if (colorNoiseStrength <= 0 && monochromeNoiseStrength <= 0) {
    return sourceCanvas;
  }

  const context = getRenderContext(sourceCanvas);
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;
  const baseSeed = hashToSeed(`${project.activeSeed}:${layerId}:finish-noise`);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3] ?? 0;
      if (alpha === 0) continue;

      const alphaFactor = alpha / 255;
      const monochromeDelta =
        (hashNoiseSample(baseSeed, x, y, 0) * 2 - 1) *
        monochromeNoiseStrength *
        MAX_MONO_NOISE_DELTA;
      const redDelta =
        ((hashNoiseSample(baseSeed, x, y, 1) * 2 - 1) *
          colorNoiseStrength *
          MAX_RGB_NOISE_DELTA +
          monochromeDelta) *
        alphaFactor;
      const greenDelta =
        ((hashNoiseSample(baseSeed, x, y, 2) * 2 - 1) *
          colorNoiseStrength *
          MAX_RGB_NOISE_DELTA +
          monochromeDelta) *
        alphaFactor;
      const blueDelta =
        ((hashNoiseSample(baseSeed, x, y, 3) * 2 - 1) *
          colorNoiseStrength *
          MAX_RGB_NOISE_DELTA +
          monochromeDelta) *
        alphaFactor;

      data[index] = clamp((data[index] ?? 0) + redDelta, 0, 255);
      data[index + 1] = clamp((data[index + 1] ?? 0) + greenDelta, 0, 255);
      data[index + 2] = clamp((data[index + 2] ?? 0) + blueDelta, 0, 255);
    }
  }

  context.putImageData(imageData, 0, 0);
  return sourceCanvas;
}

function getLayerContentPixelOffset(project: LayerRenderProject) {
  const ox = clamp(project.layout.offsetX, -1, 1) * project.canvas.width;
  const oy = clamp(project.layout.offsetY, -1, 1) * project.canvas.height;
  return { ox, oy };
}

/** T(ox,oy)·T(cx,cy)·R(θ)·T(-cx,-cy): rotate whole layer about canvas center, then shift by offset. */
function applyLayerContentPositionTransform(
  context: RenderContext,
  project: LayerRenderProject,
) {
  const { ox, oy } = getLayerContentPixelOffset(project);
  const deg = clamp(project.layout.contentRotation, 0, 360) % 360;
  if (deg === 0) {
    context.translate(ox, oy);
    return;
  }
  const cx = project.canvas.width / 2;
  const cy = project.canvas.height / 2;
  const radians = (deg * Math.PI) / 180;
  context.translate(ox, oy);
  context.translate(cx, cy);
  context.rotate(radians);
  context.translate(-cx, -cy);
}

function compositeFinishedLayer(
  context: RenderContext,
  layerCanvas: RenderCanvas,
  project: LayerRenderProject,
) {
  const transformedLayerCanvas = applyLayer3DTransform(layerCanvas, project);

  context.save();
  context.globalCompositeOperation = project.compositing.blendMode;
  context.globalAlpha = clamp(project.compositing.opacity, 0, 1);

  if (project.finish.shadowOpacity > 0) {
    context.shadowColor = withAlpha(
      project.finish.shadowColor,
      clamp(project.finish.shadowOpacity, 0, 1),
    );
    context.shadowBlur = Math.max(0, project.finish.shadowBlur);
    context.shadowOffsetX = project.finish.shadowOffsetX;
    context.shadowOffsetY = project.finish.shadowOffsetY;
  } else {
    context.shadowColor = "rgba(0, 0, 0, 0)";
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
  }

  if (!hasActiveLayer3D(project)) {
    applyLayerContentPositionTransform(context, project);
  }
  context.drawImage(transformedLayerCanvas, 0, 0);
  context.restore();
}

async function drawSlice(
  context: RenderContext,
  slice: RenderSlice,
  bitmap: ImageBitmap,
  asset: SourceAsset,
  project: LayerRenderProject,
) {
  const targetRect = slice.imageRect ?? slice.rect;
  const { x, y, width, height } = targetRect;
  const bounds = slice.clipRect ?? slice.rect;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const { sourceX, sourceY, sourceWidth, sourceHeight } = getSourceRect(slice, asset, project);
  const planeScaleX = Math.max(0.22, Math.cos(slice.rotationY));
  const planeScaleY = Math.max(0.22, Math.cos(slice.rotationX));
  const scaleX =
    slice.scale * planeScaleX * (slice.mirrorAxis === "x" ? -1 : 1);
  const scaleY =
    slice.scale * planeScaleY * (slice.mirrorAxis === "y" ? -1 : 1);

  context.save();
  context.globalAlpha = slice.opacity;
  context.globalCompositeOperation = slice.blendMode;
  context.filter = `blur(${project.effects.blur}px)`;

  if (await drawWarpedSlice(context, slice, bitmap, asset, project)) {
    context.restore();
    return;
  }

  if (slice.shape === "text" || slice.shape === "svg") {
    const surface =
      slice.shape === "text"
        ? renderTextSliceSurface(slice, bitmap, asset, project)
        : await renderSvgSliceSurface(slice, bitmap, asset, project);

    context.save();
    context.translate(centerX, centerY);
    context.rotate(slice.rotation + slice.clipRotation);
    context.scale(scaleX, scaleY);
    context.translate(-centerX, -centerY);
    context.drawImage(
      surface,
      x + slice.displacementOffset.x,
      y + slice.displacementOffset.y,
      width * (1 + slice.distortion),
      height * (1 + slice.distortion),
    );
    context.restore();

    context.restore();
    return;
  }

  context.save();
  clipSliceToInsetArea(context, slice, project);
  context.translate(centerX, centerY);
  context.rotate(slice.rotation + slice.clipRotation);
  context.scale(scaleX, scaleY);
  context.translate(-centerX, -centerY);
  drawShapePath(context, slice, project);
  context.clip("evenodd");
  context.translate(centerX, centerY);
  context.rotate(-slice.clipRotation);
  context.translate(-centerX, -centerY);
  context.drawImage(
    bitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x + slice.displacementOffset.x,
    y + slice.displacementOffset.y,
    width * (1 + slice.distortion),
    height * (1 + slice.distortion),
  );
  applySliceFogOverlay(
    context,
    project,
    slice.fogAmount,
    {
      x: x + slice.displacementOffset.x,
      y: y + slice.displacementOffset.y,
      width: width * (1 + slice.distortion),
      height: height * (1 + slice.distortion),
    },
  );
  context.restore();

  context.restore();
}

function drawBackground(
  context: RenderContext,
  project: ProjectDocument,
) {
  context.fillStyle = withAlpha(
    project.canvas.background,
    project.canvas.backgroundAlpha,
  );
  context.fillRect(0, 0, project.canvas.width, project.canvas.height);
}

function clearCanvas(
  context: RenderContext,
  width: number,
  height: number,
) {
  if (typeof context.clearRect === "function") {
    context.clearRect(0, 0, width, height);
  }
}

function resolveLayerAssets(
  layer: CompositorLayer,
  assets: SourceAsset[],
) {
  return layer.sourceIds
    .map((sourceId) => assets.find((asset) => asset.id === sourceId))
    .filter((asset): asset is SourceAsset => Boolean(asset));
}

async function renderCompositorLayer(
  project: ProjectDocument,
  layer: CompositorLayer,
  assets: SourceAsset[],
  bitmaps: Map<string, AssetBitmapEntry>,
  context: RenderContext,
  canvas: RenderCanvas,
) {
  const layerProject = createLayerRenderProject(project, layer);
  const layerAssets = resolveLayerAssets(layer, assets);

  // Blend mode and opacity alone should not force isolation when per-object blending is preferred.
  const requiresIsolation =
    hasActiveFinish(layerProject) ||
    layerProject.effects.sharpen > 0;

  if (!requiresIsolation) {
    context.save();
    applyLayerContentPositionTransform(context, layerProject);
    await renderLayer(layerProject, layerAssets, bitmaps, context, canvas);
    context.restore();
    return;
  }

  const neutralLayerProject = createLayerRenderProject(project, {
    ...layer,
    compositing: {
      ...layer.compositing,
      blendMode: "source-over",
      opacity: 1,
    },
  });
  const layerCanvas = createRenderCanvas(
    project.canvas.width,
    project.canvas.height,
  );
  await renderLayerToCanvas(neutralLayerProject, layerAssets, bitmaps, layerCanvas);
  const colorAdjustedLayerCanvas = applyLayerColorAdjustments(layerCanvas, layerProject);
  const finishedLayerCanvas = applyFinishNoise(
    colorAdjustedLayerCanvas,
    layerProject,
    layer.id,
  );
  compositeFinishedLayer(context, finishedLayerCanvas, layerProject);
}

export async function buildBitmapMap(
  assets: SourceAsset[],
  blobLookup: (asset: SourceAsset) => Promise<Blob | null>,
) {
  const entries = await Promise.all(
    assets.map(async (asset) => {
      const blob = await blobLookup(asset);
      if (!blob) return null;
      const bitmap = await loadBitmap(blob);
      return [asset.id, { asset, bitmap }] as const;
    }),
  );

  return new Map<string, AssetBitmapEntry>(entries.filter(Boolean) as [string, AssetBitmapEntry][]);
}

function createRenderCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function getRenderContext(canvas: RenderCanvas) {
  const context = canvas.getContext("2d", RENDER_CONTEXT_OPTIONS);
  if (!context) throw new Error("Unable to acquire a canvas context.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return context;
}

function drawCanvasContained(
  context: RenderContext,
  sourceCanvas: RenderCanvas,
  targetWidth: number,
  targetHeight: number,
) {
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (targetWidth - drawWidth) / 2;
  const offsetY = (targetHeight - drawHeight) / 2;

  context.drawImage(sourceCanvas, offsetX, offsetY, drawWidth, drawHeight);
}

function getKaleidoscopeScaleX(
  mirrorMode: KaleidoscopeMirrorMode,
  segment: number,
) {
  if (mirrorMode === "rotate-only") {
    return 1;
  }

  if (mirrorMode === "mirror-all") {
    return -1;
  }

  return segment % 2 === 0 ? -1 : 1;
}

function applyKaleidoscope(
  context: RenderContext,
  sourceCanvas: RenderCanvas,
  project: LayerRenderProject,
) {
  const { effects } = project;
  if (effects.kaleidoscopeSegments <= 1) {
    return;
  }

  const originX = project.canvas.width * effects.kaleidoscopeCenterX;
  const originY = project.canvas.height * effects.kaleidoscopeCenterY;
  const angleOffset = degreesToRadians(effects.kaleidoscopeAngleOffset);
  const rotationDrift = degreesToRadians(effects.kaleidoscopeRotationDrift);
  const scaleFalloff = clamp(effects.kaleidoscopeScaleFalloff, 0, 1);

  context.save();
  context.globalAlpha = clamp(effects.kaleidoscopeOpacity, 0, 1);
  context.globalCompositeOperation = project.compositing.blendMode;

  for (let segment = 1; segment < effects.kaleidoscopeSegments; segment += 1) {
    const baseAngle = (Math.PI * 2 * segment) / effects.kaleidoscopeSegments;
    const angle = baseAngle + angleOffset + rotationDrift * segment;
    const progress = segment / Math.max(effects.kaleidoscopeSegments - 1, 1);
    const segmentScale = 1 - scaleFalloff * progress;

    context.translate(originX, originY);
    context.rotate(angle);
    context.scale(
      segmentScale * getKaleidoscopeScaleX(effects.kaleidoscopeMirrorMode, segment),
      segmentScale,
    );
    context.translate(-originX, -originY);
    context.drawImage(sourceCanvas, 0, 0);
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  context.restore();
}

function toBlob(
  canvas: RenderCanvas,
  type: string,
  quality?: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to create export blob."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

export async function renderProjectToCanvas(
  project: ProjectDocument,
  assets: SourceAsset[],
  bitmaps: Map<string, AssetBitmapEntry>,
  canvas: RenderCanvas,
  options: RenderOptions = {},
) {
  const normalizedProject = normalizeProjectDocument(
    syncLegacyProjectFieldsToSelectedLayer(project),
  );
  canvas.width = normalizedProject.canvas.width;
  canvas.height = normalizedProject.canvas.height;
  const context = getRenderContext(canvas);

  if (options.includeBackground ?? true) {
    drawBackground(context, normalizedProject);
  } else {
    clearCanvas(
      context,
      normalizedProject.canvas.width,
      normalizedProject.canvas.height,
    );
  }

  const visibleLayers = normalizedProject.layers.filter((layer) => layer.visible);

  for (const layer of visibleLayers) {
    await renderCompositorLayer(
      normalizedProject,
      layer,
      assets,
      bitmaps,
      context,
      canvas,
    );
  }
}

export async function renderProjectLayerToCanvas(
  project: ProjectDocument,
  layer: CompositorLayer,
  assets: SourceAsset[],
  bitmaps: Map<string, AssetBitmapEntry>,
  canvas: RenderCanvas,
  options: RenderOptions = {},
) {
  const normalizedProject = normalizeProjectDocument(
    syncLegacyProjectFieldsToSelectedLayer(project),
  );
  const normalizedLayer =
    normalizedProject.layers.find((entry) => entry.id === layer.id) ?? layer;
  const targetWidth = Math.max(1, canvas.width || normalizedProject.canvas.width);
  const targetHeight = Math.max(1, canvas.height || normalizedProject.canvas.height);
  const renderCanvas =
    targetWidth === normalizedProject.canvas.width &&
      targetHeight === normalizedProject.canvas.height
      ? canvas
      : createRenderCanvas(
        normalizedProject.canvas.width,
        normalizedProject.canvas.height,
      );
  renderCanvas.width = normalizedProject.canvas.width;
  renderCanvas.height = normalizedProject.canvas.height;
  const renderContext = getRenderContext(renderCanvas);

  if (options.includeBackground ?? true) {
    drawBackground(renderContext, normalizedProject);
  } else {
    clearCanvas(
      renderContext,
      normalizedProject.canvas.width,
      normalizedProject.canvas.height,
    );
  }

  await renderCompositorLayer(
    normalizedProject,
    normalizedLayer,
    assets,
    bitmaps,
    renderContext,
    renderCanvas,
  );

  if (renderCanvas === canvas) {
    return;
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const targetContext = getRenderContext(canvas);
  clearCanvas(targetContext, targetWidth, targetHeight);
  drawCanvasContained(targetContext, renderCanvas, targetWidth, targetHeight);
}

async function renderLayer(
  project: LayerRenderProject,
  assets: SourceAsset[],
  bitmaps: Map<string, AssetBitmapEntry>,
  context: RenderContext,
  canvas: RenderCanvas,
) {
  if (project.layout.family === "words") {
    await renderWordsLayer(project, assets, bitmaps, context, canvas);
    return;
  }

  const slices = buildRenderSlices(project, assets);
  const kaleidoscopeSourceCanvas =
    project.effects.kaleidoscopeSegments > 1
      ? createRenderCanvas(project.canvas.width, project.canvas.height)
      : null;
  const kaleidoscopeSourceContext = kaleidoscopeSourceCanvas
    ? getRenderContext(kaleidoscopeSourceCanvas)
    : null;

  for (const slice of slices) {
    const assetBitmap = bitmaps.get(slice.assetId);
    if (!assetBitmap) continue;
    await drawSlice(context, slice, assetBitmap.bitmap, assetBitmap.asset, project);
    if (kaleidoscopeSourceContext) {
      await drawSlice(
        kaleidoscopeSourceContext,
        slice,
        assetBitmap.bitmap,
        assetBitmap.asset,
        project,
      );
    }
  }

  if (kaleidoscopeSourceCanvas) {
    applyKaleidoscope(context, kaleidoscopeSourceCanvas, project);
  }

  applySharpen(context, canvas, project.effects.sharpen);
}

async function renderLayerToCanvas(
  project: LayerRenderProject,
  assets: SourceAsset[],
  bitmaps: Map<string, AssetBitmapEntry>,
  canvas: RenderCanvas,
) {
  canvas.width = project.canvas.width;
  canvas.height = project.canvas.height;
  const context = getRenderContext(canvas);
  await renderLayer(project, assets, bitmaps, context, canvas);
}

export async function exportProjectImage(
  project: ProjectDocument,
  assets: SourceAsset[],
  bitmaps: Map<string, AssetBitmapEntry>,
) {
  const sceneCanvas = createRenderCanvas(project.canvas.width, project.canvas.height);
  const { width, height } = lockExportDimensionsToCanvas(
    project.canvas,
    {
      width: Math.round(project.export.width * project.export.scale),
      height: Math.round(project.export.height * project.export.scale),
    },
    "width",
  );
  await renderProjectToCanvas(project, assets, bitmaps, sceneCanvas, {
    includeBackground: true,
  });
  const exportCanvas = createRenderCanvas(width, height);
  const exportContext = getRenderContext(exportCanvas);
  exportContext.drawImage(sceneCanvas, 0, 0, width, height);

  return toBlob(
    exportCanvas,
    project.export.format === "image/jpeg" ? "image/jpeg" : "image/png",
    project.export.quality,
  );
}
