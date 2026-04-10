import type { GradientDirection, GradientMode, SourceKind } from "@/types/project";

/** UI scaling factor applied to the raw density value for the slider display. */
export const DENSITY_UI_SCALE = 4;

/** Maximum slider value for organic distribution. */
export const ORGANIC_DISTRIBUTION_MAX = 4_096;

/** Maximum slider value for 3D distribution. */
export const THREE_D_DISTRIBUTION_MAX = 4_096;

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

export function createNoiseSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}
