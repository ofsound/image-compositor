import type { ProjectDocument, RenderSlice, SourceAsset } from "@/types/project";
import { buildRenderSlices } from "@/lib/generator-registry";
import { clamp } from "@/lib/utils";

interface AssetBitmapEntry {
  asset: SourceAsset;
  bitmap: ImageBitmap;
}

const bitmapCache = new Map<string, Promise<ImageBitmap>>();

async function loadBitmap(asset: SourceAsset, blob: Blob) {
  const cacheKey = `${asset.id}:${blob.size}:${blob.type}`;
  if (!bitmapCache.has(cacheKey)) {
    bitmapCache.set(cacheKey, createImageBitmap(blob));
  }
  return bitmapCache.get(cacheKey)!;
}

function drawShapePath(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  slice: RenderSlice,
) {
  const { x, y, width, height } = slice.rect;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  context.beginPath();

  if (slice.shape === "triangle") {
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
    context.moveTo(centerX, centerY);
    context.arc(centerX, centerY, Math.min(width, height) / 2, -Math.PI / 2, Math.PI / 3);
    context.closePath();
    return;
  }

  context.roundRect(x, y, width, height, Math.max(8, Math.min(width, height) * 0.08));
}

function applySharpen(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  canvas: HTMLCanvasElement | OffscreenCanvas,
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
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  slice: RenderSlice,
  bitmap: ImageBitmap,
  asset: SourceAsset,
  project: ProjectDocument,
) {
  const { x, y, width, height } = slice.rect;
  const zoom = project.sourceMapping.cropZoom;
  const assetRatio = asset.width / asset.height;
  const rectRatio = width / height;
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

  context.save();
  context.globalAlpha = slice.opacity;
  context.globalCompositeOperation = slice.blendMode;
  context.translate(x + width / 2, y + height / 2);
  context.rotate(slice.rotation);
  context.scale(slice.scale * (slice.mirrorAxis === "x" ? -1 : 1), slice.scale * (slice.mirrorAxis === "y" ? -1 : 1));
  context.translate(-(x + width / 2), -(y + height / 2));
  context.filter = `blur(${project.effects.blur}px)`;

  context.save();
  drawShapePath(context, slice);
  context.clip("evenodd");
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
    drawShapePath(context, slice);
    context.stroke();
  }

  context.restore();
}

function drawBackground(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  project: ProjectDocument,
) {
  const gradient = context.createLinearGradient(0, 0, project.canvas.width, project.canvas.height);
  gradient.addColorStop(0, project.canvas.background);
  gradient.addColorStop(1, "#efe3cc");
  context.fillStyle = gradient;
  context.fillRect(0, 0, project.canvas.width, project.canvas.height);

  context.save();
  context.globalAlpha = 0.1;
  context.strokeStyle = "#7b6a59";
  for (let index = 0; index < 18; index += 1) {
    context.beginPath();
    context.moveTo(index * 120, 0);
    context.lineTo(index * 120 - 240, project.canvas.height);
    context.stroke();
  }
  context.restore();
}

export async function buildBitmapMap(
  assets: SourceAsset[],
  blobLookup: (asset: SourceAsset) => Promise<Blob | null>,
) {
  const entries = await Promise.all(
    assets.map(async (asset) => {
      const blob = await blobLookup(asset);
      if (!blob) return null;
      const bitmap = await loadBitmap(asset, blob);
      return [asset.id, { asset, bitmap }] as const;
    }),
  );

  return new Map<string, AssetBitmapEntry>(entries.filter(Boolean) as [string, AssetBitmapEntry][]);
}

export async function renderProjectToCanvas(
  project: ProjectDocument,
  assets: SourceAsset[],
  bitmaps: Map<string, AssetBitmapEntry>,
  canvas: HTMLCanvasElement | OffscreenCanvas,
) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to acquire a canvas context.");

  canvas.width = project.canvas.width;
  canvas.height = project.canvas.height;

  drawBackground(context, project);
  const slices = buildRenderSlices(project, assets);

  for (const slice of slices) {
    const assetBitmap = bitmaps.get(slice.assetId);
    if (!assetBitmap) continue;
    await drawSlice(context, slice, assetBitmap.bitmap, assetBitmap.asset, project);
  }

  if (project.effects.mirror || project.effects.kaleidoscopeSegments > 1) {
    context.save();
    context.globalAlpha = 0.2;
    for (let segment = 1; segment < project.effects.kaleidoscopeSegments; segment += 1) {
      const angle = (Math.PI * 2 * segment) / project.effects.kaleidoscopeSegments;
      context.translate(project.canvas.width / 2, project.canvas.height / 2);
      context.rotate(angle);
      context.scale(segment % 2 === 0 ? -1 : 1, 1);
      context.translate(-project.canvas.width / 2, -project.canvas.height / 2);
      context.drawImage(canvas, 0, 0);
      context.setTransform(1, 0, 0, 1, 0, 0);
    }
    context.restore();
  }

  applySharpen(context, canvas, project.effects.sharpen);
}

export async function exportProjectImage(
  project: ProjectDocument,
  assets: SourceAsset[],
  bitmaps: Map<string, AssetBitmapEntry>,
) {
  const width = Math.min(7680, Math.round(project.export.width * project.export.scale));
  const height = Math.min(7680, Math.round(project.export.height * project.export.scale));
  const canvas = new OffscreenCanvas(width, height);
  const exportProject: ProjectDocument = {
    ...project,
    canvas: {
      ...project.canvas,
      width,
      height,
    },
  };
  await renderProjectToCanvas(exportProject, assets, bitmaps, canvas);
  return canvas.convertToBlob({
    type: project.export.format,
    quality: project.export.quality,
  });
}
