import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SourceCropDialog } from "@/features/editor/source-crop-dialog";
import type { ImageSourceAsset } from "@/types/project";

vi.mock("@/components/app/source-thumbnail", () => ({
  useObjectUrl: () => "blob:asset",
}));

const asset: ImageSourceAsset = {
  id: "asset_a",
  kind: "image",
  fitMode: "custom",
  crop: {
    x: 0.25,
    y: 0.25,
    width: 0.5,
    height: 0.5,
  },
  projectId: "project_test",
  name: "Reference",
  originalFileName: "reference.jpg",
  mimeType: "image/jpeg",
  width: 1200,
  height: 800,
  orientation: 1,
  originalPath: "reference.jpg",
  normalizedPath: "reference.png",
  previewPath: "reference.webp",
  averageColor: "#112233",
  palette: ["#112233"],
  luminance: 0.2,
  createdAt: "2026-03-30T00:00:00.000Z",
};

describe("SourceCropDialog", () => {
  it("applies dragged custom crop coordinates", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn(async () => undefined);
    render(
      <SourceCropDialog
        asset={asset}
        open
        onOpenChange={vi.fn()}
        onApply={onApply}
      />,
    );

    const stage = screen.getByTestId("source-crop-stage");
    stage.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      width: 400,
      height: 400,
      top: 0,
      left: 0,
      right: 400,
      bottom: 400,
      toJSON: () => undefined,
    }));
    const frame = screen.getByTestId("source-crop-frame");

    fireEvent.pointerDown(frame, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(stage, {
      pointerId: 1,
      clientX: 200,
      clientY: 140,
    });
    fireEvent.pointerUp(stage, { pointerId: 1 });
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith(asset.id, {
      x: 0.5,
      y: 0.35,
      width: 0.5,
      height: 0.5,
    });
  });

  it("resets the crop to full image bounds", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn(async () => undefined);
    render(
      <SourceCropDialog
        asset={asset}
        open
        onOpenChange={vi.fn()}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith(asset.id, {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });
});
