import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { makeId } from "@/lib/id";
import { getSourceContentSignature } from "@/lib/assets";
import { renderProjectPreview } from "@/lib/render-service";
import type {
  DrawStroke,
  ProjectDocument,
  RenderedPreviewSnapshot,
  SourceAsset,
} from "@/types/project";

const MIN_DRAW_POINT_DISTANCE = 2;

export interface PreviewRenderState {
  ready: boolean;
  lastRenderedPreview: RenderedPreviewSnapshot | null;
}

interface PreviewStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  project: ProjectDocument;
  assets: SourceAsset[];
  onRenderState?: (state: PreviewRenderState) => void;
  drawEnabled?: boolean;
  drawBrushSize?: number;
  onAppendDrawStroke?: (stroke: DrawStroke) => Promise<void>;
}

function getProjectPoint(
  event: Pick<PointerEvent, "clientX" | "clientY">,
  canvas: HTMLElement,
  project: Pick<ProjectDocument, "canvas">,
) {
  const bounds = canvas.getBoundingClientRect();
  const scaleX = project.canvas.width / Math.max(bounds.width, 1);
  const scaleY = project.canvas.height / Math.max(bounds.height, 1);

  return {
    x: (event.clientX - bounds.left) * scaleX,
    y: (event.clientY - bounds.top) * scaleY,
  };
}

function appendStrokePoint(
  points: DrawStroke["points"],
  point: DrawStroke["points"][number],
  options?: { force?: boolean },
) {
  const lastPoint = points.at(-1);
  if (!lastPoint) {
    return [point];
  }

  if (options?.force) {
    return lastPoint.x === point.x && lastPoint.y === point.y
      ? points
      : [...points, point];
  }

  return Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >=
    MIN_DRAW_POINT_DISTANCE
    ? [...points, point]
    : points;
}

export function PreviewStage({
  canvasRef,
  project,
  assets,
  onRenderState,
  drawEnabled = false,
  drawBrushSize = 160,
  onAppendDrawStroke,
}: PreviewStageProps) {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const pointerStrokeRef = useRef<DrawStroke | null>(null);
  const [draftStroke, setDraftStroke] = useState<DrawStroke | null>(null);
  const [overlayFrame, setOverlayFrame] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const assetSignature = assets.map(getSourceContentSignature).join("|");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!canvasRef.current) return;

      onRenderState?.({ ready: false, lastRenderedPreview: null });

      if (cancelled || !canvasRef.current) return;

      await renderProjectPreview(project, assets, canvasRef.current);

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

  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;

    overlay.width = project.canvas.width;
    overlay.height = project.canvas.height;

    const context = overlay.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, overlay.width, overlay.height);
    if (!drawEnabled || !draftStroke || draftStroke.points.length === 0) {
      return;
    }

    context.strokeStyle = "rgba(24, 15, 8, 0.35)";
    context.fillStyle = "rgba(24, 15, 8, 0.18)";
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = drawBrushSize;

    if (draftStroke.points.length === 1) {
      const point = draftStroke.points[0]!;
      context.beginPath();
      context.arc(point.x, point.y, drawBrushSize / 2, 0, Math.PI * 2);
      context.fill();
      return;
    }

    context.beginPath();
    context.moveTo(draftStroke.points[0]!.x, draftStroke.points[0]!.y);
    for (let index = 1; index < draftStroke.points.length; index += 1) {
      const point = draftStroke.points[index]!;
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  }, [draftStroke, drawBrushSize, drawEnabled, project.canvas.height, project.canvas.width]);

  useEffect(() => {
    if (drawEnabled) return;
    pointerStrokeRef.current = null;
    setDraftStroke(null);
  }, [drawEnabled]);

  useLayoutEffect(() => {
    const previewCanvas = canvasRef.current;
    if (!previewCanvas) return;

    const updateOverlayFrame = () => {
      setOverlayFrame({
        left: previewCanvas.offsetLeft,
        top: previewCanvas.offsetTop,
        width: previewCanvas.clientWidth,
        height: previewCanvas.clientHeight,
      });
    };

    updateOverlayFrame();

    const resizeObserver = new ResizeObserver(() => {
      updateOverlayFrame();
    });
    resizeObserver.observe(previewCanvas);

    window.addEventListener("resize", updateOverlayFrame);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateOverlayFrame);
    };
  }, [canvasRef, project.canvas.height, project.canvas.width]);

  const finalizeStroke = async (
    event: React.PointerEvent<HTMLCanvasElement>,
  ) => {
    const overlay = overlayCanvasRef.current;
    const previewCanvas = canvasRef.current;
    const activeStroke = pointerStrokeRef.current;
    if (!overlay || !previewCanvas || !activeStroke || !drawEnabled || !onAppendDrawStroke) {
      pointerStrokeRef.current = null;
      setDraftStroke(null);
      return;
    }

    const finalStroke: DrawStroke = {
      ...activeStroke,
      points: appendStrokePoint(
        activeStroke.points,
        getProjectPoint(event.nativeEvent, previewCanvas, project),
        { force: true },
      ),
    };

    pointerStrokeRef.current = null;
    setDraftStroke(null);

    if (finalStroke.points.length > 0) {
      await onAppendDrawStroke(finalStroke);
    }
  };

  return (
    <div className="relative flex h-full min-h-0 items-center justify-center overflow-hidden rounded-lg bg-preview-bg p-3">
      <div className="relative inline-block max-h-full max-w-full">
        <canvas
          ref={canvasRef}
          className="block h-auto max-h-full w-full max-w-full rounded-md bg-preview-canvas object-contain"
          style={{ aspectRatio: `${project.canvas.width} / ${project.canvas.height}` }}
        />
        <canvas
          ref={overlayCanvasRef}
          width={project.canvas.width}
          height={project.canvas.height}
          className="absolute rounded-md"
          style={{
            left: overlayFrame.left,
            top: overlayFrame.top,
            width: overlayFrame.width,
            height: overlayFrame.height,
            cursor: drawEnabled ? "crosshair" : "default",
            pointerEvents: drawEnabled ? "auto" : "none",
            touchAction: "none",
          }}
          onPointerDown={(event) => {
            if (
              !drawEnabled ||
              !onAppendDrawStroke ||
              event.button !== 0 ||
              event.pointerType === "touch" ||
              event.pointerType === "pen"
            ) {
              return;
            }

            const overlay = overlayCanvasRef.current;
            const previewCanvas = canvasRef.current;
            if (!overlay || !previewCanvas) return;

            const point = getProjectPoint(event.nativeEvent, previewCanvas, project);
            const stroke: DrawStroke = {
              id: makeId("stroke"),
              points: [point],
            };

            pointerStrokeRef.current = stroke;
            setDraftStroke(stroke);
            event.currentTarget.setPointerCapture?.(event.pointerId);
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            const activeStroke = pointerStrokeRef.current;
            const overlay = overlayCanvasRef.current;
            const previewCanvas = canvasRef.current;
            if (!drawEnabled || !activeStroke || !overlay || !previewCanvas) return;

            const nextPoints = appendStrokePoint(
              activeStroke.points,
              getProjectPoint(event.nativeEvent, previewCanvas, project),
            );

            if (nextPoints === activeStroke.points) {
              return;
            }

            const nextStroke = { ...activeStroke, points: nextPoints };
            pointerStrokeRef.current = nextStroke;
            setDraftStroke(nextStroke);
          }}
          onPointerUp={(event) => {
            void finalizeStroke(event);
          }}
          onPointerCancel={(event) => {
            void finalizeStroke(event);
          }}
        />
      </div>
    </div>
  );
}
