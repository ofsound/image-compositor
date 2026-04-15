import type {
  FractalVariant,
  GeometryShape,
  LayoutFamily,
} from "@/types/project";

export const FRACTAL_RADIAL_SYMMETRY_COPY_LIMIT = 6;

const FRACTAL_ITERATION_LIMITS: Record<FractalVariant, number> = {
  "sierpinski-triangle": 6,
  "sierpinski-carpet": 4,
  vicsek: 5,
  "h-tree": 5,
  rosette: 4,
  "binary-tree": 8,
  "pythagoras-tree": 6,
};

export function getFractalIterationLimit(variant: FractalVariant) {
  return FRACTAL_ITERATION_LIMITS[variant];
}

export function isPatternDrivenFamily(family: LayoutFamily) {
  return family === "fractal";
}

export function getGeometryOptions(family: LayoutFamily): GeometryShape[] {
  if (family === "words") {
    return ["rect"];
  }

  if (family === "fractal") {
    return ["rect", "text"];
  }

  return family === "grid"
    ? ["mixed", "rect", "triangle", "interlock", "ring", "arc", "wedge", "text"]
    : family === "organic"
      ? ["blob", "rect", "mixed", "ring", "arc", "wedge", "text"]
      : ["mixed", "rect", "triangle", "ring", "arc", "wedge", "text"];
}

export function coerceShapeModeForFamily(
  family: LayoutFamily,
  shapeMode: GeometryShape,
): GeometryShape {
  if (getGeometryOptions(family).includes(shapeMode)) {
    return shapeMode;
  }

  if (family === "organic") {
    return "blob";
  }

  if (family === "fractal") {
    return "rect";
  }

  if (family === "words") {
    return "rect";
  }

  if (shapeMode === "interlock") {
    return "triangle";
  }

  return "rect";
}
