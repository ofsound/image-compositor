import { getSourceContentSignature } from "@/lib/assets";
import { readBlob } from "@/lib/opfs";
import {
  disposeBitmapMap,
  buildBitmapMap,
  renderProjectLayerToCanvas,
  renderProjectToCanvas,
} from "@/lib/render";
import type { AssetBitmapEntry } from "@/lib/render";
import type { CompositorLayer, ProjectDocument, SourceAsset } from "@/types/project";

const BITMAP_CACHE_LIMIT = 24;
type BitmapMap = Awaited<ReturnType<typeof buildBitmapMap>>;

interface BitmapMapCacheEntry {
  promise: Promise<BitmapMap>;
}

const bitmapMapCache = new Map<string, BitmapMapCacheEntry>();

function getBitmapMapCacheKey(assets: SourceAsset[]) {
  return assets.map(getSourceContentSignature).join("|");
}

function rememberBitmapMap(
  key: string,
  promise: Promise<BitmapMap>,
) {
  bitmapMapCache.set(key, { promise });

  if (bitmapMapCache.size <= BITMAP_CACHE_LIMIT) {
    return promise;
  }

  const oldestKey = bitmapMapCache.keys().next().value;
  if (oldestKey) {
    const oldestEntry = bitmapMapCache.get(oldestKey);
    bitmapMapCache.delete(oldestKey);
    if (oldestEntry) {
      void oldestEntry.promise.then((bitmapMap) => {
        disposeBitmapMap(bitmapMap);
      }).catch(() => undefined);
    }
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
    return cached.promise;
  }

  const promise = buildBitmapMap(assets, (asset) => readBlob(asset.normalizedPath)).catch(
    (error) => {
      bitmapMapCache.delete(key);
      throw error;
    },
  );

  return rememberBitmapMap(key, promise);
}

function getLayerThumbnailAssetSignatures(
  layer: CompositorLayer,
  assets: SourceAsset[],
) {
  const assetLookup = new Map(assets.map((asset) => [asset.id, asset]));

  return layer.sourceIds.map((sourceId) => {
    const asset = assetLookup.get(sourceId);
    return asset ? getSourceContentSignature(asset) : `missing:${sourceId}`;
  });
}

export function getLayerThumbnailSignature(
  project: ProjectDocument,
  layer: CompositorLayer,
  assets: SourceAsset[],
) {
  return JSON.stringify({
    canvas: {
      width: project.canvas.width,
      height: project.canvas.height,
      background: project.canvas.background,
      backgroundAlpha: project.canvas.backgroundAlpha,
      inset: project.canvas.inset,
    },
    layer: {
      inset: layer.inset,
      sourceIds: layer.sourceIds,
      layout: layer.layout,
      sourceMapping: layer.sourceMapping,
      effects: layer.effects,
      compositing: layer.compositing,
      finish: layer.finish,
      draw: layer.draw,
      words: layer.words,
      svgGeometry: layer.svgGeometry,
      activeSeed: layer.activeSeed,
      presets: layer.presets,
      passes: layer.passes,
    },
    assets: getLayerThumbnailAssetSignatures(layer, assets),
  });
}

export async function renderProjectPreview(
  project: ProjectDocument,
  assets: SourceAsset[],
  canvas: HTMLCanvasElement,
) {
  const bitmapMap = await loadNormalizedAssetBitmapMap(assets);
  await renderProjectToCanvas(project, assets, bitmapMap, canvas);
}

export async function renderLayerThumbnailUrl(
  project: ProjectDocument,
  layer: CompositorLayer,
  assets: SourceAsset[],
  width: number,
  height: number,
  bitmapMap?: Map<string, AssetBitmapEntry>,
) {
  const activeBitmapMap = bitmapMap ?? await loadNormalizedAssetBitmapMap(assets);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  await renderProjectLayerToCanvas(project, layer, assets, activeBitmapMap, canvas, {
    includeBackground: false,
  });

  const blob = await canvasToBlob(canvas, "image/webp", 0.82);
  return blob ? URL.createObjectURL(blob) : null;
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
      const url = await renderLayerThumbnailUrl(
        project,
        layer,
        assets,
        width,
        height,
        bitmapMap,
      );
      return [layer.id, url] as const;
    }),
  );

  return Object.fromEntries(
    entries.filter(
      (entry): entry is readonly [string, string] => Boolean(entry[1]),
    ),
  );
}
