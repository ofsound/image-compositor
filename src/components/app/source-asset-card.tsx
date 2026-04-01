import type { MouseEvent, ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SourceAsset } from "@/types/project";

interface SourceAssetCardProps {
  asset: SourceAsset;
  enabled: boolean;
  thumbnail: ReactNode;
  onToggle: (assetId: string) => void;
}

export function SourceAssetCard({
  asset,
  enabled,
  thumbnail,
  onToggle,
}: SourceAssetCardProps) {
  const Icon = enabled ? Eye : EyeOff;

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggle(asset.id);
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
      <div className="relative">
        <div className={cn(!enabled && "opacity-55")}>{thumbnail}</div>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute right-1 top-1 h-7 w-7 rounded-full border border-border bg-surface-raised/90 p-0 text-text-muted shadow-sm backdrop-blur-sm hover:text-text"
          aria-label={`${enabled ? "Disable" : "Enable"} ${asset.name}`}
          onClick={handleToggle}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
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
