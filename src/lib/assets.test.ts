import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/opfs", () => ({
  readBlob: vi.fn(),
  writeBlob: vi.fn(async () => undefined),
}));

import {
  createGeneratedSourceAsset,
  getSourceContentSignature,
  normalizeSourceAsset,
  updateGeneratedSourceAsset,
} from "@/lib/assets";
import { writeBlob } from "@/lib/opfs";
import type { SourceAsset } from "@/types/project";

function createCanvasMocks() {
  const linearGradient = { addColorStop: vi.fn() };
  const radialGradient = { addColorStop: vi.fn() };
  const conicGradient = { addColorStop: vi.fn() };
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
    createLinearGradient: vi.fn(() => linearGradient),
    createRadialGradient: vi.fn(() => radialGradient),
    createConicGradient: vi.fn(() => conicGradient),
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
    linearGradient,
    radialGradient,
    conicGradient,
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

  it("normalizes legacy gradient assets to linear mode defaults", () => {
    const asset = normalizeSourceAsset({
      id: "asset_gradient",
      kind: "gradient",
      projectId: "project_test",
      name: "Legacy Gradient",
      originalFileName: "legacy-gradient.png",
      mimeType: "image/png",
      width: 320,
      height: 240,
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
        direction: "vertical",
      },
    });

    expect(asset.kind).toBe("gradient");
    if (asset.kind !== "gradient") {
      throw new Error("Expected a gradient source asset.");
    }
    expect(asset.recipe).toEqual({
      mode: "linear",
      from: "#112233",
      to: "#445566",
      direction: "vertical",
      viaColor: null,
      viaPosition: 0.5,
      centerX: 0.5,
      centerY: 0.5,
      radialRadius: 1,
      radialInnerRadius: 0,
      conicAngle: 0,
      conicSpan: 360,
      conicRepeat: false,
    });
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
      .mockReturnValueOnce(primaryCanvas as never)
      .mockReturnValueOnce(previewCanvas as never);

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
    const { primaryCanvas, previewCanvas, primaryContext, linearGradient } =
      createCanvasMocks();
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(primaryCanvas as never)
      .mockReturnValueOnce(previewCanvas as never);
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
        mode: "linear",
        from: "#112233",
        to: "#445566",
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

    try {
      const updated = await updateGeneratedSourceAsset(asset, {
        name: "Skyline",
        mode: "linear",
        from: "#334455",
        to: "#ddeeff",
        direction: "vertical",
        viaColor: "#778899",
        viaPosition: 0.25,
        centerX: 0.5,
        centerY: 0.5,
        radialRadius: 1,
        radialInnerRadius: 0,
        conicAngle: 0,
        conicSpan: 360,
        conicRepeat: false,
      });

      expect(updated.id).toBe(asset.id);
      expect(updated.kind).toBe("gradient");
      if (updated.kind !== "gradient") {
        throw new Error("Expected a gradient source asset.");
      }
      expect(updated.name).toBe("Skyline");
      expect(updated.recipe).toEqual({
        mode: "linear",
        from: "#334455",
        to: "#ddeeff",
        direction: "vertical",
        viaColor: "#778899",
        viaPosition: 0.25,
        centerX: 0.5,
        centerY: 0.5,
        radialRadius: 1,
        radialInnerRadius: 0,
        conicAngle: 0,
        conicSpan: 360,
        conicRepeat: false,
      });
      expect(primaryContext.createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 1200);
      expect(linearGradient.addColorStop).toHaveBeenCalledTimes(3);
      expect(linearGradient.addColorStop).toHaveBeenNthCalledWith(1, 0, "#334455");
      expect(linearGradient.addColorStop).toHaveBeenNthCalledWith(2, 0.25, "#778899");
      expect(linearGradient.addColorStop).toHaveBeenNthCalledWith(3, 1, "#ddeeff");
      expect(writeBlob).toHaveBeenCalledTimes(3);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it("creates radial gradients using the normalized center and radii", async () => {
    const { primaryCanvas, previewCanvas, primaryContext, radialGradient } =
      createCanvasMocks();
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(primaryCanvas as never)
      .mockReturnValueOnce(previewCanvas as never);

    try {
      const asset = await createGeneratedSourceAsset(
        {
          kind: "gradient",
          name: "",
          recipe: {
            mode: "radial",
            from: "#112233",
            to: "#ddeeff",
            direction: "diagonal-down",
            viaColor: "#778899",
            viaPosition: 0.5,
            centerX: 0.25,
            centerY: 0.75,
            radialRadius: 0.4,
            radialInnerRadius: 0.25,
            conicAngle: 0,
            conicSpan: 360,
            conicRepeat: false,
          },
        },
        "project_test",
        { width: 1800, height: 1200 },
      );

      expect(asset.kind).toBe("gradient");
      expect(primaryContext.createRadialGradient).toHaveBeenCalledTimes(1);
      expect(primaryContext.createRadialGradient).toHaveBeenCalledWith(
        450,
        900,
        expect.closeTo(162.25, 2),
        450,
        900,
        expect.closeTo(649, 2),
      );
      expect(radialGradient.addColorStop).toHaveBeenNthCalledWith(1, 0, "#112233");
      expect(radialGradient.addColorStop).toHaveBeenNthCalledWith(2, 0.5, "#778899");
      expect(radialGradient.addColorStop).toHaveBeenNthCalledWith(3, 1, "#ddeeff");
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it("creates repeating conic gradients with the requested span", async () => {
    const { primaryCanvas, previewCanvas, primaryContext, conicGradient } =
      createCanvasMocks();
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(primaryCanvas as never)
      .mockReturnValueOnce(previewCanvas as never);

    try {
      await createGeneratedSourceAsset(
        {
          kind: "gradient",
          name: "Conic",
          recipe: {
            mode: "conic",
            from: "#112233",
            to: "#ddeeff",
            direction: "diagonal-down",
            viaColor: "#778899",
            viaPosition: 0.5,
            centerX: 0.5,
            centerY: 0.25,
            radialRadius: 1,
            radialInnerRadius: 0,
            conicAngle: 90,
            conicSpan: 120,
            conicRepeat: true,
          },
        },
        "project_test",
        { width: 1800, height: 1200 },
      );

      expect(primaryContext.createConicGradient).toHaveBeenCalledWith(
        Math.PI / 2,
        900,
        300,
      );
      expect(conicGradient.addColorStop).toHaveBeenNthCalledWith(1, 0, "#112233");
      expect(conicGradient.addColorStop).toHaveBeenNthCalledWith(
        2,
        expect.closeTo(1 / 6, 5),
        "#778899",
      );
      expect(conicGradient.addColorStop).toHaveBeenNthCalledWith(
        3,
        expect.closeTo(1 / 3, 5),
        "#ddeeff",
      );
      expect(conicGradient.addColorStop).toHaveBeenCalledWith(1, "#ddeeff");
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it("includes the expanded gradient recipe in source signatures", () => {
    const asset = normalizeSourceAsset({
      id: "asset_gradient",
      kind: "gradient",
      projectId: "project_test",
      name: "Gradient",
      originalFileName: "gradient.png",
      mimeType: "image/png",
      width: 320,
      height: 240,
      orientation: 1,
      originalPath: "assets/original/asset_gradient.png",
      normalizedPath: "assets/normalized/asset_gradient.png",
      previewPath: "assets/previews/asset_gradient.webp",
      averageColor: "#112233",
      palette: ["#112233", "#445566"],
      luminance: 0.2,
      createdAt: "2026-04-01T00:00:00.000Z",
      recipe: {
        mode: "conic",
        from: "#112233",
        to: "#445566",
        direction: "horizontal",
        viaColor: "#778899",
        viaPosition: 0.25,
        centerX: 0.4,
        centerY: 0.6,
        radialRadius: 0.8,
        radialInnerRadius: 0.2,
        conicAngle: 45,
        conicSpan: 180,
        conicRepeat: true,
      },
    });

    const signature = getSourceContentSignature(asset);

    expect(signature).toContain("|conic|");
    expect(signature).toContain("|#778899|0.25|0.4|0.6|0.8|0.2|45|180|1");
  });
});
