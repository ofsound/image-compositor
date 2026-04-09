import { getSourceContentSignature } from "@/lib/assets";
import { readBlob } from "@/lib/opfs";
import {
  buildBitmapMap,
  renderProjectLayerToCanvas,
  renderProjectToCanvas,
} from "@/lib/render";
import type { ProjectDocument, SourceAsset } from "@/types/project";

const BITMAP_CACHE_LIMIT = 24;
const bitmapMapCache = new Map<string, Promise<Awaited<ReturnType<typeof buildBitmapMap>>>>();

function getBitmapMapCacheKey(assets: SourceAsset[]) {
  return assets.map(getSourceContentSignature).join("|");
}

function rememberBitmapMap(
  key: string,
  promise: Promise<Awaited<ReturnType<typeof buildBitmapMap>>>,
) {
  bitmapMapCache.set(key, promise);

  if (bitmapMapCache.size <= BITMAP_CACHE_LIMIT) {
    return promise;
  }

  const oldestKey = bitmapMapCache.keys().next().value;
  if (oldestKey) {
    bitmapMapCache.delete(oldestKey);
  }

  return promise;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function loadNormalizedAssetBitmapMap(assets: SourceAsset[]) {
  const key = getBitmapMapCacheKey(assets);
  const cached = bitmapMapCache.get(key);

  if (cached) {
    return cached;
  }

  const promise = buildBitmapMap(assets, (asset) => readBlob(asset.normalizedPath)).catch(
    (error) => {
      bitmapMapCache.delete(key);
      throw error;
    },
  );

  return rememberBitmapMap(key, promise);
}

export async function renderProjectPreview(
  project: ProjectDocument,
  assets: SourceAsset[],
  canvas: HTMLCanvasElement,
) {
  const bitmapMap = await loadNormalizedAssetBitmapMap(assets);
  await renderProjectToCanvas(project, assets, bitmapMap, canvas);
}

export async function renderLayerThumbnailUrls(
  project: ProjectDocument,
  assets: SourceAsset[],
  width: number,
  height: number,
) {
  const bitmapMap = await loadNormalizedAssetBitmapMap(assets);
  const entries = await Promise.all(
    project.layers.map(async (layer) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      await renderProjectLayerToCanvas(project, layer, assets, bitmapMap, canvas, {
        includeBackground: false,
      });

      const blob = await canvasToBlob(canvas, "image/webp", 0.82);
      return [layer.id, blob ? URL.createObjectURL(blob) : null] as const;
    }),
  );

  return Object.fromEntries(
    entries.filter(
      (entry): entry is readonly [string, string] => Boolean(entry[1]),
    ),
  );
}
