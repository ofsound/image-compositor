import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SourceColorField } from "@/components/app/source-color-field";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SliderField,
  ControlBlock,
} from "@/components/app/procedural-texture-tab";
import {
  InspectorGroup,
  InspectorFieldGrid,
} from "@/components/app/inspector-group";
import type {
  ElementModulationPattern,
  ElementModulationSettings,
  ElementModulationTarget,
  GeometryShape,
} from "@/types/project";

import { coerceShapeModeForFamily } from "@/lib/layout-utils";
import {
  DENSITY_UI_SCALE,
  formatCurveAttractorTypeLabel,
  formatCurveVariantLabel,
  formatFractalVariantLabel,
  formatStripBendWaveformLabel,
  ORGANIC_DISTRIBUTION_MAX,
  THREE_D_DISTRIBUTION_MAX,
  formatPercentValue,
  formatDegreeValue,
} from "@/lib/format-utils";
import type { ProjectEditorView } from "@/lib/project-editor-view";
import {
  DEFAULT_COMPOSITING,
  DEFAULT_DRAW,
  DEFAULT_EFFECTS,
  DEFAULT_FINISH,
  DEFAULT_LAYOUT,
  DEFAULT_SVG_GEOMETRY,
  DEFAULT_SOURCE_MAPPING,
} from "@/lib/project-defaults";
import {
  readSvgGeometryFile,
  SVG_GEOMETRY_FIT_OPTIONS,
  SVG_GEOMETRY_MIRROR_OPTIONS,
} from "@/lib/svg-geometry";
import {
  FRACTAL_RADIAL_SYMMETRY_COPY_LIMIT,
  getFractalIterationLimit,
} from "@/lib/layout-utils";
import { Switch } from "@/components/ui/switch";
import {
  BLEND_MODE_OPTIONS,
  CROP_DISTRIBUTION_OPTIONS,
  CURVE_ATTRACTOR_TYPE_OPTIONS,
  CURVE_VARIANT_OPTIONS,
  FRACTAL_VARIANT_OPTIONS,
  isOption,
  isOptionValue,
  KALEIDOSCOPE_MIRROR_MODE_OPTIONS,
  LAYOUT_FAMILY_OPTIONS,
  RADIAL_CHILD_ROTATION_OPTIONS,
  SOURCE_ASSIGNMENT_OPTIONS,
  STRIP_BEND_WAVEFORM_OPTIONS,
  SYMMETRY_MODE_OPTIONS,
  THREE_D_STRUCTURE_OPTIONS,
  WORDS_FONT_OPTIONS,
  WORDS_MODE_OPTIONS,
} from "@/features/editor/right-sidebar-options";

interface RightSidebarProps {
  previewExpanded: boolean;
  activeProjectView: ProjectEditorView;
  patchProject: (
    updater: (view: ProjectEditorView) => ProjectEditorView,
  ) => void;
  clearDrawLayer: () => Promise<void>;
  hasDrawStrokes: boolean;
  inspectorLayerName: string;
  isDrawFamily: boolean;
  isTextShapeMode: boolean;
  isSvgShapeMode: boolean;
  isRectShapeMode: boolean;
  isWedgeShapeMode: boolean;
  isHollowShapeMode: boolean;
  isGridFamily: boolean;
  isStripsFamily: boolean;
  isBlocksFamily: boolean;
  isRadialFamily: boolean;
  isOrganicFamily: boolean;
  isFlowFamily: boolean;
  isThreeDFamily: boolean;
  isFractalFamily: boolean;
  isCurvesFamily: boolean;
  isWordsFamily: boolean;
  isSymmetryActive: boolean;
  isRadialSymmetry: boolean;
  isToneMapAssignment: boolean;
  isContrastAssignment: boolean;
  isKaleidoscopeActive: boolean;
  showGeometryControls: boolean;
  geometryOptions: GeometryShape[];
  geometryValue: GeometryShape;
}

const ELEMENT_MODULATION_TARGET_OPTIONS: Array<{
  value: ElementModulationTarget;
  label: string;
}> = [
  { value: "rotation", label: "Rotation" },
  { value: "scale", label: "Scale" },
  { value: "displacementX", label: "Displace X" },
  { value: "displacementY", label: "Displace Y" },
  { value: "opacity", label: "Opacity" },
  { value: "distortion", label: "Distortion" },
  { value: "wedgeSweep", label: "Wedge Sweep" },
  { value: "threeDZ", label: "3D Z" },
  { value: "threeDTwist", label: "3D Twist" },
  { value: "symmetryDrift", label: "Symmetry Drift" },
];

const ELEMENT_MODULATION_PATTERN_OPTIONS: Array<{
  value: ElementModulationPattern;
  label: string;
}> = [
  { value: "sine", label: "Sine" },
  { value: "triangle", label: "Triangle" },
  { value: "saw", label: "Saw" },
  { value: "checker", label: "Checker" },
  { value: "linear", label: "Linear" },
  { value: "rings", label: "Rings" },
  { value: "spiral", label: "Spiral" },
  { value: "depth", label: "Depth" },
];

function isElementModulationTarget(value: string): value is ElementModulationTarget {
  return ELEMENT_MODULATION_TARGET_OPTIONS.some((option) => option.value === value);
}

function isElementModulationPattern(value: string): value is ElementModulationPattern {
  return ELEMENT_MODULATION_PATTERN_OPTIONS.some((option) => option.value === value);
}

function getElementModulationAmountConfig(target: ElementModulationTarget) {
  if (target === "rotation" || target === "wedgeSweep" || target === "threeDTwist") {
    return {
      max: 180,
      step: 1,
      formatter: (value: number) => `${Math.round(value)}°`,
    };
  }

  if (target === "displacementX" || target === "displacementY") {
    return {
      max: 500,
      step: 1,
      formatter: (value: number) => `${Math.round(value)} px`,
    };
  }

  if (target === "opacity") {
    return {
      max: 100,
      step: 1,
      formatter: (value: number) => `${Math.round(value)}%`,
    };
  }

  if (target === "threeDZ" || target === "symmetryDrift") {
    return {
      max: 1,
      step: 0.01,
      formatter: (value: number) => value.toFixed(2),
    };
  }

  return {
    max: target === "scale" ? 2 : 0.8,
    step: 0.01,
    formatter: (value: number) => value.toFixed(2),
  };
}

export function RightSidebar({
  previewExpanded,
  activeProjectView,
  patchProject,
  clearDrawLayer,
  hasDrawStrokes,
  inspectorLayerName,
  isDrawFamily,
  isTextShapeMode,
  isSvgShapeMode,
  isRectShapeMode,
  isWedgeShapeMode,
  isHollowShapeMode,
  isGridFamily,
  isStripsFamily,
  isBlocksFamily,
  isRadialFamily,
  isOrganicFamily,
  isFlowFamily,
  isThreeDFamily,
  isFractalFamily,
  isCurvesFamily,
  isWordsFamily,
  isSymmetryActive,
  isRadialSymmetry,
  isToneMapAssignment,
  isContrastAssignment,
  isKaleidoscopeActive,
  showGeometryControls,
  geometryOptions,
  geometryValue,
}: RightSidebarProps) {
  const svgUploadInputRef = useRef<HTMLInputElement>(null);
  const [svgUploadError, setSvgUploadError] = useState<string | null>(null);
  const [selectedModulationTarget, setSelectedModulationTarget] =
    useState<ElementModulationTarget>("rotation");

  if (previewExpanded) return null;

  const fractalIterationMax = getFractalIterationLimit(
    activeProjectView.layout.fractalVariant,
  );
  const radialCopiesMax =
    isFractalFamily && isRadialSymmetry
      ? FRACTAL_RADIAL_SYMMETRY_COPY_LIMIT
      : 12;
  const selectedModulation =
    activeProjectView.effects.elementModulations[selectedModulationTarget];
  const selectedModulationAmountConfig = getElementModulationAmountConfig(
    selectedModulationTarget,
  );
  const patchSelectedModulation = (
    patch: Partial<ElementModulationSettings>,
  ) => {
    patchProject((project) => ({
      ...project,
      effects: {
        ...project.effects,
        elementModulations: {
          ...project.effects.elementModulations,
          [selectedModulationTarget]: {
            ...project.effects.elementModulations[selectedModulationTarget],
            ...patch,
          },
        },
      },
    }));
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <section aria-label="Inspector" className="flex min-h-0 flex-1 flex-col">
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Inspector</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
            <section aria-label="Layer Controls" className="space-y-4">
              <div className="rounded-md border border-border-subtle bg-surface-sunken/70 px-3 py-2.5">
                <div
                  id="layer-controls-heading"
                  className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted"
                >
                  Layer Controls
                </div>
                <div className="mt-1 text-sm font-medium text-text">
                  Editing {inspectorLayerName}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 [grid-auto-flow:dense]">
                <InspectorGroup title="Shape">
                  <InspectorFieldGrid className="sm:grid-cols-2">
                    <ControlBlock label="Family">
                      <Select
                        value={activeProjectView.layout.family}
                        onValueChange={(value) => {
                          if (!isOptionValue(LAYOUT_FAMILY_OPTIONS, value)) return;
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              family: value,
                              shapeMode: coerceShapeModeForFamily(
                                value,
                                project.layout.shapeMode,
                              ),
                              symmetryCopies:
                                value === "fractal" &&
                                project.layout.symmetryMode === "radial"
                                  ? Math.min(
                                      project.layout.symmetryCopies,
                                      FRACTAL_RADIAL_SYMMETRY_COPY_LIMIT,
                                    )
                                  : project.layout.symmetryCopies,
                            },
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LAYOUT_FAMILY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ControlBlock>
                    {showGeometryControls ? (
                      <ControlBlock label="Geometry">
                        <Select
                          value={geometryValue}
                          onValueChange={(value) => {
                            if (!isOption(geometryOptions, value)) return;
                            patchProject((project) => ({
                              ...project,
                              layout: {
                                ...project.layout,
                                shapeMode: value,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {geometryOptions.map((option: GeometryShape) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ControlBlock>
                    ) : null}
                    {!isWordsFamily && !isTextShapeMode && !isSvgShapeMode && isRectShapeMode ? (
                      <SliderField
                        className="sm:col-span-2"
                        label="Corner Radius"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.rectCornerRadius}
                        defaultValue={DEFAULT_LAYOUT.rectCornerRadius}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              rectCornerRadius: value,
                            },
                          }))
                        }
                      />
                    ) : null}
                    {!isWordsFamily && !isTextShapeMode && !isSvgShapeMode && isWedgeShapeMode ? (
                      <>
                        <SliderField
                          label="Wedge Angle"
                          min={0}
                          max={360}
                          step={1}
                          value={activeProjectView.layout.wedgeAngle}
                          defaultValue={DEFAULT_LAYOUT.wedgeAngle}
                          formatter={(value) => `${Math.round(value)}°`}
                          onChange={(value) =>
                            patchProject((project) => ({
                              ...project,
                              layout: {
                                ...project.layout,
                                wedgeAngle: value,
                              },
                            }))
                          }
                        />
                        <SliderField
                          label="Wedge Jitter"
                          min={0}
                          max={360}
                          step={1}
                          value={activeProjectView.layout.wedgeJitter}
                          defaultValue={DEFAULT_LAYOUT.wedgeJitter}
                          formatter={(value) => `${Math.round(value)}°`}
                          onChange={(value) =>
                            patchProject((project) => ({
                              ...project,
                              layout: {
                                ...project.layout,
                                wedgeJitter: value,
                              },
                            }))
                          }
                        />
                      </>
                    ) : null}
                    {!isWordsFamily && !isTextShapeMode && !isSvgShapeMode && isHollowShapeMode ? (
                      <SliderField
                        className="sm:col-span-2"
                        label="Hollow Ratio"
                        min={0}
                        max={0.95}
                        step={0.01}
                        value={activeProjectView.layout.hollowRatio}
                        defaultValue={DEFAULT_LAYOUT.hollowRatio}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              hollowRatio: value,
                            },
                          }))
                        }
                      />
                    ) : null}
                  </InspectorFieldGrid>
                </InspectorGroup>

                {isDrawFamily ? (
                  <InspectorGroup title="Brush">
                    <InspectorFieldGrid>
                      <SliderField
                        className="sm:col-span-2"
                        label="Brush Size"
                        min={8}
                        max={640}
                        step={1}
                        value={activeProjectView.draw.brushSize}
                        defaultValue={DEFAULT_DRAW.brushSize}
                        formatter={(value) => `${Math.round(value)} px`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            draw: {
                              ...project.draw,
                              brushSize: Math.round(value),
                            },
                          }))
                        }
                      />
                      <ControlBlock
                        label="Layer Strokes"
                        className="sm:col-span-2"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          disabled={!hasDrawStrokes}
                          onClick={() => void clearDrawLayer()}
                        >
                          Clear Draw Layer
                        </Button>
                      </ControlBlock>
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {isSvgShapeMode ? (
                  <InspectorGroup title="SVG">
                    <InspectorFieldGrid className="sm:grid-cols-2">
                      <ControlBlock label="Shape File" className="sm:col-span-2">
                        <input
                          ref={svgUploadInputRef}
                          type="file"
                          accept=".svg,image/svg+xml"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = "";
                            if (!file) return;

                            void readSvgGeometryFile(file)
                              .then(({ fileName, markup }) => {
                                setSvgUploadError(null);
                                patchProject((project) => ({
                                  ...project,
                                  svgGeometry: {
                                    ...project.svgGeometry,
                                    fileName,
                                    markup,
                                  },
                                }));
                              })
                              .catch((error) => {
                                setSvgUploadError(
                                  error instanceof Error
                                    ? error.message
                                    : "Could not read SVG geometry.",
                                );
                              });
                          }}
                        />
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => svgUploadInputRef.current?.click()}
                          >
                            {activeProjectView.svgGeometry.markup
                              ? "Replace SVG"
                              : "Upload SVG"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!activeProjectView.svgGeometry.markup}
                            onClick={() => {
                              setSvgUploadError(null);
                              patchProject((project) => ({
                                ...project,
                                svgGeometry: {
                                  ...project.svgGeometry,
                                  fileName: null,
                                  markup: null,
                                },
                              }));
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                        <div className="rounded-md bg-surface-muted px-3 py-2 text-xs text-text-muted">
                          {activeProjectView.svgGeometry.fileName ??
                            "No SVG uploaded. SVG geometry will render empty."}
                        </div>
                        {svgUploadError ? (
                          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                            {svgUploadError}
                          </div>
                        ) : !activeProjectView.svgGeometry.markup ? (
                          <div className="rounded-md border border-border-subtle bg-surface-sunken px-3 py-2 text-xs text-text-muted">
                            Upload a valid SVG to use this geometry mode.
                          </div>
                        ) : null}
                      </ControlBlock>

                      <ControlBlock label="Fit">
                        <Select
                          value={activeProjectView.svgGeometry.fit}
                          onValueChange={(value) => {
                            if (!isOption(SVG_GEOMETRY_FIT_OPTIONS, value)) return;
                            patchProject((project) => ({
                              ...project,
                              svgGeometry: {
                                ...project.svgGeometry,
                                fit: value,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger aria-label="SVG Fit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SVG_GEOMETRY_FIT_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ControlBlock>
                      <ControlBlock label="Mirror">
                        <Select
                          value={activeProjectView.svgGeometry.mirrorMode}
                          onValueChange={(value) => {
                            if (!isOption(SVG_GEOMETRY_MIRROR_OPTIONS, value)) return;
                            patchProject((project) => ({
                              ...project,
                              svgGeometry: {
                                ...project.svgGeometry,
                                mirrorMode: value,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger aria-label="SVG Mirror">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SVG_GEOMETRY_MIRROR_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ControlBlock>
                      <SliderField
                        label="Padding"
                        min={0}
                        max={0.45}
                        step={0.01}
                        value={activeProjectView.svgGeometry.padding}
                        defaultValue={DEFAULT_SVG_GEOMETRY.padding}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            svgGeometry: {
                              ...project.svgGeometry,
                              padding: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Threshold"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.svgGeometry.threshold}
                        defaultValue={DEFAULT_SVG_GEOMETRY.threshold}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            svgGeometry: {
                              ...project.svgGeometry,
                              threshold: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Grow / Shrink"
                        min={-32}
                        max={32}
                        step={1}
                        value={activeProjectView.svgGeometry.morphology}
                        defaultValue={DEFAULT_SVG_GEOMETRY.morphology}
                        formatter={(value) => `${Math.round(value)} px`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            svgGeometry: {
                              ...project.svgGeometry,
                              morphology: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Random Rotation"
                        min={0}
                        max={180}
                        step={1}
                        value={activeProjectView.svgGeometry.randomRotation}
                        defaultValue={DEFAULT_SVG_GEOMETRY.randomRotation}
                        formatter={(value) => `${Math.round(value)}°`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            svgGeometry: {
                              ...project.svgGeometry,
                              randomRotation: value,
                            },
                          }))
                        }
                      />
                      <ControlBlock label="Invert">
                        <div className="flex items-center justify-between rounded-md bg-surface-muted px-3 py-2.5">
                          <span className="text-xs text-text-muted">
                            Fill outside alpha
                          </span>
                          <Switch
                            checked={activeProjectView.svgGeometry.invert}
                            onCheckedChange={(checked) =>
                              patchProject((project) => ({
                                ...project,
                                svgGeometry: {
                                  ...project.svgGeometry,
                                  invert: checked,
                                },
                              }))
                            }
                          />
                        </div>
                      </ControlBlock>
                      <ControlBlock label="Tile Repeat">
                        <div className="flex items-center justify-between rounded-md bg-surface-muted px-3 py-2.5">
                          <span className="text-xs text-text-muted">
                            Repeat inside slice
                          </span>
                          <Switch
                            checked={activeProjectView.svgGeometry.repeatEnabled}
                            onCheckedChange={(checked) =>
                              patchProject((project) => ({
                                ...project,
                                svgGeometry: {
                                  ...project.svgGeometry,
                                  repeatEnabled: checked,
                                },
                              }))
                            }
                          />
                        </div>
                      </ControlBlock>
                      <SliderField
                        label="Tile Scale"
                        min={0.08}
                        max={1}
                        step={0.01}
                        value={activeProjectView.svgGeometry.repeatScale}
                        defaultValue={DEFAULT_SVG_GEOMETRY.repeatScale}
                        disabled={!activeProjectView.svgGeometry.repeatEnabled}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            svgGeometry: {
                              ...project.svgGeometry,
                              repeatScale: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Tile Gap"
                        min={0}
                        max={0.8}
                        step={0.01}
                        value={activeProjectView.svgGeometry.repeatGap}
                        defaultValue={DEFAULT_SVG_GEOMETRY.repeatGap}
                        disabled={!activeProjectView.svgGeometry.repeatEnabled}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            svgGeometry: {
                              ...project.svgGeometry,
                              repeatGap: value,
                            },
                          }))
                        }
                      />
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {isWordsFamily || isTextShapeMode ? (
                  <InspectorGroup title={isWordsFamily ? "Words" : "Text"}>
                    <InspectorFieldGrid className="sm:grid-cols-2">
                      {isWordsFamily ? (
                        <ControlBlock label="Render Mode">
                          <Select
                            value={activeProjectView.words.mode}
                            onValueChange={(value) => {
                              if (!isOptionValue(WORDS_MODE_OPTIONS, value)) return;
                              patchProject((project) => ({
                                ...project,
                                words: {
                                  ...project.words,
                                  mode: value,
                                },
                              }));
                            }}
                          >
                            <SelectTrigger aria-label="Render Mode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WORDS_MODE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </ControlBlock>
                      ) : null}
                      <ControlBlock label="Font">
                        <Select
                          value={activeProjectView.words.fontFamily}
                          onValueChange={(value) => {
                            if (!isOptionValue(WORDS_FONT_OPTIONS, value)) return;
                            patchProject((project) => ({
                              ...project,
                              words: {
                                ...project.words,
                                fontFamily: value,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger aria-label="Font">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WORDS_FONT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ControlBlock>
                      <ControlBlock label="Text" className="sm:col-span-2">
                        <Textarea
                          aria-label="Words Text"
                          className="min-h-28 resize-y"
                          value={activeProjectView.words.text}
                          onChange={(event) => {
                            const nextText = event.target.value;
                            patchProject((project) => ({
                              ...project,
                              words: {
                                ...project.words,
                                text: nextText,
                              },
                            }));
                          }}
                        />
                      </ControlBlock>
                      {activeProjectView.words.mode === "plain-text" ? (
                        isWordsFamily ? (
                          <div className="sm:col-span-2">
                            <SourceColorField
                              id="words-text-color"
                              label="Text Color"
                              value={activeProjectView.words.textColor}
                              onChange={(value) =>
                                patchProject((project) => ({
                                  ...project,
                                  words: {
                                    ...project.words,
                                    textColor: value,
                                  },
                                }))
                              }
                            />
                          </div>
                        ) : null
                      ) : null}
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {isGridFamily ? (
                  <InspectorGroup title="Grid">
                    <InspectorFieldGrid className="sm:grid-cols-2">
                      <SliderField
                        label="Columns"
                        min={2}
                        max={32}
                        step={1}
                        value={activeProjectView.layout.columns}
                        defaultValue={DEFAULT_LAYOUT.columns}
                        formatter={(value) => `${Math.round(value)}`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              columns: Math.round(value),
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Rows"
                        min={2}
                        max={32}
                        step={1}
                        value={activeProjectView.layout.rows}
                        defaultValue={DEFAULT_LAYOUT.rows}
                        formatter={(value) => `${Math.round(value)}`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              rows: Math.round(value),
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Gutter Horizontal"
                        min={0}
                        max={300}
                        step={1}
                        value={activeProjectView.layout.gutterHorizontal}
                        defaultValue={DEFAULT_LAYOUT.gutterHorizontal}
                        formatter={(value) => `${Math.round(value)} px`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              gutterHorizontal: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Gutter Vertical"
                        min={0}
                        max={300}
                        step={1}
                        value={activeProjectView.layout.gutterVertical}
                        defaultValue={DEFAULT_LAYOUT.gutterVertical}
                        formatter={(value) => `${Math.round(value)} px`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              gutterVertical: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Grid Angle"
                        min={0}
                        max={180}
                        step={1}
                        value={activeProjectView.layout.gridAngle}
                        defaultValue={DEFAULT_LAYOUT.gridAngle}
                        formatter={(value) => `${Math.round(value)}°`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              gridAngle: value,
                            },
                          }))
                        }
                      />
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {isStripsFamily ? (
                  <InspectorGroup title="Strips">
                    <InspectorFieldGrid>
                      <SliderField
                        label="Strips Angle"
                        min={0}
                        max={180}
                        step={1}
                        value={activeProjectView.layout.stripAngle}
                        defaultValue={DEFAULT_LAYOUT.stripAngle}
                        formatter={(value) => `${Math.round(value)}°`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              stripAngle: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Density"
                        min={0.05}
                        max={1}
                        step={0.01}
                        value={
                          activeProjectView.layout.density / DENSITY_UI_SCALE
                        }
                        defaultValue={DEFAULT_LAYOUT.density / DENSITY_UI_SCALE}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              density: Number(
                                (value * DENSITY_UI_SCALE).toFixed(2),
                              ),
                            },
                          }))
                        }
                      />
                      <SliderField
                        className="sm:col-span-2"
                        label="Gutter"
                        min={0}
                        max={300}
                        step={1}
                        value={activeProjectView.layout.gutter}
                        defaultValue={DEFAULT_LAYOUT.gutter}
                        formatter={(value) => `${Math.round(value)} px`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              gutter: value,
                            },
                          }))
                        }
                      />
                      <ControlBlock
                        label="Bend Waveform"
                        className="sm:col-span-2"
                      >
                        <Select
                          value={activeProjectView.layout.stripBendWaveform}
                          onValueChange={(value) => {
                            if (!isOption(STRIP_BEND_WAVEFORM_OPTIONS, value)) {
                              return;
                            }
                            patchProject((project) => ({
                              ...project,
                              layout: {
                                ...project.layout,
                                stripBendWaveform: value,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger aria-label="Bend Waveform">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STRIP_BEND_WAVEFORM_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {formatStripBendWaveformLabel(option)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ControlBlock>
                      <SliderField
                        label="Bend Amount"
                        min={0}
                        max={600}
                        step={1}
                        disabled={
                          activeProjectView.layout.stripBendWaveform === "none"
                        }
                        value={activeProjectView.layout.stripBendAmount}
                        defaultValue={DEFAULT_LAYOUT.stripBendAmount}
                        formatter={(value) => `${Math.round(value)} px`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              stripBendAmount: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Bend Frequency"
                        min={0.1}
                        max={24}
                        step={0.1}
                        disabled={
                          activeProjectView.layout.stripBendWaveform === "none"
                        }
                        value={activeProjectView.layout.stripBendFrequency}
                        defaultValue={DEFAULT_LAYOUT.stripBendFrequency}
                        formatter={(value) => `${value.toFixed(1)}x`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              stripBendFrequency: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Bend Phase"
                        min={0}
                        max={360}
                        step={1}
                        disabled={
                          activeProjectView.layout.stripBendWaveform === "none"
                        }
                        value={activeProjectView.layout.stripBendPhase}
                        defaultValue={DEFAULT_LAYOUT.stripBendPhase}
                        formatter={formatDegreeValue}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              stripBendPhase: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Phase Offset"
                        min={-180}
                        max={180}
                        step={1}
                        disabled={
                          activeProjectView.layout.stripBendWaveform === "none"
                        }
                        value={activeProjectView.layout.stripBendPhaseOffset}
                        defaultValue={DEFAULT_LAYOUT.stripBendPhaseOffset}
                        formatter={formatDegreeValue}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              stripBendPhaseOffset: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Duty"
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        disabled={
                          activeProjectView.layout.stripBendWaveform === "none"
                        }
                        value={activeProjectView.layout.stripBendDuty}
                        defaultValue={DEFAULT_LAYOUT.stripBendDuty}
                        formatter={formatPercentValue}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              stripBendDuty: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Skew"
                        min={-1}
                        max={1}
                        step={0.01}
                        disabled={
                          activeProjectView.layout.stripBendWaveform === "none"
                        }
                        value={activeProjectView.layout.stripBendSkew}
                        defaultValue={DEFAULT_LAYOUT.stripBendSkew}
                        formatter={formatPercentValue}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              stripBendSkew: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Resolution"
                        min={4}
                        max={96}
                        step={1}
                        disabled={
                          activeProjectView.layout.stripBendWaveform === "none"
                        }
                        value={activeProjectView.layout.stripBendResolution}
                        defaultValue={DEFAULT_LAYOUT.stripBendResolution}
                        formatter={(value) => `${Math.round(value)} seg`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              stripBendResolution: Math.round(value),
                            },
                          }))
                        }
                      />
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {isBlocksFamily ? (
                  <InspectorGroup title="Blocks">
                    <InspectorFieldGrid className="sm:grid-cols-2">
                      <SliderField
                        label="Block Depth"
                        min={0}
                        max={7}
                        step={1}
                        value={activeProjectView.layout.blockDepth}
                        defaultValue={DEFAULT_LAYOUT.blockDepth}
                        formatter={(value) => `${Math.round(value)}`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              blockDepth: Math.round(value),
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Split Randomness"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.blockSplitRandomness}
                        defaultValue={DEFAULT_LAYOUT.blockSplitRandomness}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              blockSplitRandomness: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Min Block Size"
                        min={32}
                        max={400}
                        step={1}
                        value={activeProjectView.layout.blockMinSize}
                        defaultValue={DEFAULT_LAYOUT.blockMinSize}
                        formatter={(value) => `${Math.round(value)} px`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              blockMinSize: Math.round(value),
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Split Bias"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.blockSplitBias}
                        defaultValue={DEFAULT_LAYOUT.blockSplitBias}
                        formatter={(value) => {
                          if (value < 0.45) return "horizontal";
                          if (value > 0.55) return "vertical";
                          return "balanced";
                        }}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              blockSplitBias: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        className="sm:col-span-2"
                        label="Gutter"
                        min={0}
                        max={300}
                        step={1}
                        value={activeProjectView.layout.gutter}
                        defaultValue={DEFAULT_LAYOUT.gutter}
                        formatter={(value) => `${Math.round(value)} px`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              gutter: value,
                            },
                          }))
                        }
                      />
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {isRadialFamily ? (
                  <InspectorGroup title="Radial">
                    <InspectorFieldGrid className="sm:grid-cols-2">
                      <SliderField
                        label="Radial Segments"
                        min={2}
                        max={36}
                        step={1}
                        value={activeProjectView.layout.radialSegments}
                        defaultValue={DEFAULT_LAYOUT.radialSegments}
                        formatter={(value) => `${Math.round(value)}`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              radialSegments: Math.round(value),
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Radial Rings"
                        min={1}
                        max={12}
                        step={1}
                        value={activeProjectView.layout.radialRings}
                        defaultValue={DEFAULT_LAYOUT.radialRings}
                        formatter={(value) => `${Math.round(value)}`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              radialRings: Math.round(value),
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Angle Offset"
                        min={0}
                        max={360}
                        step={1}
                        value={activeProjectView.layout.radialAngleOffset}
                        defaultValue={DEFAULT_LAYOUT.radialAngleOffset}
                        formatter={(value) => `${Math.round(value)}°`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              radialAngleOffset: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Ring Phase"
                        min={-180}
                        max={180}
                        step={1}
                        value={activeProjectView.layout.radialRingPhaseStep}
                        defaultValue={DEFAULT_LAYOUT.radialRingPhaseStep}
                        formatter={(value) => `${Math.round(value)}°`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              radialRingPhaseStep: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Inner Radius"
                        min={0}
                        max={0.85}
                        step={0.01}
                        value={activeProjectView.layout.radialInnerRadius}
                        defaultValue={DEFAULT_LAYOUT.radialInnerRadius}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              radialInnerRadius: value,
                            },
                          }))
                        }
                      />
                      <ControlBlock label="Child Rotation">
                        <Select
                          value={
                            activeProjectView.layout.radialChildRotationMode
                          }
                          onValueChange={(value) => {
                            if (!isOption(RADIAL_CHILD_ROTATION_OPTIONS, value))
                              return;
                            patchProject((project) => ({
                              ...project,
                              layout: {
                                ...project.layout,
                                radialChildRotationMode: value,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger aria-label="Child Rotation">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RADIAL_CHILD_ROTATION_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ControlBlock>
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {isOrganicFamily ? (
                  <InspectorGroup title="Organic">
                    <InspectorFieldGrid>
                      <SliderField
                        label="Density"
                        min={0.05}
                        max={1}
                        step={0.01}
                        value={
                          activeProjectView.layout.density / DENSITY_UI_SCALE
                        }
                        defaultValue={DEFAULT_LAYOUT.density / DENSITY_UI_SCALE}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              density: Number(
                                (value * DENSITY_UI_SCALE).toFixed(2),
                              ),
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Distribution"
                        min={0}
                        max={ORGANIC_DISTRIBUTION_MAX}
                        step={1}
                        value={activeProjectView.layout.organicVariation}
                        defaultValue={DEFAULT_LAYOUT.organicVariation}
                        formatter={(value) => `${Math.round(value)}`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              organicVariation: Math.round(value),
                            },
                          }))
                        }
                      />
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {isFlowFamily ? (
                  <InspectorGroup title="Flow">
                    <InspectorFieldGrid>
                      <SliderField
                        label="Density"
                        min={0.05}
                        max={1}
                        step={0.01}
                        value={
                          activeProjectView.layout.density / DENSITY_UI_SCALE
                        }
                        defaultValue={DEFAULT_LAYOUT.density / DENSITY_UI_SCALE}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              density: Number(
                                (value * DENSITY_UI_SCALE).toFixed(2),
                              ),
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Flow Curvature"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.flowCurvature}
                        defaultValue={DEFAULT_LAYOUT.flowCurvature}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              flowCurvature: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Flow Coherence"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.flowCoherence}
                        defaultValue={DEFAULT_LAYOUT.flowCoherence}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              flowCoherence: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Flow Branch Rate"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.flowBranchRate}
                        defaultValue={DEFAULT_LAYOUT.flowBranchRate}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              flowBranchRate: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        className="sm:col-span-2"
                        label="Flow Taper"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.flowTaper}
                        defaultValue={DEFAULT_LAYOUT.flowTaper}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              flowTaper: value,
                            },
                          }))
                        }
                      />
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {isThreeDFamily ? (
                  <InspectorGroup title="3D Scene" className="xl:col-span-2">
                    <InspectorFieldGrid className="sm:grid-cols-2">
                      <SliderField
                        label="Density"
                        min={0.05}
                        max={1}
                        step={0.01}
                        value={
                          activeProjectView.layout.density / DENSITY_UI_SCALE
                        }
                        defaultValue={DEFAULT_LAYOUT.density / DENSITY_UI_SCALE}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              density: Number(
                                (value * DENSITY_UI_SCALE).toFixed(2),
                              ),
                            },
                          }))
                        }
                      />
                      <ControlBlock label="Structure">
                        <Select
                          value={activeProjectView.layout.threeDStructure}
                          onValueChange={(value) => {
                            if (!isOption(THREE_D_STRUCTURE_OPTIONS, value))
                              return;
                            patchProject((project) => ({
                              ...project,
                              layout: {
                                ...project.layout,
                                threeDStructure: value,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger aria-label="Structure">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {THREE_D_STRUCTURE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ControlBlock>
                      <SliderField
                        label="Distribution"
                        min={0}
                        max={THREE_D_DISTRIBUTION_MAX}
                        step={1}
                        value={activeProjectView.layout.threeDDistribution}
                        defaultValue={DEFAULT_LAYOUT.threeDDistribution}
                        formatter={(value) => `${Math.round(value)}`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              threeDDistribution: Math.round(value),
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Depth"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.threeDDepth}
                        defaultValue={DEFAULT_LAYOUT.threeDDepth}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              threeDDepth: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Camera Distance"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.threeDCameraDistance}
                        defaultValue={DEFAULT_LAYOUT.threeDCameraDistance}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              threeDCameraDistance: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Perspective"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.threeDPerspective}
                        defaultValue={DEFAULT_LAYOUT.threeDPerspective}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              threeDPerspective: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Pan X"
                        min={-1}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.threeDPanX}
                        defaultValue={DEFAULT_LAYOUT.threeDPanX}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              threeDPanX: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Pan Y"
                        min={-1}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.threeDPanY}
                        defaultValue={DEFAULT_LAYOUT.threeDPanY}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              threeDPanY: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Z Jitter"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.threeDZJitter}
                        defaultValue={DEFAULT_LAYOUT.threeDZJitter}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              threeDZJitter: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Yaw"
                        min={-180}
                        max={180}
                        step={1}
                        value={activeProjectView.layout.threeDYaw}
                        defaultValue={DEFAULT_LAYOUT.threeDYaw}
                        formatter={(value) => `${Math.round(value)}°`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              threeDYaw: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Pitch"
                        min={-89}
                        max={89}
                        step={1}
                        value={activeProjectView.layout.threeDPitch}
                        defaultValue={DEFAULT_LAYOUT.threeDPitch}
                        formatter={(value) => `${Math.round(value)}°`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              threeDPitch: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Billboard"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.threeDBillboard}
                        defaultValue={DEFAULT_LAYOUT.threeDBillboard}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              threeDBillboard: value,
                            },
                          }))
                        }
                      />
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {isFractalFamily ? (
                  <InspectorGroup title="Fractal" className="xl:col-span-2">
                    <InspectorFieldGrid className="sm:grid-cols-2">
                      <ControlBlock
                        label="Fractal Variant"
                        className="sm:col-span-2"
                      >
                        <Select
                          value={activeProjectView.layout.fractalVariant}
                          onValueChange={(value) => {
                            if (!isOption(FRACTAL_VARIANT_OPTIONS, value))
                              return;
                            patchProject((project) => ({
                              ...project,
                              layout: {
                                ...project.layout,
                                fractalVariant: value,
                                fractalIterations: Math.min(
                                  project.layout.fractalIterations,
                                  getFractalIterationLimit(value),
                                ),
                                shapeMode: "rect",
                              },
                            }));
                          }}
                        >
                          <SelectTrigger aria-label="Fractal Variant">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FRACTAL_VARIANT_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {formatFractalVariantLabel(option)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ControlBlock>
                      <SliderField
                        label="Iterations"
                        min={0}
                        max={fractalIterationMax}
                        step={1}
                        value={Math.min(
                          activeProjectView.layout.fractalIterations,
                          fractalIterationMax,
                        )}
                        defaultValue={Math.min(
                          DEFAULT_LAYOUT.fractalIterations,
                          fractalIterationMax,
                        )}
                        formatter={(value) => `${Math.round(value)}`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              fractalIterations: Math.round(value),
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Spacing"
                        min={0}
                        max={0.45}
                        step={0.01}
                        value={activeProjectView.layout.fractalSpacing}
                        defaultValue={DEFAULT_LAYOUT.fractalSpacing}
                        formatter={formatPercentValue}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              fractalSpacing: value,
                            },
                          }))
                        }
                      />
                      {activeProjectView.layout.fractalVariant ===
                      "sierpinski-triangle" ? (
                        <>
                          <SliderField
                            label="Corner Pull"
                            min={0.5}
                            max={1.4}
                            step={0.01}
                            value={activeProjectView.layout.fractalTrianglePull}
                            defaultValue={DEFAULT_LAYOUT.fractalTrianglePull}
                            formatter={(value) => `${value.toFixed(2)}x`}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalTrianglePull: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Rotation"
                            min={-180}
                            max={180}
                            step={1}
                            value={
                              activeProjectView.layout.fractalTriangleRotation
                            }
                            defaultValue={DEFAULT_LAYOUT.fractalTriangleRotation}
                            formatter={formatDegreeValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalTriangleRotation: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                      {activeProjectView.layout.fractalVariant ===
                      "sierpinski-carpet" ? (
                        <>
                          <SliderField
                            label="Hole Scale"
                            min={0.18}
                            max={0.6}
                            step={0.01}
                            value={
                              activeProjectView.layout.fractalCarpetHoleScale
                            }
                            defaultValue={DEFAULT_LAYOUT.fractalCarpetHoleScale}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalCarpetHoleScale: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Offset"
                            min={-0.24}
                            max={0.24}
                            step={0.01}
                            value={activeProjectView.layout.fractalCarpetOffset}
                            defaultValue={DEFAULT_LAYOUT.fractalCarpetOffset}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalCarpetOffset: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                      {activeProjectView.layout.fractalVariant === "vicsek" ? (
                        <>
                          <SliderField
                            label="Arm Scale"
                            min={0.18}
                            max={0.48}
                            step={0.01}
                            value={
                              activeProjectView.layout.fractalVicsekArmScale
                            }
                            defaultValue={DEFAULT_LAYOUT.fractalVicsekArmScale}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalVicsekArmScale: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Center Scale"
                            min={0.18}
                            max={0.48}
                            step={0.01}
                            value={
                              activeProjectView.layout.fractalVicsekCenterScale
                            }
                            defaultValue={DEFAULT_LAYOUT.fractalVicsekCenterScale}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalVicsekCenterScale: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                      {activeProjectView.layout.fractalVariant === "h-tree" ? (
                        <>
                          <SliderField
                            label="Branch Ratio"
                            min={0.25}
                            max={0.8}
                            step={0.01}
                            value={activeProjectView.layout.fractalHTreeRatio}
                            defaultValue={DEFAULT_LAYOUT.fractalHTreeRatio}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalHTreeRatio: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Stroke Thickness"
                            min={0.04}
                            max={0.4}
                            step={0.01}
                            value={
                              activeProjectView.layout.fractalHTreeThickness
                            }
                            defaultValue={DEFAULT_LAYOUT.fractalHTreeThickness}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalHTreeThickness: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                      {activeProjectView.layout.fractalVariant === "rosette" ? (
                        <>
                          <SliderField
                            label="Petals"
                            min={3}
                            max={12}
                            step={1}
                            value={
                              activeProjectView.layout.fractalRosettePetals
                            }
                            defaultValue={DEFAULT_LAYOUT.fractalRosettePetals}
                            formatter={(value) => `${Math.round(value)}`}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalRosettePetals: Math.round(value),
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Twist"
                            min={-180}
                            max={180}
                            step={1}
                            value={activeProjectView.layout.fractalRosetteTwist}
                            defaultValue={DEFAULT_LAYOUT.fractalRosetteTwist}
                            formatter={formatDegreeValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalRosetteTwist: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            className="sm:col-span-2"
                            label="Inner Radius"
                            min={0}
                            max={0.88}
                            step={0.01}
                            value={
                              activeProjectView.layout.fractalRosetteInnerRadius
                            }
                            defaultValue={DEFAULT_LAYOUT.fractalRosetteInnerRadius}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalRosetteInnerRadius: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                      {activeProjectView.layout.fractalVariant ===
                      "binary-tree" ? (
                        <>
                          <SliderField
                            label="Branch Angle"
                            min={5}
                            max={85}
                            step={1}
                            value={activeProjectView.layout.fractalBinaryAngle}
                            defaultValue={DEFAULT_LAYOUT.fractalBinaryAngle}
                            formatter={formatDegreeValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalBinaryAngle: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Length Decay"
                            min={0.35}
                            max={0.92}
                            step={0.01}
                            value={activeProjectView.layout.fractalBinaryDecay}
                            defaultValue={DEFAULT_LAYOUT.fractalBinaryDecay}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalBinaryDecay: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            className="sm:col-span-2"
                            label="Branch Thickness"
                            min={0.04}
                            max={0.32}
                            step={0.01}
                            value={
                              activeProjectView.layout.fractalBinaryThickness
                            }
                            defaultValue={DEFAULT_LAYOUT.fractalBinaryThickness}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalBinaryThickness: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                      {activeProjectView.layout.fractalVariant ===
                      "pythagoras-tree" ? (
                        <>
                          <SliderField
                            label="Branch Angle"
                            min={5}
                            max={85}
                            step={1}
                            value={
                              activeProjectView.layout.fractalPythagorasAngle
                            }
                            defaultValue={DEFAULT_LAYOUT.fractalPythagorasAngle}
                            formatter={formatDegreeValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalPythagorasAngle: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Square Scale"
                            min={0.35}
                            max={0.92}
                            step={0.01}
                            value={
                              activeProjectView.layout.fractalPythagorasScale
                            }
                            defaultValue={DEFAULT_LAYOUT.fractalPythagorasScale}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalPythagorasScale: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            className="sm:col-span-2"
                            label="Lean"
                            min={-1}
                            max={1}
                            step={0.01}
                            value={
                              activeProjectView.layout.fractalPythagorasLean
                            }
                            defaultValue={DEFAULT_LAYOUT.fractalPythagorasLean}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  fractalPythagorasLean: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {isCurvesFamily ? (
                  <InspectorGroup title="Curves" className="xl:col-span-2">
                    <InspectorFieldGrid className="sm:grid-cols-2">
                      <ControlBlock
                        label="Curve Variant"
                        className="sm:col-span-2"
                      >
                        <Select
                          value={activeProjectView.layout.curveVariant}
                          onValueChange={(value) => {
                            if (!isOption(CURVE_VARIANT_OPTIONS, value)) return;
                            patchProject((project) => ({
                              ...project,
                              layout: {
                                ...project.layout,
                                curveVariant: value,
                                shapeMode: "rect",
                              },
                            }));
                          }}
                        >
                          <SelectTrigger aria-label="Curve Variant">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURVE_VARIANT_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {formatCurveVariantLabel(option)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ControlBlock>
                      <SliderField
                        label="Samples"
                        min={8}
                        max={1600}
                        step={1}
                        value={activeProjectView.layout.curveSamples}
                        defaultValue={DEFAULT_LAYOUT.curveSamples}
                        formatter={(value) => `${Math.round(value)}`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              curveSamples: Math.round(value),
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Cell Size"
                        min={0.003}
                        max={0.2}
                        step={0.001}
                        value={activeProjectView.layout.curveCellSize}
                        defaultValue={DEFAULT_LAYOUT.curveCellSize}
                        formatter={formatPercentValue}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              curveCellSize: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Scale X"
                        min={0.1}
                        max={1.4}
                        step={0.01}
                        value={activeProjectView.layout.curveScaleX}
                        defaultValue={DEFAULT_LAYOUT.curveScaleX}
                        formatter={formatPercentValue}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              curveScaleX: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Scale Y"
                        min={0.1}
                        max={1.4}
                        step={0.01}
                        value={activeProjectView.layout.curveScaleY}
                        defaultValue={DEFAULT_LAYOUT.curveScaleY}
                        formatter={formatPercentValue}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              curveScaleY: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Curve Rotation"
                        min={-180}
                        max={180}
                        step={1}
                        value={activeProjectView.layout.curveRotation}
                        defaultValue={DEFAULT_LAYOUT.curveRotation}
                        formatter={formatDegreeValue}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              curveRotation: value,
                            },
                          }))
                        }
                      />
                      <ControlBlock label="Align to Tangent">
                        <div className="flex items-center justify-between rounded-md bg-surface-muted px-3 py-2.5">
                          <span className="text-xs text-text-muted">
                            Rotate cells
                          </span>
                          <Switch
                            checked={activeProjectView.layout.curveAlignToTangent}
                            onCheckedChange={(checked) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveAlignToTangent: checked,
                                },
                              }))
                            }
                          />
                        </div>
                      </ControlBlock>
                      {activeProjectView.layout.curveVariant === "lissajous" ||
                      activeProjectView.layout.curveVariant === "harmonograph" ? (
                        <>
                          <SliderField
                            label="Frequency X"
                            min={0.25}
                            max={12}
                            step={0.25}
                            value={activeProjectView.layout.curveFrequencyX}
                            defaultValue={DEFAULT_LAYOUT.curveFrequencyX}
                            formatter={(value) => value.toFixed(2)}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveFrequencyX: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Frequency Y"
                            min={0.25}
                            max={12}
                            step={0.25}
                            value={activeProjectView.layout.curveFrequencyY}
                            defaultValue={DEFAULT_LAYOUT.curveFrequencyY}
                            formatter={(value) => value.toFixed(2)}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveFrequencyY: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Curve Phase"
                            min={-360}
                            max={360}
                            step={1}
                            value={activeProjectView.layout.curvePhase}
                            defaultValue={DEFAULT_LAYOUT.curvePhase}
                            formatter={formatDegreeValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curvePhase: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Loops"
                            min={0.25}
                            max={12}
                            step={0.25}
                            value={activeProjectView.layout.curveLoops}
                            defaultValue={DEFAULT_LAYOUT.curveLoops}
                            formatter={(value) => value.toFixed(2)}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveLoops: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                      {activeProjectView.layout.curveVariant === "harmonograph" ? (
                        <SliderField
                          className="sm:col-span-2"
                          label="Damping"
                          min={0}
                          max={0.4}
                          step={0.01}
                          value={activeProjectView.layout.curveDamping}
                          defaultValue={DEFAULT_LAYOUT.curveDamping}
                          formatter={formatPercentValue}
                          onChange={(value) =>
                            patchProject((project) => ({
                              ...project,
                              layout: {
                                ...project.layout,
                                curveDamping: value,
                              },
                            }))
                          }
                        />
                      ) : null}
                      {activeProjectView.layout.curveVariant === "epicycloid" ||
                      activeProjectView.layout.curveVariant === "hypotrochoid" ? (
                        <>
                          <SliderField
                            label="Loops"
                            min={0.25}
                            max={12}
                            step={0.25}
                            value={activeProjectView.layout.curveLoops}
                            defaultValue={DEFAULT_LAYOUT.curveLoops}
                            formatter={(value) => value.toFixed(2)}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveLoops: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Gear Ratio"
                            min={0.05}
                            max={0.95}
                            step={0.01}
                            value={activeProjectView.layout.curveGearRatio}
                            defaultValue={DEFAULT_LAYOUT.curveGearRatio}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveGearRatio: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            className="sm:col-span-2"
                            label="Pen Offset"
                            min={0.1}
                            max={2.5}
                            step={0.01}
                            value={activeProjectView.layout.curvePenOffset}
                            defaultValue={DEFAULT_LAYOUT.curvePenOffset}
                            formatter={(value) => `${value.toFixed(2)}x`}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curvePenOffset: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                      {activeProjectView.layout.curveVariant === "superformula" ? (
                        <>
                          <SliderField
                            label="Loops"
                            min={0.25}
                            max={12}
                            step={0.25}
                            value={activeProjectView.layout.curveLoops}
                            defaultValue={DEFAULT_LAYOUT.curveLoops}
                            formatter={(value) => value.toFixed(2)}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveLoops: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="M"
                            min={0}
                            max={16}
                            step={0.25}
                            value={activeProjectView.layout.curveSuperformulaM}
                            defaultValue={DEFAULT_LAYOUT.curveSuperformulaM}
                            formatter={(value) => value.toFixed(2)}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveSuperformulaM: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="N1"
                            min={0.1}
                            max={8}
                            step={0.01}
                            value={activeProjectView.layout.curveSuperformulaN1}
                            defaultValue={DEFAULT_LAYOUT.curveSuperformulaN1}
                            formatter={(value) => value.toFixed(2)}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveSuperformulaN1: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="N2"
                            min={0.1}
                            max={8}
                            step={0.01}
                            value={activeProjectView.layout.curveSuperformulaN2}
                            defaultValue={DEFAULT_LAYOUT.curveSuperformulaN2}
                            formatter={(value) => value.toFixed(2)}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveSuperformulaN2: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            className="sm:col-span-2"
                            label="N3"
                            min={0.1}
                            max={8}
                            step={0.01}
                            value={activeProjectView.layout.curveSuperformulaN3}
                            defaultValue={DEFAULT_LAYOUT.curveSuperformulaN3}
                            formatter={(value) => value.toFixed(2)}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveSuperformulaN3: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                      {activeProjectView.layout.curveVariant === "phyllotaxis" ? (
                        <>
                          <SliderField
                            label="Divergence"
                            min={0}
                            max={360}
                            step={0.1}
                            value={activeProjectView.layout.curvePhyllotaxisAngle}
                            defaultValue={DEFAULT_LAYOUT.curvePhyllotaxisAngle}
                            formatter={formatDegreeValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curvePhyllotaxisAngle: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Growth"
                            min={0.2}
                            max={1.8}
                            step={0.01}
                            value={activeProjectView.layout.curvePhyllotaxisGrowth}
                            defaultValue={DEFAULT_LAYOUT.curvePhyllotaxisGrowth}
                            formatter={(value) => `${value.toFixed(2)}x`}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curvePhyllotaxisGrowth: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                      {activeProjectView.layout.curveVariant ===
                      "strange-attractor" ? (
                        <>
                          <ControlBlock label="Attractor" className="sm:col-span-2">
                            <Select
                              value={activeProjectView.layout.curveAttractorType}
                              onValueChange={(value) => {
                                if (!isOption(CURVE_ATTRACTOR_TYPE_OPTIONS, value))
                                  return;
                                patchProject((project) => ({
                                  ...project,
                                  layout: {
                                    ...project.layout,
                                    curveAttractorType: value,
                                  },
                                }));
                              }}
                            >
                              <SelectTrigger aria-label="Attractor">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CURVE_ATTRACTOR_TYPE_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {formatCurveAttractorTypeLabel(option)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </ControlBlock>
                          <SliderField
                            label="Step"
                            min={0.001}
                            max={0.03}
                            step={0.001}
                            value={activeProjectView.layout.curveAttractorStep}
                            defaultValue={DEFAULT_LAYOUT.curveAttractorStep}
                            formatter={(value) => value.toFixed(3)}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveAttractorStep: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Attractor Scale"
                            min={0.1}
                            max={2}
                            step={0.01}
                            value={activeProjectView.layout.curveAttractorScale}
                            defaultValue={DEFAULT_LAYOUT.curveAttractorScale}
                            formatter={(value) => `${value.toFixed(2)}x`}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveAttractorScale: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Yaw"
                            min={-180}
                            max={180}
                            step={1}
                            value={activeProjectView.layout.curveAttractorYaw}
                            defaultValue={DEFAULT_LAYOUT.curveAttractorYaw}
                            formatter={formatDegreeValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveAttractorYaw: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Pitch"
                            min={-89}
                            max={89}
                            step={1}
                            value={activeProjectView.layout.curveAttractorPitch}
                            defaultValue={DEFAULT_LAYOUT.curveAttractorPitch}
                            formatter={formatDegreeValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveAttractorPitch: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            className="sm:col-span-2"
                            label="Camera Distance"
                            min={1.2}
                            max={8}
                            step={0.1}
                            value={
                              activeProjectView.layout.curveAttractorCameraDistance
                            }
                            defaultValue={
                              DEFAULT_LAYOUT.curveAttractorCameraDistance
                            }
                            formatter={(value) => value.toFixed(1)}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  curveAttractorCameraDistance: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {!isDrawFamily ? (
                  <InspectorGroup title="Symmetry">
                    <InspectorFieldGrid>
                      <ControlBlock label="Symmetry" className="sm:col-span-2">
                        <Select
                          value={activeProjectView.layout.symmetryMode}
                          onValueChange={(value) => {
                            if (!isOption(SYMMETRY_MODE_OPTIONS, value)) return;
                            patchProject((project) => ({
                              ...project,
                              layout: {
                                ...project.layout,
                                symmetryMode: value,
                                symmetryCopies:
                                  value === "radial" &&
                                  project.layout.family === "fractal"
                                    ? Math.min(
                                        project.layout.symmetryCopies,
                                        FRACTAL_RADIAL_SYMMETRY_COPY_LIMIT,
                                      )
                                    : project.layout.symmetryCopies,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SYMMETRY_MODE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </ControlBlock>
                      {isSymmetryActive ? (
                        <>
                          <SliderField
                            label="Symmetry Center X"
                            min={0}
                            max={1}
                            step={0.01}
                            value={activeProjectView.layout.symmetryCenterX}
                            defaultValue={DEFAULT_LAYOUT.symmetryCenterX}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  symmetryCenterX: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Symmetry Center Y"
                            min={0}
                            max={1}
                            step={0.01}
                            value={activeProjectView.layout.symmetryCenterY}
                            defaultValue={DEFAULT_LAYOUT.symmetryCenterY}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  symmetryCenterY: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            className="sm:col-span-2"
                            label="Clone Drift"
                            min={0}
                            max={1}
                            step={0.01}
                            value={activeProjectView.layout.symmetryJitter}
                            defaultValue={DEFAULT_LAYOUT.symmetryJitter}
                            formatter={formatPercentValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  symmetryJitter: value,
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                      {isRadialSymmetry ? (
                        <>
                          <SliderField
                            label="Symmetry Angle Offset"
                            min={-180}
                            max={180}
                            step={1}
                            value={activeProjectView.layout.symmetryAngleOffset}
                            defaultValue={DEFAULT_LAYOUT.symmetryAngleOffset}
                            formatter={formatDegreeValue}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  symmetryAngleOffset: value,
                                },
                              }))
                            }
                          />
                          <SliderField
                            label="Radial Copies"
                            min={2}
                            max={radialCopiesMax}
                            step={1}
                            value={Math.min(
                              activeProjectView.layout.symmetryCopies,
                              radialCopiesMax,
                            )}
                            defaultValue={Math.min(DEFAULT_LAYOUT.symmetryCopies, radialCopiesMax)}
                            formatter={(value) => `${Math.round(value)}`}
                            onChange={(value) =>
                              patchProject((project) => ({
                                ...project,
                                layout: {
                                  ...project.layout,
                                  symmetryCopies: Math.min(
                                    Math.round(value),
                                    radialCopiesMax,
                                  ),
                                },
                              }))
                            }
                          />
                        </>
                      ) : null}
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                {!isDrawFamily ? (
                  <InspectorGroup title="Visibility">
                    <InspectorFieldGrid>
                      <SliderField
                        label="Hide Percentage"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.hidePercentage}
                        defaultValue={DEFAULT_LAYOUT.hidePercentage}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              hidePercentage: value,
                            },
                          }))
                        }
                      />
                      <SliderField
                        label="Letterbox"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.letterbox}
                        defaultValue={DEFAULT_LAYOUT.letterbox}
                        formatter={(value) => `${Math.round(value * 100)}%`}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              letterbox: value,
                            },
                          }))
                        }
                      />
                    </InspectorFieldGrid>
                  </InspectorGroup>
                ) : null}

                <InspectorGroup title="Position">
                  <InspectorFieldGrid>
                    <SliderField
                      label="Offset X"
                      min={-1}
                      max={1}
                      step={0.01}
                      value={activeProjectView.layout.offsetX}
                      defaultValue={DEFAULT_LAYOUT.offsetX}
                      formatter={(value) => `${Math.round(value * 100)}%`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            offsetX: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Offset Y"
                      min={-1}
                      max={1}
                      step={0.01}
                      value={activeProjectView.layout.offsetY}
                      defaultValue={DEFAULT_LAYOUT.offsetY}
                      formatter={(value) => `${Math.round(value * 100)}%`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            offsetY: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      className="sm:col-span-2"
                      label="Rotation"
                      min={0}
                      max={360}
                      step={1}
                      value={activeProjectView.layout.contentRotation}
                      defaultValue={DEFAULT_LAYOUT.contentRotation}
                      formatter={formatDegreeValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            contentRotation: value,
                          },
                        }))
                      }
                    />
                  </InspectorFieldGrid>
                </InspectorGroup>

                <InspectorGroup title="Assignment">
                  <InspectorFieldGrid>
                    <ControlBlock
                      label="Source Assignment"
                      className="sm:col-span-2"
                    >
                      <Select
                        value={activeProjectView.sourceMapping.strategy}
                        onValueChange={(value) => {
                          if (!isOption(SOURCE_ASSIGNMENT_OPTIONS, value))
                            return;
                          patchProject((project) => ({
                            ...project,
                            sourceMapping: {
                              ...project.sourceMapping,
                              strategy: value,
                            },
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCE_ASSIGNMENT_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ControlBlock>
                    {isToneMapAssignment ? (
                      <ControlBlock
                        label="Tone Direction"
                        className="sm:col-span-2"
                      >
                        <Select
                          value={activeProjectView.sourceMapping.luminanceSort}
                          onValueChange={(value) => {
                            if (
                              value !== "ascending" &&
                              value !== "descending"
                            ) {
                              return;
                            }

                            patchProject((project) => ({
                              ...project,
                              sourceMapping: {
                                ...project.sourceMapping,
                                luminanceSort: value,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ascending">Dark to Light</SelectItem>
                            <SelectItem value="descending">Light to Dark</SelectItem>
                          </SelectContent>
                        </Select>
                      </ControlBlock>
                    ) : null}
                    {isContrastAssignment ? (
                      <SliderField
                        className="sm:col-span-2"
                        label="Contrast Strength"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.sourceMapping.paletteEmphasis}
                        defaultValue={DEFAULT_SOURCE_MAPPING.paletteEmphasis}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            sourceMapping: {
                              ...project.sourceMapping,
                              paletteEmphasis: value,
                            },
                          }))
                        }
                      />
                    ) : null}
                  </InspectorFieldGrid>
                </InspectorGroup>

                <InspectorGroup title="Crop">
                  <InspectorFieldGrid>
                    <ControlBlock label="Crop Distribution">
                      <Select
                        value={activeProjectView.sourceMapping.cropDistribution}
                        onValueChange={(value) => {
                          if (!isOption(CROP_DISTRIBUTION_OPTIONS, value))
                            return;
                          patchProject((project) => ({
                            ...project,
                            sourceMapping: {
                              ...project.sourceMapping,
                              cropDistribution: value,
                            },
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="center">Centered</SelectItem>
                          <SelectItem value="distributed">
                            Distributed
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </ControlBlock>
                    <SliderField
                      label="Crop Zoom"
                      min={1}
                      max={2.5}
                      step={0.01}
                      value={activeProjectView.sourceMapping.cropZoom}
                      defaultValue={DEFAULT_SOURCE_MAPPING.cropZoom}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          sourceMapping: {
                            ...project.sourceMapping,
                            cropZoom: value,
                          },
                        }))
                      }
                    />
                    <ControlBlock
                      label="Preserve Aspect"
                      className="sm:col-span-2"
                    >
                      <div className="flex items-center justify-between rounded-md bg-surface-muted px-3 py-2.5">
                        <span className="text-xs text-text-muted">
                          Center crop, no stretch
                        </span>
                        <Switch
                          checked={
                            activeProjectView.sourceMapping.preserveAspect
                          }
                          onCheckedChange={(checked) =>
                            patchProject((project) => ({
                              ...project,
                              sourceMapping: {
                                ...project.sourceMapping,
                                preserveAspect: checked,
                              },
                            }))
                          }
                        />
                      </div>
                    </ControlBlock>
                  </InspectorFieldGrid>
                </InspectorGroup>

                <InspectorGroup title="Blend">
                  <InspectorFieldGrid>
                    <ControlBlock label="Blend Mode" className="sm:col-span-2">
                      <Select
                        value={activeProjectView.compositing.blendMode}
                        onValueChange={(value) => {
                          if (!isOption(BLEND_MODE_OPTIONS, value)) return;
                          patchProject((project) => ({
                            ...project,
                            compositing: {
                              ...project.compositing,
                              blendMode: value,
                            },
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BLEND_MODE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ControlBlock>
                    <SliderField
                      label="Opacity"
                      min={0.2}
                      max={1}
                      step={0.01}
                      value={activeProjectView.compositing.opacity}
                      defaultValue={DEFAULT_COMPOSITING.opacity}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          compositing: {
                            ...project.compositing,
                            opacity: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Overlap"
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProjectView.compositing.overlap}
                      defaultValue={DEFAULT_COMPOSITING.overlap}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          compositing: {
                            ...project.compositing,
                            overlap: value,
                          },
                        }))
                      }
                    />
                  </InspectorFieldGrid>
                </InspectorGroup>

                <InspectorGroup title="Motion">
                  <InspectorFieldGrid>
                    <SliderField
                      label="Rotation Jitter"
                      min={0}
                      max={180}
                      step={1}
                      value={activeProjectView.effects.rotationJitter}
                      defaultValue={DEFAULT_EFFECTS.rotationJitter}
                      formatter={(value) => `${Math.round(value)}°`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: {
                            ...project.effects,
                            rotationJitter: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Scale Jitter"
                      min={0}
                      max={3}
                      step={0.01}
                      value={activeProjectView.effects.scaleJitter}
                      defaultValue={DEFAULT_EFFECTS.scaleJitter}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: {
                            ...project.effects,
                            scaleJitter: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Displacement"
                      min={0}
                      max={100}
                      step={1}
                      value={activeProjectView.effects.displacement}
                      defaultValue={DEFAULT_EFFECTS.displacement}
                      formatter={(value) => `${Math.round(value)} px`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: {
                            ...project.effects,
                            displacement: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Distortion"
                      min={0}
                      max={0.8}
                      step={0.01}
                      value={activeProjectView.effects.distortion}
                      defaultValue={DEFAULT_EFFECTS.distortion}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: {
                            ...project.effects,
                            distortion: value,
                          },
                        }))
                      }
                    />
                    <ControlBlock label="Algorithmic Variation">
                      <div className="grid gap-3 rounded-md border border-border-subtle bg-surface-sunken/50 p-3 sm:grid-cols-2">
                        <ControlBlock label="Target">
                          <Select
                            value={selectedModulationTarget}
                            onValueChange={(value) => {
                              if (!isElementModulationTarget(value)) return;
                              setSelectedModulationTarget(value);
                            }}
                          >
                            <SelectTrigger aria-label="Modulation Target">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ELEMENT_MODULATION_TARGET_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </ControlBlock>
                        <ControlBlock label="Enabled">
                          <div className="flex h-9 items-center justify-end rounded-md bg-surface-muted px-3">
                            <Switch
                              aria-label="Enable Modulation"
                              checked={selectedModulation.enabled}
                              onCheckedChange={(checked) =>
                                patchSelectedModulation({ enabled: checked })
                              }
                            />
                          </div>
                        </ControlBlock>
                        <ControlBlock label="Pattern" className="sm:col-span-2">
                          <Select
                            value={selectedModulation.pattern}
                            onValueChange={(value) => {
                              if (!isElementModulationPattern(value)) return;
                              patchSelectedModulation({ pattern: value });
                            }}
                          >
                            <SelectTrigger aria-label="Modulation Pattern">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ELEMENT_MODULATION_PATTERN_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </ControlBlock>
                        <SliderField
                          label="Amount"
                          min={0}
                          max={selectedModulationAmountConfig.max}
                          step={selectedModulationAmountConfig.step}
                          value={selectedModulation.amount}
                          defaultValue={
                            DEFAULT_EFFECTS.elementModulations[selectedModulationTarget]
                              .amount
                          }
                          formatter={selectedModulationAmountConfig.formatter}
                          onChange={(value) =>
                            patchSelectedModulation({ amount: value })
                          }
                        />
                        <SliderField
                          label="Frequency"
                          min={0}
                          max={16}
                          step={0.01}
                          value={selectedModulation.frequency}
                          defaultValue={
                            DEFAULT_EFFECTS.elementModulations[selectedModulationTarget]
                              .frequency
                          }
                          onChange={(value) =>
                            patchSelectedModulation({ frequency: value })
                          }
                        />
                        <SliderField
                          label="Phase"
                          min={-360}
                          max={360}
                          step={1}
                          value={selectedModulation.phase}
                          defaultValue={
                            DEFAULT_EFFECTS.elementModulations[selectedModulationTarget]
                              .phase
                          }
                          formatter={(value) => `${Math.round(value)}°`}
                          onChange={(value) =>
                            patchSelectedModulation({ phase: value })
                          }
                        />
                        <SliderField
                          label="Axis"
                          min={-180}
                          max={180}
                          step={1}
                          value={selectedModulation.axisAngle}
                          defaultValue={
                            DEFAULT_EFFECTS.elementModulations[selectedModulationTarget]
                              .axisAngle
                          }
                          formatter={(value) => `${Math.round(value)}°`}
                          onChange={(value) =>
                            patchSelectedModulation({ axisAngle: value })
                          }
                        />
                        <SliderField
                          label="Origin X"
                          min={0}
                          max={1}
                          step={0.01}
                          value={selectedModulation.originX}
                          defaultValue={
                            DEFAULT_EFFECTS.elementModulations[selectedModulationTarget]
                              .originX
                          }
                          formatter={(value) => `${Math.round(value * 100)}%`}
                          onChange={(value) =>
                            patchSelectedModulation({ originX: value })
                          }
                        />
                        <SliderField
                          label="Origin Y"
                          min={0}
                          max={1}
                          step={0.01}
                          value={selectedModulation.originY}
                          defaultValue={
                            DEFAULT_EFFECTS.elementModulations[selectedModulationTarget]
                              .originY
                          }
                          formatter={(value) => `${Math.round(value * 100)}%`}
                          onChange={(value) =>
                            patchSelectedModulation({ originY: value })
                          }
                        />
                      </div>
                    </ControlBlock>
                  </InspectorFieldGrid>
                </InspectorGroup>

                <InspectorGroup title="Kaleidoscope">
                  <InspectorFieldGrid>
                    <SliderField
                      className="sm:col-span-2"
                      label="Kaleidoscope"
                      min={1}
                      max={12}
                      step={1}
                      value={activeProjectView.effects.kaleidoscopeSegments}
                      defaultValue={DEFAULT_EFFECTS.kaleidoscopeSegments}
                      formatter={(value) => `${Math.round(value)} seg`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: {
                            ...project.effects,
                            kaleidoscopeSegments: Math.round(value),
                          },
                        }))
                      }
                    />
                    {isKaleidoscopeActive ? (
                      <>
                        <SliderField
                          label="Center X"
                          min={0}
                          max={1}
                          step={0.01}
                          value={activeProjectView.effects.kaleidoscopeCenterX}
                          defaultValue={DEFAULT_EFFECTS.kaleidoscopeCenterX}
                          formatter={(value) => `${Math.round(value * 100)}%`}
                          onChange={(value) =>
                            patchProject((project) => ({
                              ...project,
                              effects: {
                                ...project.effects,
                                kaleidoscopeCenterX: value,
                              },
                            }))
                          }
                        />
                        <SliderField
                          label="Center Y"
                          min={0}
                          max={1}
                          step={0.01}
                          value={activeProjectView.effects.kaleidoscopeCenterY}
                          defaultValue={DEFAULT_EFFECTS.kaleidoscopeCenterY}
                          formatter={(value) => `${Math.round(value * 100)}%`}
                          onChange={(value) =>
                            patchProject((project) => ({
                              ...project,
                              effects: {
                                ...project.effects,
                                kaleidoscopeCenterY: value,
                              },
                            }))
                          }
                        />
                        <SliderField
                          label="Angle Offset"
                          min={0}
                          max={360}
                          step={1}
                          value={
                            activeProjectView.effects.kaleidoscopeAngleOffset
                          }
                          defaultValue={DEFAULT_EFFECTS.kaleidoscopeAngleOffset}
                          formatter={(value) => `${Math.round(value)}°`}
                          onChange={(value) =>
                            patchProject((project) => ({
                              ...project,
                              effects: {
                                ...project.effects,
                                kaleidoscopeAngleOffset: value,
                              },
                            }))
                          }
                        />
                        <SliderField
                          label="Rotation Drift"
                          min={-180}
                          max={180}
                          step={1}
                          value={
                            activeProjectView.effects.kaleidoscopeRotationDrift
                          }
                          defaultValue={DEFAULT_EFFECTS.kaleidoscopeRotationDrift}
                          formatter={(value) => `${Math.round(value)}°`}
                          onChange={(value) =>
                            patchProject((project) => ({
                              ...project,
                              effects: {
                                ...project.effects,
                                kaleidoscopeRotationDrift: value,
                              },
                            }))
                          }
                        />
                        <SliderField
                          label="Scale Falloff"
                          min={0}
                          max={1}
                          step={0.01}
                          value={
                            activeProjectView.effects.kaleidoscopeScaleFalloff
                          }
                          defaultValue={DEFAULT_EFFECTS.kaleidoscopeScaleFalloff}
                          formatter={(value) => `${Math.round(value * 100)}%`}
                          onChange={(value) =>
                            patchProject((project) => ({
                              ...project,
                              effects: {
                                ...project.effects,
                                kaleidoscopeScaleFalloff: value,
                              },
                            }))
                          }
                        />
                        <SliderField
                          label="Kaleidoscope Opacity"
                          min={0}
                          max={1}
                          step={0.01}
                          value={activeProjectView.effects.kaleidoscopeOpacity}
                          defaultValue={DEFAULT_EFFECTS.kaleidoscopeOpacity}
                          formatter={(value) => `${Math.round(value * 100)}%`}
                          onChange={(value) =>
                            patchProject((project) => ({
                              ...project,
                              effects: {
                                ...project.effects,
                                kaleidoscopeOpacity: value,
                              },
                            }))
                          }
                        />
                        <ControlBlock
                          label="Mirror Mode"
                          className="sm:col-span-2"
                        >
                          <Select
                            value={
                              activeProjectView.effects.kaleidoscopeMirrorMode
                            }
                            onValueChange={(value) => {
                              if (
                                !isOption(
                                  KALEIDOSCOPE_MIRROR_MODE_OPTIONS,
                                  value,
                                )
                              )
                                return;
                              patchProject((project) => ({
                                ...project,
                                effects: {
                                  ...project.effects,
                                  kaleidoscopeMirrorMode: value,
                                },
                              }));
                            }}
                          >
                            <SelectTrigger aria-label="Mirror Mode">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {KALEIDOSCOPE_MIRROR_MODE_OPTIONS.map(
                                (option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </ControlBlock>
                      </>
                    ) : null}
                  </InspectorFieldGrid>
                </InspectorGroup>

                <InspectorGroup title="Layer Finish" className="xl:col-span-2">
                  <InspectorFieldGrid className="sm:grid-cols-2">
                    <SliderField
                      label="Blur"
                      min={0}
                      max={200}
                      step={0.1}
                      value={activeProjectView.effects.blur}
                      defaultValue={DEFAULT_EFFECTS.blur}
                      formatter={(value) => `${value.toFixed(1)} px`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: {
                            ...project.effects,
                            blur: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Sharpen"
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProjectView.effects.sharpen}
                      defaultValue={DEFAULT_EFFECTS.sharpen}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: {
                            ...project.effects,
                            sharpen: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Shadow X"
                      min={-200}
                      max={200}
                      step={1}
                      value={activeProjectView.finish.shadowOffsetX}
                      defaultValue={DEFAULT_FINISH.shadowOffsetX}
                      formatter={(value) => `${Math.round(value)} px`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            shadowOffsetX: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Shadow Y"
                      min={-200}
                      max={200}
                      step={1}
                      value={activeProjectView.finish.shadowOffsetY}
                      defaultValue={DEFAULT_FINISH.shadowOffsetY}
                      formatter={(value) => `${Math.round(value)} px`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            shadowOffsetY: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Shadow Blur"
                      min={0}
                      max={200}
                      step={1}
                      value={activeProjectView.finish.shadowBlur}
                      defaultValue={DEFAULT_FINISH.shadowBlur}
                      formatter={(value) => `${Math.round(value)} px`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            shadowBlur: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Shadow Opacity"
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProjectView.finish.shadowOpacity}
                      defaultValue={DEFAULT_FINISH.shadowOpacity}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            shadowOpacity: value,
                          },
                        }))
                      }
                    />
                    <SourceColorField
                      id="finish-shadow-color"
                      label="Shadow Color"
                      className="sm:col-span-2"
                      value={activeProjectView.finish.shadowColor}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            shadowColor: value,
                          },
                        }))
                      }
                    />
                    <ControlBlock
                      label="Layer 3D"
                      value={
                        <Switch
                          aria-label="Layer 3D"
                          checked={activeProjectView.finish.layer3DEnabled}
                          onCheckedChange={(checked) =>
                            patchProject((project) => ({
                              ...project,
                              finish: {
                                ...project.finish,
                                layer3DEnabled: checked,
                              },
                            }))
                          }
                        />
                      }
                      className="sm:col-span-2"
                    >
                      <div className="h-px bg-border-subtle" />
                    </ControlBlock>
                    <SliderField
                      label="3D Rotate X"
                      min={-89}
                      max={89}
                      step={1}
                      disabled={!activeProjectView.finish.layer3DEnabled}
                      value={activeProjectView.finish.layer3DRotateX}
                      defaultValue={DEFAULT_FINISH.layer3DRotateX}
                      formatter={formatDegreeValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            layer3DRotateX: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="3D Rotate Y"
                      min={-89}
                      max={89}
                      step={1}
                      disabled={!activeProjectView.finish.layer3DEnabled}
                      value={activeProjectView.finish.layer3DRotateY}
                      defaultValue={DEFAULT_FINISH.layer3DRotateY}
                      formatter={formatDegreeValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            layer3DRotateY: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="3D Rotate Z"
                      min={-180}
                      max={180}
                      step={1}
                      disabled={!activeProjectView.finish.layer3DEnabled}
                      value={activeProjectView.finish.layer3DRotateZ}
                      defaultValue={DEFAULT_FINISH.layer3DRotateZ}
                      formatter={formatDegreeValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            layer3DRotateZ: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="3D Scale"
                      min={0.05}
                      max={3}
                      step={0.01}
                      disabled={!activeProjectView.finish.layer3DEnabled}
                      value={activeProjectView.finish.layer3DScale}
                      defaultValue={DEFAULT_FINISH.layer3DScale}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            layer3DScale: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="3D Pan X"
                      min={-1}
                      max={1}
                      step={0.01}
                      disabled={!activeProjectView.finish.layer3DEnabled}
                      value={activeProjectView.finish.layer3DPanX}
                      defaultValue={DEFAULT_FINISH.layer3DPanX}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            layer3DPanX: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="3D Pan Y"
                      min={-1}
                      max={1}
                      step={0.01}
                      disabled={!activeProjectView.finish.layer3DEnabled}
                      value={activeProjectView.finish.layer3DPanY}
                      defaultValue={DEFAULT_FINISH.layer3DPanY}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            layer3DPanY: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="3D Pivot X"
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={!activeProjectView.finish.layer3DEnabled}
                      value={activeProjectView.finish.layer3DPivotX}
                      defaultValue={DEFAULT_FINISH.layer3DPivotX}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            layer3DPivotX: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="3D Pivot Y"
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={!activeProjectView.finish.layer3DEnabled}
                      value={activeProjectView.finish.layer3DPivotY}
                      defaultValue={DEFAULT_FINISH.layer3DPivotY}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            layer3DPivotY: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="3D Perspective"
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={!activeProjectView.finish.layer3DEnabled}
                      value={activeProjectView.finish.layer3DPerspective}
                      defaultValue={DEFAULT_FINISH.layer3DPerspective}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            layer3DPerspective: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="3D Camera Distance"
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={!activeProjectView.finish.layer3DEnabled}
                      value={activeProjectView.finish.layer3DCameraDistance}
                      defaultValue={DEFAULT_FINISH.layer3DCameraDistance}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            layer3DCameraDistance: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="3D Z Offset"
                      min={-1}
                      max={1}
                      step={0.01}
                      disabled={!activeProjectView.finish.layer3DEnabled}
                      value={activeProjectView.finish.layer3DDepth}
                      defaultValue={DEFAULT_FINISH.layer3DDepth}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            layer3DDepth: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Brightness"
                      min={0}
                      max={2}
                      step={0.01}
                      value={activeProjectView.finish.brightness}
                      defaultValue={DEFAULT_FINISH.brightness}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            brightness: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Contrast"
                      min={0}
                      max={2}
                      step={0.01}
                      value={activeProjectView.finish.contrast}
                      defaultValue={DEFAULT_FINISH.contrast}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            contrast: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Saturate"
                      min={0}
                      max={2}
                      step={0.01}
                      value={activeProjectView.finish.saturate}
                      defaultValue={DEFAULT_FINISH.saturate}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            saturate: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Hue Rotate"
                      min={-180}
                      max={180}
                      step={1}
                      value={activeProjectView.finish.hueRotate}
                      defaultValue={DEFAULT_FINISH.hueRotate}
                      formatter={formatDegreeValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            hueRotate: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Noise"
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProjectView.finish.noise}
                      defaultValue={DEFAULT_FINISH.noise}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            noise: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Monochromatic Noise"
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProjectView.finish.noiseMonochrome}
                      defaultValue={DEFAULT_FINISH.noiseMonochrome}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            noiseMonochrome: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      className="sm:col-span-2"
                      label="Invert"
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProjectView.finish.invert}
                      defaultValue={DEFAULT_FINISH.invert}
                      formatter={formatPercentValue}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          finish: {
                            ...project.finish,
                            invert: value,
                          },
                        }))
                      }
                    />
                  </InspectorFieldGrid>
                </InspectorGroup>
              </div>
            </section>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
