import type {
  SvgGeometryFit,
  SvgGeometryMirrorMode,
} from "@/types/project";

export const SVG_GEOMETRY_MAX_BYTES = 256 * 1024;

export const SVG_GEOMETRY_FIT_OPTIONS: SvgGeometryFit[] = [
  "contain",
  "cover",
  "stretch",
];

export const SVG_GEOMETRY_MIRROR_OPTIONS: SvgGeometryMirrorMode[] = [
  "none",
  "x",
  "y",
  "alternate",
];

const BLOCKED_ELEMENTS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "object",
  "embed",
  "audio",
  "video",
  "canvas",
]);

function parseDimension(value: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^([0-9]*\.?[0-9]+)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]!);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseViewBox(value: string | null) {
  if (!value) return null;
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number.parseFloat(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  const [, , width, height] = parts;
  return width > 0 && height > 0 ? { width, height } : null;
}

function hasExternalReference(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.startsWith("#")) return false;
  if (trimmed.startsWith("data:image/")) return false;
  const externalUrlPattern = /url\(\s*['"]?\s*(?:https?:|\/\/)/i;
  return (
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ||
    trimmed.startsWith("//") ||
    externalUrlPattern.test(trimmed) ||
    trimmed.includes("@import")
  );
}

export function sanitizeSvgGeometryMarkup(rawMarkup: string) {
  const size = new Blob([rawMarkup]).size;
  if (size > SVG_GEOMETRY_MAX_BYTES) {
    throw new Error("SVG geometry files must be 256 KB or smaller.");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawMarkup, "image/svg+xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("The SVG could not be parsed.");
  }

  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") {
    throw new Error("SVG geometry must use an <svg> root element.");
  }

  for (const element of Array.from(root.querySelectorAll("*"))) {
    const tagName = element.tagName.toLowerCase();
    if (BLOCKED_ELEMENTS.has(tagName)) {
      throw new Error(`SVG geometry cannot contain <${tagName}> elements.`);
    }
    if (tagName === "style" && hasExternalReference(element.textContent ?? "")) {
      throw new Error("SVG geometry cannot reference external resources.");
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value;
      if (name.startsWith("on")) {
        throw new Error("SVG geometry cannot contain event handlers.");
      }
      if (name === "xmlns" || name.startsWith("xmlns:")) {
        continue;
      }
      if (hasExternalReference(value)) {
        throw new Error("SVG geometry cannot reference external resources.");
      }
    }
  }

  for (const attribute of Array.from(root.attributes)) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;
    if (name.startsWith("on")) {
      throw new Error("SVG geometry cannot contain event handlers.");
    }
    if (name === "xmlns" || name.startsWith("xmlns:")) {
      continue;
    }
    if (hasExternalReference(value)) {
      throw new Error("SVG geometry cannot reference external resources.");
    }
  }

  if (!root.getAttribute("xmlns")) {
    root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }

  const viewBox = parseViewBox(root.getAttribute("viewBox"));
  const width = parseDimension(root.getAttribute("width")) ?? viewBox?.width ?? 100;
  const height = parseDimension(root.getAttribute("height")) ?? viewBox?.height ?? 100;
  if (!root.getAttribute("viewBox")) {
    root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height));

  return new XMLSerializer().serializeToString(root);
}

export async function readSvgGeometryFile(file: File) {
  if (file.size > SVG_GEOMETRY_MAX_BYTES) {
    throw new Error("SVG geometry files must be 256 KB or smaller.");
  }
  const markup = sanitizeSvgGeometryMarkup(await file.text());
  return {
    fileName: file.name,
    markup,
  };
}
