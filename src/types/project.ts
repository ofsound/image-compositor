export type GeometryShape =
  | "rect"
  | "triangle"
  | "interlock"
  | "blob"
  | "ring"
  | "wedge"
  | "mixed";
export type LayoutFamily = "grid" | "strips" | "blocks" | "radial" | "organic" | "3d";
export type RadialChildRotationMode = "none" | "tangent" | "outward";
export type ThreeDStructureMode = "sphere" | "torus" | "attractor";
export type KaleidoscopeMirrorMode =
  | "rotate-only"
  | "alternate"
  | "mirror-all";
export type CropDistribution = "center" | "distributed";
export type SourceKind = "image" | "solid" | "gradient";
export type GradientDirection =
  | "horizontal"
  | "vertical"
  | "diagonal-down"
  | "diagonal-up";
export type SourceAssignmentStrategy =
  | "random"
  | "weighted"
  | "sequential"
  | "luminance"
  | "palette"
  | "symmetry";
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

export interface GradientSourceAsset extends BaseSourceAsset {
  kind: "gradient";
  recipe: {
    from: string;
    to: string;
    direction: GradientDirection;
  };
}

export type SourceAsset =
  | ImageSourceAsset
  | SolidSourceAsset
  | GradientSourceAsset;

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
  hidePercentage: number;
  letterbox: number;
  wedgeAngle: number;
  wedgeJitter: number;
  randomness: number;
  organicVariation: number;
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
}

export interface SourceMappingSettings {
  strategy: SourceAssignmentStrategy;
  sourceBias: number;
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
}

export interface CompositingSettings {
  blendMode: BlendMode;
  opacity: number;
  overlap: number;
  shadow: number;
  feather: number;
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
  sourceIds: string[];
  canvas: CanvasSettings;
  layout: LayoutSettings;
  sourceMapping: SourceMappingSettings;
  effects: EffectSettings;
  compositing: CompositingSettings;
  export: ExportSettings;
  activeSeed: number;
  presets: GeneratorPreset[];
  passes: RenderPass[];
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
  version: 1;
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
