export type GeometryShape =
  | "rect"
  | "triangle"
  | "interlock"
  | "blob"
  | "ring"
  | "arc"
  | "wedge"
  | "text"
  | "svg"
  | "mixed";
export type LayoutFamily =
  | "grid"
  | "strips"
  | "blocks"
  | "radial"
  | "organic"
  | "flow"
  | "3d"
  | "fractal"
  | "draw"
  | "words";
export type WordsMode = "image-fill" | "plain-text";
export type WordFontFamily =
  | "dm-sans"
  | "cormorant-garamond"
  | "jetbrains-mono";
export type FractalVariant =
  | "sierpinski-triangle"
  | "sierpinski-carpet"
  | "vicsek"
  | "h-tree"
  | "rosette"
  | "binary-tree"
  | "pythagoras-tree";
export type RadialChildRotationMode = "none" | "tangent" | "outward";
export type ThreeDStructureMode = "sphere" | "torus" | "attractor";
export type KaleidoscopeMirrorMode =
  | "rotate-only"
  | "alternate"
  | "mirror-all";
export type CropDistribution = "center" | "distributed";
export type SourceKind =
  | "image"
  | "solid"
  | "gradient"
  | "perlin"
  | "cellular"
  | "reaction"
  | "waves";
export type GradientMode = "linear" | "radial" | "conic";
export type GradientDirection =
  | "horizontal"
  | "vertical"
  | "diagonal-down"
  | "diagonal-up";
export type SourceAssignmentStrategy =
  | "random"
  | "round-robin"
  | "tone-map"
  | "contrast"
  | "anti-repeat";
export type ExportFormat = "image/png" | "image/jpeg" | "image/png-transparent";
export type BlendMode =
  | "source-over"
  | "multiply"
  | "screen"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "difference"
  | "color-dodge"
  | "luminosity";
export type ElementModulationPattern =
  | "sine"
  | "triangle"
  | "saw"
  | "checker"
  | "linear"
  | "rings"
  | "spiral"
  | "depth";
export type ElementModulationTarget =
  | "rotation"
  | "scale"
  | "displacementX"
  | "displacementY"
  | "opacity"
  | "distortion"
  | "wedgeSweep"
  | "threeDZ"
  | "threeDTwist"
  | "symmetryDrift";

export interface BaseSourceAsset {
  id: string;
  projectId: string;
  name: string;
  originalFileName: string;
  mimeType: string;
  width: number;
  height: number;
  orientation: number;
  originalPath: string;
  normalizedPath: string;
  previewPath: string;
  averageColor: string;
  palette: string[];
  luminance: number;
  createdAt: string;
}

export interface ImageSourceAsset extends BaseSourceAsset {
  kind: "image";
}

export interface SolidSourceAsset extends BaseSourceAsset {
  kind: "solid";
  recipe: {
    color: string;
  };
}

export interface GradientSourceRecipe {
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

export interface GradientSourceAsset extends BaseSourceAsset {
  kind: "gradient";
  recipe: GradientSourceRecipe;
}

export interface PerlinSourceRecipe {
  color: string;
  scale: number;
  detail: number;
  contrast: number;
  distortion: number;
  seed: number;
}

export interface PerlinSourceAsset extends BaseSourceAsset {
  kind: "perlin";
  recipe: PerlinSourceRecipe;
}

export interface CellularSourceRecipe {
  color: string;
  scale: number;
  jitter: number;
  edge: number;
  contrast: number;
  seed: number;
}

export interface CellularSourceAsset extends BaseSourceAsset {
  kind: "cellular";
  recipe: CellularSourceRecipe;
}

export interface ReactionSourceRecipe {
  color: string;
  scale: number;
  diffusion: number;
  balance: number;
  distortion: number;
  seed: number;
}

export interface ReactionSourceAsset extends BaseSourceAsset {
  kind: "reaction";
  recipe: ReactionSourceRecipe;
}

export interface WaveSourceRecipe {
  color: string;
  scale: number;
  interference: number;
  directionality: number;
  distortion: number;
  seed: number;
}

export interface WaveSourceAsset extends BaseSourceAsset {
  kind: "waves";
  recipe: WaveSourceRecipe;
}

export type SourceAsset =
  | ImageSourceAsset
  | SolidSourceAsset
  | GradientSourceAsset
  | PerlinSourceAsset
  | CellularSourceAsset
  | ReactionSourceAsset
  | WaveSourceAsset;

export interface CanvasSettings {
  width: number;
  height: number;
  background: string;
  backgroundAlpha: number;
  inset: number;
}

export interface LayoutSettings {
  family: LayoutFamily;
  shapeMode: GeometryShape;
  rectCornerRadius: number;
  density: number;
  stripAngle: number;
  gridAngle: number;
  columns: number;
  rows: number;
  gutter: number;
  gutterHorizontal: number;
  gutterVertical: number;
  blockDepth: number;
  blockSplitRandomness: number;
  blockMinSize: number;
  blockSplitBias: number;
  stripOrientation: "horizontal" | "vertical" | "mixed";
  radialSegments: number;
  radialRings: number;
  radialAngleOffset: number;
  radialRingPhaseStep: number;
  radialInnerRadius: number;
  radialChildRotationMode: RadialChildRotationMode;
  symmetryMode: "none" | "mirror-x" | "mirror-y" | "quad" | "radial";
  symmetryCopies: number;
  symmetryCenterX: number;
  symmetryCenterY: number;
  symmetryAngleOffset: number;
  symmetryJitter: number;
  hidePercentage: number;
  letterbox: number;
  /** Layer content shift as fraction of canvas width, -1…1 (-100%…+100%). */
  offsetX: number;
  /** Layer content shift as fraction of canvas height, -1…1 (-100%…+100%). */
  offsetY: number;
  /** Whole-layer content rotation in degrees around the canvas center (0…360). */
  contentRotation: number;
  wedgeAngle: number;
  wedgeJitter: number;
  hollowRatio: number;
  randomness: number;
  organicVariation: number;
  flowCurvature: number;
  flowCoherence: number;
  flowBranchRate: number;
  flowTaper: number;
  threeDStructure: ThreeDStructureMode;
  threeDDistribution: number;
  threeDDepth: number;
  threeDCameraDistance: number;
  threeDPanX: number;
  threeDPanY: number;
  threeDYaw: number;
  threeDPitch: number;
  threeDPerspective: number;
  threeDBillboard: number;
  threeDZJitter: number;
  fractalVariant: FractalVariant;
  fractalIterations: number;
  fractalSpacing: number;
  fractalTrianglePull: number;
  fractalTriangleRotation: number;
  fractalCarpetHoleScale: number;
  fractalCarpetOffset: number;
  fractalVicsekArmScale: number;
  fractalVicsekCenterScale: number;
  fractalHTreeRatio: number;
  fractalHTreeThickness: number;
  fractalRosettePetals: number;
  fractalRosetteTwist: number;
  fractalRosetteInnerRadius: number;
  fractalBinaryAngle: number;
  fractalBinaryDecay: number;
  fractalBinaryThickness: number;
  fractalPythagorasAngle: number;
  fractalPythagorasScale: number;
  fractalPythagorasLean: number;
}

export interface SourceMappingSettings {
  strategy: SourceAssignmentStrategy;
  sourceWeights: Record<string, number>;
  preserveAspect: boolean;
  cropDistribution: CropDistribution;
  cropZoom: number;
  luminanceSort: "ascending" | "descending";
  paletteEmphasis: number;
}

export interface EffectSettings {
  blur: number;
  sharpen: number;
  kaleidoscopeSegments: number;
  kaleidoscopeCenterX: number;
  kaleidoscopeCenterY: number;
  kaleidoscopeAngleOffset: number;
  kaleidoscopeMirrorMode: KaleidoscopeMirrorMode;
  kaleidoscopeRotationDrift: number;
  kaleidoscopeScaleFalloff: number;
  kaleidoscopeOpacity: number;
  rotationJitter: number;
  scaleJitter: number;
  displacement: number;
  distortion: number;
  elementModulations: Record<ElementModulationTarget, ElementModulationSettings>;
}

export interface ElementModulationSettings {
  enabled: boolean;
  pattern: ElementModulationPattern;
  amount: number;
  frequency: number;
  phase: number;
  originX: number;
  originY: number;
  axisAngle: number;
}

export interface CompositingSettings {
  blendMode: BlendMode;
  opacity: number;
  overlap: number;
  feather: number;
}

export interface FinishSettings {
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowOpacity: number;
  shadowColor: string;
  brightness: number;
  contrast: number;
  saturate: number;
  hueRotate: number;
  grayscale: number;
  invert: number;
  noise: number;
  noiseMonochrome: number;
}

export interface DrawStrokePoint {
  x: number;
  y: number;
}

export interface DrawStroke {
  id: string;
  points: DrawStrokePoint[];
}

export interface DrawSettings {
  brushSize: number;
  strokes: DrawStroke[];
}

export interface WordsSettings {
  mode: WordsMode;
  fontFamily: WordFontFamily;
  text: string;
  textColor: string;
}

export type SvgGeometryFit = "contain" | "cover" | "stretch";
export type SvgGeometryMirrorMode = "none" | "x" | "y" | "alternate";

export interface SvgGeometrySettings {
  fileName: string | null;
  markup: string | null;
  fit: SvgGeometryFit;
  padding: number;
  threshold: number;
  invert: boolean;
  morphology: number;
  repeatEnabled: boolean;
  repeatScale: number;
  repeatGap: number;
  randomRotation: number;
  mirrorMode: SvgGeometryMirrorMode;
}

export interface CompositorLayer {
  id: string;
  name: string;
  visible: boolean;
  inset: number;
  sourceIds: string[];
  layout: LayoutSettings;
  sourceMapping: SourceMappingSettings;
  effects: EffectSettings;
  compositing: CompositingSettings;
  finish: FinishSettings;
  draw: DrawSettings;
  words: WordsSettings;
  svgGeometry: SvgGeometrySettings;
  activeSeed: number;
  presets: GeneratorPreset[];
  passes: RenderPass[];
}

export interface ExportSettings {
  format: ExportFormat;
  quality: number;
  width: number;
  height: number;
  scale: number;
}

export interface GeneratorPreset {
  id: string;
  name: string;
  family: LayoutFamily;
  seedOffset: number;
  params: Record<string, number | string | boolean>;
}

export interface RenderPass {
  id: string;
  type: "layout" | "assignment" | "transform" | "compose" | "export";
  enabled: boolean;
  label: string;
}

export interface ProjectSnapshot {
  canvas: CanvasSettings;
  export: ExportSettings;
  layers: CompositorLayer[];
  selectedLayerId: string | null;
}

export interface ProjectDocument extends ProjectSnapshot {
  id: string;
  title: string;
  currentVersionId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  label: string;
  createdAt: string;
  thumbnailPath: string | null;
  snapshot: ProjectSnapshot;
}

export interface ProjectBundleManifest {
  version: 1 | 2 | 3 | 4;
  projectId: string;
  exportedAt: string;
  assetIds: string[];
  versionIds: string[];
}

export interface ImportedProjectBundle {
  manifest: ProjectBundleManifest;
  projectDoc: ProjectDocument;
  versionDocs: ProjectVersion[];
  assetDocs: SourceAsset[];
  assetBlobs: Record<string, Blob>;
  versionBlobs: Record<string, Blob>;
}

export interface BundleImportInspection {
  fileName: string;
  projectId: string;
  projectTitle: string;
  bundle: ImportedProjectBundle;
  conflictProject: ProjectDocument | null;
}

export interface RenderAsset {
  asset: SourceAsset;
  bitmap: CanvasImageSource;
}

export interface RenderedPreviewSnapshot {
  project: ProjectDocument;
  assetIds: string[];
}

export interface LayerRenderProject {
  canvas: CanvasSettings & { inset: number };
  sourceIds: string[];
  layout: LayoutSettings;
  sourceMapping: SourceMappingSettings;
  effects: EffectSettings;
  compositing: CompositingSettings;
  finish: FinishSettings;
  draw: DrawSettings;
  words: WordsSettings;
  svgGeometry: SvgGeometrySettings;
  activeSeed: number;
  presets: GeneratorPreset[];
  passes: RenderPass[];
}

export interface RenderRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderPoint {
  x: number;
  y: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderSlice {
  id: string;
  shape: Exclude<GeometryShape, "mixed">;
  assetId: string;
  rect: RenderRect;
  clipRect: RenderRect | null;
  clipPathPoints: RenderPoint[] | null;
  quadPoints: RenderPoint[] | null;
  clipRotation: number;
  imageRect: RenderRect | null;
  rotation: number;
  rotationX: number;
  rotationY: number;
  scale: number;
  opacity: number;
  blendMode: BlendMode;
  clipInset: number;
  displacementOffset: { x: number; y: number };
  distortion: number;
  sourceCrop: NormalizedRect | null;
  wedgeSweepRadians: number | null;
  mirrorAxis: "none" | "x" | "y";
  depth: number;
  fogAmount: number;
}

export interface ProcessedAssetPayload {
  blob: Blob;
  normalizedBlob: Blob;
  previewBlob: Blob;
  width: number;
  height: number;
  mimeType: string;
  averageColor: string;
  palette: string[];
  luminance: number;
  orientation: number;
}
