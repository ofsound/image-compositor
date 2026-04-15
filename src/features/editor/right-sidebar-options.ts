import type {
  BlendMode,
  CropDistribution,
  FractalVariant,
  GeometryShape,
  KaleidoscopeMirrorMode,
  LayoutFamily,
  RadialChildRotationMode,
  SourceAssignmentStrategy,
  ThreeDStructureMode,
} from "@/types/project";
import type { ProjectEditorView } from "@/lib/project-editor-view";

export const LAYOUT_FAMILY_OPTIONS: LayoutFamily[] = [
  "blocks",
  "grid",
  "strips",
  "radial",
  "organic",
  "flow",
  "3d",
  "fractal",
  "draw",
];

export const FRACTAL_VARIANT_OPTIONS: FractalVariant[] = [
  "sierpinski-triangle",
  "sierpinski-carpet",
  "vicsek",
  "h-tree",
  "rosette",
  "binary-tree",
  "pythagoras-tree",
];

export const RADIAL_CHILD_ROTATION_OPTIONS: RadialChildRotationMode[] = [
  "none",
  "tangent",
  "outward",
];

export const THREE_D_STRUCTURE_OPTIONS: ThreeDStructureMode[] = [
  "sphere",
  "torus",
  "attractor",
];

export const SYMMETRY_MODE_OPTIONS: ProjectEditorView["layout"]["symmetryMode"][] = [
  "none",
  "mirror-x",
  "mirror-y",
  "quad",
  "radial",
];

export const SOURCE_ASSIGNMENT_OPTIONS: SourceAssignmentStrategy[] = [
  "random",
  "weighted",
  "sequential",
  "luminance",
  "palette",
  "symmetry",
];

export const CROP_DISTRIBUTION_OPTIONS: CropDistribution[] = [
  "center",
  "distributed",
];

export const BLEND_MODE_OPTIONS: BlendMode[] = [
  "source-over",
  "multiply",
  "screen",
  "overlay",
  "soft-light",
  "hard-light",
  "difference",
  "color-dodge",
  "luminosity",
];

export const KALEIDOSCOPE_MIRROR_MODE_OPTIONS: KaleidoscopeMirrorMode[] = [
  "rotate-only",
  "alternate",
  "mirror-all",
];

export function isOption<T extends string>(
  options: readonly T[],
  value: string,
): value is T {
  return options.some((option) => option === value);
}

export type RightSidebarGeometryOptions = GeometryShape[];
