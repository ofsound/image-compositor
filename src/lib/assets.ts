import { luminanceFromRgb, normalizeHexColor, rgbToHex } from "@/lib/color";
import { makeId } from "@/lib/id";
import { readBlob, writeBlob } from "@/lib/opfs";
import { clamp } from "@/lib/utils";
import type {
  GradientDirection,
  GradientMode,
  GradientSourceRecipe,
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
const DEFAULT_GRADIENT_MODE: GradientMode = "linear";
const DEFAULT_GRADIENT_DIRECTION: GradientDirection = "diagonal-down";
const DEFAULT_VIA_POSITION = 0.5;
const DEFAULT_CENTER = 0.5;
const DEFAULT_RADIAL_RADIUS = 1;
const DEFAULT_RADIAL_INNER_RADIUS = 0;
const DEFAULT_CONIC_ANGLE = 0;
const DEFAULT_CONIC_SPAN = 360;
const DEFAULT_CONIC_REPEAT = false;

export const ACCEPTED_IMAGE_TYPES = COMMON_EXTENSIONS.join(",");

export interface SolidSourceInput {
  name?: string;
  color: string;
}

export interface GradientSourceInput {
  name?: string;
  mode: GradientMode;
  from: string;
  to: string;
  direction: GradientDirection;
  viaColor: string | null;
  viaPosition: number;
  centerX: number;
  centerY: number;
  radialRadius: number;
  radialInnerRadius: number;
  conicAngle: number;
  conicSpan: number;
  conicRepeat: boolean;
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

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function clampNormalized(value: number, fallback: number) {
  return Number.isFinite(value) ? clamp(value, 0, 1) : fallback;
}

function clampRange(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function getDefaultGradientRecipe(): GradientSourceRecipe {
  return {
    mode: DEFAULT_GRADIENT_MODE,
    from: "#000000",
    to: "#ffffff",
    direction: DEFAULT_GRADIENT_DIRECTION,
    viaColor: null,
    viaPosition: DEFAULT_VIA_POSITION,
    centerX: DEFAULT_CENTER,
    centerY: DEFAULT_CENTER,
    radialRadius: DEFAULT_RADIAL_RADIUS,
    radialInnerRadius: DEFAULT_RADIAL_INNER_RADIUS,
    conicAngle: DEFAULT_CONIC_ANGLE,
    conicSpan: DEFAULT_CONIC_SPAN,
    conicRepeat: DEFAULT_CONIC_REPEAT,
  };
}

export function getDefaultGradientInput(): GradientSourceInput {
  return {
    name: "",
    ...getDefaultGradientRecipe(),
  };
}

function normalizeGradientRecipe(
  input: Omit<GradientSourceInput, "name">,
): GradientSourceRecipe {
  const defaults = getDefaultGradientRecipe();
  const direction = input.direction;
  const mode = input.mode;
  const viaColor =
    typeof input.viaColor === "string" && input.viaColor.trim().length > 0
      ? normalizeHexColor(input.viaColor, defaults.to)
      : null;

  return {
    mode:
      mode === "linear" || mode === "radial" || mode === "conic"
        ? mode
        : defaults.mode,
    from: normalizeHexColor(input.from, defaults.from),
    to: normalizeHexColor(input.to, defaults.to),
    direction:
      direction === "horizontal" ||
      direction === "vertical" ||
      direction === "diagonal-down" ||
      direction === "diagonal-up"
        ? direction
        : defaults.direction,
    viaColor,
    viaPosition: clampRange(input.viaPosition, 0, 1, defaults.viaPosition),
    centerX: clampNormalized(input.centerX, defaults.centerX),
    centerY: clampNormalized(input.centerY, defaults.centerY),
    radialRadius: clampRange(input.radialRadius, 0, 1, defaults.radialRadius),
    radialInnerRadius: clampRange(
      input.radialInnerRadius,
      0,
      0.95,
      defaults.radialInnerRadius,
    ),
    conicAngle: Number.isFinite(input.conicAngle)
      ? input.conicAngle
      : defaults.conicAngle,
    conicSpan: clampRange(input.conicSpan, 1, 360, defaults.conicSpan),
    conicRepeat:
      typeof input.conicRepeat === "boolean"
        ? input.conicRepeat
        : defaults.conicRepeat,
  };
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

function buildGradientStops(recipe: GradientSourceRecipe) {
  const stops = [
    { offset: 0, color: recipe.from },
    ...(recipe.viaColor
      ? [{ offset: recipe.viaPosition, color: recipe.viaColor }]
      : []),
    { offset: 1, color: recipe.to },
  ];

  return stops
    .map((stop) => ({
      offset: clamp(stop.offset, 0, 1),
      color: normalizeHexColor(stop.color),
    }))
    .sort((a, b) => a.offset - b.offset);
}

function createLinearGradientForDirection(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  direction: GradientDirection,
) {
  if (direction === "horizontal") {
    return context.createLinearGradient(0, 0, width, 0);
  }

  if (direction === "vertical") {
    return context.createLinearGradient(0, 0, 0, height);
  }

  if (direction === "diagonal-up") {
    return context.createLinearGradient(0, height, width, 0);
  }

  return context.createLinearGradient(0, 0, width, height);
}

function getGradientCenter(
  recipe: GradientSourceRecipe,
  width: number,
  height: number,
) {
  return {
    x: clamp(recipe.centerX, 0, 1) * width,
    y: clamp(recipe.centerY, 0, 1) * height,
  };
}

function getFarthestCornerDistance(
  center: { x: number; y: number },
  width: number,
  height: number,
) {
  return Math.max(
    Math.hypot(center.x, center.y),
    Math.hypot(width - center.x, center.y),
    Math.hypot(center.x, height - center.y),
    Math.hypot(width - center.x, height - center.y),
  );
}

function applyConicColorStops(
  gradient: CanvasGradient,
  recipe: GradientSourceRecipe,
  stops: ReturnType<typeof buildGradientStops>,
) {
  const spanFraction = clamp(recipe.conicSpan, 1, 360) / 360;

  if (!recipe.conicRepeat || spanFraction >= 1) {
    for (const stop of stops) {
      gradient.addColorStop(stop.offset * spanFraction, stop.color);
    }
    if (spanFraction < 1) {
      gradient.addColorStop(spanFraction, stops.at(-1)?.color ?? recipe.to);
      gradient.addColorStop(1, stops.at(-1)?.color ?? recipe.to);
    }
    return;
  }

  const cycleCount = Math.max(1, Math.ceil(1 / spanFraction));
  for (let cycle = 0; cycle < cycleCount; cycle += 1) {
    const cycleStart = cycle * spanFraction;
    const cycleEnd = Math.min(1, cycleStart + spanFraction);
    for (const stop of stops) {
      const offset = cycleStart + stop.offset * spanFraction;
      if (offset > 1) continue;
      gradient.addColorStop(offset, stop.color);
    }
    gradient.addColorStop(cycleEnd, stops.at(-1)?.color ?? recipe.to);
  }
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

  const recipe = source.recipe;
  const stops = buildGradientStops(recipe);
  const gradient =
    recipe.mode === "radial"
      ? (() => {
          const center = getGradientCenter(recipe, width, height);
          const outerRadius = Math.max(
            1,
            getFarthestCornerDistance(center, width, height) *
              clamp(recipe.radialRadius, 0, 1),
          );
          const innerRadius =
            clamp(recipe.radialInnerRadius, 0, 0.95) * outerRadius;
          return context.createRadialGradient(
            center.x,
            center.y,
            innerRadius,
            center.x,
            center.y,
            outerRadius,
          );
        })()
      : recipe.mode === "conic"
        ? (() => {
            const center = getGradientCenter(recipe, width, height);
            return context.createConicGradient(
              degreesToRadians(recipe.conicAngle),
              center.x,
              center.y,
            );
          })()
        : createLinearGradientForDirection(
            context,
            width,
            height,
            recipe.direction,
          );

  if (recipe.mode === "conic") {
    applyConicColorStops(gradient, recipe, stops);
  } else {
    for (const stop of stops) {
      gradient.addColorStop(stop.offset, stop.color);
    }
  }

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

  const modeLabel =
    source.recipe.mode[0]!.toUpperCase() + source.recipe.mode.slice(1);
  return `${modeLabel} Gradient ${normalizeHexColor(
    source.recipe.from,
  ).toUpperCase()} -> ${normalizeHexColor(source.recipe.to).toUpperCase()}`;
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

export function getSourceContentSignature(asset: SourceAsset) {
  const base = [
    asset.id,
    asset.kind,
    asset.normalizedPath,
    asset.previewPath,
    asset.averageColor,
    asset.palette.join(","),
    asset.luminance,
    asset.width,
    asset.height,
  ].join("|");

  if (asset.kind === "solid") {
    return `${base}|${asset.recipe.color}`;
  }

  if (asset.kind === "gradient") {
    return [
      base,
      asset.recipe.mode,
      asset.recipe.from,
      asset.recipe.to,
      asset.recipe.direction,
      asset.recipe.viaColor ?? "",
      asset.recipe.viaPosition,
      asset.recipe.centerX,
      asset.recipe.centerY,
      asset.recipe.radialRadius,
      asset.recipe.radialInnerRadius,
      asset.recipe.conicAngle,
      asset.recipe.conicSpan,
      asset.recipe.conicRepeat ? 1 : 0,
    ].join("|");
  }

  return base;
}

export function getDefaultGradientMode(): GradientMode {
  return DEFAULT_GRADIENT_MODE;
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
  return {
    name: input.name?.trim() ?? "",
    ...normalizeGradientRecipe(input),
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
      recipe: normalizeGradientRecipe({
        mode: recipe?.mode ?? DEFAULT_GRADIENT_MODE,
        from:
          recipe?.from ??
          asset.palette[0] ??
          asset.averageColor ??
          getDefaultGradientRecipe().from,
        to:
          recipe?.to ??
          asset.palette[1] ??
          asset.averageColor ??
          getDefaultGradientRecipe().to,
        direction: recipe?.direction ?? DEFAULT_GRADIENT_DIRECTION,
        viaColor:
          typeof recipe?.viaColor === "string" ? recipe.viaColor : null,
        viaPosition:
          typeof recipe?.viaPosition === "number"
            ? recipe.viaPosition
            : DEFAULT_VIA_POSITION,
        centerX:
          typeof recipe?.centerX === "number"
            ? recipe.centerX
            : DEFAULT_CENTER,
        centerY:
          typeof recipe?.centerY === "number"
            ? recipe.centerY
            : DEFAULT_CENTER,
        radialRadius:
          typeof recipe?.radialRadius === "number"
            ? recipe.radialRadius
            : DEFAULT_RADIAL_RADIUS,
        radialInnerRadius:
          typeof recipe?.radialInnerRadius === "number"
            ? recipe.radialInnerRadius
            : DEFAULT_RADIAL_INNER_RADIUS,
        conicAngle:
          typeof recipe?.conicAngle === "number"
            ? recipe.conicAngle
            : DEFAULT_CONIC_ANGLE,
        conicSpan:
          typeof recipe?.conicSpan === "number"
            ? recipe.conicSpan
            : DEFAULT_CONIC_SPAN,
        conicRepeat:
          typeof recipe?.conicRepeat === "boolean"
            ? recipe.conicRepeat
            : DEFAULT_CONIC_REPEAT,
      }),
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
          recipe: normalizeGradientRecipe(source.recipe),
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
          recipe: normalizeGradientRecipe(source as GradientSourceInput),
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
