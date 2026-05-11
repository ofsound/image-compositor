import { useEffect, useRef, useState, type PointerEvent } from "react";
import { RotateCcw } from "lucide-react";

import { useObjectUrl } from "@/components/app/source-thumbnail";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { getSourceContentSignature } from "@/lib/assets";
import { clamp } from "@/lib/utils";
import type { ImageSourceAsset, NormalizedRect } from "@/types/project";

const MIN_CROP_SIZE = 0.05;

interface DragSession {
  pointerId: number;
  startX: number;
  startY: number;
  crop: NormalizedRect;
}

interface SourceCropDialogProps {
  asset: ImageSourceAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (assetId: string, crop: NormalizedRect) => Promise<void>;
}

export function getDefaultImageSourceCrop(): NormalizedRect {
  return { x: 0, y: 0, width: 1, height: 1 };
}

function constrainCrop(crop: NormalizedRect): NormalizedRect {
  const width = clamp(crop.width, MIN_CROP_SIZE, 1);
  const height = clamp(crop.height, MIN_CROP_SIZE, 1);

  return {
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
  };
}

function resizeCrop(
  crop: NormalizedRect,
  width: number,
  height: number,
): NormalizedRect {
  const nextWidth = clamp(width, MIN_CROP_SIZE, 1);
  const nextHeight = clamp(height, MIN_CROP_SIZE, 1);
  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;

  return constrainCrop({
    x: centerX - nextWidth / 2,
    y: centerY - nextHeight / 2,
    width: nextWidth,
    height: nextHeight,
  });
}

function getCropZoom(crop: NormalizedRect) {
  return 1 / Math.max(crop.width, crop.height);
}

export function SourceCropDialog({
  asset,
  open,
  onOpenChange,
  onApply,
}: SourceCropDialogProps) {
  const [draftCrop, setDraftCrop] = useState<NormalizedRect>(
    getDefaultImageSourceCrop(),
  );
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const previewUrl = useObjectUrl(
    open && asset ? asset.normalizedPath : null,
    asset ? getSourceContentSignature(asset) : undefined,
  );

  useEffect(() => {
    if (open) {
      setDraftCrop(constrainCrop(asset?.crop ?? getDefaultImageSourceCrop()));
    }
  }, [asset, open]);

  if (!asset) return null;

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragSessionRef.current = null;
  };

  const cropZoom = getCropZoom(draftCrop);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(92vw,44rem)]">
        <DialogHeader>
          <DialogTitle>Custom crop</DialogTitle>
        </DialogHeader>

        <div
          ref={stageRef}
          data-testid="source-crop-stage"
          className="relative max-h-[58vh] w-full overflow-hidden rounded-md bg-surface-sunken"
          style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
          onPointerMove={(event) => {
            const session = dragSessionRef.current;
            const stage = stageRef.current;
            if (!session || !stage || session.pointerId !== event.pointerId) {
              return;
            }

            const bounds = stage.getBoundingClientRect();
            const deltaX = (event.clientX - session.startX) / bounds.width;
            const deltaY = (event.clientY - session.startY) / bounds.height;
            setDraftCrop(
              constrainCrop({
                ...session.crop,
                x: session.crop.x + deltaX,
                y: session.crop.y + deltaY,
              }),
            );
          }}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={asset.name}
              className="h-full w-full select-none object-fill"
              draggable={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.1em] text-text-faint">
              Loading
            </div>
          )}
          <div className="absolute inset-0 bg-black/40" />
          <div
            data-testid="source-crop-frame"
            className="absolute cursor-move border border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]"
            style={{
              left: `${draftCrop.x * 100}%`,
              top: `${draftCrop.y * 100}%`,
              width: `${draftCrop.width * 100}%`,
              height: `${draftCrop.height * 100}%`,
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture?.(event.pointerId);
              dragSessionRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                crop: draftCrop,
              };
            }}
          >
            <div className="absolute inset-0 border border-black/40" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 text-xs text-text-muted">
            Zoom
            <Slider
              aria-label={`${asset.name} crop zoom`}
              min={1}
              max={8}
              step={0.01}
              value={[cropZoom]}
              onValueChange={(next) => {
                const zoom = next[0] ?? cropZoom;
                const scale = cropZoom / zoom;
                setDraftCrop(
                  resizeCrop(
                    draftCrop,
                    draftCrop.width * scale,
                    draftCrop.height * scale,
                  ),
                );
              }}
            />
          </label>
          <label className="space-y-1.5 text-xs text-text-muted">
            Width
            <Slider
              aria-label={`${asset.name} crop width`}
              min={MIN_CROP_SIZE}
              max={1}
              step={0.001}
              value={[draftCrop.width]}
              onValueChange={(next) =>
                setDraftCrop(
                  resizeCrop(draftCrop, next[0] ?? draftCrop.width, draftCrop.height),
                )
              }
            />
          </label>
          <label className="space-y-1.5 text-xs text-text-muted">
            Height
            <Slider
              aria-label={`${asset.name} crop height`}
              min={MIN_CROP_SIZE}
              max={1}
              step={0.001}
              value={[draftCrop.height]}
              onValueChange={(next) =>
                setDraftCrop(
                  resizeCrop(draftCrop, draftCrop.width, next[0] ?? draftCrop.height),
                )
              }
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDraftCrop(getDefaultImageSourceCrop())}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                void onApply(asset.id, constrainCrop(draftCrop)).then(() =>
                  onOpenChange(false),
                );
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
