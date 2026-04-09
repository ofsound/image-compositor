import { luminanceFromRgb, normalizeHexColor, rgbToHex } from "@/lib/color";
import { makeId } from "@/lib/id";
import { readBlob, writeBlob } from "@/lib/opfs";
import { clamp, lerp } from "@/lib/utils";
import type {
  GradientDirection,
  GradientMode,
  GradientSourceRecipe,
  NoiseSourceRecipe,
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
const DEFAULT_NOISE_SCALE = 0.55;
const DEFAULT_NOISE_DETAIL = 0.55;
const DEFAULT_NOISE_CONTRAST = 0.45;
const DEFAULT_NOISE_DISTORTION = 0.25;
const DEFAULT_NOISE_SEED = 1;

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

export interface NoiseSourceInput {
  name?: string;
  color: string;
  scale: number;
  detail: number;
  contrast: number;
  distortion: number;
  seed: number;
}

type GeneratedSourceInput =
  | { kind: "solid"; name?: string; recipe: SolidSourceInput }
  | { kind: "gradient"; name?: string; recipe: GradientSourceInput }
  | { kind: "noise"; name?: string; recipe: NoiseSourceInput };

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

function getDefaultNoiseRecipe(): NoiseSourceRecipe {
  return {
    color: "#0f766e",
    scale: DEFAULT_NOISE_SCALE,
    detail: DEFAULT_NOISE_DETAIL,
    contrast: DEFAULT_NOISE_CONTRAST,
    distortion: DEFAULT_NOISE_DISTORTION,
    seed: DEFAULT_NOISE_SEED,
  };
}

export function getDefaultGradientInput(): GradientSourceInput {
  return {
    name: "",
    ...getDefaultGradientRecipe(),
  };
}

export function getDefaultNoiseInput(): NoiseSourceInput {
  return {
    name: "",
    ...getDefaultNoiseRecipe(),
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

function normalizeNoiseRecipe(input: Omit<NoiseSourceInput, "name">): NoiseSourceRecipe {
  const defaults = getDefaultNoiseRecipe();

  return {
    color: normalizeHexColor(input.color, defaults.color),
    scale: clampRange(input.scale, 0, 1, defaults.scale),
    detail: clampRange(input.detail, 0, 1, defaults.detail),
    contrast: clampRange(input.contrast, 0, 1, defaults.contrast),
    distortion: clampRange(input.distortion, 0, 1, defaults.distortion),
    seed: Number.isFinite(input.seed)
      ? Math.abs(Math.trunc(input.seed)) >>> 0
      : defaults.seed,
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

function hash2D(x: number, y: number, seed: number) {
  let hash = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function dotGradient(ix: number, iy: number, x: number, y: number, seed: number) {
  const angle = hash2D(ix, iy, seed) * Math.PI * 2;
  const dx = x - ix;
  const dy = y - iy;
  return dx * Math.cos(angle) + dy * Math.sin(angle);
}

function samplePerlin2D(x: number, y: number, seed: number) {
  const x0 = Math.floor(x);
  const x1 = x0 + 1;
  const y0 = Math.floor(y);
  const y1 = y0 + 1;
  const sx = fade(x - x0);
  const sy = fade(y - y0);
  const n0 = dotGradient(x0, y0, x, y, seed);
  const n1 = dotGradient(x1, y0, x, y, seed);
  const ix0 = lerp(n0, n1, sx);
  const n2 = dotGradient(x0, y1, x, y, seed);
  const n3 = dotGradient(x1, y1, x, y, seed);
  const ix1 = lerp(n2, n3, sx);

  return lerp(ix0, ix1, sy);
}

function sampleFbm(
  x: number,
  y: number,
  seed: number,
  octaves: number,
  persistence: number,
  lacunarity: number,
) {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let amplitudeSum = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    total += samplePerlin2D(x * frequency, y * frequency, seed + octave * 1013) * amplitude;
    amplitudeSum += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return amplitudeSum > 0 ? total / amplitudeSum : 0;
}

function hexToRgbTriplet(hex: string) {
  const normalized = normalizeHexColor(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness };
  }

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue =
    max === nr
      ? ((ng - nb) / delta + (ng < nb ? 6 : 0)) / 6
      : max === ng
        ? ((nb - nr) / delta + 2) / 6
        : ((nr - ng) / delta + 4) / 6;

  return { h: hue, s: saturation, l: lightness };
}

function hueToRgb(p: number, q: number, t: number) {
  let next = t;
  if (next < 0) next += 1;
  if (next > 1) next -= 1;
  if (next < 1 / 6) return p + (q - p) * 6 * next;
  if (next < 1 / 2) return q;
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) {
    const value = Math.round(l * 255);
    return { r: value, g: value, b: value };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

function shapeNoiseValue(value: number, contrast: number) {
  const centered = value * 2 - 1;
  const exponent = lerp(1.15, 0.42, contrast);
  const shaped = Math.sign(centered) * Math.pow(Math.abs(centered), exponent);
  return clamp(shaped * 0.5 + 0.5, 0, 1);
}

function drawNoiseSource(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  recipe: NoiseSourceRecipe,
) {
  const { r, g, b } = hexToRgbTriplet(recipe.color);
  const base = rgbToHsl(r, g, b);
  const image = context.createImageData(width, height);
  const data = image.data;
  const shortestSide = Math.max(1, Math.min(width, height));
  const featureFrequency = lerp(10, 1.2, recipe.scale);
  const warpFrequency = lerp(1.8, 0.45, recipe.scale);
  const warpAmount = recipe.distortion * 1.2;
  const octaves = 2 + Math.round(recipe.detail * 4);
  const persistence = lerp(0.6, 0.48, recipe.detail);
  const lacunarity = lerp(1.85, 2.5, recipe.detail);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / shortestSide;
      const ny = y / shortestSide;
      const warpX =
        sampleFbm(nx * warpFrequency + 17.1, ny * warpFrequency + 3.7, recipe.seed + 211, 3, 0.55, 2) *
        warpAmount;
      const warpY =
        sampleFbm(nx * warpFrequency + 91.2, ny * warpFrequency + 47.9, recipe.seed + 577, 3, 0.55, 2) *
        warpAmount;
      const sample = sampleFbm(
        (nx + warpX) * featureFrequency,
        (ny + warpY) * featureFrequency,
        recipe.seed,
        octaves,
        persistence,
        lacunarity,
      );
      const shapedValue = shapeNoiseValue(sample * 0.5 + 0.5, recipe.contrast);
      const lightness = clamp(base.l + lerp(-0.26, 0.18, shapedValue), 0.08, 0.9);
      const saturation = clamp(base.s + lerp(0.08, -0.05, shapedValue), 0.12, 0.96);
      const rgb = hslToRgb(base.h, saturation, lightness);
      const index = (y * width + x) * 4;
      data[index] = rgb.r;
      data[index + 1] = rgb.g;
      data[index + 2] = rgb.b;
      data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
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

  if (source.kind === "noise") {
    drawNoiseSource(context, width, height, normalizeNoiseRecipe(source.recipe));
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

  if (source.kind === "noise") {
    return `Noise ${normalizeHexColor(source.recipe.color).toUpperCase()}`;
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
  if (kind === "noise") return "Noise";
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

  if (asset.kind === "noise") {
    return [
      base,
      asset.recipe.color,
      asset.recipe.scale,
      asset.recipe.detail,
      asset.recipe.contrast,
      asset.recipe.distortion,
      asset.recipe.seed,
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

export function normalizeNoiseInput(input: NoiseSourceInput): NoiseSourceInput {
  return {
    name: input.name?.trim() ?? "",
    ...normalizeNoiseRecipe(input),
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

  if (asset.kind === "noise") {
    const recipe = asset.recipe as Partial<NoiseSourceInput> | undefined;
    const defaults = getDefaultNoiseRecipe();
    return {
      ...asset,
      kind: "noise",
      recipe: normalizeNoiseRecipe({
        color: recipe?.color ?? asset.averageColor ?? defaults.color,
        scale: typeof recipe?.scale === "number" ? recipe.scale : defaults.scale,
        detail: typeof recipe?.detail === "number" ? recipe.detail : defaults.detail,
        contrast:
          typeof recipe?.contrast === "number" ? recipe.contrast : defaults.contrast,
        distortion:
          typeof recipe?.distortion === "number"
            ? recipe.distortion
            : defaults.distortion,
        seed: typeof recipe?.seed === "number" ? recipe.seed : defaults.seed,
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
      : source.kind === "noise"
        ? ({
            kind: "noise" as const,
            name: source.name,
            recipe: normalizeNoiseInput(source.recipe),
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
  source: SolidSourceInput | GradientSourceInput | NoiseSourceInput,
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
      : asset.kind === "noise"
        ? {
            kind: "noise" as const,
            name: source.name,
            recipe: normalizeNoiseInput(source as NoiseSourceInput),
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
