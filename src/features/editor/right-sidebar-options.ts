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
  WordFontFamily,
  WordsMode,
} from "@/types/project";
import type { ProjectEditorView } from "@/lib/project-editor-view";

export interface LabeledOption<T extends string> {
  value: T;
  label: string;
}

export const LAYOUT_FAMILY_OPTIONS: LabeledOption<LayoutFamily>[] = [
  { value: "blocks", label: "Blocks" },
  { value: "grid", label: "Grid" },
  { value: "strips", label: "Strips" },
  { value: "radial", label: "Radial" },
  { value: "organic", label: "Organic" },
  { value: "flow", label: "Flow" },
  { value: "3d", label: "3D" },
  { value: "fractal", label: "Fractal" },
  { value: "draw", label: "Draw" },
  { value: "words", label: "Words" },
];

export const WORDS_MODE_OPTIONS: LabeledOption<WordsMode>[] = [
  { value: "image-fill", label: "Image Fill" },
  { value: "plain-text", label: "Plain Text" },
];

export const WORDS_FONT_OPTIONS: LabeledOption<WordFontFamily>[] = [
  { value: "dm-sans", label: "DM Sans" },
  { value: "cormorant-garamond", label: "Cormorant Garamond" },
  { value: "jetbrains-mono", label: "JetBrains Mono" },
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
  "round-robin",
  "tone-map",
  "contrast",
  "anti-repeat",
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

export function isOptionValue<T extends string>(
  options: readonly LabeledOption<T>[],
  value: string,
): value is T {
  return options.some((option) => option.value === value);
}

export type RightSidebarGeometryOptions = GeometryShape[];
