import { useEffect } from "react";

import { getSourceContentSignature } from "@/lib/assets";
import { buildBitmapMap, renderProjectToCanvas } from "@/lib/render";
import { readBlob } from "@/lib/opfs";
import type {
  ProjectDocument,
  RenderedPreviewSnapshot,
  SourceAsset,
} from "@/types/project";

export interface PreviewRenderState {
  ready: boolean;
  lastRenderedPreview: RenderedPreviewSnapshot | null;
}

interface PreviewStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  project: ProjectDocument;
  assets: SourceAsset[];
  onRenderState?: (state: PreviewRenderState) => void;
}

export function PreviewStage({
  canvasRef,
  project,
  assets,
  onRenderState,
}: PreviewStageProps) {
  const assetSignature = assets.map(getSourceContentSignature).join("|");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!canvasRef.current) return;

      onRenderState?.({ ready: false, lastRenderedPreview: null });

      const bitmapMap = await buildBitmapMap(assets, (asset) =>
        readBlob(asset.normalizedPath),
      );

      if (cancelled || !canvasRef.current) return;

      await renderProjectToCanvas(project, assets, bitmapMap, canvasRef.current);

      if (cancelled) return;
      onRenderState?.({
        ready: true,
        lastRenderedPreview: {
          project: structuredClone(project),
          assetIds: assets.map((asset) => asset.id),
        },
      });
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [assetSignature, canvasRef, onRenderState, project]);

  return (
    <div className="relative overflow-hidden rounded-lg bg-preview-bg">
      <canvas
        ref={canvasRef}
        className="aspect-[3/2] w-full rounded-md bg-preview-canvas object-contain"
      />
    </div>
  );
}
