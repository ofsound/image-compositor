import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/opfs", () => ({
  readBlob: vi.fn(),
  writeBlob: vi.fn(async () => undefined),
}));

import {
  createGeneratedSourceAsset,
  normalizeSourceAsset,
  updateGeneratedSourceAsset,
} from "@/lib/assets";
import { writeBlob } from "@/lib/opfs";
import type { SourceAsset } from "@/types/project";

function createCanvasMocks() {
  const gradient = { addColorStop: vi.fn() };
  const primaryContext = {
    fillRect: vi.fn(),
    getImageData: vi.fn(() => ({
      width: 1800,
      height: 1200,
      data: new Uint8ClampedArray([
        17, 34, 51, 255,
        17, 34, 51, 255,
        17, 34, 51, 255,
        17, 34, 51, 255,
      ]),
    })),
    createLinearGradient: vi.fn(() => gradient),
  };
  const previewContext = {
    drawImage: vi.fn(),
  };
  const primaryCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => primaryContext),
    toBlob: vi.fn((callback: BlobCallback) =>
      callback(new Blob(["generated"], { type: "image/png" })),
    ),
  } as unknown as HTMLCanvasElement;
  const previewCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => previewContext),
    toBlob: vi.fn((callback: BlobCallback) =>
      callback(new Blob(["preview"], { type: "image/webp" })),
    ),
  } as unknown as HTMLCanvasElement;

  return {
    gradient,
    primaryContext,
    previewContext,
    primaryCanvas,
    previewCanvas,
  };
}

describe("normalizeSourceAsset", () => {
  it("defaults legacy assets without kind to image", () => {
    const asset = normalizeSourceAsset({
      id: "asset_a",
      projectId: "project_test",
      name: "Legacy Asset",
      originalFileName: "legacy.png",
      mimeType: "image/png",
      width: 100,
      height: 100,
      orientation: 1,
      originalPath: "assets/original/asset_a.png",
      normalizedPath: "assets/normalized/asset_a.png",
      previewPath: "assets/previews/asset_a.webp",
      averageColor: "#112233",
      palette: ["#112233"],
      luminance: 0.2,
      createdAt: "2026-04-01T00:00:00.000Z",
    });

    expect(asset.kind).toBe("image");
  });
});

describe("generated sources", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(writeBlob).mockClear();
  });

  it("creates a solid source with generated blobs and metadata", async () => {
    const { primaryCanvas, previewCanvas } = createCanvasMocks();
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(primaryCanvas)
      .mockReturnValueOnce(previewCanvas);

    try {
      const asset = await createGeneratedSourceAsset(
        {
          kind: "solid",
          name: "",
          recipe: { color: "#112233" },
        },
        "project_test",
        { width: 1800, height: 1200 },
      );

      expect(asset.kind).toBe("solid");
      if (asset.kind !== "solid") {
        throw new Error("Expected a solid source asset.");
      }
      expect(asset.recipe).toEqual({ color: "#112233" });
      expect(asset.width).toBe(1800);
      expect(asset.height).toBe(1200);
      expect(asset.name).toBe("Solid #112233");
      expect(writeBlob).toHaveBeenCalledTimes(3);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it("updates an existing gradient source without changing its id", async () => {
    const { primaryCanvas, previewCanvas, primaryContext, gradient } =
      createCanvasMocks();
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(primaryCanvas)
      .mockReturnValueOnce(previewCanvas);
    const asset: SourceAsset = {
      id: "asset_gradient",
      kind: "gradient",
      projectId: "project_test",
      name: "Gradient Old",
      originalFileName: "gradient-asset_gradient.png",
      mimeType: "image/png",
      width: 1800,
      height: 1200,
      orientation: 1,
      originalPath: "assets/original/asset_gradient.png",
      normalizedPath: "assets/normalized/asset_gradient.png",
      previewPath: "assets/previews/asset_gradient.webp",
      averageColor: "#112233",
      palette: ["#112233", "#445566"],
      luminance: 0.2,
      createdAt: "2026-04-01T00:00:00.000Z",
      recipe: {
        from: "#112233",
        to: "#445566",
        direction: "horizontal",
      },
    };

    try {
      const updated = await updateGeneratedSourceAsset(asset, {
        name: "Skyline",
        from: "#334455",
        to: "#ddeeff",
        direction: "vertical",
      });

      expect(updated.id).toBe(asset.id);
      expect(updated.kind).toBe("gradient");
      if (updated.kind !== "gradient") {
        throw new Error("Expected a gradient source asset.");
      }
      expect(updated.name).toBe("Skyline");
      expect(updated.recipe).toEqual({
        from: "#334455",
        to: "#ddeeff",
        direction: "vertical",
      });
      expect(primaryContext.createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 1200);
      expect(gradient.addColorStop).toHaveBeenCalledTimes(2);
      expect(writeBlob).toHaveBeenCalledTimes(3);
    } finally {
      createElementSpy.mockRestore();
    }
  });
});
