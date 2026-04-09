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
import { normalizeSourceWeights } from "@/lib/source-weights";

type LegacyEffectSettings = Partial<EffectSettings> & {
  mirror?: boolean;
};

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
  gutterHorizontal: 14,
  gutterVertical: 14,
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
  symmetryCenterX: 0.5,
  symmetryCenterY: 0.5,
  symmetryAngleOffset: 0,
  symmetryJitter: 0,
  hidePercentage: 0,
  letterbox: 0,
  wedgeAngle: 120,
  wedgeJitter: 0,
  hollowRatio: 0.48,
  randomness: 0.52,
  organicVariation: 0,
  flowCurvature: 0.44,
  flowCoherence: 0.72,
  flowBranchRate: 0.2,
  flowTaper: 0.34,
  threeDStructure: "sphere",
  threeDDistribution: 0,
  threeDDepth: 0.6,
  threeDCameraDistance: 0.62,
  threeDPanX: 0,
  threeDPanY: 0,
  threeDYaw: 28,
  threeDPitch: -18,
  threeDPerspective: 0.68,
  threeDBillboard: 0.78,
  threeDZJitter: 0.18,
};

function normalizeStripAngle(layout: Partial<LayoutSettings> | undefined) {
  if (layout?.stripAngle !== undefined) return layout.stripAngle;
  if (layout?.stripOrientation === "horizontal") return 90;
  return DEFAULT_LAYOUT.stripAngle;
}

export const DEFAULT_SOURCE_MAPPING: SourceMappingSettings = {
  strategy: "palette",
  sourceBias: 0.62,
  sourceWeights: {},
  preserveAspect: true,
  cropDistribution: "distributed",
  cropZoom: 1,
  luminanceSort: "descending",
  paletteEmphasis: 0.72,
};

export const DEFAULT_EFFECTS: EffectSettings = {
  blur: 0,
  sharpen: 0,
  kaleidoscopeSegments: 1,
  kaleidoscopeCenterX: 0.5,
  kaleidoscopeCenterY: 0.5,
  kaleidoscopeAngleOffset: 0,
  kaleidoscopeMirrorMode: "alternate",
  kaleidoscopeRotationDrift: 0,
  kaleidoscopeScaleFalloff: 0,
  kaleidoscopeOpacity: 0.2,
  rotationJitter: 0,
  scaleJitter: 0,
  displacement: 0,
  distortion: 0,
};

function normalizeKaleidoscopeMirrorMode(
  effects: LegacyEffectSettings | undefined,
) {
  if (effects?.kaleidoscopeMirrorMode) {
    return effects.kaleidoscopeMirrorMode;
  }

  if (effects?.mirror === true) {
    return "alternate";
  }

  return DEFAULT_EFFECTS.kaleidoscopeMirrorMode;
}

export function normalizeEffectSettings(
  effects: LegacyEffectSettings | undefined,
): EffectSettings {
  return {
    blur: effects?.blur ?? DEFAULT_EFFECTS.blur,
    sharpen: effects?.sharpen ?? DEFAULT_EFFECTS.sharpen,
    kaleidoscopeSegments:
      effects?.kaleidoscopeSegments ?? DEFAULT_EFFECTS.kaleidoscopeSegments,
    kaleidoscopeCenterX:
      effects?.kaleidoscopeCenterX ?? DEFAULT_EFFECTS.kaleidoscopeCenterX,
    kaleidoscopeCenterY:
      effects?.kaleidoscopeCenterY ?? DEFAULT_EFFECTS.kaleidoscopeCenterY,
    kaleidoscopeAngleOffset:
      effects?.kaleidoscopeAngleOffset ??
      DEFAULT_EFFECTS.kaleidoscopeAngleOffset,
    kaleidoscopeMirrorMode: normalizeKaleidoscopeMirrorMode(effects),
    kaleidoscopeRotationDrift:
      effects?.kaleidoscopeRotationDrift ??
      DEFAULT_EFFECTS.kaleidoscopeRotationDrift,
    kaleidoscopeScaleFalloff:
      effects?.kaleidoscopeScaleFalloff ??
      DEFAULT_EFFECTS.kaleidoscopeScaleFalloff,
    kaleidoscopeOpacity:
      effects?.kaleidoscopeOpacity ?? DEFAULT_EFFECTS.kaleidoscopeOpacity,
    rotationJitter: effects?.rotationJitter ?? DEFAULT_EFFECTS.rotationJitter,
    scaleJitter: effects?.scaleJitter ?? DEFAULT_EFFECTS.scaleJitter,
    displacement: effects?.displacement ?? DEFAULT_EFFECTS.displacement,
    distortion: effects?.distortion ?? DEFAULT_EFFECTS.distortion,
  };
}

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
    gutterHorizontal:
      layout?.gutterHorizontal ??
      layout?.gutter ??
      DEFAULT_LAYOUT.gutterHorizontal,
    gutterVertical:
      layout?.gutterVertical ??
      layout?.gutter ??
      DEFAULT_LAYOUT.gutterVertical,
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
    symmetryCenterX: layout?.symmetryCenterX ?? DEFAULT_LAYOUT.symmetryCenterX,
    symmetryCenterY: layout?.symmetryCenterY ?? DEFAULT_LAYOUT.symmetryCenterY,
    symmetryAngleOffset:
      layout?.symmetryAngleOffset ?? DEFAULT_LAYOUT.symmetryAngleOffset,
    symmetryJitter: layout?.symmetryJitter ?? DEFAULT_LAYOUT.symmetryJitter,
    hidePercentage: layout?.hidePercentage ?? DEFAULT_LAYOUT.hidePercentage,
    letterbox: layout?.letterbox ?? DEFAULT_LAYOUT.letterbox,
    wedgeAngle: layout?.wedgeAngle ?? DEFAULT_LAYOUT.wedgeAngle,
    wedgeJitter: layout?.wedgeJitter ?? DEFAULT_LAYOUT.wedgeJitter,
    hollowRatio: layout?.hollowRatio ?? DEFAULT_LAYOUT.hollowRatio,
    randomness: layout?.randomness ?? DEFAULT_LAYOUT.randomness,
    organicVariation:
      layout?.organicVariation ?? DEFAULT_LAYOUT.organicVariation,
    flowCurvature: layout?.flowCurvature ?? DEFAULT_LAYOUT.flowCurvature,
    flowCoherence: layout?.flowCoherence ?? DEFAULT_LAYOUT.flowCoherence,
    flowBranchRate: layout?.flowBranchRate ?? DEFAULT_LAYOUT.flowBranchRate,
    flowTaper: layout?.flowTaper ?? DEFAULT_LAYOUT.flowTaper,
    threeDStructure:
      layout?.threeDStructure ?? DEFAULT_LAYOUT.threeDStructure,
    threeDDistribution:
      layout?.threeDDistribution ?? DEFAULT_LAYOUT.threeDDistribution,
    threeDDepth: layout?.threeDDepth ?? DEFAULT_LAYOUT.threeDDepth,
    threeDCameraDistance:
      layout?.threeDCameraDistance ?? DEFAULT_LAYOUT.threeDCameraDistance,
    threeDPanX: layout?.threeDPanX ?? DEFAULT_LAYOUT.threeDPanX,
    threeDPanY: layout?.threeDPanY ?? DEFAULT_LAYOUT.threeDPanY,
    threeDYaw: layout?.threeDYaw ?? DEFAULT_LAYOUT.threeDYaw,
    threeDPitch: layout?.threeDPitch ?? DEFAULT_LAYOUT.threeDPitch,
    threeDPerspective:
      layout?.threeDPerspective ?? DEFAULT_LAYOUT.threeDPerspective,
    threeDBillboard:
      layout?.threeDBillboard ?? DEFAULT_LAYOUT.threeDBillboard,
    threeDZJitter: layout?.threeDZJitter ?? DEFAULT_LAYOUT.threeDZJitter,
  };
}

export function normalizeSourceMapping(
  sourceMapping: Partial<SourceMappingSettings> | undefined,
  fallbackCropDistribution: CropDistribution = "center",
): SourceMappingSettings {
  return {
    strategy: sourceMapping?.strategy ?? DEFAULT_SOURCE_MAPPING.strategy,
    sourceBias: sourceMapping?.sourceBias ?? DEFAULT_SOURCE_MAPPING.sourceBias,
    sourceWeights: normalizeSourceWeights(sourceMapping?.sourceWeights),
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
    effects: normalizeEffectSettings(snapshot.effects),
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
    effects: normalizeEffectSettings(project.effects),
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
