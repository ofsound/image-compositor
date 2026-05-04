import { closestCenter, DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ImagePlus, Plus } from "lucide-react";

import { EditableSliderValue } from "@/components/app/editable-slider-value";
import { PanelShell } from "@/components/app/panel-shell";
import { SortableLayerRow } from "@/components/app/sortable-layer-row";
import { SourceAssetCard } from "@/components/app/source-asset-card";
import { SourceThumbnail } from "@/components/app/source-thumbnail";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { getSourceContentSignature } from "@/lib/assets";
import {
  formatSourceWeightValue,
  normalizeSliderInputValue,
  parseMultiplierInputValue,
} from "@/lib/format-utils";
import type { ProjectEditorView } from "@/lib/project-editor-view";
import { DEFAULT_SOURCE_WEIGHT, getSourceWeight } from "@/lib/source-weights";
import type { ProjectDocument, SourceAsset, SourceKind } from "@/types/project";

interface LeftSidebarProps {
  previewExpanded: boolean;
  projectAssets: SourceAsset[];
  activeProject: ProjectDocument;
  activeProjectView: ProjectEditorView;
  displayLayers: ProjectDocument["layers"];
  selectedLayer: ProjectDocument["layers"][number] | null;
  layerThumbnailUrls: Record<string, string>;
  layerSensors: React.ComponentProps<typeof DndContext>["sensors"];
  handleLayerDragEnd: (event: DragEndEvent) => void;
  openAddSourceDialog: (mode: SourceKind) => void;
  openEditSourceDialog: (assetId: string) => void;
  handleRemoveSource: (assetId: string) => Promise<void>;
  updateSourceWeight: (assetId: string, weight: number) => void;
  toggleAssetEnabled: (assetId: string) => void;
  addLayer: () => void;
  selectLayer: (layerId: string) => void;
  toggleLayerVisibility: (layerId: string) => void;
  deleteLayer: (layerId: string) => void;
}

export function LeftSidebar({
  previewExpanded,
  projectAssets,
  activeProject,
  activeProjectView,
  displayLayers,
  selectedLayer,
  layerThumbnailUrls,
  layerSensors,
  handleLayerDragEnd,
  openAddSourceDialog,
  openEditSourceDialog,
  handleRemoveSource,
  updateSourceWeight,
  toggleAssetEnabled,
  addLayer,
  selectLayer,
  toggleLayerVisibility,
  deleteLayer,
}: LeftSidebarProps) {
  if (previewExpanded) return null;

  return (
    <>
      <PanelShell
        title="Sources"
        actions={
          <Button
            className="w-fit shrink-0"
            variant="outline"
            size="sm"
            onClick={() => openAddSourceDialog("image")}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Add Source
          </Button>
        }
        contentClassName="min-h-0 overflow-y-auto pr-1"
      >
        {projectAssets.length === 0 ? (
          <div className="rounded-md bg-surface-sunken p-4 text-xs leading-relaxed text-text-faint">
            Add image, solid, or gradient sources to begin. Imported
            images stay immutable, while generated sources can be edited
            later.
          </div>
        ) : (
          <div className="flex flex-col gap-3" data-testid="sources-rail">
            {projectAssets.map((asset) => {
              const enabled = activeProjectView.sourceIds.includes(asset.id);
              const mixWeight = getSourceWeight(
                activeProjectView.sourceMapping.sourceWeights,
                asset.id,
              );

              return (
                <SourceAssetCard
                  key={asset.id}
                  asset={asset}
                  enabled={enabled}
                  layout="rail"
                  topContent={
                    enabled ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                          <span>Mix</span>
                          <EditableSliderValue
                            value={formatSourceWeightValue(mixWeight)}
                            inputLabel={`${asset.name} mix weight`}
                            onCommit={(nextText) => {
                              const parsedValue = parseMultiplierInputValue(nextText);
                              if (parsedValue === null) {
                                return;
                              }

                              updateSourceWeight(
                                asset.id,
                                normalizeSliderInputValue({
                                  value: parsedValue,
                                  min: 0,
                                  max: 4,
                                  step: 0.05,
                                }),
                              );
                            }}
                          />
                        </div>
                        <Slider
                          aria-label={`${asset.name} mix weight`}
                          min={0}
                          max={4}
                          step={0.05}
                          value={[mixWeight]}
                          defaultValue={[DEFAULT_SOURCE_WEIGHT]}
                          onValueChange={(next) =>
                            updateSourceWeight(asset.id, next[0] ?? mixWeight)
                          }
                        />
                      </div>
                    ) : null
                  }
                  onToggle={toggleAssetEnabled}
                  onRemove={(assetId) => void handleRemoveSource(assetId)}
                  onEdit={
                    asset.kind === "image" ? undefined : openEditSourceDialog
                  }
                  thumbnail={
                    <SourceThumbnail
                      previewPath={asset.previewPath}
                      label={asset.name}
                      versionKey={getSourceContentSignature(asset)}
                      compact
                    />
                  }
                />
              );
            })}
          </div>
        )}
      </PanelShell>

      <PanelShell
        title="Layers"
        actions={
          <Button
            className="min-w-[9rem] shrink-0 justify-center"
            variant="outline"
            size="sm"
            onClick={() => void addLayer()}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Layer
          </Button>
        }
        contentClassName="min-h-0 overflow-y-auto pr-1"
      >
        <DndContext
          sensors={layerSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleLayerDragEnd}
        >
          <SortableContext
            items={displayLayers.map((layer) => layer.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {displayLayers.map((layer) => (
                <SortableLayerRow
                  key={layer.id}
                  layer={layer}
                  isSelected={layer.id === selectedLayer?.id}
                  thumbnailUrl={layerThumbnailUrls[layer.id] ?? null}
                  canDelete={activeProject.layers.length > 1}
                  onSelect={() => void selectLayer(layer.id)}
                  onToggleVisibility={() => void toggleLayerVisibility(layer.id)}
                  onDelete={() => void deleteLayer(layer.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </PanelShell>
    </>
  );
}
