import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  getContainedCanvasSize,
  PreviewStage,
} from "@/components/app/preview-stage";
import { createProjectDocument } from "@/lib/project-defaults";
import { buildBitmapMap } from "@/lib/render";
import type { SourceAsset } from "@/types/project";

vi.mock("@/lib/render", () => ({
  buildBitmapMap: vi.fn(async () => new Map()),
  renderProjectToCanvas: vi.fn(async () => undefined),
}));

vi.mock("@/lib/opfs", () => ({
  readBlob: vi.fn(async () => new Blob(["asset"])),
}));

const asset: SourceAsset = {
  id: "asset_a",
  kind: "image",
  fitMode: "stretch",
  projectId: "project_test",
  name: "Asset A",
  originalFileName: "asset-a.jpg",
  mimeType: "image/jpeg",
  width: 1200,
  height: 800,
  orientation: 1,
  originalPath: "a.jpg",
  normalizedPath: "a.png",
  previewPath: "a.webp",
  averageColor: "#112233",
  palette: ["#112233"],
  luminance: 0.25,
  createdAt: "2026-04-01T00:00:00.000Z",
};

describe("PreviewStage", () => {
  it("fits the displayed canvas inside the available stage without clipping", () => {
    expect(getContainedCanvasSize(1200, 700, 3000, 3000)).toEqual({
      width: 700,
      height: 700,
    });
    expect(getContainedCanvasSize(1200, 500, 3000, 1500)).toEqual({
      width: 1000,
      height: 500,
    });
    expect(getContainedCanvasSize(500, 1200, 1500, 3000)).toEqual({
      width: 500,
      height: 1000,
    });
  });

  it("reports the exact rendered preview snapshot after painting", async () => {
    const project = createProjectDocument("Preview Snapshot");
    const canvasRef = { current: document.createElement("canvas") };
    const onRenderState = vi.fn();

    render(
      <PreviewStage
        canvasRef={canvasRef}
        project={project}
        assets={[asset]}
        onRenderState={onRenderState}
      />,
    );

    await waitFor(() =>
      expect(onRenderState).toHaveBeenLastCalledWith({
        ready: true,
        lastRenderedPreview: {
          project,
          assetIds: ["asset_a"],
        },
      }),
    );

    expect(onRenderState).toHaveBeenNthCalledWith(1, {
      ready: false,
      lastRenderedPreview: null,
    });
  });

  it("rerenders when a source changes without changing its id", async () => {
    const project = createProjectDocument("Preview Asset Update");
    const canvasRef = { current: document.createElement("canvas") };
    const { rerender } = render(
      <PreviewStage
        canvasRef={canvasRef}
        project={project}
        assets={[asset]}
      />,
    );

    await waitFor(() => expect(buildBitmapMap).toHaveBeenCalled());
    const initialCallCount = vi.mocked(buildBitmapMap).mock.calls.length;

    const updatedAsset: SourceAsset = {
      ...asset,
      averageColor: "#445566",
      palette: ["#445566"],
    };

    rerender(
      <PreviewStage
        canvasRef={canvasRef}
        project={project}
        assets={[updatedAsset]}
      />,
    );

    await waitFor(() =>
      expect(buildBitmapMap).toHaveBeenCalledTimes(initialCallCount + 1),
    );
  });

  it("commits one draw stroke on pointer up without rerendering the project mid-drag", async () => {
    const project = createProjectDocument("Preview Draw");
    project.layers[0]!.layout.family = "draw";
    project.selectedLayerId = project.layers[0]!.id;
    const canvasRef = { current: document.createElement("canvas") };
    const onAppendDrawStroke = vi.fn(async () => undefined);
    const { container } = render(
      <PreviewStage
        canvasRef={canvasRef}
        project={project}
        assets={[asset]}
        drawEnabled
        drawBrushSize={120}
        onAppendDrawStroke={onAppendDrawStroke}
      />,
    );

    const previewCanvas = container.querySelectorAll("canvas")[0] as HTMLCanvasElement;
    const overlay = container.querySelectorAll("canvas")[1] as HTMLCanvasElement;
    expect(overlay).toBeTruthy();
    const bounds = {
      left: 0,
      top: 0,
      width: 300,
      height: 300,
      right: 300,
      bottom: 300,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    };
    Object.defineProperty(previewCanvas, "getBoundingClientRect", {
      value: () => bounds,
    });
    Object.defineProperty(overlay, "getBoundingClientRect", {
      value: () => ({
        ...bounds,
      }),
    });
    Object.defineProperty(overlay, "setPointerCapture", {
      value: vi.fn(),
    });

    fireEvent.pointerDown(overlay, {
      button: 0,
      clientX: 30,
      clientY: 60,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(overlay, {
      clientX: 150,
      clientY: 180,
      pointerId: 1,
      pointerType: "mouse",
    });

    expect(onAppendDrawStroke).not.toHaveBeenCalled();

    fireEvent.pointerUp(overlay, {
      clientX: 240,
      clientY: 210,
      pointerId: 1,
      pointerType: "mouse",
    });

    await waitFor(() =>
      expect(onAppendDrawStroke).toHaveBeenCalledWith(
        expect.objectContaining({
          points: [
            { x: 300, y: 600 },
            { x: 1500, y: 1800 },
            { x: 2400, y: 2100 },
          ],
        }),
      ),
    );
  });

  it("maps non-square preview coordinates without horizontal drift", async () => {
    const project = createProjectDocument("Preview Draw Wide");
    project.canvas.width = 3000;
    project.canvas.height = 1500;
    project.layers[0]!.layout.family = "draw";
    project.selectedLayerId = project.layers[0]!.id;
    const canvasRef = { current: document.createElement("canvas") };
    const onAppendDrawStroke = vi.fn(async () => undefined);
    const { container } = render(
      <PreviewStage
        canvasRef={canvasRef}
        project={project}
        assets={[asset]}
        drawEnabled
        drawBrushSize={120}
        onAppendDrawStroke={onAppendDrawStroke}
      />,
    );

    const previewCanvas = container.querySelectorAll("canvas")[0] as HTMLCanvasElement;
    const overlay = container.querySelectorAll("canvas")[1] as HTMLCanvasElement;
    const bounds = {
      left: 50,
      top: 20,
      width: 600,
      height: 300,
      right: 650,
      bottom: 320,
      x: 50,
      y: 20,
      toJSON: () => undefined,
    };
    Object.defineProperty(previewCanvas, "getBoundingClientRect", {
      value: () => bounds,
    });
    Object.defineProperty(overlay, "getBoundingClientRect", {
      value: () => ({
        ...bounds,
      }),
    });
    Object.defineProperty(overlay, "setPointerCapture", {
      value: vi.fn(),
    });

    fireEvent.pointerDown(overlay, {
      button: 0,
      clientX: 50,
      clientY: 170,
      pointerId: 2,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(overlay, {
      clientX: 650,
      clientY: 170,
      pointerId: 2,
      pointerType: "mouse",
    });

    await waitFor(() =>
      expect(onAppendDrawStroke).toHaveBeenCalledWith(
        expect.objectContaining({
          points: [
            { x: 0, y: 750 },
            { x: 3000, y: 750 },
          ],
        }),
      ),
    );
  });
});
