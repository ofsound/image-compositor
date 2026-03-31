import type { ProcessedAssetPayload, SourceAsset } from "@/types/project";
import { makeId } from "@/lib/id";
import { writeBlob } from "@/lib/opfs";

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

export async function persistProcessedAsset(
  file: File,
  payload: ProcessedAssetPayload,
) {
  const assetId = makeId("asset");
  const extension = file.name.split(".").pop() || "bin";
  const originalPath = `assets/original/${assetId}.${extension}`;
  const normalizedPath = `assets/normalized/${assetId}.png`;
  const previewPath = `assets/previews/${assetId}.webp`;

  await Promise.all([
    writeBlob(originalPath, payload.blob),
    writeBlob(normalizedPath, payload.normalizedBlob),
    writeBlob(previewPath, payload.previewBlob),
  ]);

  const asset: SourceAsset = {
    id: assetId,
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
