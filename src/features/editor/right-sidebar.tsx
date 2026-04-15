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
import type { GeometryShape } from "@/types/project";

import { coerceShapeModeForFamily } from "@/lib/layout-utils";
import {
  DENSITY_UI_SCALE,
  formatFractalVariantLabel,
  ORGANIC_DISTRIBUTION_MAX,
  THREE_D_DISTRIBUTION_MAX,
  formatPercentValue,
  formatDegreeValue,
} from "@/lib/format-utils";
import type { ProjectEditorView } from "@/lib/project-editor-view";
import {
  FRACTAL_RADIAL_SYMMETRY_COPY_LIMIT,
  getFractalIterationLimit,
} from "@/lib/layout-utils";
import { Switch } from "@/components/ui/switch";
import {
  BLEND_MODE_OPTIONS,
  CROP_DISTRIBUTION_OPTIONS,
  FRACTAL_VARIANT_OPTIONS,
  isOption,
  isOptionValue,
  KALEIDOSCOPE_MIRROR_MODE_OPTIONS,
  LAYOUT_FAMILY_OPTIONS,
  RADIAL_CHILD_ROTATION_OPTIONS,
  SOURCE_ASSIGNMENT_OPTIONS,
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

export function RightSidebar({
  previewExpanded,
  activeProjectView,
  patchProject,
  clearDrawLayer,
  hasDrawStrokes,
  inspectorLayerName,
  isDrawFamily,
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
  if (previewExpanded) return null;

  const fractalIterationMax = getFractalIterationLimit(
    activeProjectView.layout.fractalVariant,
  );
  const radialCopiesMax =
    isFractalFamily && isRadialSymmetry
      ? FRACTAL_RADIAL_SYMMETRY_COPY_LIMIT
      : 12;

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
                    {!isWordsFamily && isRectShapeMode ? (
                      <SliderField
                        className="sm:col-span-2"
                        label="Corner Radius"
                        min={0}
                        max={1}
                        step={0.01}
                        value={activeProjectView.layout.rectCornerRadius}
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
                    {!isWordsFamily && isWedgeShapeMode ? (
                      <>
                        <SliderField
                          label="Wedge Angle"
                          min={0}
                          max={360}
                          step={1}
                          value={activeProjectView.layout.wedgeAngle}
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
                    {!isWordsFamily && isHollowShapeMode ? (
                      <SliderField
                        className="sm:col-span-2"
                        label="Hollow Ratio"
                        min={0}
                        max={0.95}
                        step={0.01}
                        value={activeProjectView.layout.hollowRatio}
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

                {isWordsFamily ? (
                  <InspectorGroup title="Words">
                    <InspectorFieldGrid className="sm:grid-cols-2">
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

                {isBlocksFamily ? (
                  <InspectorGroup title="Blocks">
                    <InspectorFieldGrid className="sm:grid-cols-2">
                      <SliderField
                        label="Block Depth"
                        min={0}
                        max={7}
                        step={1}
                        value={activeProjectView.layout.blockDepth}
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
                      label="Blur"
                      min={0}
                      max={18}
                      step={0.1}
                      value={activeProjectView.effects.blur}
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
                      label="Rotation Jitter"
                      min={0}
                      max={180}
                      step={1}
                      value={activeProjectView.effects.rotationJitter}
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
                      max={0.8}
                      step={0.01}
                      value={activeProjectView.effects.scaleJitter}
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
                      label="Shadow X"
                      min={-200}
                      max={200}
                      step={1}
                      value={activeProjectView.finish.shadowOffsetX}
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
                    <SliderField
                      label="Brightness"
                      min={0}
                      max={2}
                      step={0.01}
                      value={activeProjectView.finish.brightness}
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
