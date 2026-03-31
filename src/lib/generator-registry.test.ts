import { describe, expect, it } from "vitest";

import { buildRenderSlices } from "@/lib/generator-registry";
import { createProjectDocument } from "@/lib/project-defaults";
import type { SourceAsset } from "@/types/project";

const assets: SourceAsset[] = [
  {
    id: "asset_a",
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
});
