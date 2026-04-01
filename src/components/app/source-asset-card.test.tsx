import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SourceAssetCard } from "@/components/app/source-asset-card";
import type { SourceAsset } from "@/types/project";

const asset: SourceAsset = {
  id: "asset_a",
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

describe("SourceAssetCard", () => {
  it("renders enabled assets with a disable button", () => {
    render(
      <SourceAssetCard
        asset={asset}
        enabled
        onToggle={vi.fn()}
        thumbnail={<div>thumb</div>}
      />,
    );

    expect(screen.getByLabelText("Disable Asset A")).toBeInTheDocument();
    expect(screen.getByText("Asset A").closest("[data-state]")).toHaveAttribute(
      "data-state",
      "enabled",
    );
  });

  it("renders disabled assets with an enable button", () => {
    render(
      <SourceAssetCard
        asset={asset}
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
        asset={asset}
        enabled
        onToggle={onToggle}
        thumbnail={<div>thumb</div>}
      />,
    );

    await user.click(screen.getByLabelText("Disable Asset A"));

    expect(onToggle).toHaveBeenCalledWith("asset_a");
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
