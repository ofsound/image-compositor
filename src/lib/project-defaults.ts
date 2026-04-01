import type {
  CanvasSettings,
  CompositingSettings,
  EffectSettings,
  ExportSettings,
  GeneratorPreset,
  LayoutSettings,
  ProjectDocument,
  ProjectSnapshot,
  RenderPass,
  SourceMappingSettings,
} from "@/types/project";
import { makeId } from "@/lib/id";

export const DEFAULT_CANVAS: CanvasSettings = {
  width: 1800,
  height: 1200,
  background: "#f5efe4",
  inset: 48,
};

export const DEFAULT_LAYOUT: LayoutSettings = {
  family: "blocks",
  shapeMode: "mixed",
  density: 0.68,
  columns: 8,
  rows: 6,
  gutter: 14,
  blockDepth: 3,
  stripOrientation: "mixed",
  radialSegments: 9,
  radialRings: 4,
  symmetryMode: "mirror-x",
  symmetryCopies: 4,
  randomness: 0.52,
};

export const DEFAULT_SOURCE_MAPPING: SourceMappingSettings = {
  strategy: "palette",
  sourceBias: 0.62,
  preserveAspect: true,
  cropZoom: 1,
  luminanceSort: "descending",
  paletteEmphasis: 0.72,
};

export const DEFAULT_EFFECTS: EffectSettings = {
  blur: 0,
  sharpen: 0.18,
  mirror: false,
  kaleidoscopeSegments: 3,
  rotationJitter: 18,
  scaleJitter: 0.14,
  displacement: 24,
  distortion: 0.24,
};

export const DEFAULT_COMPOSITING: CompositingSettings = {
  blendMode: "source-over",
  opacity: 0.94,
  overlap: 0.22,
  shadow: 0.08,
  feather: 0.04,
};

export const DEFAULT_EXPORT: ExportSettings = {
  format: "image/png",
  quality: 0.96,
  width: 3840,
  height: 2560,
  scale: 1,
};

export const DEFAULT_PASSES: RenderPass[] = [
  { id: "layout", type: "layout", enabled: true, label: "Layout" },
  { id: "assignment", type: "assignment", enabled: true, label: "Assignment" },
  { id: "transform", type: "transform", enabled: true, label: "Transform" },
  { id: "compose", type: "compose", enabled: true, label: "Compose" },
  { id: "export", type: "export", enabled: true, label: "Export" },
];

export const DEFAULT_PRESETS: GeneratorPreset[] = [
  {
    id: "pack",
    name: "Packed Echo",
    family: "blocks",
    seedOffset: 0,
    params: { emphasis: 0.74, shapeBias: "mixed" },
  },
  {
    id: "radial",
    name: "Signal Wedge",
    family: "radial",
    seedOffset: 57,
    params: { density: 0.5, symmetry: "radial" },
  },
];

export function createSnapshot(): ProjectSnapshot {
  return {
    sourceIds: [],
    canvas: structuredClone(DEFAULT_CANVAS),
    layout: structuredClone(DEFAULT_LAYOUT),
    sourceMapping: structuredClone(DEFAULT_SOURCE_MAPPING),
    effects: structuredClone(DEFAULT_EFFECTS),
    compositing: structuredClone(DEFAULT_COMPOSITING),
    export: structuredClone(DEFAULT_EXPORT),
    activeSeed: 187310,
    presets: structuredClone(DEFAULT_PRESETS),
    passes: structuredClone(DEFAULT_PASSES),
  };
}

export function createProjectDocument(title = "Untitled Composition"): ProjectDocument {
  const now = new Date().toISOString();
  return {
    id: makeId("project"),
    title,
    currentVersionId: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...createSnapshot(),
  };
}
