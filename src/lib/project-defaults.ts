import type {
  CanvasSettings,
  CropDistribution,
  CompositingSettings,
  EffectSettings,
  ExportSettings,
  GeneratorPreset,
  LayoutSettings,
  ProjectDocument,
  ProjectSnapshot,
  ProjectVersion,
  RenderPass,
  SourceMappingSettings,
} from "@/types/project";
import { makeId } from "@/lib/id";

export const DEFAULT_CANVAS: CanvasSettings = {
  width: 3000,
  height: 3000,
  background: "#f5efe4",
  backgroundAlpha: 0,
  inset: 48,
};

export function normalizeCanvasSettings(
  canvas: Partial<CanvasSettings> | undefined,
): CanvasSettings {
  return {
    width: canvas?.width ?? DEFAULT_CANVAS.width,
    height: canvas?.height ?? DEFAULT_CANVAS.height,
    background: canvas?.background ?? DEFAULT_CANVAS.background,
    backgroundAlpha: canvas?.backgroundAlpha ?? DEFAULT_CANVAS.backgroundAlpha,
    inset: canvas?.inset ?? DEFAULT_CANVAS.inset,
  };
}

export const DEFAULT_LAYOUT: LayoutSettings = {
  family: "grid",
  shapeMode: "rect",
  rectCornerRadius: 0,
  density: 0.68,
  stripAngle: 0,
  columns: 8,
  rows: 8,
  gutter: 14,
  blockDepth: 3,
  blockSplitRandomness: 0.5,
  blockMinSize: 140,
  blockSplitBias: 0.5,
  stripOrientation: "mixed",
  radialSegments: 9,
  radialRings: 4,
  radialAngleOffset: 0,
  radialRingPhaseStep: 0,
  radialInnerRadius: 0,
  radialChildRotationMode: "tangent",
  symmetryMode: "none",
  symmetryCopies: 4,
  hidePercentage: 0,
  letterbox: 0,
  wedgeAngle: 120,
  wedgeJitter: 0,
  randomness: 0.52,
};

function normalizeStripAngle(layout: Partial<LayoutSettings> | undefined) {
  if (layout?.stripAngle !== undefined) return layout.stripAngle;
  if (layout?.stripOrientation === "horizontal") return 90;
  return DEFAULT_LAYOUT.stripAngle;
}

export const DEFAULT_SOURCE_MAPPING: SourceMappingSettings = {
  strategy: "palette",
  sourceBias: 0.62,
  preserveAspect: true,
  cropDistribution: "distributed",
  cropZoom: 1,
  luminanceSort: "descending",
  paletteEmphasis: 0.72,
};

export const DEFAULT_EFFECTS: EffectSettings = {
  blur: 0,
  sharpen: 0,
  mirror: false,
  kaleidoscopeSegments: 1,
  rotationJitter: 0,
  scaleJitter: 0,
  displacement: 0,
  distortion: 0,
};

export const DEFAULT_COMPOSITING: CompositingSettings = {
  blendMode: "source-over",
  opacity: 1,
  overlap: 0.0,
  shadow: 0.08,
  feather: 0.04,
};

export const DEFAULT_EXPORT: ExportSettings = {
  format: "image/png",
  quality: 0.96,
  width: 3000,
  height: 3000,
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

export function normalizeLayoutSettings(
  layout: Partial<LayoutSettings> | undefined,
): LayoutSettings {
  return {
    family: layout?.family ?? DEFAULT_LAYOUT.family,
    shapeMode: layout?.shapeMode ?? DEFAULT_LAYOUT.shapeMode,
    rectCornerRadius:
      layout?.rectCornerRadius ?? DEFAULT_LAYOUT.rectCornerRadius,
    density: layout?.density ?? DEFAULT_LAYOUT.density,
    stripAngle: normalizeStripAngle(layout),
    columns: layout?.columns ?? DEFAULT_LAYOUT.columns,
    rows: layout?.rows ?? DEFAULT_LAYOUT.rows,
    gutter: layout?.gutter ?? DEFAULT_LAYOUT.gutter,
    blockDepth: layout?.blockDepth ?? DEFAULT_LAYOUT.blockDepth,
    blockSplitRandomness:
      layout?.blockSplitRandomness ?? DEFAULT_LAYOUT.blockSplitRandomness,
    blockMinSize: layout?.blockMinSize ?? DEFAULT_LAYOUT.blockMinSize,
    blockSplitBias: layout?.blockSplitBias ?? DEFAULT_LAYOUT.blockSplitBias,
    stripOrientation:
      layout?.stripOrientation ?? DEFAULT_LAYOUT.stripOrientation,
    radialSegments: layout?.radialSegments ?? DEFAULT_LAYOUT.radialSegments,
    radialRings: layout?.radialRings ?? DEFAULT_LAYOUT.radialRings,
    radialAngleOffset:
      layout?.radialAngleOffset ?? DEFAULT_LAYOUT.radialAngleOffset,
    radialRingPhaseStep:
      layout?.radialRingPhaseStep ?? DEFAULT_LAYOUT.radialRingPhaseStep,
    radialInnerRadius:
      layout?.radialInnerRadius ?? DEFAULT_LAYOUT.radialInnerRadius,
    radialChildRotationMode:
      layout?.radialChildRotationMode ??
      DEFAULT_LAYOUT.radialChildRotationMode,
    symmetryMode: layout?.symmetryMode ?? DEFAULT_LAYOUT.symmetryMode,
    symmetryCopies: layout?.symmetryCopies ?? DEFAULT_LAYOUT.symmetryCopies,
    hidePercentage: layout?.hidePercentage ?? DEFAULT_LAYOUT.hidePercentage,
    letterbox: layout?.letterbox ?? DEFAULT_LAYOUT.letterbox,
    wedgeAngle: layout?.wedgeAngle ?? DEFAULT_LAYOUT.wedgeAngle,
    wedgeJitter: layout?.wedgeJitter ?? DEFAULT_LAYOUT.wedgeJitter,
    randomness: layout?.randomness ?? DEFAULT_LAYOUT.randomness,
  };
}

export function normalizeSourceMapping(
  sourceMapping: Partial<SourceMappingSettings> | undefined,
  fallbackCropDistribution: CropDistribution = "center",
): SourceMappingSettings {
  return {
    strategy: sourceMapping?.strategy ?? DEFAULT_SOURCE_MAPPING.strategy,
    sourceBias: sourceMapping?.sourceBias ?? DEFAULT_SOURCE_MAPPING.sourceBias,
    preserveAspect: sourceMapping?.preserveAspect ?? DEFAULT_SOURCE_MAPPING.preserveAspect,
    cropDistribution: sourceMapping?.cropDistribution ?? fallbackCropDistribution,
    cropZoom: sourceMapping?.cropZoom ?? DEFAULT_SOURCE_MAPPING.cropZoom,
    luminanceSort: sourceMapping?.luminanceSort ?? DEFAULT_SOURCE_MAPPING.luminanceSort,
    paletteEmphasis: sourceMapping?.paletteEmphasis ?? DEFAULT_SOURCE_MAPPING.paletteEmphasis,
  };
}

export function normalizeProjectSnapshot(
  snapshot: ProjectSnapshot,
  fallbackCropDistribution: CropDistribution = "center",
): ProjectSnapshot {
  return {
    ...snapshot,
    canvas: normalizeCanvasSettings(snapshot.canvas),
    layout: normalizeLayoutSettings(snapshot.layout),
    sourceMapping: normalizeSourceMapping(snapshot.sourceMapping, fallbackCropDistribution),
  };
}

export function normalizeProjectDocument(
  project: ProjectDocument,
  fallbackCropDistribution: CropDistribution = "center",
): ProjectDocument {
  return {
    ...project,
    deletedAt: project.deletedAt ?? null,
    canvas: normalizeCanvasSettings(project.canvas),
    layout: normalizeLayoutSettings(project.layout),
    sourceMapping: normalizeSourceMapping(project.sourceMapping, fallbackCropDistribution),
  };
}

export function normalizeProjectVersion(
  version: ProjectVersion,
  fallbackCropDistribution: CropDistribution = "center",
): ProjectVersion {
  return {
    ...version,
    snapshot: normalizeProjectSnapshot(version.snapshot, fallbackCropDistribution),
  };
}

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
