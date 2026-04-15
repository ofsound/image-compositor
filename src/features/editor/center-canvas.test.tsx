import { createRef } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createProjectDocument } from "@/lib/project-defaults";
import { createProjectEditorView } from "@/lib/project-editor-view";
import { CenterCanvas } from "./center-canvas";

vi.mock("@/components/app/preview-stage", () => ({
  PreviewStage: () => <div>Preview Stage</div>,
}));

describe("CenterCanvas", () => {
  it("keeps accessible center regions without visible panel headings", () => {
    const project = createProjectDocument("Center Canvas");

    render(
      <CenterCanvas
        previewExpanded={false}
        setPreviewExpanded={vi.fn()}
        canvasRef={createRef<HTMLCanvasElement>()}
        previewProject={project}
        activeProject={project}
        previewAssets={[]}
        setRenderState={vi.fn()}
        drawEnabled={false}
        drawBrushSize={12}
        appendDrawStroke={vi.fn(async () => undefined)}
        patchProject={vi.fn()}
      />,
    );

    const previewRegion = screen.getByRole("region", { name: "Preview" });
    const projectSettingsRegion = screen.getByRole("region", {
      name: "Project Settings",
    });

    expect(within(previewRegion).getByRole("button", { name: "Expand preview" })).toBeInTheDocument();
    expect(within(projectSettingsRegion).getByLabelText("Canvas W")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Preview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Project Settings" })).not.toBeInTheDocument();
  });

  it("supports manual entry for background alpha", async () => {
    const user = userEvent.setup();
    const patchProject = vi.fn();
    const project = createProjectDocument("Center Canvas");
    const projectView = createProjectEditorView(project);

    render(
      <CenterCanvas
        previewExpanded={false}
        setPreviewExpanded={vi.fn()}
        canvasRef={createRef<HTMLCanvasElement>()}
        previewProject={project}
        activeProject={project}
        previewAssets={[]}
        setRenderState={vi.fn()}
        drawEnabled={false}
        drawBrushSize={12}
        appendDrawStroke={vi.fn(async () => undefined)}
        patchProject={patchProject}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Background alpha" }));
    const input = screen.getByRole("textbox", { name: "Background alpha" });
    await user.clear(input);
    await user.type(input, "25%");
    await user.keyboard("{Enter}");

    expect(patchProject).toHaveBeenCalledTimes(1);

    const updater = patchProject.mock.calls[0]?.[0];
    expect(typeof updater).toBe("function");

    const nextProject = updater(projectView);
    expect(nextProject.canvas.backgroundAlpha).toBe(0.25);
  });
});
