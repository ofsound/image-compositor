import type { GeometryShape, LayoutFamily } from "@/types/project";

export function getGeometryOptions(family: LayoutFamily): GeometryShape[] {
  return family === "grid"
    ? ["mixed", "rect", "triangle", "interlock", "ring", "arc", "wedge"]
    : family === "organic"
      ? ["blob", "rect", "mixed", "ring", "arc", "wedge"]
      : ["mixed", "rect", "triangle", "ring", "arc", "wedge"];
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

  if (shapeMode === "interlock") {
    return "triangle";
  }

  return "rect";
}
