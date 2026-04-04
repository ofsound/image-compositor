import { luminanceFromRgb, normalizeHexColor, rgbToHex } from "@/lib/color";
import { makeId } from "@/lib/id";
import { readBlob, writeBlob } from "@/lib/opfs";
import { clamp } from "@/lib/utils";
import type {
  GradientDirection,
  ProcessedAssetPayload,
  SourceAsset,
  SourceKind,
} from "@/types/project";

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

const PREVIEW_MAX_DIMENSION = 640;
const DEFAULT_GRADIENT_DIRECTION: GradientDirection = "diagonal-down";

export const ACCEPTED_IMAGE_TYPES = COMMON_EXTENSIONS.join(",");

export interface SolidSourceInput {
  name?: string;
  color: string;
}

export interface GradientSourceInput {
  name?: string;
  from: string;
  to: string;
  direction: GradientDirection;
}

type GeneratedSourceInput =
  | { kind: "solid"; name?: string; recipe: SolidSourceInput }
  | { kind: "gradient"; name?: string; recipe: GradientSourceInput };

type LegacySourceAsset = Omit<SourceAsset, "kind"> & {
  kind?: SourceKind;
  recipe?: unknown;
};

function getAssetExtension(fileName: string) {
  return fileName.split(".").pop() || "bin";
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

  const averageR = totalR / Math.max(total, 1);
  const averageG = totalG / Math.max(total, 1);
  const averageB = totalB / Math.max(total, 1);

  return {
    averageColor: rgbToHex(averageR, averageG, averageB),
    palette: [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key]) => {
        const [r, g, b] = key.split("-").map(Number);
        return rgbToHex(r, g, b);
      }),
    luminance: luminanceFromRgb(averageR, averageG, averageB),
  };
}

function renderBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to encode generated source."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function renderScaledCanvas(source: HTMLCanvasElement, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to render generated source preview.");
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

function drawGeneratedSource(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  source: GeneratedSourceInput,
) {
  if (source.kind === "solid") {
    context.fillStyle = normalizeHexColor(source.recipe.color);
    context.fillRect(0, 0, width, height);
    return;
  }

  const gradient =
    source.recipe.direction === "horizontal"
      ? context.createLinearGradient(0, 0, width, 0)
      : source.recipe.direction === "vertical"
        ? context.createLinearGradient(0, 0, 0, height)
        : source.recipe.direction === "diagonal-up"
          ? context.createLinearGradient(0, height, width, 0)
          : context.createLinearGradient(0, 0, width, height);

  gradient.addColorStop(0, normalizeHexColor(source.recipe.from));
  gradient.addColorStop(1, normalizeHexColor(source.recipe.to));
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

async function buildGeneratedSourcePayload(
  source: GeneratedSourceInput,
  width: number,
  height: number,
) {
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const canvas = document.createElement("canvas");
  canvas.width = safeWidth;
  canvas.height = safeHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to create a canvas for generated source.");

  drawGeneratedSource(context, safeWidth, safeHeight, source);

  const imageData = context.getImageData(0, 0, safeWidth, safeHeight);
  const normalizedBlob = await renderBlob(canvas, "image/png", 0.96);
  const previewCanvas = renderScaledCanvas(canvas, PREVIEW_MAX_DIMENSION);
  const previewBlob = await renderBlob(previewCanvas, "image/webp", 0.92);
  const paletteInfo = samplePalette(imageData);

  return {
    blob: normalizedBlob,
    normalizedBlob,
    previewBlob,
    width: safeWidth,
    height: safeHeight,
    mimeType: "image/png",
    averageColor: paletteInfo.averageColor,
    palette: paletteInfo.palette,
    luminance: paletteInfo.luminance,
    orientation: 1,
  } satisfies ProcessedAssetPayload;
}

function buildGeneratedSourceName(source: GeneratedSourceInput) {
  if (source.name?.trim()) return source.name.trim();

  if (source.kind === "solid") {
    return `Solid ${normalizeHexColor(source.recipe.color).toUpperCase()}`;
  }

  return `Gradient ${normalizeHexColor(source.recipe.from).toUpperCase()} -> ${normalizeHexColor(
    source.recipe.to,
  ).toUpperCase()}`;
}

function buildGeneratedOriginalFileName(
  kind: Exclude<SourceKind, "image">,
  assetId: string,
) {
  return `${kind}-${assetId}.png`;
}

export function getSourceKindLabel(kind: SourceKind) {
  if (kind === "solid") return "Solid";
  if (kind === "gradient") return "Gradient";
  return "Image";
}

export function getDefaultGradientDirection(): GradientDirection {
  return DEFAULT_GRADIENT_DIRECTION;
}

export function normalizeSolidInput(input: SolidSourceInput): SolidSourceInput {
  return {
    name: input.name?.trim() ?? "",
    color: normalizeHexColor(input.color, "#000000"),
  };
}

export function normalizeGradientInput(input: GradientSourceInput): GradientSourceInput {
  const direction = input.direction;
  return {
    name: input.name?.trim() ?? "",
    from: normalizeHexColor(input.from, "#000000"),
    to: normalizeHexColor(input.to, "#ffffff"),
    direction:
      direction === "horizontal" ||
      direction === "vertical" ||
      direction === "diagonal-down" ||
      direction === "diagonal-up"
        ? direction
        : DEFAULT_GRADIENT_DIRECTION,
  };
}

export function normalizeSourceAsset(asset: LegacySourceAsset): SourceAsset {
  if (asset.kind === "solid") {
    const recipe = asset.recipe as Partial<SolidSourceInput> | undefined;
    return {
      ...asset,
      kind: "solid",
      recipe: {
        color: normalizeHexColor(recipe?.color ?? asset.averageColor ?? "#000000"),
      },
    };
  }

  if (asset.kind === "gradient") {
    const recipe = asset.recipe as Partial<GradientSourceInput> | undefined;
    return {
      ...asset,
      kind: "gradient",
      recipe: {
        from: normalizeHexColor(recipe?.from ?? asset.palette[0] ?? asset.averageColor ?? "#000000"),
        to: normalizeHexColor(
          recipe?.to ?? asset.palette[1] ?? asset.averageColor ?? "#ffffff",
          "#ffffff",
        ),
        direction:
          recipe?.direction === "horizontal" ||
          recipe?.direction === "vertical" ||
          recipe?.direction === "diagonal-down" ||
          recipe?.direction === "diagonal-up"
            ? recipe.direction
            : DEFAULT_GRADIENT_DIRECTION,
      },
    };
  }

  return {
    ...asset,
    kind: "image",
  };
}

export function getAssetStoragePaths(assetId: string, originalFileName: string) {
  const extension = getAssetExtension(originalFileName);
  return {
    originalPath: `assets/original/${assetId}.${extension}`,
    normalizedPath: `assets/normalized/${assetId}.png`,
    previewPath: `assets/previews/${assetId}.webp`,
  };
}

async function persistAssetPayload(
  assetId: string,
  originalFileName: string,
  payload: ProcessedAssetPayload,
) {
  const { originalPath, normalizedPath, previewPath } = getAssetStoragePaths(
    assetId,
    originalFileName,
  );

  await Promise.all([
    writeBlob(originalPath, payload.blob),
    writeBlob(normalizedPath, payload.normalizedBlob),
    writeBlob(previewPath, payload.previewBlob),
  ]);

  return {
    originalPath,
    normalizedPath,
    previewPath,
  };
}

export async function persistProcessedAsset(
  file: File,
  payload: ProcessedAssetPayload,
  projectId: string,
) {
  const assetId = makeId("asset");
  const { originalPath, normalizedPath, previewPath } = await persistAssetPayload(
    assetId,
    file.name,
    payload,
  );

  const asset: SourceAsset = {
    id: assetId,
    kind: "image",
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

export async function createGeneratedSourceAsset(
  source: GeneratedSourceInput,
  projectId: string,
  size: Pick<SourceAsset, "width" | "height">,
) {
  const assetId = makeId("asset");
  const normalizedSource =
    source.kind === "solid"
      ? ({
          kind: "solid" as const,
          name: source.name,
          recipe: normalizeSolidInput(source.recipe),
        } satisfies GeneratedSourceInput)
      : ({
          kind: "gradient" as const,
          name: source.name,
          recipe: normalizeGradientInput(source.recipe),
        } satisfies GeneratedSourceInput);
  const payload = await buildGeneratedSourcePayload(
    normalizedSource,
    size.width,
    size.height,
  );
  const originalFileName = buildGeneratedOriginalFileName(normalizedSource.kind, assetId);
  const { originalPath, normalizedPath, previewPath } = await persistAssetPayload(
    assetId,
    originalFileName,
    payload,
  );

  return normalizeSourceAsset({
    id: assetId,
    kind: normalizedSource.kind,
    projectId,
    name: buildGeneratedSourceName(normalizedSource),
    originalFileName,
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
    recipe: normalizedSource.recipe,
  });
}

export async function updateGeneratedSourceAsset(
  asset: SourceAsset,
  source: SolidSourceInput | GradientSourceInput,
) {
  if (asset.kind === "image") {
    throw new Error("Image sources cannot be edited.");
  }

  const normalizedSource =
    asset.kind === "solid"
      ? {
          kind: "solid" as const,
          name: source.name,
          recipe: normalizeSolidInput(source as SolidSourceInput),
        } satisfies GeneratedSourceInput
      : {
          kind: "gradient" as const,
          name: source.name,
          recipe: normalizeGradientInput(source as GradientSourceInput),
        } satisfies GeneratedSourceInput;

  const payload = await buildGeneratedSourcePayload(
    normalizedSource,
    asset.width,
    asset.height,
  );

  await Promise.all([
    writeBlob(asset.originalPath, payload.blob),
    writeBlob(asset.normalizedPath, payload.normalizedBlob),
    writeBlob(asset.previewPath, payload.previewBlob),
  ]);

  return normalizeSourceAsset({
    ...asset,
    name: buildGeneratedSourceName(normalizedSource),
    mimeType: payload.mimeType,
    averageColor: payload.averageColor,
    palette: payload.palette,
    luminance: payload.luminance,
    recipe: normalizedSource.recipe,
  });
}

export async function duplicateSourceAsset(asset: SourceAsset, projectId: string) {
  const assetId = makeId("asset");
  const originalFileName =
    asset.kind === "image"
      ? asset.originalFileName
      : buildGeneratedOriginalFileName(asset.kind, assetId);
  const { originalPath, normalizedPath, previewPath } = getAssetStoragePaths(
    assetId,
    originalFileName,
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

  return normalizeSourceAsset({
    ...asset,
    id: assetId,
    projectId,
    originalFileName,
    originalPath,
    normalizedPath,
    previewPath,
    createdAt: new Date().toISOString(),
  });
}

export function clampCanvasDimension(value: number, fallback: number) {
  return clamp(Math.round(value), 1, Math.max(1, fallback));
}
