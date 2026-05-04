import { Maximize2, Minimize2 } from "lucide-react";

import { EditableSliderValue } from "@/components/app/editable-slider-value";
import { PreviewStage } from "@/components/app/preview-stage";
import type { PreviewRenderState } from "@/components/app/preview-stage";
import { PanelShell } from "@/components/app/panel-shell";
import { SourceColorField } from "@/components/app/source-color-field";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lockExportDimensionsToCanvas } from "@/lib/export-sizing";
import {
  formatPercentValue,
  normalizeSliderInputValue,
  parsePercentInputValue,
} from "@/lib/format-utils";
import { DEFAULT_CANVAS, DEFAULT_EXPORT } from "@/lib/project-defaults";
import type { ProjectEditorView } from "@/lib/project-editor-view";
import type { DrawStroke, ProjectDocument, SourceAsset } from "@/types/project";
import { SliderField } from "@/components/app/procedural-texture-tab";
import { ControlBlock } from "@/components/app/procedural-texture-tab";

const EXPORT_FORMAT_OPTIONS: {
  value: ProjectEditorView["export"]["format"];
  label: string;
}[] = [
  { value: "image/png", label: "PNG" },
  { value: "image/jpeg", label: "JPEG" },
  { value: "image/png-transparent", label: "Transparent PNG" },
];

function isExportFormat(
  value: string,
): value is ProjectEditorView["export"]["format"] {
  return EXPORT_FORMAT_OPTIONS.some((option) => option.value === value);
}

interface CenterCanvasProps {
  previewExpanded: boolean;
  setPreviewExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  previewProject: ProjectDocument | null;
  activeProject: ProjectDocument;
  previewAssets: SourceAsset[];
  setRenderState: React.Dispatch<React.SetStateAction<PreviewRenderState>>;
  drawEnabled: boolean;
  drawBrushSize: number;
  appendDrawStroke: (stroke: DrawStroke) => Promise<void>;
  patchProject: (
    updater: (project: ProjectEditorView) => ProjectEditorView,
  ) => void;
}

export function CenterCanvas({
  previewExpanded,
  setPreviewExpanded,
  canvasRef,
  previewProject,
  activeProject,
  previewAssets,
  setRenderState,
  drawEnabled,
  drawBrushSize,
  appendDrawStroke,
  patchProject,
}: CenterCanvasProps) {
  const previewPanel = (
    <PanelShell
      title="Preview"
      sectionLabel="Preview"
      hideHeader
      className="min-w-0 flex-1"
      overlayActions={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="bg-surface-raised/85 backdrop-blur-sm"
          aria-label={previewExpanded ? "Restore layout" : "Expand preview"}
          aria-pressed={previewExpanded}
          title={previewExpanded ? "Restore layout" : "Expand preview"}
          onClick={() => setPreviewExpanded((current) => !current)}
        >
          {previewExpanded ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      }
      cardClassName="rounded-none border-0 bg-transparent shadow-none backdrop-blur-none"
      contentClassName="flex min-h-0 min-w-0 flex-1 flex-col p-0"
    >
      <PreviewStage
        canvasRef={canvasRef}
        project={previewProject ?? activeProject}
        assets={previewAssets}
        onRenderState={setRenderState}
        drawEnabled={drawEnabled}
        drawBrushSize={drawBrushSize}
        onAppendDrawStroke={appendDrawStroke}
      />
    </PanelShell>
  );

  const projectSettingsPanel = (
    <PanelShell
      title="Project Settings"
      sectionLabel="Project Settings"
      hideHeader
      className="shrink-0"
      cardClassName="bg-surface-raised shadow-none"
      contentClassName="max-h-[38vh] overflow-y-auto space-y-4 p-4"
    >
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <section aria-label="Canvas settings" className="min-w-0 space-y-4">
          <SliderField
            label="Canvas W"
            min={1200}
            max={3840}
            step={10}
            value={activeProject.canvas.width}
            defaultValue={DEFAULT_CANVAS.width}
            formatter={(value) => `${Math.round(value)} px`}
            onChange={(value) =>
              patchProject((project) => {
                const canvas = {
                  ...project.canvas,
                  width: Math.round(value),
                };
                return {
                  ...project,
                  canvas,
                  export: {
                    ...project.export,
                    ...lockExportDimensionsToCanvas(
                      canvas,
                      project.export,
                      "width"
                    ),
                  },
                };
              })
            }
          />
          <SliderField
            label="Canvas H"
            min={800}
            max={3200}
            step={10}
            value={activeProject.canvas.height}
            defaultValue={DEFAULT_CANVAS.height}
            formatter={(value) => `${Math.round(value)} px`}
            onChange={(value) =>
              patchProject((project) => {
                const canvas = {
                  ...project.canvas,
                  height: Math.round(value),
                };
                return {
                  ...project,
                  canvas,
                  export: {
                    ...project.export,
                    ...lockExportDimensionsToCanvas(
                      canvas,
                      project.export,
                      "width"
                    ),
                  },
                };
              })
            }
          />
          <ControlBlock
            label="Canvas Background"
            value={`${Math.round(activeProject.canvas.backgroundAlpha * 100)}%`}
          >
            <SourceColorField
              id="canvas-background-color"
              label="Color"
              value={activeProject.canvas.background}
              onChange={(value) =>
                patchProject((project) => ({
                  ...project,
                  canvas: {
                    ...project.canvas,
                    background: value,
                  },
                }))
              }
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Alpha</span>
                <EditableSliderValue
                  value={formatPercentValue(activeProject.canvas.backgroundAlpha)}
                  inputLabel="Background alpha"
                  onCommit={(nextText) => {
                    const parsedValue = parsePercentInputValue(nextText);
                    if (parsedValue === null) {
                      return;
                    }

                    patchProject((project) => ({
                      ...project,
                      canvas: {
                        ...project.canvas,
                        backgroundAlpha: normalizeSliderInputValue({
                          value: parsedValue,
                          min: 0,
                          max: 1,
                          step: 0.01,
                        }),
                      },
                    }));
                  }}
                  className="text-text-faint"
                />
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[activeProject.canvas.backgroundAlpha]}
                defaultValue={[DEFAULT_CANVAS.backgroundAlpha]}
                onValueChange={(next) =>
                  patchProject((project) => ({
                    ...project,
                    canvas: {
                      ...project.canvas,
                      backgroundAlpha: next[0] ?? project.canvas.backgroundAlpha,
                    },
                  }))
                }
              />
            </div>
          </ControlBlock>
        </section>

        <section aria-label="Export settings" className="min-w-0 space-y-4">
          <ControlBlock label="Export Format">
            <Select
              value={activeProject.export.format}
              onValueChange={(value) => {
                if (!isExportFormat(value)) return;
                patchProject((project) => ({
                  ...project,
                  export: {
                    ...project.export,
                    format: value,
                  },
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPORT_FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ControlBlock>
          <SliderField
            label="Export W"
            min={1920}
            max={7680}
            step={16}
            value={activeProject.export.width}
            defaultValue={DEFAULT_EXPORT.width}
            formatter={(value) => `${Math.round(value)} px`}
            onChange={(value) =>
              patchProject((project) => ({
                ...project,
                export: {
                  ...project.export,
                  ...lockExportDimensionsToCanvas(
                    project.canvas,
                    {
                      ...project.export,
                      width: Math.round(value),
                    },
                    "width"
                  ),
                },
              }))
            }
          />
          <SliderField
            label="Export H"
            min={1080}
            max={7680}
            step={16}
            value={activeProject.export.height}
            defaultValue={DEFAULT_EXPORT.height}
            formatter={(value) => `${Math.round(value)} px`}
            onChange={(value) =>
              patchProject((project) => ({
                ...project,
                export: {
                  ...project.export,
                  ...lockExportDimensionsToCanvas(
                    project.canvas,
                    {
                      ...project.export,
                      height: Math.round(value),
                    },
                    "height"
                  ),
                },
              }))
            }
          />
          <SliderField
            label="Export Quality"
            min={0.7}
            max={1}
            step={0.01}
            value={activeProject.export.quality}
            defaultValue={DEFAULT_EXPORT.quality}
            onChange={(value) =>
              patchProject((project) => ({
                ...project,
                export: { ...project.export, quality: value },
              }))
            }
          />
        </section>
      </div>
    </PanelShell>
  );

  if (previewExpanded) {
    return previewPanel;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-3">
      {previewPanel}
      {projectSettingsPanel}
    </div>
  );
}
