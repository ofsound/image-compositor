import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createProjectDocument } from "@/lib/project-defaults";
import { createProjectEditorView } from "@/lib/project-editor-view";
import type { ImageSourceAsset } from "@/types/project";
import { LeftSidebar } from "./left-sidebar";

vi.mock("@/components/app/source-thumbnail", () => ({
  SourceThumbnail: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock("@/components/app/sortable-layer-row", () => ({
  SortableLayerRow: ({ layer }: { layer: { name: string } }) => <div>{layer.name}</div>,
}));

function createImageAsset(): ImageSourceAsset {
  return {
    id: "asset-1",
    projectId: "project-1",
    kind: "image",
    name: "Reference",
    originalFileName: "reference.png",
    mimeType: "image/png",
    width: 1200,
    height: 1200,
    orientation: 1,
    originalPath: "/original/reference.png",
    normalizedPath: "/normalized/reference.png",
    previewPath: "/preview/reference.png",
    averageColor: "#888888",
    palette: ["#888888"],
    luminance: 0.5,
    createdAt: new Date().toISOString(),
  };
}

describe("LeftSidebar", () => {
  it("supports manual entry for source mix weight", async () => {
    const user = userEvent.setup();
    const updateSourceWeight = vi.fn();
    const project = createProjectDocument("Left Sidebar");
    const activeProjectView = createProjectEditorView(project);
    const asset = createImageAsset();

    activeProjectView.sourceIds = [asset.id];
    activeProjectView.sourceMapping.sourceWeights = {
      [asset.id]: 1.5,
    };

    render(
      <LeftSidebar
        previewExpanded={false}
        projectAssets={[asset]}
        activeProject={project}
        activeProjectView={activeProjectView}
        displayLayers={project.layers}
        selectedLayer={project.layers[0] ?? null}
        layerThumbnailUrls={{}}
        layerSensors={[]}
        handleLayerDragEnd={vi.fn()}
        openAddSourceDialog={vi.fn()}
        openEditSourceDialog={vi.fn()}
        handleRemoveSource={vi.fn(async () => undefined)}
        updateSourceWeight={updateSourceWeight}
        toggleAssetEnabled={vi.fn()}
        addLayer={vi.fn()}
        duplicateLayer={vi.fn()}
        selectLayer={vi.fn()}
        toggleLayerVisibility={vi.fn()}
        deleteLayer={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Reference mix weight" }));
    const input = screen.getByRole("textbox", { name: "Reference mix weight" });
    await user.clear(input);
    await user.type(input, "1.63x");
    await user.keyboard("{Enter}");

    expect(updateSourceWeight).toHaveBeenCalledWith(asset.id, 1.65);
  });
});
