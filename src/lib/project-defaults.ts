import type {
  CanvasSettings,
  CompositingSettings,
  CompositorLayer,
  CropDistribution,
  EffectSettings,
  ExportSettings,
  FinishSettings,
  GeneratorPreset,
  LayoutSettings,
  LayerRenderProject,
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

type LegacyCompositingSettings = Partial<CompositingSettings> & {
  shadow?: number;
};

type LegacyProjectLike = {
  canvas?: Partial<CanvasSettings> & { inset?: number };
  sourceIds?: string[];
  layout?: Partial<LayoutSettings>;
  sourceMapping?: Partial<SourceMappingSettings>;
  effects?: Partial<EffectSettings>;
  compositing?: LegacyCompositingSettings;
  finish?: Partial<FinishSettings>;
  activeSeed?: number;
  presets?: GeneratorPreset[];
  passes?: RenderPass[];
  layers?: unknown;
  selectedLayerId?: string | null;
};

type LegacySnapshotLike = LegacyProjectLike & {
  export?: Partial<ExportSettings>;
};

type LegacyDocumentLike = LegacySnapshotLike & Pick<
  ProjectDocument,
  "id" | "title" | "currentVersionId" | "deletedAt" | "createdAt" | "updatedAt"
>;

type SelectedLayerProjectionKey =
  | "sourceIds"
  | "layout"
  | "sourceMapping"
  | "effects"
  | "compositing"
  | "finish"
  | "activeSeed"
  | "presets"
  | "passes";

const SELECTED_LAYER_PROJECTION_KEYS: SelectedLayerProjectionKey[] = [
  "sourceIds",
  "layout",
  "sourceMapping",
  "effects",
  "compositing",
  "finish",
  "activeSeed",
  "presets",
  "passes",
];

function getSelectedLayerIndexFromSnapshot(snapshot: {
  layers: CompositorLayer[];
  selectedLayerId: string | null;
}) {
  const selectedIndex = snapshot.layers.findIndex(
    (layer) => layer.id === snapshot.selectedLayerId,
  );
  return selectedIndex >= 0 ? selectedIndex : Math.max(snapshot.layers.length - 1, 0);
}

export function getSelectedLayer<T extends { layers: CompositorLayer[]; selectedLayerId: string | null }>(
  value: T,
) {
  return value.layers[getSelectedLayerIndexFromSnapshot(value)] ?? null;
}

export function createLayerRenderProject(
  project: Pick<ProjectDocument, "canvas">,
  layer: CompositorLayer,
): LayerRenderProject {
  return {
    canvas: {
      ...structuredClone(project.canvas),
      inset: layer.inset,
    },
    sourceIds: structuredClone(layer.sourceIds),
    layout: structuredClone(layer.layout),
    sourceMapping: structuredClone(layer.sourceMapping),
    effects: structuredClone(layer.effects),
    compositing: structuredClone(layer.compositing),
    finish: structuredClone(layer.finish),
    activeSeed: layer.activeSeed,
    presets: structuredClone(layer.presets),
    passes: structuredClone(layer.passes),
  };
}

function getSelectedLayerProjectionValue(
  snapshot: Pick<ProjectSnapshot, "layers" | "selectedLayerId">,
  key: SelectedLayerProjectionKey,
) {
  const selectedLayer = getSelectedLayer(snapshot);

  if (selectedLayer) {
    return selectedLayer[key];
  }

  switch (key) {
    case "sourceIds":
      return [];
    case "layout":
      return DEFAULT_LAYOUT;
    case "sourceMapping":
      return DEFAULT_SOURCE_MAPPING;
    case "effects":
      return DEFAULT_EFFECTS;
    case "compositing":
      return DEFAULT_COMPOSITING;
    case "finish":
      return DEFAULT_FINISH;
    case "activeSeed":
      return 187310;
    case "presets":
      return DEFAULT_PRESETS;
    case "passes":
      return DEFAULT_PASSES;
  }
}

function cloneSelectedLayerProjectionValue(
  key: SelectedLayerProjectionKey,
  value: ProjectSnapshot[SelectedLayerProjectionKey],
) {
  if (key === "activeSeed") {
    return value;
  }

  return structuredClone(value);
}

function setSelectedLayerProjectionValue(
  snapshot: ProjectSnapshot,
  key: SelectedLayerProjectionKey,
  value: ProjectSnapshot[SelectedLayerProjectionKey],
) {
  const selectedIndex = getSelectedLayerIndexFromSnapshot(snapshot);
  const selectedLayer = snapshot.layers[selectedIndex];

  if (!selectedLayer) {
    return;
  }

  snapshot.layers = snapshot.layers.map((layer, index) =>
    index === selectedIndex
      ? ({
          ...layer,
          [key]: cloneSelectedLayerProjectionValue(key, value),
        } as CompositorLayer)
      : layer,
  );
}

function setSelectedLayerInset(snapshot: ProjectSnapshot, inset: number) {
  const selectedIndex = getSelectedLayerIndexFromSnapshot(snapshot);
  const selectedLayer = snapshot.layers[selectedIndex];

  if (!selectedLayer) {
    return;
  }

  snapshot.layers = snapshot.layers.map((layer, index) =>
    index === selectedIndex ? { ...layer, inset } : layer,
  );
}

function attachSelectedLayerProjection<T extends ProjectSnapshot>(snapshot: T): T {
  const target = snapshot as T & Record<string, unknown>;

  for (const key of SELECTED_LAYER_PROJECTION_KEYS) {
    Reflect.deleteProperty(target, key);
    Object.defineProperty(target, key, {
      enumerable: true,
      configurable: true,
      get() {
        return getSelectedLayerProjectionValue(snapshot, key);
      },
      set(value: ProjectSnapshot[SelectedLayerProjectionKey]) {
        setSelectedLayerProjectionValue(snapshot, key, value);
      },
    });
  }

  const canvas = snapshot.canvas as CanvasSettings & Record<string, unknown>;
  Reflect.deleteProperty(canvas, "inset");
  Object.defineProperty(canvas, "inset", {
    enumerable: true,
    configurable: true,
    get() {
      return getSelectedLayer(snapshot)?.inset ?? DEFAULT_LAYER_INSET;
    },
    set(value: number) {
      setSelectedLayerInset(snapshot, value);
    },
  });

  return snapshot;
}

function stripSelectedLayerProjection(snapshot: ProjectSnapshot) {
  const canvas = structuredClone(snapshot.canvas) as Partial<CanvasSettings>;
  delete canvas.inset;

  return {
    canvas: canvas as CanvasSettings,
    export: structuredClone(snapshot.export),
    layers: snapshot.layers.map((layer) => structuredClone(layer)),
    selectedLayerId: snapshot.selectedLayerId,
  };
}

export const DEFAULT_LAYER_INSET = 48;

export const DEFAULT_CANVAS: CanvasSettings = {
  width: 3000,
  height: 3000,
  background: "#f5efe4",
  backgroundAlpha: 0,
  inset: DEFAULT_LAYER_INSET,
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
  feather: 0.04,
};

export const DEFAULT_FINISH: FinishSettings = {
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
  shadowOpacity: 0,
  shadowColor: "#180f08",
  brightness: 1,
  contrast: 1,
  saturate: 1,
  hueRotate: 0,
  grayscale: 0,
  invert: 0,
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
    preserveAspect:
      sourceMapping?.preserveAspect ?? DEFAULT_SOURCE_MAPPING.preserveAspect,
    cropDistribution:
      sourceMapping?.cropDistribution ?? fallbackCropDistribution,
    cropZoom: sourceMapping?.cropZoom ?? DEFAULT_SOURCE_MAPPING.cropZoom,
    luminanceSort:
      sourceMapping?.luminanceSort ?? DEFAULT_SOURCE_MAPPING.luminanceSort,
    paletteEmphasis:
      sourceMapping?.paletteEmphasis ?? DEFAULT_SOURCE_MAPPING.paletteEmphasis,
  };
}

function normalizeCompositingSettings(
  compositing: LegacyCompositingSettings | undefined,
): CompositingSettings {
  return {
    blendMode: compositing?.blendMode ?? DEFAULT_COMPOSITING.blendMode,
    opacity: compositing?.opacity ?? DEFAULT_COMPOSITING.opacity,
    overlap: compositing?.overlap ?? DEFAULT_COMPOSITING.overlap,
    feather: compositing?.feather ?? DEFAULT_COMPOSITING.feather,
  };
}

function normalizeFinishSettings(
  finish: Partial<FinishSettings> | undefined,
  compositing: LegacyCompositingSettings | undefined,
): FinishSettings {
  const legacyShadow = compositing?.shadow ?? 0;
  const shouldMigrateShadow =
    (!finish || "shadowOffsetX" in finish === false) && legacyShadow > 0;

  return {
    shadowOffsetX: finish?.shadowOffsetX ?? 0,
    shadowOffsetY:
      finish?.shadowOffsetY ??
      (shouldMigrateShadow ? 24 : DEFAULT_FINISH.shadowOffsetY),
    shadowBlur:
      finish?.shadowBlur ??
      (shouldMigrateShadow ? 36 : DEFAULT_FINISH.shadowBlur),
    shadowOpacity:
      finish?.shadowOpacity ??
      (shouldMigrateShadow
        ? Math.min(0.35, legacyShadow * 2.25)
        : DEFAULT_FINISH.shadowOpacity),
    shadowColor: finish?.shadowColor ?? DEFAULT_FINISH.shadowColor,
    brightness: finish?.brightness ?? DEFAULT_FINISH.brightness,
    contrast: finish?.contrast ?? DEFAULT_FINISH.contrast,
    saturate: finish?.saturate ?? DEFAULT_FINISH.saturate,
    hueRotate: finish?.hueRotate ?? DEFAULT_FINISH.hueRotate,
    grayscale: finish?.grayscale ?? DEFAULT_FINISH.grayscale,
    invert: finish?.invert ?? DEFAULT_FINISH.invert,
  };
}

function normalizeLayerPasses(
  passes: RenderPass[] | undefined,
): RenderPass[] {
  return structuredClone(passes ?? DEFAULT_PASSES);
}

function normalizeLayerPresets(
  presets: GeneratorPreset[] | undefined,
): GeneratorPreset[] {
  return structuredClone(presets ?? DEFAULT_PRESETS);
}

export function normalizeCompositorLayer(
  layer: Partial<CompositorLayer> | undefined,
  fallbackCropDistribution: CropDistribution = "center",
  fallbackName = "Layer 1",
): CompositorLayer {
  return {
    id: layer?.id ?? makeId("layer"),
    name: layer?.name?.trim() || fallbackName,
    visible: layer?.visible ?? true,
    inset: layer?.inset ?? DEFAULT_LAYER_INSET,
    sourceIds: structuredClone(layer?.sourceIds ?? []),
    layout: normalizeLayoutSettings(layer?.layout),
    sourceMapping: normalizeSourceMapping(
      layer?.sourceMapping,
      fallbackCropDistribution,
    ),
    effects: normalizeEffectSettings(layer?.effects),
    compositing: normalizeCompositingSettings(layer?.compositing),
    finish: normalizeFinishSettings(layer?.finish, layer?.compositing),
    activeSeed: layer?.activeSeed ?? 187310,
    presets: normalizeLayerPresets(layer?.presets),
    passes: normalizeLayerPasses(layer?.passes),
  };
}

export function createCompositorLayer(
  input: Partial<CompositorLayer> = {},
): CompositorLayer {
  return normalizeCompositorLayer(input, "distributed", input.name ?? "Layer 1");
}

function createLegacyLayer(
  value: LegacyProjectLike,
  fallbackCropDistribution: CropDistribution,
): CompositorLayer {
  return normalizeCompositorLayer(
    {
      name: "Layer 1",
      visible: true,
      inset: value.canvas?.inset ?? DEFAULT_LAYER_INSET,
      sourceIds: value.sourceIds ?? [],
      layout: value.layout,
      sourceMapping: value.sourceMapping,
      effects: value.effects,
      compositing: value.compositing,
      finish: value.finish,
      activeSeed: value.activeSeed,
      presets: value.presets,
      passes: value.passes,
    } as Partial<CompositorLayer>,
    fallbackCropDistribution,
    "Layer 1",
  );
}

function normalizeLayers(
  value: LegacyProjectLike,
  fallbackCropDistribution: CropDistribution,
): { layers: CompositorLayer[]; selectedLayerId: string | null } {
  const rawLayers = Array.isArray(value.layers)
    ? value.layers
    : [createLegacyLayer(value, fallbackCropDistribution)];
  const layers = rawLayers.map((layer, index) =>
    normalizeCompositorLayer(
      layer as Partial<CompositorLayer>,
      fallbackCropDistribution,
      `Layer ${index + 1}`,
    ),
  );
  const selectedLayerId =
    layers.find((layer) => layer.id === value.selectedLayerId)?.id ??
    layers.at(-1)?.id ??
    null;

  return { layers, selectedLayerId };
}

export function syncLegacyProjectFieldsToSelectedLayer<T extends ProjectSnapshot>(
  snapshot: T,
): T {
  const selectedLayerIndex = getSelectedLayerIndexFromSnapshot(snapshot);
  const selectedLayer = snapshot.layers[selectedLayerIndex];
  if (!selectedLayer) {
    return snapshot;
  }

  const nextSelectedLayer: CompositorLayer = {
    ...selectedLayer,
    inset: snapshot.canvas.inset ?? selectedLayer.inset,
    sourceIds: structuredClone(snapshot.sourceIds ?? selectedLayer.sourceIds),
    layout: structuredClone(snapshot.layout ?? selectedLayer.layout),
    sourceMapping: structuredClone(
      snapshot.sourceMapping ?? selectedLayer.sourceMapping,
    ),
    effects: structuredClone(snapshot.effects ?? selectedLayer.effects),
    compositing: structuredClone(
      snapshot.compositing ?? selectedLayer.compositing,
    ),
    finish: structuredClone(snapshot.finish ?? selectedLayer.finish),
    activeSeed: snapshot.activeSeed ?? selectedLayer.activeSeed,
    presets: structuredClone(snapshot.presets ?? selectedLayer.presets),
    passes: structuredClone(snapshot.passes ?? selectedLayer.passes),
  };
  const layers = snapshot.layers.map((layer, index) =>
    index === selectedLayerIndex ? nextSelectedLayer : layer,
  );

  return {
    ...snapshot,
    layers,
  };
}

function attachLegacySelectedLayerFields<T extends ProjectSnapshot>(
  snapshot: T,
): T {
  return attachSelectedLayerProjection(snapshot);
}

function hasLegacyRootOverrides(snapshot: LegacySnapshotLike) {
  const canvas = snapshot.canvas;

  return (
    ("sourceIds" in snapshot && snapshot.sourceIds !== undefined) ||
    ("layout" in snapshot && snapshot.layout !== undefined) ||
    ("sourceMapping" in snapshot && snapshot.sourceMapping !== undefined) ||
    ("effects" in snapshot && snapshot.effects !== undefined) ||
    ("compositing" in snapshot && snapshot.compositing !== undefined) ||
    ("finish" in snapshot && snapshot.finish !== undefined) ||
    ("activeSeed" in snapshot && snapshot.activeSeed !== undefined) ||
    ("presets" in snapshot && snapshot.presets !== undefined) ||
    ("passes" in snapshot && snapshot.passes !== undefined) ||
    (!!canvas && "inset" in canvas)
  );
}

export function normalizeProjectSnapshot(
  snapshot: ProjectSnapshot | LegacySnapshotLike,
  fallbackCropDistribution: CropDistribution = "center",
): ProjectSnapshot {
  const normalizedCanvas = normalizeCanvasSettings(snapshot.canvas);
  const { layers, selectedLayerId } = normalizeLayers(
    snapshot as ProjectSnapshot & LegacyProjectLike,
    fallbackCropDistribution,
  );
  const normalizedSnapshot = {
    canvas: normalizedCanvas,
    export: {
      format: snapshot.export?.format ?? DEFAULT_EXPORT.format,
      quality: snapshot.export?.quality ?? DEFAULT_EXPORT.quality,
      width: snapshot.export?.width ?? DEFAULT_EXPORT.width,
      height: snapshot.export?.height ?? DEFAULT_EXPORT.height,
      scale: snapshot.export?.scale ?? DEFAULT_EXPORT.scale,
    },
    layers,
    selectedLayerId,
  } as ProjectSnapshot;

  if (hasLegacyRootOverrides(snapshot)) {
    const legacyLayer = createLegacyLayer(snapshot, fallbackCropDistribution);
    const selectedLayerIndex = getSelectedLayerIndexFromSnapshot(normalizedSnapshot);
    const selectedLayer = normalizedSnapshot.layers[selectedLayerIndex];

    if (!selectedLayer) {
      return attachLegacySelectedLayerFields(normalizedSnapshot);
    }

    return attachLegacySelectedLayerFields({
      ...normalizedSnapshot,
      layers: normalizedSnapshot.layers.map((layer, index) =>
        index === selectedLayerIndex
          ? {
              ...layer,
              inset: legacyLayer.inset,
              sourceIds: structuredClone(legacyLayer.sourceIds),
              layout: structuredClone(legacyLayer.layout),
              sourceMapping: structuredClone(legacyLayer.sourceMapping),
              effects: structuredClone(legacyLayer.effects),
              compositing: structuredClone(legacyLayer.compositing),
              finish: structuredClone(legacyLayer.finish),
              activeSeed: legacyLayer.activeSeed,
              presets: structuredClone(legacyLayer.presets),
              passes: structuredClone(legacyLayer.passes),
            }
          : layer,
      ),
    });
  }

  return attachLegacySelectedLayerFields(
    normalizedSnapshot,
  );
}

export function normalizeProjectDocument(
  project: ProjectDocument | LegacyDocumentLike,
  fallbackCropDistribution: CropDistribution = "center",
): ProjectDocument {
  const normalizedSnapshot = normalizeProjectSnapshot(
    project,
    fallbackCropDistribution,
  );

  return attachSelectedLayerProjection({
    ...project,
    ...normalizedSnapshot,
    deletedAt: project.deletedAt ?? null,
  } as ProjectDocument);
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

export function serializeProjectSnapshot(snapshot: ProjectSnapshot): ProjectSnapshot {
  return stripSelectedLayerProjection(snapshot) as ProjectSnapshot;
}

export function serializeProjectDocument(project: ProjectDocument): ProjectDocument {
  return {
    ...stripSelectedLayerProjection(project),
    id: project.id,
    title: project.title,
    currentVersionId: project.currentVersionId,
    deletedAt: project.deletedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  } as ProjectDocument;
}

export function serializeProjectVersion(version: ProjectVersion): ProjectVersion {
  return {
    ...version,
    snapshot: serializeProjectSnapshot(version.snapshot),
  };
}

export function createSnapshot(): ProjectSnapshot {
  const layer = createCompositorLayer({
    name: "Layer 1",
    visible: true,
  });

  return attachSelectedLayerProjection({
    canvas: structuredClone(DEFAULT_CANVAS),
    export: structuredClone(DEFAULT_EXPORT),
    layers: [layer],
    selectedLayerId: layer.id,
  } as ProjectSnapshot);
}

export function createProjectDocument(title = "Untitled Composition"): ProjectDocument {
  const now = new Date().toISOString();
  return normalizeProjectDocument({
    id: makeId("project"),
    title,
    currentVersionId: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...serializeProjectSnapshot(createSnapshot()),
  });
}
