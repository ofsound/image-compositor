import type { CanvasSettings, ExportSettings } from "@/types/project";
import { clamp } from "@/lib/utils";

const EXPORT_WIDTH_MIN = 1920;
const EXPORT_WIDTH_MAX = 7680;
const EXPORT_HEIGHT_MIN = 1080;
const EXPORT_HEIGHT_MAX = 7680;
const EXPORT_STEP = 16;

function roundToStep(value: number) {
  return Math.round(value / EXPORT_STEP) * EXPORT_STEP;
}

function clampExportWidth(value: number) {
  return clamp(roundToStep(value), EXPORT_WIDTH_MIN, EXPORT_WIDTH_MAX);
}

function clampExportHeight(value: number) {
  return clamp(roundToStep(value), EXPORT_HEIGHT_MIN, EXPORT_HEIGHT_MAX);
}

export function lockExportDimensionsToCanvas(
  canvas: Pick<CanvasSettings, "width" | "height">,
  exportSettings: Pick<ExportSettings, "width" | "height">,
  anchor: "width" | "height",
) {
  const aspectRatio = canvas.width / Math.max(1, canvas.height);

  if (anchor === "height") {
    let height = clampExportHeight(exportSettings.height);
    const width = clampExportWidth(height * aspectRatio);
    height = clampExportHeight(width / aspectRatio);
    return { width, height };
  }

  let width = clampExportWidth(exportSettings.width);
  const height = clampExportHeight(width / aspectRatio);
  width = clampExportWidth(height * aspectRatio);
  return { width, height };
}
