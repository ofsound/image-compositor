import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Eye, EyeOff, GripVertical, Layers, Trash2 } from "lucide-react";

import { LayerRowThumbnail } from "@/components/app/layer-row-thumbnail";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectDocument } from "@/types/project";

export function SortableLayerRow({
  layer,
  isSelected,
  thumbnailUrl,
  canDelete,
  onSelect,
  onToggleVisibility,
  onDuplicate,
  onDelete,
}: {
  layer: ProjectDocument["layers"][number];
  isSelected: boolean;
  thumbnailUrl: string | null;
  canDelete: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const sourceCountLabel = `${layer.sourceIds.length} source${
    layer.sourceIds.length === 1 ? "" : "s"
  }`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border p-3 ${
        isSelected
          ? "border-border-strong bg-surface-sunken"
          : "border-border bg-surface-muted/50"
      } ${isDragging ? "z-10 shadow-lg ring-1 ring-border-strong" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block w-full text-left"
            onClick={onSelect}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-text">
              <Layers className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <span className="truncate">{layer.name}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.08em] text-text-muted">
              {isSelected ? (
                <span className="rounded-full border border-border-subtle bg-surface px-2 py-1 text-text">
                  Editing
                </span>
              ) : null}
              <span className="rounded-full border border-border-subtle px-2 py-1">
                {layer.visible ? "Visible" : "Hidden"}
              </span>
              <span>{sourceCountLabel}</span>
            </div>
          </button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="touch-none h-8 w-8 shrink-0 px-0 text-text-faint hover:text-text active:cursor-grabbing"
          aria-label={`Reorder ${layer.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 cursor-grab" />
        </Button>
      </div>
      <button
        type="button"
        className="mt-3 block w-full text-left"
        onClick={onSelect}
      >
        <LayerRowThumbnail
          layerId={layer.id}
          layerName={layer.name}
          thumbnailUrl={thumbnailUrl}
        />
      </button>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-all",
            layer.visible
              ? "border-control-secondary-border bg-control-secondary text-control-secondary-text hover:bg-control-secondary-hover"
              : "border-border bg-transparent text-text-secondary hover:border-border-strong hover:bg-control-ghost-hover hover:text-text",
          )}
          onClick={onToggleVisibility}
          aria-label={
            layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`
          }
        >
          {layer.visible ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {layer.visible ? "Hide" : "Show"}
        </button>
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-center gap-1.5 px-2"
          onClick={onDuplicate}
          aria-label={`Duplicate ${layer.name}`}
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicate
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-center gap-1.5 px-2"
          onClick={onDelete}
          disabled={!canDelete}
          aria-label={`Delete ${layer.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}
