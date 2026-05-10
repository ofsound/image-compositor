import { clamp } from "@/lib/utils";

export function normalizeHexColor(value: string, fallback = "#000000") {
  const candidate = value.trim();
  const normalized = candidate.startsWith("#") ? candidate.slice(1) : candidate;

  if (/^[\da-fA-F]{6}$/.test(normalized)) {
    return `#${normalized.toLowerCase()}`;
  }

  if (/^[\da-fA-F]{3}$/.test(normalized)) {
    return `#${normalized
      .split("")
      .map((char) => `${char}${char}`)
      .join("")
      .toLowerCase()}`;
  }

  return fallback;
}

export function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function luminanceFromRgb(r: number, g: number, b: number) {
  const [nr, ng, nb] = [r, g, b].map((value) => value / 255);
  return 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;
}

export function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  return `#${normalized}${Math.round(clamp(alpha, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0")}`;
}
