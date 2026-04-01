import { useDeferredValue, useEffect } from "react";

import { buildBitmapMap, renderProjectToCanvas } from "@/lib/render";
import { readBlob } from "@/lib/opfs";
import type { ProjectDocument, SourceAsset } from "@/types/project";

interface PreviewStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  project: ProjectDocument;
  assets: SourceAsset[];
  onRenderState?: (state: { ready: boolean; count: number }) => void;
}

export function PreviewStage({
  canvasRef,
  project,
  assets,
  onRenderState,
}: PreviewStageProps) {
  const deferredProject = useDeferredValue(project);
  const assetSignature = assets.map((asset) => asset.id).join("|");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!canvasRef.current) return;

      onRenderState?.({ ready: false, count: assets.length });

      const bitmapMap = await buildBitmapMap(assets, (asset) =>
        readBlob(asset.normalizedPath),
      );

      if (cancelled || !canvasRef.current) return;

      await renderProjectToCanvas(
        deferredProject,
        assets,
        bitmapMap,
        canvasRef.current,
      );

      if (cancelled) return;
      onRenderState?.({ ready: true, count: assets.length });
    }

    void render();

    return () => {
      cancelled = true;
    };
  }, [assetSignature, canvasRef, deferredProject, onRenderState]);

  return (
    <div className="relative overflow-hidden rounded-lg bg-preview-bg">
      <canvas
        ref={canvasRef}
        className="aspect-[3/2] w-full rounded-md bg-preview-canvas object-contain"
      />
    </div>
  );
}
