import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SourceAssetCard } from "@/components/app/source-asset-card";
import type { SourceAsset } from "@/types/project";

const imageAsset: SourceAsset = {
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

const gradientAsset: SourceAsset = {
  ...imageAsset,
  id: "asset_gradient",
  kind: "gradient",
  name: "Sunrise",
  recipe: {
    mode: "linear",
    from: "#112233",
    to: "#ffaa00",
    direction: "horizontal",
    viaColor: null,
    viaPosition: 0.5,
    centerX: 0.5,
    centerY: 0.5,
    radialRadius: 1,
    radialInnerRadius: 0,
    conicAngle: 0,
    conicSpan: 360,
    conicRepeat: false,
  },
};

describe("SourceAssetCard", () => {
  it("renders enabled assets with a disable button", () => {
    render(
      <SourceAssetCard
        asset={imageAsset}
        enabled
        onToggle={vi.fn()}
        thumbnail={<div>thumb</div>}
      />,
    );

    expect(screen.getByLabelText("Disable Asset A")).toBeInTheDocument();
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.getByText("Asset A").closest("[data-state]")).toHaveAttribute(
      "data-state",
      "enabled",
    );
  });

  it("renders disabled assets with an enable button", () => {
    render(
      <SourceAssetCard
        asset={imageAsset}
        enabled={false}
        onToggle={vi.fn()}
        thumbnail={<div>thumb</div>}
      />,
    );

    expect(screen.getByLabelText("Enable Asset A")).toBeInTheDocument();
    expect(screen.getByText("Asset A").closest("[data-state]")).toHaveAttribute(
      "data-state",
      "disabled",
    );
  });

  it("toggles the asset with one click", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <SourceAssetCard
        asset={imageAsset}
        enabled
        onToggle={onToggle}
        thumbnail={<div>thumb</div>}
      />,
    );

    await user.click(screen.getByLabelText("Disable Asset A"));

    expect(onToggle).toHaveBeenCalledWith("asset_a");
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders a remove button and removes the asset with one click", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(
      <SourceAssetCard
        asset={imageAsset}
        enabled
        onToggle={vi.fn()}
        onRemove={onRemove}
        thumbnail={<div>thumb</div>}
      />,
    );

    await user.click(screen.getByLabelText("Remove Asset A"));

    expect(onRemove).toHaveBeenCalledWith("asset_a");
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("renders an edit button for editable generated sources", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onRemove = vi.fn();

    render(
      <SourceAssetCard
        asset={gradientAsset}
        enabled
        onToggle={vi.fn()}
        onEdit={onEdit}
        onRemove={onRemove}
        thumbnail={<div>thumb</div>}
      />,
    );

    expect(screen.getByText("Gradient")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove Sunrise")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Edit Sunrise"));

    expect(onEdit).toHaveBeenCalledWith("asset_gradient");
  });

  it("renders optional top content above the thumbnail", () => {
    render(
      <SourceAssetCard
        asset={imageAsset}
        enabled
        onToggle={vi.fn()}
        thumbnail={<div>thumb</div>}
        topContent={<div>mix control</div>}
      />,
    );

    expect(screen.getByText("mix control")).toBeInTheDocument();
    expect(screen.getByText("thumb")).toBeInTheDocument();
  });

  it("supports the compact rail layout", () => {
    render(
      <SourceAssetCard
        asset={imageAsset}
        enabled
        layout="rail"
        onToggle={vi.fn()}
        thumbnail={<div>thumb</div>}
        topContent={<div>mix control</div>}
      />,
    );

    expect(screen.getByText("Asset A").closest("[data-layout]")).toHaveAttribute(
      "data-layout",
      "rail",
    );
    expect(screen.getByText("mix control")).toBeInTheDocument();
  });
});
