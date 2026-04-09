import type { MouseEvent, ReactNode } from "react";
import { Eye, EyeOff, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getSourceKindLabel } from "@/lib/assets";
import { cn } from "@/lib/utils";
import type { SourceAsset } from "@/types/project";

interface SourceAssetCardProps {
  asset: SourceAsset;
  enabled: boolean;
  thumbnail: ReactNode;
  topContent?: ReactNode;
  onToggle: (assetId: string) => void;
  onEdit?: (assetId: string) => void;
  onRemove?: (assetId: string) => void;
}

export function SourceAssetCard({
  asset,
  enabled,
  thumbnail,
  topContent,
  onToggle,
  onEdit,
  onRemove,
}: SourceAssetCardProps) {
  const Icon = enabled ? Eye : EyeOff;

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggle(asset.id);
  };

  const handleEdit = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onEdit?.(asset.id);
  };

  const handleRemove = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onRemove?.(asset.id);
  };

  return (
    <div
      className={cn(
        "w-[140px] flex-shrink-0 rounded-md border p-2 transition-opacity",
        enabled
          ? "border-border-subtle bg-surface-sunken"
          : "border-border bg-surface-muted/70 opacity-70",
      )}
      data-state={enabled ? "enabled" : "disabled"}
    >
      {topContent ? <div className="mb-3">{topContent}</div> : null}
      <div className="relative">
        <div className={cn(!enabled && "opacity-55")}>{thumbnail}</div>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute left-1 top-1 h-7 w-auto min-w-[1.75rem] rounded-md border-0 bg-surface-raised/35 px-1.5 py-0 text-text-muted shadow-none backdrop-blur-sm hover:bg-surface-raised/55 hover:text-text"
            aria-label={`Remove ${asset.name}`}
            onClick={handleRemove}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1 h-7 w-auto min-w-[1.75rem] rounded-md border-0 bg-surface-raised/35 px-1.5 py-0 text-text-muted shadow-none backdrop-blur-sm hover:bg-surface-raised/55 hover:text-text"
          aria-label={`${enabled ? "Disable" : "Enable"} ${asset.name}`}
          onClick={handleToggle}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute bottom-1 right-1 h-7 w-auto min-w-[1.75rem] rounded-md border-0 bg-surface-raised/35 px-1.5 py-0 text-text-muted shadow-none backdrop-blur-sm hover:bg-surface-raised/55 hover:text-text"
            aria-label={`Edit ${asset.name}`}
            onClick={handleEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-faint">
            {getSourceKindLabel(asset.kind)}
          </div>
          <div
            className={cn(
              "truncate text-xs font-medium",
              enabled ? "text-text" : "text-text-muted",
            )}
          >
            {asset.name}
          </div>
          <div className="font-mono text-[10px] text-text-faint">
            {asset.width} × {asset.height}
          </div>
        </div>
        <div
          className="h-5 w-5 flex-shrink-0 rounded-full border border-border"
          style={{ background: asset.averageColor }}
        />
      </div>
    </div>
  );
}
