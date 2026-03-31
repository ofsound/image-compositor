import type { ProcessedAssetPayload } from "@/types/project";

function isHeicType(file: File) {
  return (
    file.type.includes("heic") ||
    file.type.includes("heif") ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

let worker: Worker | null = null;

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("@/workers/image-worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

export function processImageFile(file: File) {
  if (isHeicType(file)) {
    return processImageFileOnMainThread(file);
  }

  const activeWorker = getWorker();
  const requestId = crypto.randomUUID();

  const workerPromise = new Promise<ProcessedAssetPayload>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.requestId !== requestId) return;
      activeWorker.removeEventListener("message", onMessage);
      activeWorker.removeEventListener("error", onError);

      if (event.data.error) {
        reject(new Error(event.data.error));
        return;
      }

      resolve(event.data.payload as ProcessedAssetPayload);
    };

    const onError = (error: ErrorEvent) => {
      activeWorker.removeEventListener("message", onMessage);
      activeWorker.removeEventListener("error", onError);
      reject(error.error ?? new Error("Image processing failed."));
    };

    activeWorker.addEventListener("message", onMessage);
    activeWorker.addEventListener("error", onError);
    activeWorker.postMessage({ requestId, file });
  });

  const timeoutPromise = new Promise<ProcessedAssetPayload>((_, reject) => {
    window.setTimeout(() => reject(new Error("Image worker timed out.")), 4_000);
  });

  return Promise.race([workerPromise, timeoutPromise]).catch(() =>
    processImageFileOnMainThread(file),
  );
}

async function renderScaledBlob(
  bitmap: ImageBitmap,
  maxDimension: number,
  type: string,
  quality: number,
) {
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to render image.");
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to encode image."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function processImageFileOnMainThread(file: File): Promise<ProcessedAssetPayload> {
  const sourceBlob = await decodeBlobOnMainThread(file);
  const bitmap = await createImageBitmap(sourceBlob, { imageOrientation: "from-image" });
  const normalizedBlob = await renderScaledBlob(
    bitmap,
    Math.max(bitmap.width, bitmap.height),
    "image/png",
    0.96,
  );
  const previewBlob = await renderScaledBlob(bitmap, 640, "image/webp", 0.92);

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = bitmap.width;
  sampleCanvas.height = bitmap.height;
  const context = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to sample image.");
  context.drawImage(bitmap, 0, 0);
  const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;
  const buckets = new Map<string, number>();

  for (let index = 0; index < imageData.data.length; index += 16) {
    const r = imageData.data[index]!;
    const g = imageData.data[index + 1]!;
    const b = imageData.data[index + 2]!;
    const alpha = imageData.data[index + 3]!;
    if (alpha < 32) continue;
    totalR += r;
    totalG += g;
    totalB += b;
    count += 1;
    const key = [r, g, b]
      .map((value) => Math.round(value / 32) * 32)
      .join("-");
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  bitmap.close();

  const averageR = totalR / Math.max(1, count);
  const averageG = totalG / Math.max(1, count);
  const averageB = totalB / Math.max(1, count);
  const averageColor = `#${[averageR, averageG, averageB]
    .map((value) => Math.round(value).toString(16).padStart(2, "0"))
    .join("")}`;
  const palette = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => {
      const [r, g, b] = key.split("-").map(Number);
      return `#${[r, g, b]
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("")}`;
    });
  const luminance =
    (0.2126 * averageR + 0.7152 * averageG + 0.0722 * averageB) / 255;

  return {
    blob: file,
    normalizedBlob,
    previewBlob,
    width: imageData.width,
    height: imageData.height,
    mimeType: file.type || "application/octet-stream",
    averageColor,
    palette,
    luminance,
    orientation: 1,
  };
}

async function decodeBlobOnMainThread(file: File) {
  if (!isHeicType(file)) {
    return file;
  }

  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({
    blob: file,
    toType: "image/png",
    quality: 0.96,
  });

  return Array.isArray(converted) ? converted[0]! : converted;
}
