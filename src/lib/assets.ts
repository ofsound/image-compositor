import type { ProcessedAssetPayload, SourceAsset } from "@/types/project";
import { makeId } from "@/lib/id";
import { readBlob, writeBlob } from "@/lib/opfs";

const COMMON_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".avif",
  ".heic",
  ".heif",
];

export const ACCEPTED_IMAGE_TYPES = COMMON_EXTENSIONS.join(",");

function getAssetExtension(fileName: string) {
  return fileName.split(".").pop() || "bin";
}

export function getAssetStoragePaths(assetId: string, originalFileName: string) {
  const extension = getAssetExtension(originalFileName);
  return {
    originalPath: `assets/original/${assetId}.${extension}`,
    normalizedPath: `assets/normalized/${assetId}.png`,
    previewPath: `assets/previews/${assetId}.webp`,
  };
}

export async function persistProcessedAsset(
  file: File,
  payload: ProcessedAssetPayload,
  projectId: string,
) {
  const assetId = makeId("asset");
  const { originalPath, normalizedPath, previewPath } = getAssetStoragePaths(assetId, file.name);

  await Promise.all([
    writeBlob(originalPath, payload.blob),
    writeBlob(normalizedPath, payload.normalizedBlob),
    writeBlob(previewPath, payload.previewBlob),
  ]);

  const asset: SourceAsset = {
    id: assetId,
    projectId,
    name: file.name.replace(/\.[^.]+$/, ""),
    originalFileName: file.name,
    mimeType: payload.mimeType,
    width: payload.width,
    height: payload.height,
    orientation: payload.orientation,
    originalPath,
    normalizedPath,
    previewPath,
    averageColor: payload.averageColor,
    palette: payload.palette,
    luminance: payload.luminance,
    createdAt: new Date().toISOString(),
  };

  return asset;
}

export async function duplicateSourceAsset(asset: SourceAsset, projectId: string) {
  const assetId = makeId("asset");
  const { originalPath, normalizedPath, previewPath } = getAssetStoragePaths(
    assetId,
    asset.originalFileName,
  );

  const [original, normalized, preview] = await Promise.all([
    readBlob(asset.originalPath),
    readBlob(asset.normalizedPath),
    readBlob(asset.previewPath),
  ]);

  await Promise.all([
    original ? writeBlob(originalPath, original) : Promise.resolve(),
    normalized ? writeBlob(normalizedPath, normalized) : Promise.resolve(),
    preview ? writeBlob(previewPath, preview) : Promise.resolve(),
  ]);

  return {
    ...asset,
    id: assetId,
    projectId,
    originalPath,
    normalizedPath,
    previewPath,
    createdAt: new Date().toISOString(),
  } satisfies SourceAsset;
}
