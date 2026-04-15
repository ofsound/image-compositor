import type {
  FractalVariant,
  GradientDirection,
  GradientMode,
  SourceKind,
} from "@/types/project";

/** UI scaling factor applied to the raw density value for the slider display. */
export const DENSITY_UI_SCALE = 4;

/** Maximum slider value for organic distribution. */
export const ORGANIC_DISTRIBUTION_MAX = 4_096;

/** Maximum slider value for 3D distribution. */
export const THREE_D_DISTRIBUTION_MAX = 4_096;

export function formatFractalVariantLabel(variant: FractalVariant) {
  return variant
    .split("-")
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPercentValue(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function formatDegreeValue(value: number) {
  return `${Math.round(value)}°`;
}

export function formatSourceWeightValue(value: number) {
  const rounded = Math.round(value * 100) / 100;
  const displayValue = Number.isInteger(rounded)
    ? rounded.toFixed(0)
    : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${displayValue}x`;
}

export function formatSourceModeLabel(mode: SourceKind) {
  if (mode === "solid") return "Solid";
  if (mode === "gradient") return "Gradient";
  if (mode === "perlin") return "Perlin";
  if (mode === "cellular") return "Cellular";
  if (mode === "reaction") return "Reaction";
  if (mode === "waves") return "Waves";
  return "Image";
}

export function formatGradientDirectionLabel(direction: GradientDirection) {
  if (direction === "diagonal-down") return "Diagonal down";
  if (direction === "diagonal-up") return "Diagonal up";
  return direction[0]!.toUpperCase() + direction.slice(1);
}

export function formatGradientModeLabel(mode: GradientMode) {
  return mode[0]!.toUpperCase() + mode.slice(1);
}

export function parseNumericInputValue(text: string) {
  const normalized = text.trim();
  if (!normalized) return null;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractNumericInputValue(text: string) {
  const match = text.trim().match(/[+-]?(?:\d+\.?\d*|\.\d+)/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePercentInputValue(text: string) {
  const normalized = text.trim();
  if (!normalized) return null;

  const parsed = extractNumericInputValue(normalized);
  if (parsed === null) return null;
  if (normalized.includes("%")) return parsed / 100;
  if (Math.abs(parsed) <= 1 && normalized.includes(".")) return parsed;
  return parsed / 100;
}

export function parseDegreeInputValue(text: string) {
  return extractNumericInputValue(text);
}

export function parsePixelInputValue(text: string) {
  return extractNumericInputValue(text);
}

export function parseSegmentInputValue(text: string) {
  return extractNumericInputValue(text);
}

export function parseMultiplierInputValue(text: string) {
  return extractNumericInputValue(text);
}

export function parseFormattedSliderInputValue(text: string) {
  const normalized = text.trim();
  if (!normalized) return null;
  if (normalized.includes("%")) return parsePercentInputValue(normalized);
  if (normalized.includes("°")) return parseDegreeInputValue(normalized);
  if (normalized.toLowerCase().includes("px")) return parsePixelInputValue(normalized);
  if (normalized.toLowerCase().includes("seg")) return parseSegmentInputValue(normalized);
  if (normalized.toLowerCase().endsWith("x")) return parseMultiplierInputValue(normalized);
  return parseNumericInputValue(normalized);
}

function getDecimalPlaces(value: number) {
  if (!Number.isFinite(value)) return 0;

  const serialized = value.toString().toLowerCase();
  if (serialized.includes("e-")) {
    const [, exponent = "0"] = serialized.split("e-");
    return Number.parseInt(exponent, 10);
  }

  const [, fraction = ""] = serialized.split(".");
  return fraction.length;
}

export function normalizeSliderInputValue({
  value,
  min,
  max,
  step,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
}) {
  const clampedValue = Math.min(max, Math.max(min, value));
  const snappedValue = min + Math.round((clampedValue - min) / step) * step;
  const precision = Math.max(
    getDecimalPlaces(min),
    getDecimalPlaces(max),
    getDecimalPlaces(step),
  );
  const roundedValue = Number(snappedValue.toFixed(precision));
  return Math.min(max, Math.max(min, roundedValue));
}

export function createNoiseSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}
