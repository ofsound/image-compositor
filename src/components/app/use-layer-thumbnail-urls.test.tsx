import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createCompositorLayer, createProjectDocument } from "@/lib/project-defaults";
import { useLayerThumbnailUrls } from "@/components/app/use-layer-thumbnail-urls";
import type { ProjectDocument, SourceAsset } from "@/types/project";

const {
  loadNormalizedAssetBitmapMap,
  renderLayerThumbnailUrl,
} = vi.hoisted(() => ({
  loadNormalizedAssetBitmapMap: vi.fn(async () => new Map()),
  renderLayerThumbnailUrl: vi.fn(),
}));

vi.mock("@/lib/render-service", () => ({
  getLayerThumbnailSignature: vi.fn(
    (project: ProjectDocument, layer: ProjectDocument["layers"][number], assets: SourceAsset[]) =>
      JSON.stringify({
        width: project.canvas.width,
        columns: layer.layout.columns,
        sources: layer.sourceIds,
        assets: assets.map((asset) => asset.id),
      }),
  ),
  loadNormalizedAssetBitmapMap,
  renderLayerThumbnailUrl,
}));

function createImageAsset(projectId: string, id: string): SourceAsset {
  return {
    id,
    kind: "image",
    fitMode: "stretch",
    projectId,
    name: id,
    originalFileName: `${id}.png`,
    mimeType: "image/png",
    width: 640,
    height: 640,
    orientation: 1,
    originalPath: `${id}.png`,
    normalizedPath: `${id}.png`,
    previewPath: `${id}.webp`,
    averageColor: "#112233",
    palette: ["#112233"],
    luminance: 0.3,
    createdAt: "2026-04-12T00:00:00.000Z",
  };
}

function createProjectWithTwoLayers() {
  const project = createProjectDocument("Thumbnails");
  const secondLayer = createCompositorLayer({
    name: "Layer 2",
    visible: true,
  });
  project.layers[0]!.id = "layer_1";
  secondLayer.sourceIds = ["asset_2"];
  secondLayer.id = "layer_2";
  project.layers[0]!.sourceIds = ["asset_1"];
  project.layers.push(secondLayer);
  return project;
}

function ThumbnailProbe({
  project,
  assets,
}: {
  project: ProjectDocument | null;
  assets: SourceAsset[];
}) {
  const urls = useLayerThumbnailUrls({
    project,
    assets,
    width: 224,
    height: 140,
  });

  return <div data-testid="urls">{JSON.stringify(urls)}</div>;
}

describe("useLayerThumbnailUrls", () => {
  it("reuses existing layer thumbnails when unrelated project fields change", async () => {
    const revokeObjectUrlSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    let nextThumbnailId = 1;
    renderLayerThumbnailUrl.mockImplementation(
      async (_project, layer: { id: string }) => `blob:${layer.id}:${nextThumbnailId++}`,
    );
    const project = createProjectWithTwoLayers();
    const assets = [
      createImageAsset(project.id, "asset_1"),
      createImageAsset(project.id, "asset_2"),
    ];
    const { rerender } = render(
      <ThumbnailProbe project={project} assets={assets} />,
    );

    await waitFor(() =>
      expect(renderLayerThumbnailUrl).toHaveBeenCalledTimes(2),
    );
    const initialUrls = screen.getByTestId("urls").textContent;

    const renamedProject: ProjectDocument = {
      ...project,
      title: "Renamed Project",
      layers: project.layers.map((layer) => ({
        ...layer,
        name: `${layer.name} renamed`,
      })),
    };

    rerender(<ThumbnailProbe project={renamedProject} assets={assets} />);

    await waitFor(() =>
      expect(screen.getByTestId("urls").textContent).toBe(initialUrls),
    );
    expect(renderLayerThumbnailUrl).toHaveBeenCalledTimes(2);
    expect(revokeObjectUrlSpy).not.toHaveBeenCalled();

    const updatedProject: ProjectDocument = {
      ...renamedProject,
      layers: renamedProject.layers.map((layer, index) =>
        index === 1
          ? {
              ...layer,
              layout: {
                ...layer.layout,
                columns: layer.layout.columns + 1,
              },
            }
          : layer,
      ),
    };

    rerender(<ThumbnailProbe project={updatedProject} assets={assets} />);

    await waitFor(() =>
      expect(renderLayerThumbnailUrl).toHaveBeenCalledTimes(3),
    );
    expect(screen.getByTestId("urls").textContent).toContain("blob:layer_1");
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:layer_2:2");
  });
});
