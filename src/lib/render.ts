import type {
  KaleidoscopeMirrorMode,
  LayerRenderProject,
  ProjectDocument,
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
import { clamp } from "@/lib/utils";

interface AssetBitmapEntry {
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
const FULL_CIRCLE_RADIANS = Math.PI * 2;

const bitmapCache = new WeakMap<Blob, Promise<ImageBitmap>>();
const RENDER_CONTEXT_OPTIONS = {
  alpha: true,
  colorSpace: "srgb",
} as CanvasRenderingContext2DSettings & { colorSpace?: "srgb" };

function getHollowRatio(project: LayerRenderProject) {
  return clamp(project.layout.hollowRatio, 0, 0.95);
}

async function loadBitmap(blob: Blob) {
  if (!bitmapCache.has(blob)) {
    bitmapCache.set(blob, createImageBitmap(blob));
  }
  return bitmapCache.get(blob)!;
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

  if (project.sourceMapping.preserveAspect) {
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

  sourceWidth /= zoom;
  sourceHeight /= zoom;
  sourceX = clamp(sourceX + (asset.width - sourceWidth) / 2, 0, asset.width - sourceWidth);
  sourceY = clamp(sourceY + (asset.height - sourceHeight) / 2, 0, asset.height - sourceHeight);

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

function renderSliceSurface(
  slice: RenderSlice,
  bitmap: ImageBitmap,
  asset: SourceAsset,
  project: LayerRenderProject,
) {
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
  if (slice.fogAmount > 0) {
    surfaceContext.fillStyle = withAlpha(
      project.canvas.background,
      Math.min(0.36, slice.fogAmount),
    );
    surfaceContext.fillRect(0, 0, width, height);
  }
  surfaceContext.restore();

  return surface;
}

function drawWarpedSlice(
  context: RenderContext,
  slice: RenderSlice,
  bitmap: ImageBitmap,
  asset: SourceAsset,
  project: LayerRenderProject,
) {
  if (!slice.quadPoints || slice.quadPoints.length !== 4) {
    return false;
  }

  const surface = renderSliceSurface(slice, bitmap, asset, project);
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
    finish.brightness !== DEFAULT_FINISH.brightness ||
    finish.contrast !== DEFAULT_FINISH.contrast ||
    finish.saturate !== DEFAULT_FINISH.saturate ||
    finish.hueRotate !== DEFAULT_FINISH.hueRotate ||
    finish.grayscale !== DEFAULT_FINISH.grayscale ||
    finish.invert !== DEFAULT_FINISH.invert
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

function compositeFinishedLayer(
  context: RenderContext,
  layerCanvas: RenderCanvas,
  project: LayerRenderProject,
) {
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

  context.drawImage(layerCanvas, 0, 0);
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

  if (drawWarpedSlice(context, slice, bitmap, asset, project)) {
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
  if (slice.fogAmount > 0) {
    context.fillStyle = withAlpha(
      project.canvas.background,
      Math.min(0.36, slice.fogAmount),
    );
    context.fillRect(
      x + slice.displacementOffset.x,
      y + slice.displacementOffset.y,
      width * (1 + slice.distortion),
      height * (1 + slice.distortion),
    );
  }
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
  } else if (typeof context.clearRect === "function") {
    context.clearRect(
      0,
      0,
      normalizedProject.canvas.width,
      normalizedProject.canvas.height,
    );
  }

  const visibleLayers = normalizedProject.layers.filter((layer) => layer.visible);

  for (const layer of visibleLayers) {
    const layerProject = createLayerRenderProject(normalizedProject, layer);
    const layerAssets =
      layer.sourceIds.length > 0
        ? layer.sourceIds
            .map((sourceId) => assets.find((asset) => asset.id === sourceId))
            .filter((asset): asset is SourceAsset => Boolean(asset))
        : assets;

    const usesDirectComposite =
      layer.compositing.blendMode === "source-over" &&
      clamp(layer.compositing.opacity, 0, 1) === 1 &&
      !hasActiveFinish(layerProject);

    if (usesDirectComposite) {
      await renderLayer(layerProject, layerAssets, bitmaps, context, canvas);
      continue;
    }

    const neutralLayerProject = createLayerRenderProject(normalizedProject, {
      ...layer,
      compositing: {
        ...layer.compositing,
        blendMode: "source-over",
        opacity: 1,
      },
    });
    const layerCanvas = createRenderCanvas(
      normalizedProject.canvas.width,
      normalizedProject.canvas.height,
    );
    await renderLayerToCanvas(neutralLayerProject, layerAssets, bitmaps, layerCanvas);
    const finishedLayerCanvas = applyLayerColorAdjustments(layerCanvas, layerProject);
    compositeFinishedLayer(context, finishedLayerCanvas, layerProject);
  }
}

async function renderLayer(
  project: LayerRenderProject,
  assets: SourceAsset[],
  bitmaps: Map<string, AssetBitmapEntry>,
  context: RenderContext,
  canvas: RenderCanvas,
) {
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
