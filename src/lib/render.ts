import type {
  KaleidoscopeMirrorMode,
  ProjectDocument,
  RenderSlice,
  SourceAsset,
} from "@/types/project";
import { withAlpha } from "@/lib/color";
import { buildRenderSlices } from "@/lib/generator-registry";
import { lockExportDimensionsToCanvas } from "@/lib/export-sizing";
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
const FULL_CIRCLE_RADIANS = Math.PI * 2;

const bitmapCache = new WeakMap<Blob, Promise<ImageBitmap>>();
const RENDER_CONTEXT_OPTIONS = {
  alpha: true,
  colorSpace: "srgb",
} as CanvasRenderingContext2DSettings & { colorSpace?: "srgb" };

async function loadBitmap(blob: Blob) {
  if (!bitmapCache.has(blob)) {
    bitmapCache.set(blob, createImageBitmap(blob));
  }
  return bitmapCache.get(blob)!;
}

function drawShapePath(
  context: RenderContext,
  slice: RenderSlice,
  project: ProjectDocument,
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
    const innerRadius = outerRadius * 0.48;
    context.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    context.moveTo(centerX + innerRadius, centerY);
    context.arc(centerX, centerY, innerRadius, 0, Math.PI * 2, true);
    return;
  }

  if (slice.shape === "wedge") {
    const radius = Math.min(width, height) / 2;
    const sweepRadians = slice.wedgeSweepRadians ?? Math.PI / 3;

    if (sweepRadians >= FULL_CIRCLE_RADIANS - 0.0001) {
      context.arc(centerX, centerY, radius, 0, FULL_CIRCLE_RADIANS);
      context.closePath();
      return;
    }

    context.moveTo(centerX, centerY);
    context.arc(
      centerX,
      centerY,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + sweepRadians,
    );
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
  project: ProjectDocument,
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

function getSourceRect(slice: RenderSlice, asset: SourceAsset, project: ProjectDocument) {
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

async function drawSlice(
  context: RenderContext,
  slice: RenderSlice,
  bitmap: ImageBitmap,
  asset: SourceAsset,
  project: ProjectDocument,
) {
  const targetRect = slice.imageRect ?? slice.rect;
  const { x, y, width, height } = targetRect;
  const bounds = slice.clipRect ?? slice.rect;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const { sourceX, sourceY, sourceWidth, sourceHeight } = getSourceRect(slice, asset, project);
  const scaleX = slice.scale * (slice.mirrorAxis === "x" ? -1 : 1);
  const scaleY = slice.scale * (slice.mirrorAxis === "y" ? -1 : 1);

  context.save();
  context.globalAlpha = slice.opacity;
  context.globalCompositeOperation = slice.blendMode;
  context.filter = `blur(${project.effects.blur}px)`;

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
  context.restore();

  if (project.compositing.shadow > 0) {
    context.globalAlpha = project.compositing.shadow * 0.4;
    context.strokeStyle = "rgba(24, 15, 8, 0.2)";
    context.lineWidth = 2;
    context.save();
    clipSliceToInsetArea(context, slice, project);
    context.translate(centerX, centerY);
    context.rotate(slice.rotation + slice.clipRotation);
    context.scale(scaleX, scaleY);
    context.translate(-centerX, -centerY);
    drawShapePath(context, slice, project);
    context.stroke();
    context.restore();
  }

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
  project: ProjectDocument,
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
  canvas.width = project.canvas.width;
  canvas.height = project.canvas.height;
  const context = getRenderContext(canvas);

  if (options.includeBackground ?? true) {
    drawBackground(context, project);
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
