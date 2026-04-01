export type GeometryShape = "rect" | "triangle" | "ring" | "wedge" | "mixed";
export type LayoutFamily = "grid" | "strips" | "blocks" | "radial";
export type CropDistribution = "center" | "distributed";
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

export interface SourceAsset {
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

export interface CanvasSettings {
  width: number;
  height: number;
  background: string;
  inset: number;
}

export interface LayoutSettings {
  family: LayoutFamily;
  shapeMode: GeometryShape;
  density: number;
  columns: number;
  rows: number;
  gutter: number;
  blockDepth: number;
  stripOrientation: "horizontal" | "vertical" | "mixed";
  radialSegments: number;
  radialRings: number;
  symmetryMode: "none" | "mirror-x" | "mirror-y" | "quad" | "radial";
  symmetryCopies: number;
  randomness: number;
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
  mirror: boolean;
  kaleidoscopeSegments: number;
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

export interface RenderRect {
  x: number;
  y: number;
  width: number;
  height: number;
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
  rotation: number;
  scale: number;
  opacity: number;
  blendMode: BlendMode;
  clipInset: number;
  displacementOffset: { x: number; y: number };
  distortion: number;
  sourceCrop: NormalizedRect | null;
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
