import { luminanceFromRgb, normalizeHexColor, rgbToHex } from "@/lib/color";
import { makeId } from "@/lib/id";
import { readBlob } from "@/lib/opfs";
import { clamp, lerp } from "@/lib/utils";
import type {
  CellularSourceRecipe,
  GradientDirection,
  GradientMode,
  GradientSourceRecipe,
  ImageSourceFitMode,
  PerlinSourceRecipe,
  ProcessedAssetPayload,
  ReactionSourceRecipe,
  SourceAsset,
  SourceKind,
  WaveSourceRecipe,
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
const DEFAULT_CELLULAR_SCALE = 0.55;
const DEFAULT_CELLULAR_JITTER = 0.6;
const DEFAULT_CELLULAR_EDGE = 0.55;
const DEFAULT_CELLULAR_CONTRAST = 0.45;
const DEFAULT_CELLULAR_SEED = 1;
const DEFAULT_REACTION_SCALE = 0.55;
const DEFAULT_REACTION_DIFFUSION = 0.55;
const DEFAULT_REACTION_BALANCE = 0.5;
const DEFAULT_REACTION_DISTORTION = 0.2;
const DEFAULT_REACTION_SEED = 1;
const DEFAULT_WAVE_SCALE = 0.55;
const DEFAULT_WAVE_INTERFERENCE = 0.65;
const DEFAULT_WAVE_DIRECTIONALITY = 0.6;
const DEFAULT_WAVE_DISTORTION = 0.2;
const DEFAULT_WAVE_SEED = 1;
export const DEFAULT_IMAGE_SOURCE_FIT_MODE: ImageSourceFitMode = "stretch";

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

export interface PerlinSourceInput {
  name?: string;
  color: string;
  scale: number;
  detail: number;
  contrast: number;
  distortion: number;
  seed: number;
}

export interface CellularSourceInput {
  name?: string;
  color: string;
  scale: number;
  jitter: number;
  edge: number;
  contrast: number;
  seed: number;
}

export interface ReactionSourceInput {
  name?: string;
  color: string;
  scale: number;
  diffusion: number;
  balance: number;
  distortion: number;
  seed: number;
}

export interface WaveSourceInput {
  name?: string;
  color: string;
  scale: number;
  interference: number;
  directionality: number;
  distortion: number;
  seed: number;
}

export type GeneratedSourceInput =
  | { kind: "solid"; name?: string; recipe: SolidSourceInput }
  | { kind: "gradient"; name?: string; recipe: GradientSourceInput }
  | { kind: "perlin"; name?: string; recipe: PerlinSourceInput }
  | { kind: "cellular"; name?: string; recipe: CellularSourceInput }
  | { kind: "reaction"; name?: string; recipe: ReactionSourceInput }
  | { kind: "waves"; name?: string; recipe: WaveSourceInput };

export interface AssetBlobPayloads {
  original: Blob | null;
  normalized: Blob | null;
  preview: Blob | null;
}

export interface PreparedAssetRecord {
  asset: SourceAsset;
  blobs: AssetBlobPayloads;
}

type LegacySourceAsset = Omit<SourceAsset, "kind"> & {
  kind?: SourceKind | "noise";
  fitMode?: unknown;
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

function normalizeImageSourceFitMode(value: unknown): ImageSourceFitMode {
  return value === "natural" || value === "stretch"
    ? value
    : DEFAULT_IMAGE_SOURCE_FIT_MODE;
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

function getDefaultPerlinRecipe(): PerlinSourceRecipe {
  return {
    color: "#0f766e",
    scale: DEFAULT_NOISE_SCALE,
    detail: DEFAULT_NOISE_DETAIL,
    contrast: DEFAULT_NOISE_CONTRAST,
    distortion: DEFAULT_NOISE_DISTORTION,
    seed: DEFAULT_NOISE_SEED,
  };
}

function getDefaultCellularRecipe(): CellularSourceRecipe {
  return {
    color: "#8b5cf6",
    scale: DEFAULT_CELLULAR_SCALE,
    jitter: DEFAULT_CELLULAR_JITTER,
    edge: DEFAULT_CELLULAR_EDGE,
    contrast: DEFAULT_CELLULAR_CONTRAST,
    seed: DEFAULT_CELLULAR_SEED,
  };
}

function getDefaultReactionRecipe(): ReactionSourceRecipe {
  return {
    color: "#ef4444",
    scale: DEFAULT_REACTION_SCALE,
    diffusion: DEFAULT_REACTION_DIFFUSION,
    balance: DEFAULT_REACTION_BALANCE,
    distortion: DEFAULT_REACTION_DISTORTION,
    seed: DEFAULT_REACTION_SEED,
  };
}

function getDefaultWaveRecipe(): WaveSourceRecipe {
  return {
    color: "#0ea5e9",
    scale: DEFAULT_WAVE_SCALE,
    interference: DEFAULT_WAVE_INTERFERENCE,
    directionality: DEFAULT_WAVE_DIRECTIONALITY,
    distortion: DEFAULT_WAVE_DISTORTION,
    seed: DEFAULT_WAVE_SEED,
  };
}

export function getDefaultGradientInput(): GradientSourceInput {
  return {
    name: "",
    ...getDefaultGradientRecipe(),
  };
}

export function getDefaultPerlinInput(): PerlinSourceInput {
  return {
    name: "",
    ...getDefaultPerlinRecipe(),
  };
}

export function getDefaultCellularInput(): CellularSourceInput {
  return {
    name: "",
    ...getDefaultCellularRecipe(),
  };
}

export function getDefaultReactionInput(): ReactionSourceInput {
  return {
    name: "",
    ...getDefaultReactionRecipe(),
  };
}

export function getDefaultWaveInput(): WaveSourceInput {
  return {
    name: "",
    ...getDefaultWaveRecipe(),
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

function normalizePerlinRecipe(input: Omit<PerlinSourceInput, "name">): PerlinSourceRecipe {
  const defaults = getDefaultPerlinRecipe();

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

function normalizeCellularRecipe(
  input: Omit<CellularSourceInput, "name">,
): CellularSourceRecipe {
  const defaults = getDefaultCellularRecipe();

  return {
    color: normalizeHexColor(input.color, defaults.color),
    scale: clampRange(input.scale, 0, 1, defaults.scale),
    jitter: clampRange(input.jitter, 0, 1, defaults.jitter),
    edge: clampRange(input.edge, 0, 1, defaults.edge),
    contrast: clampRange(input.contrast, 0, 1, defaults.contrast),
    seed: Number.isFinite(input.seed)
      ? Math.abs(Math.trunc(input.seed)) >>> 0
      : defaults.seed,
  };
}

function normalizeReactionRecipe(
  input: Omit<ReactionSourceInput, "name">,
): ReactionSourceRecipe {
  const defaults = getDefaultReactionRecipe();

  return {
    color: normalizeHexColor(input.color, defaults.color),
    scale: clampRange(input.scale, 0, 1, defaults.scale),
    diffusion: clampRange(input.diffusion, 0, 1, defaults.diffusion),
    balance: clampRange(input.balance, 0, 1, defaults.balance),
    distortion: clampRange(input.distortion, 0, 1, defaults.distortion),
    seed: Number.isFinite(input.seed)
      ? Math.abs(Math.trunc(input.seed)) >>> 0
      : defaults.seed,
  };
}

function normalizeWaveRecipe(input: Omit<WaveSourceInput, "name">): WaveSourceRecipe {
  const defaults = getDefaultWaveRecipe();

  return {
    color: normalizeHexColor(input.color, defaults.color),
    scale: clampRange(input.scale, 0, 1, defaults.scale),
    interference: clampRange(
      input.interference,
      0,
      1,
      defaults.interference,
    ),
    directionality: clampRange(
      input.directionality,
      0,
      1,
      defaults.directionality,
    ),
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

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(edge1 - edge0, 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}

function sampleBilinearField(
  field: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
) {
  const clampedX = clamp(x, 0, width - 1);
  const clampedY = clamp(y, 0, height - 1);
  const x0 = Math.floor(clampedX);
  const y0 = Math.floor(clampedY);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = clampedX - x0;
  const ty = clampedY - y0;
  const top = lerp(field[y0 * width + x0] ?? 0, field[y0 * width + x1] ?? 0, tx);
  const bottom = lerp(
    field[y1 * width + x0] ?? 0,
    field[y1 * width + x1] ?? 0,
    tx,
  );
  return lerp(top, bottom, ty);
}

function shadeTextureValue(
  data: Uint8ClampedArray,
  index: number,
  base: ReturnType<typeof rgbToHsl>,
  value: number,
) {
  const shapedValue = clamp(value, 0, 1);
  const lightness = clamp(base.l + lerp(-0.26, 0.18, shapedValue), 0.08, 0.9);
  const saturation = clamp(base.s + lerp(0.08, -0.05, shapedValue), 0.12, 0.96);
  const rgb = hslToRgb(base.h, saturation, lightness);
  data[index] = rgb.r;
  data[index + 1] = rgb.g;
  data[index + 2] = rgb.b;
  data[index + 3] = 255;
}

function drawPerlinSource(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  recipe: PerlinSourceRecipe,
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
      const index = (y * width + x) * 4;
      shadeTextureValue(data, index, base, shapedValue);
    }
  }

  context.putImageData(image, 0, 0);
}

function drawCellularSource(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  recipe: CellularSourceRecipe,
) {
  const { r, g, b } = hexToRgbTriplet(recipe.color);
  const base = rgbToHsl(r, g, b);
  const image = context.createImageData(width, height);
  const data = image.data;
  const shortestSide = Math.max(1, Math.min(width, height));
  const cellFrequency = lerp(5.5, 22, recipe.scale);
  const jitterAmount = lerp(0.05, 0.95, recipe.jitter);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x / shortestSide) * cellFrequency;
      const ny = (y / shortestSide) * cellFrequency;
      const cellX = Math.floor(nx);
      const cellY = Math.floor(ny);
      let nearest = Number.POSITIVE_INFINITY;
      let secondNearest = Number.POSITIVE_INFINITY;

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const ix = cellX + offsetX;
          const iy = cellY + offsetY;
          const pointX = ix + 0.5 + (hash2D(ix, iy, recipe.seed + 17) - 0.5) * jitterAmount;
          const pointY = iy + 0.5 + (hash2D(ix, iy, recipe.seed + 101) - 0.5) * jitterAmount;
          const distance = Math.hypot(nx - pointX, ny - pointY);
          if (distance < nearest) {
            secondNearest = nearest;
            nearest = distance;
          } else if (distance < secondNearest) {
            secondNearest = distance;
          }
        }
      }

      const cellFill = 1 - clamp(nearest / 1.35, 0, 1);
      const edgeGap = clamp(secondNearest - nearest, 0, 1);
      const edgeMask = 1 - smoothstep(0.03, lerp(0.24, 0.06, recipe.edge), edgeGap);
      const sample = clamp(
        lerp(cellFill, edgeMask, recipe.edge * 0.8) + edgeMask * 0.12,
        0,
        1,
      );
      const shapedValue = shapeNoiseValue(sample, recipe.contrast);
      const index = (y * width + x) * 4;
      shadeTextureValue(data, index, base, shapedValue);
    }
  }

  context.putImageData(image, 0, 0);
}

function drawReactionSource(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  recipe: ReactionSourceRecipe,
) {
  const { r, g, b } = hexToRgbTriplet(recipe.color);
  const base = rgbToHsl(r, g, b);
  const image = context.createImageData(width, height);
  const data = image.data;
  const simulationWidth = clamp(
    Math.round(lerp(48, 112, recipe.scale)),
    24,
    Math.max(24, width),
  );
  const simulationHeight = Math.max(
    24,
    Math.round((simulationWidth * height) / Math.max(width, 1)),
  );
  const a = new Float32Array(simulationWidth * simulationHeight).fill(1);
  const bField = new Float32Array(simulationWidth * simulationHeight);
  const nextA = new Float32Array(simulationWidth * simulationHeight);
  const nextB = new Float32Array(simulationWidth * simulationHeight);
  const feed = lerp(0.026, 0.058, recipe.balance);
  const kill = lerp(0.05, 0.064, recipe.balance);
  const diffusionA = lerp(0.16, 0.24, recipe.diffusion);
  const diffusionB = lerp(0.08, 0.14, recipe.diffusion);
  const iterations = Math.round(lerp(14, 42, recipe.scale));

  for (let y = 0; y < simulationHeight; y += 1) {
    for (let x = 0; x < simulationWidth; x += 1) {
      const index = y * simulationWidth + x;
      const nx = x / simulationWidth;
      const ny = y / simulationHeight;
      const seedNoise = sampleFbm(
        nx * lerp(2.5, 8, recipe.scale),
        ny * lerp(2.5, 8, recipe.scale),
        recipe.seed,
        3,
        0.55,
        2,
      );
      const radial = Math.hypot(nx - 0.5, ny - 0.5);
      const blot = seedNoise * 0.5 + 0.5 > lerp(0.48, 0.58, recipe.balance) - radial * 0.15;
      if (blot) {
        bField[index] = lerp(0.55, 1, recipe.diffusion);
        a[index] = 1 - bField[index] * 0.45;
      }
    }
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let y = 0; y < simulationHeight; y += 1) {
      for (let x = 0; x < simulationWidth; x += 1) {
        const index = y * simulationWidth + x;
        const centerA = a[index] ?? 1;
        const centerB = bField[index] ?? 0;
        let laplaceA = -centerA;
        let laplaceB = -centerB;

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) continue;
            const nx = Math.min(
              simulationWidth - 1,
              Math.max(0, x + offsetX),
            );
            const ny = Math.min(
              simulationHeight - 1,
              Math.max(0, y + offsetY),
            );
            const weight = offsetX === 0 || offsetY === 0 ? 0.2 : 0.05;
            const neighborIndex = ny * simulationWidth + nx;
            laplaceA += (a[neighborIndex] ?? centerA) * weight;
            laplaceB += (bField[neighborIndex] ?? centerB) * weight;
          }
        }

        const reaction = centerA * centerB * centerB;
        nextA[index] = clamp(
          centerA + (diffusionA * laplaceA - reaction + feed * (1 - centerA)),
          0,
          1,
        );
        nextB[index] = clamp(
          centerB + (diffusionB * laplaceB + reaction - (kill + feed) * centerB),
          0,
          1,
        );
      }
    }

    a.set(nextA);
    bField.set(nextB);
  }

  const shortestSide = Math.max(1, Math.min(width, height));
  const warpAmount = recipe.distortion * 4;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / shortestSide;
      const ny = y / shortestSide;
      const warpX =
        sampleFbm(nx * 1.8 + 13.7, ny * 1.8 + 7.3, recipe.seed + 19, 3, 0.55, 2) *
        warpAmount;
      const warpY =
        sampleFbm(nx * 1.8 + 47.1, ny * 1.8 + 29.4, recipe.seed + 97, 3, 0.55, 2) *
        warpAmount;
      const sample = sampleBilinearField(
        bField,
        simulationWidth,
        simulationHeight,
        ((x / Math.max(width - 1, 1)) * (simulationWidth - 1)) + warpX,
        ((y / Math.max(height - 1, 1)) * (simulationHeight - 1)) + warpY,
      );
      const shapedValue = shapeNoiseValue(sample, recipe.balance);
      const index = (y * width + x) * 4;
      shadeTextureValue(data, index, base, shapedValue);
    }
  }

  context.putImageData(image, 0, 0);
}

function drawWaveSource(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  recipe: WaveSourceRecipe,
) {
  const { r, g, b } = hexToRgbTriplet(recipe.color);
  const base = rgbToHsl(r, g, b);
  const image = context.createImageData(width, height);
  const data = image.data;
  const shortestSide = Math.max(1, Math.min(width, height));
  const baseFrequency = lerp(5, 30, recipe.scale);
  const directionAngle = lerp(Math.PI / 10, Math.PI / 2, recipe.directionality);
  const dirX = Math.cos(directionAngle);
  const dirY = Math.sin(directionAngle);
  const crossX = -dirY;
  const crossY = dirX;
  const warpAmount = recipe.distortion * 0.18;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / shortestSide;
      const ny = y / shortestSide;
      const warpX =
        sampleFbm(nx * 2.2 + 5.1, ny * 2.2 + 17.4, recipe.seed + 7, 3, 0.55, 2) *
        warpAmount;
      const warpY =
        sampleFbm(nx * 2.2 + 61.3, ny * 2.2 + 43.2, recipe.seed + 29, 3, 0.55, 2) *
        warpAmount;
      const px = nx + warpX;
      const py = ny + warpY;
      const primaryAxis = px * dirX + py * dirY;
      const crossAxis = px * crossX + py * crossY;
      const primary = Math.sin(primaryAxis * baseFrequency * Math.PI * 2);
      const secondary = Math.sin(
        (primaryAxis * lerp(1.8, 4.4, recipe.interference) +
          crossAxis * lerp(0.2, 2.1, 1 - recipe.directionality)) *
          Math.PI *
          2,
      );
      const tertiary = Math.cos(
        (crossAxis * baseFrequency * lerp(0.45, 1.8, recipe.interference) +
          primaryAxis * 0.7) *
          Math.PI *
          2,
      );
      const blend = lerp(
        primary,
        primary * 0.45 + secondary * 0.35 + tertiary * 0.2,
        recipe.interference,
      );
      const sample = clamp(blend * 0.5 + 0.5, 0, 1);
      const shapedValue = shapeNoiseValue(sample, recipe.interference);
      const index = (y * width + x) * 4;
      shadeTextureValue(data, index, base, shapedValue);
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

  if (source.kind === "perlin") {
    drawPerlinSource(context, width, height, normalizePerlinRecipe(source.recipe));
    return;
  }

  if (source.kind === "cellular") {
    drawCellularSource(
      context,
      width,
      height,
      normalizeCellularRecipe(source.recipe),
    );
    return;
  }

  if (source.kind === "reaction") {
    drawReactionSource(
      context,
      width,
      height,
      normalizeReactionRecipe(source.recipe),
    );
    return;
  }

  if (source.kind === "waves") {
    drawWaveSource(context, width, height, normalizeWaveRecipe(source.recipe));
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

function normalizeGeneratedSourceInput(
  source: GeneratedSourceInput,
): GeneratedSourceInput {
  if (source.kind === "solid") {
    return {
      kind: "solid",
      name: source.name,
      recipe: normalizeSolidInput(source.recipe),
    };
  }

  if (source.kind === "perlin") {
    return {
      kind: "perlin",
      name: source.name,
      recipe: normalizePerlinInput(source.recipe),
    };
  }

  if (source.kind === "cellular") {
    return {
      kind: "cellular",
      name: source.name,
      recipe: normalizeCellularInput(source.recipe),
    };
  }

  if (source.kind === "reaction") {
    return {
      kind: "reaction",
      name: source.name,
      recipe: normalizeReactionInput(source.recipe),
    };
  }

  if (source.kind === "waves") {
    return {
      kind: "waves",
      name: source.name,
      recipe: normalizeWaveInput(source.recipe),
    };
  }

  return {
    kind: "gradient",
    name: source.name,
    recipe: normalizeGradientRecipe(source.recipe),
  };
}

export function renderGeneratedSourceToCanvas(
  canvas: HTMLCanvasElement,
  source: GeneratedSourceInput,
) {
  const width = Math.max(1, Math.round(canvas.width));
  const height = Math.max(1, Math.round(canvas.height));
  const context = canvas.getContext("2d", {
    willReadFrequently:
      source.kind === "perlin" ||
      source.kind === "cellular" ||
      source.kind === "reaction" ||
      source.kind === "waves",
  });
  if (!context) {
    throw new Error("Unable to create a canvas for generated source preview.");
  }

  drawGeneratedSource(
    context,
    width,
    height,
    normalizeGeneratedSourceInput(source),
  );
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

  if (source.kind === "perlin") {
    return `Perlin ${normalizeHexColor(source.recipe.color).toUpperCase()}`;
  }

  if (source.kind === "cellular") {
    return `Cellular ${normalizeHexColor(source.recipe.color).toUpperCase()}`;
  }

  if (source.kind === "reaction") {
    return `Reaction ${normalizeHexColor(source.recipe.color).toUpperCase()}`;
  }

  if (source.kind === "waves") {
    return `Waves ${normalizeHexColor(source.recipe.color).toUpperCase()}`;
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
  if (kind === "perlin") return "Perlin";
  if (kind === "cellular") return "Cellular";
  if (kind === "reaction") return "Reaction";
  if (kind === "waves") return "Waves";
  return "Image";
}

export function getSourceContentSignature(asset: SourceAsset) {
  const base = [
    asset.id,
    asset.kind,
    asset.kind === "image" ? asset.fitMode : "",
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

  if (asset.kind === "perlin") {
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

  if (asset.kind === "cellular") {
    return [
      base,
      asset.recipe.color,
      asset.recipe.scale,
      asset.recipe.jitter,
      asset.recipe.edge,
      asset.recipe.contrast,
      asset.recipe.seed,
    ].join("|");
  }

  if (asset.kind === "reaction") {
    return [
      base,
      asset.recipe.color,
      asset.recipe.scale,
      asset.recipe.diffusion,
      asset.recipe.balance,
      asset.recipe.distortion,
      asset.recipe.seed,
    ].join("|");
  }

  if (asset.kind === "waves") {
    return [
      base,
      asset.recipe.color,
      asset.recipe.scale,
      asset.recipe.interference,
      asset.recipe.directionality,
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

export function normalizePerlinInput(input: PerlinSourceInput): PerlinSourceInput {
  return {
    name: input.name?.trim() ?? "",
    ...normalizePerlinRecipe(input),
  };
}

export function normalizeCellularInput(
  input: CellularSourceInput,
): CellularSourceInput {
  return {
    name: input.name?.trim() ?? "",
    ...normalizeCellularRecipe(input),
  };
}

export function normalizeReactionInput(
  input: ReactionSourceInput,
): ReactionSourceInput {
  return {
    name: input.name?.trim() ?? "",
    ...normalizeReactionRecipe(input),
  };
}

export function normalizeWaveInput(input: WaveSourceInput): WaveSourceInput {
  return {
    name: input.name?.trim() ?? "",
    ...normalizeWaveRecipe(input),
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

  if (asset.kind === "noise" || asset.kind === "perlin") {
    const recipe = asset.recipe as Partial<PerlinSourceInput> | undefined;
    const defaults = getDefaultPerlinRecipe();
    return {
      ...asset,
      kind: "perlin",
      recipe: normalizePerlinRecipe({
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

  if (asset.kind === "cellular") {
    const recipe = asset.recipe as Partial<CellularSourceInput> | undefined;
    const defaults = getDefaultCellularRecipe();
    return {
      ...asset,
      kind: "cellular",
      recipe: normalizeCellularRecipe({
        color: recipe?.color ?? asset.averageColor ?? defaults.color,
        scale: typeof recipe?.scale === "number" ? recipe.scale : defaults.scale,
        jitter:
          typeof recipe?.jitter === "number" ? recipe.jitter : defaults.jitter,
        edge: typeof recipe?.edge === "number" ? recipe.edge : defaults.edge,
        contrast:
          typeof recipe?.contrast === "number"
            ? recipe.contrast
            : defaults.contrast,
        seed: typeof recipe?.seed === "number" ? recipe.seed : defaults.seed,
      }),
    };
  }

  if (asset.kind === "reaction") {
    const recipe = asset.recipe as Partial<ReactionSourceInput> | undefined;
    const defaults = getDefaultReactionRecipe();
    return {
      ...asset,
      kind: "reaction",
      recipe: normalizeReactionRecipe({
        color: recipe?.color ?? asset.averageColor ?? defaults.color,
        scale: typeof recipe?.scale === "number" ? recipe.scale : defaults.scale,
        diffusion:
          typeof recipe?.diffusion === "number"
            ? recipe.diffusion
            : defaults.diffusion,
        balance:
          typeof recipe?.balance === "number"
            ? recipe.balance
            : defaults.balance,
        distortion:
          typeof recipe?.distortion === "number"
            ? recipe.distortion
            : defaults.distortion,
        seed: typeof recipe?.seed === "number" ? recipe.seed : defaults.seed,
      }),
    };
  }

  if (asset.kind === "waves") {
    const recipe = asset.recipe as Partial<WaveSourceInput> | undefined;
    const defaults = getDefaultWaveRecipe();
    return {
      ...asset,
      kind: "waves",
      recipe: normalizeWaveRecipe({
        color: recipe?.color ?? asset.averageColor ?? defaults.color,
        scale: typeof recipe?.scale === "number" ? recipe.scale : defaults.scale,
        interference:
          typeof recipe?.interference === "number"
            ? recipe.interference
            : defaults.interference,
        directionality:
          typeof recipe?.directionality === "number"
            ? recipe.directionality
            : defaults.directionality,
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
    fitMode: normalizeImageSourceFitMode(asset.fitMode),
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

function buildAssetPayload(
  assetId: string,
  originalFileName: string,
  payload: ProcessedAssetPayload,
) {
  const { originalPath, normalizedPath, previewPath } = getAssetStoragePaths(
    assetId,
    originalFileName,
  );

  return {
    originalPath,
    normalizedPath,
    previewPath,
    blobs: {
      original: payload.blob,
      normalized: payload.normalizedBlob,
      preview: payload.previewBlob,
    } satisfies AssetBlobPayloads,
  };
}

export async function persistProcessedAsset(
  file: File,
  payload: ProcessedAssetPayload,
  projectId: string,
) {
  const assetId = makeId("asset");
  const { originalPath, normalizedPath, previewPath, blobs } = buildAssetPayload(
    assetId,
    file.name,
    payload,
  );

  return {
    asset: normalizeSourceAsset({
      id: assetId,
      kind: "image",
      fitMode: DEFAULT_IMAGE_SOURCE_FIT_MODE,
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
    }),
    blobs,
  } satisfies PreparedAssetRecord;
}

export async function createGeneratedSourceAsset(
  source: GeneratedSourceInput,
  projectId: string,
  size: Pick<SourceAsset, "width" | "height">,
) {
  const assetId = makeId("asset");
  const normalizedSource = normalizeGeneratedSourceInput(source);
  const payload = await buildGeneratedSourcePayload(
    normalizedSource,
    size.width,
    size.height,
  );
  const originalFileName = buildGeneratedOriginalFileName(normalizedSource.kind, assetId);
  const { originalPath, normalizedPath, previewPath, blobs } = buildAssetPayload(
    assetId,
    originalFileName,
    payload,
  );

  return {
    asset: normalizeSourceAsset({
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
    }),
    blobs,
  } satisfies PreparedAssetRecord;
}

export async function updateGeneratedSourceAsset(
  asset: SourceAsset,
  source:
    | SolidSourceInput
    | GradientSourceInput
    | PerlinSourceInput
    | CellularSourceInput
    | ReactionSourceInput
    | WaveSourceInput,
) {
  if (asset.kind === "image") {
    throw new Error("Image sources cannot be edited.");
  }

  const nextSource: GeneratedSourceInput =
    asset.kind === "solid"
      ? {
          kind: "solid",
          name: source.name,
          recipe: source as SolidSourceInput,
        }
      : asset.kind === "perlin"
        ? {
            kind: "perlin",
            name: source.name,
            recipe: source as PerlinSourceInput,
          }
        : asset.kind === "cellular"
          ? {
              kind: "cellular",
              name: source.name,
              recipe: source as CellularSourceInput,
            }
          : asset.kind === "reaction"
            ? {
                kind: "reaction",
                name: source.name,
                recipe: source as ReactionSourceInput,
              }
            : asset.kind === "waves"
              ? {
                  kind: "waves",
                  name: source.name,
                  recipe: source as WaveSourceInput,
                }
              : {
                  kind: "gradient",
                  name: source.name,
                  recipe: source as GradientSourceInput,
                };
  const normalizedSource = normalizeGeneratedSourceInput(nextSource);

  const payload = await buildGeneratedSourcePayload(
    normalizedSource,
    asset.width,
    asset.height,
  );

  return {
    asset: normalizeSourceAsset({
      ...asset,
      name: buildGeneratedSourceName(normalizedSource),
      mimeType: payload.mimeType,
      averageColor: payload.averageColor,
      palette: payload.palette,
      luminance: payload.luminance,
      recipe: normalizedSource.recipe,
    }),
    blobs: {
      original: payload.blob,
      normalized: payload.normalizedBlob,
      preview: payload.previewBlob,
    },
  } satisfies PreparedAssetRecord;
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

  return {
    asset: normalizeSourceAsset({
      ...asset,
      id: assetId,
      projectId,
      originalFileName,
      originalPath,
      normalizedPath,
      previewPath,
      createdAt: new Date().toISOString(),
    }),
    blobs: {
      original,
      normalized,
      preview,
    },
  } satisfies PreparedAssetRecord;
}

export function clampCanvasDimension(value: number, fallback: number) {
  return clamp(Math.round(value), 1, Math.max(1, fallback));
}
