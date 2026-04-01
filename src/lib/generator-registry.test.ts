import { describe, expect, it } from "vitest";

import { buildRenderSlices } from "@/lib/generator-registry";
import { createProjectDocument } from "@/lib/project-defaults";
import type { SourceAsset } from "@/types/project";

const assets: SourceAsset[] = [
  {
    id: "asset_a",
    projectId: "project_test",
    name: "A",
    originalFileName: "a.jpg",
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    orientation: 1,
    originalPath: "a.jpg",
    normalizedPath: "a.png",
    previewPath: "a.webp",
    averageColor: "#112233",
    palette: ["#112233", "#445566"],
    luminance: 0.2,
    createdAt: "2026-03-30T00:00:00.000Z",
  },
  {
    id: "asset_b",
    projectId: "project_test",
    name: "B",
    originalFileName: "b.jpg",
    mimeType: "image/jpeg",
    width: 1000,
    height: 1200,
    orientation: 1,
    originalPath: "b.jpg",
    normalizedPath: "b.png",
    previewPath: "b.webp",
    averageColor: "#ffeedd",
    palette: ["#ffeedd", "#ccbbaa", "#997755"],
    luminance: 0.8,
    createdAt: "2026-03-30T00:00:00.000Z",
  },
];

describe("buildRenderSlices", () => {
  it("builds deterministic slices for a seeded project", () => {
    const project = createProjectDocument("Determinism");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "blocks";
    project.layout.symmetryMode = "mirror-x";

    const first = buildRenderSlices(project, assets);
    const second = buildRenderSlices(project, assets);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it("keeps all rectangles within a sensible padded canvas range", () => {
    const project = createProjectDocument("Bounds");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.symmetryMode = "none";
    const slices = buildRenderSlices(project, assets);

    for (const slice of slices) {
      expect(slice.rect.width).toBeGreaterThan(0);
      expect(slice.rect.height).toBeGreaterThan(0);
      expect(slice.rect.x).toBeGreaterThan(-400);
      expect(slice.rect.y).toBeGreaterThan(-400);
      expect(slice.rect.x + slice.rect.width).toBeLessThan(project.canvas.width + 400);
      expect(slice.rect.y + slice.rect.height).toBeLessThan(project.canvas.height + 400);
    }
  });

  it("assigns unique distributed crops for a single-image 5x5 grid", () => {
    const project = createProjectDocument("Distributed Grid");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 5;
    project.layout.rows = 5;
    project.layout.symmetryMode = "none";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices).toHaveLength(25);
    expect(new Set(slices.map((slice) => JSON.stringify(slice.sourceCrop))).size).toBe(25);
  });

  it("keeps sequential assignment while distributing unique crops per asset", () => {
    const project = createProjectDocument("Sequential Crops");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 4;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "sequential";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, assets);
    const assetBySliceId = new Map(slices.map((slice) => [slice.id, slice.assetId]));

    expect([
      assetBySliceId.get("slice_0"),
      assetBySliceId.get("slice_1"),
      assetBySliceId.get("slice_2"),
      assetBySliceId.get("slice_3"),
      assetBySliceId.get("slice_4"),
      assetBySliceId.get("slice_5"),
      assetBySliceId.get("slice_6"),
      assetBySliceId.get("slice_7"),
    ]).toEqual([
      "asset_a",
      "asset_b",
      "asset_a",
      "asset_b",
      "asset_a",
      "asset_b",
      "asset_a",
      "asset_b",
    ]);
    for (const assetId of ["asset_a", "asset_b"]) {
      const assetSlices = slices.filter((slice) => slice.assetId === assetId);
      expect(new Set(assetSlices.map((slice) => JSON.stringify(slice.sourceCrop))).size).toBe(
        assetSlices.length,
      );
    }
  });

  it("keeps palette assignment while distributing unique crops per asset", () => {
    const project = createProjectDocument("Palette Crops");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 3;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "palette";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, assets);
    const assetBySliceId = new Map(slices.map((slice) => [slice.id, slice.assetId]));

    expect([
      assetBySliceId.get("slice_0"),
      assetBySliceId.get("slice_1"),
      assetBySliceId.get("slice_2"),
      assetBySliceId.get("slice_3"),
      assetBySliceId.get("slice_4"),
      assetBySliceId.get("slice_5"),
    ]).toEqual(["asset_b", "asset_a", "asset_b", "asset_a", "asset_b", "asset_a"]);
    for (const assetId of ["asset_a", "asset_b"]) {
      const assetSlices = slices.filter((slice) => slice.assetId === assetId);
      expect(new Set(assetSlices.map((slice) => JSON.stringify(slice.sourceCrop))).size).toBe(
        assetSlices.length,
      );
    }
  });

  it("gives symmetry clones distinct crop windows", () => {
    const project = createProjectDocument("Symmetry Crops");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.symmetryMode = "mirror-x";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices.length).toBeGreaterThan(4);
    expect(new Set(slices.map((slice) => JSON.stringify(slice.sourceCrop))).size).toBe(
      slices.length,
    );
  });
});
