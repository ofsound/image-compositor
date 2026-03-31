import * as UTIF from "utif";

import { luminanceFromRgb, rgbToHex } from "@/lib/color";
import type { ProcessedAssetPayload } from "@/types/project";

interface WorkerRequest {
  requestId: string;
  file: File;
}

function isHeicType(file: File) {
  return (
    file.type.includes("heic") ||
    file.type.includes("heif") ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

function isTiffType(file: File) {
  return file.type.includes("tiff") || /\.(tif|tiff)$/i.test(file.name);
}

async function decodeBlobFromFile(file: File) {
  if (isHeicType(file)) {
    throw new Error("HEIC conversion is handled on the main thread.");
  }

  if (isTiffType(file)) {
    const buffer = await file.arrayBuffer();
    const ifds = UTIF.decode(buffer);
    const image = ifds[0];
    UTIF.decodeImage(buffer, image, ifds);
    const rgba = UTIF.toRGBA8(image);
    const width = Number((image as { width?: number }).width ?? 1);
    const height = Number((image as { height?: number }).height ?? 1);
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to prepare TIFF canvas.");
    const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    context.putImageData(imageData, 0, 0);
    return canvas.convertToBlob({ type: "image/png", quality: 0.96 });
  }

  return file;
}

async function readBitmap(blob: Blob) {
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

async function renderDerivative(
  bitmap: ImageBitmap,
  maxDimension: number,
  type: string,
  quality: number,
) {
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create render context.");
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas.convertToBlob({ type, quality });
}

async function readImageData(bitmap: ImageBitmap) {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to sample pixels.");
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
}

function samplePalette(data: ImageData) {
  const buckets = new Map<string, number>();
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let total = 0;

  for (let index = 0; index < data.data.length; index += 16) {
    const r = data.data[index]!;
    const g = data.data[index + 1]!;
    const b = data.data[index + 2]!;
    const alpha = data.data[index + 3]!;
    if (alpha < 32) continue;

    totalR += r;
    totalG += g;
    totalB += b;
    total += 1;

    const key = [r, g, b]
      .map((value) => Math.round(value / 32) * 32)
      .join("-");
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const average = rgbToHex(totalR / Math.max(total, 1), totalG / Math.max(total, 1), totalB / Math.max(total, 1));

  const palette = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => {
      const [r, g, b] = key.split("-").map(Number);
      return rgbToHex(r, g, b);
    });

  const luminance = luminanceFromRgb(totalR / Math.max(total, 1), totalG / Math.max(total, 1), totalB / Math.max(total, 1));

  return { averageColor: average, palette, luminance };
}

async function processFile(file: File): Promise<ProcessedAssetPayload> {
  const normalizedSource = await decodeBlobFromFile(file);
  const bitmap = await readBitmap(normalizedSource);
  const normalizedBlob = await renderDerivative(bitmap, Math.max(bitmap.width, bitmap.height), "image/png", 0.96);
  const previewBlob = await renderDerivative(bitmap, 640, "image/webp", 0.92);
  const imageData = await readImageData(bitmap);
  const paletteInfo = samplePalette(imageData);

  bitmap.close();

  return {
    blob: file,
    normalizedBlob,
    previewBlob,
    width: imageData.width,
    height: imageData.height,
    mimeType: file.type || "application/octet-stream",
    averageColor: paletteInfo.averageColor,
    palette: paletteInfo.palette,
    luminance: paletteInfo.luminance,
    orientation: 1,
  };
}

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const { requestId, file } = event.data;

  try {
    const payload = await processFile(file);
    self.postMessage({ requestId, payload });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : "Image processing failed.",
    });
  }
});
