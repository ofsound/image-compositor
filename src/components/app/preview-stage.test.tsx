import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PreviewStage } from "@/components/app/preview-stage";
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
});
