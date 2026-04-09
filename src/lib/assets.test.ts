import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/opfs", () => ({
  readBlob: vi.fn(),
  writeBlob: vi.fn(async () => undefined),
}));

import {
  createGeneratedSourceAsset,
  getSourceContentSignature,
  normalizeSourceAsset,
  renderGeneratedSourceToCanvas,
  updateGeneratedSourceAsset,
} from "@/lib/assets";
import { writeBlob } from "@/lib/opfs";
import type { SourceAsset } from "@/types/project";

function createCanvasMocks() {
  const linearGradient = { addColorStop: vi.fn() };
  const radialGradient = { addColorStop: vi.fn() };
  const conicGradient = { addColorStop: vi.fn() };
  const imageData = {
    width: 1800,
    height: 1200,
    data: new Uint8ClampedArray([
      17, 34, 51, 255,
      17, 34, 51, 255,
      17, 34, 51, 255,
      17, 34, 51, 255,
    ]),
  };
  const primaryContext = {
    fillRect: vi.fn(),
    createImageData: vi.fn((width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
    })),
    putImageData: vi.fn(),
    getImageData: vi.fn(() => imageData),
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
    imageData,
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

  it("normalizes legacy noise assets to perlin with bounded defaults", () => {
    const asset = normalizeSourceAsset({
      id: "asset_noise",
      kind: "noise",
      projectId: "project_test",
      name: "Legacy Noise",
      originalFileName: "legacy-noise.png",
      mimeType: "image/png",
      width: 320,
      height: 240,
      orientation: 1,
      originalPath: "assets/original/asset_noise.png",
      normalizedPath: "assets/normalized/asset_noise.png",
      previewPath: "assets/previews/asset_noise.webp",
      averageColor: "#225577",
      palette: ["#225577", "#88aacc"],
      luminance: 0.2,
      createdAt: "2026-04-01T00:00:00.000Z",
      recipe: {
        scale: 2,
        detail: -1,
        contrast: 0.75,
        distortion: 0.25,
        seed: 99.8,
      },
    });

    expect(asset.kind).toBe("perlin");
    if (asset.kind !== "perlin") {
      throw new Error("Expected a perlin source asset.");
    }
    expect(asset.recipe).toEqual({
      color: "#225577",
      scale: 1,
      detail: 0,
      contrast: 0.75,
      distortion: 0.25,
      seed: 99,
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

  it("creates a perlin source with a persisted normalized recipe", async () => {
    const { primaryCanvas, previewCanvas, primaryContext } = createCanvasMocks();
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(primaryCanvas as never)
      .mockReturnValueOnce(previewCanvas as never);

    try {
      const asset = await createGeneratedSourceAsset(
        {
          kind: "perlin",
          name: "",
          recipe: {
            color: "#225577",
            scale: 0.9,
            detail: 0.4,
            contrast: 0.7,
            distortion: 0.2,
            seed: 42,
          },
        },
        "project_test",
        { width: 64, height: 48 },
      );

      expect(asset.kind).toBe("perlin");
      if (asset.kind !== "perlin") {
        throw new Error("Expected a perlin source asset.");
      }
      expect(asset.recipe).toEqual({
        color: "#225577",
        scale: 0.9,
        detail: 0.4,
        contrast: 0.7,
        distortion: 0.2,
        seed: 42,
      });
      expect(asset.name).toBe("Perlin #225577");
      expect(primaryContext.createImageData).toHaveBeenCalledWith(64, 48);
      expect(primaryContext.putImageData).toHaveBeenCalledTimes(1);
      expect(writeBlob).toHaveBeenCalledTimes(3);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it("creates a cellular source with a persisted normalized recipe", async () => {
    const { primaryCanvas, previewCanvas, primaryContext } = createCanvasMocks();
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(primaryCanvas as never)
      .mockReturnValueOnce(previewCanvas as never);

    try {
      const asset = await createGeneratedSourceAsset(
        {
          kind: "cellular",
          name: "",
          recipe: {
            color: "#6655cc",
            scale: 0.7,
            jitter: 0.2,
            edge: 0.8,
            contrast: 0.6,
            seed: 12,
          },
        },
        "project_test",
        { width: 64, height: 48 },
      );

      expect(asset.kind).toBe("cellular");
      if (asset.kind !== "cellular") {
        throw new Error("Expected a cellular source asset.");
      }
      expect(asset.recipe).toEqual({
        color: "#6655cc",
        scale: 0.7,
        jitter: 0.2,
        edge: 0.8,
        contrast: 0.6,
        seed: 12,
      });
      expect(asset.name).toBe("Cellular #6655CC");
      expect(primaryContext.createImageData).toHaveBeenCalledWith(64, 48);
      expect(primaryContext.putImageData).toHaveBeenCalledTimes(1);
      expect(writeBlob).toHaveBeenCalledTimes(3);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it("creates reaction and waves sources with normalized defaults", async () => {
    const { primaryCanvas, previewCanvas } = createCanvasMocks();
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(primaryCanvas as never)
      .mockReturnValueOnce(previewCanvas as never)
      .mockReturnValueOnce(primaryCanvas as never)
      .mockReturnValueOnce(previewCanvas as never);

    try {
      const reaction = await createGeneratedSourceAsset(
        {
          kind: "reaction",
          name: "",
          recipe: {
            color: "#cc5533",
            scale: 0.8,
            diffusion: 0.3,
            balance: 0.6,
            distortion: 0.45,
            seed: 77,
          },
        },
        "project_test",
        { width: 64, height: 48 },
      );
      const waves = await createGeneratedSourceAsset(
        {
          kind: "waves",
          name: "",
          recipe: {
            color: "#2299bb",
            scale: 0.8,
            interference: 0.2,
            directionality: 0.9,
            distortion: 0.45,
            seed: 88,
          },
        },
        "project_test",
        { width: 64, height: 48 },
      );

      expect(reaction.kind).toBe("reaction");
      expect(waves.kind).toBe("waves");
      expect(reaction.name).toBe("Reaction #CC5533");
      expect(waves.name).toBe("Waves #2299BB");
      expect(writeBlob).toHaveBeenCalledTimes(6);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it("updates an existing perlin source without changing its id", async () => {
    const { primaryCanvas, previewCanvas, primaryContext } = createCanvasMocks();
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(primaryCanvas as never)
      .mockReturnValueOnce(previewCanvas as never);
    const asset: SourceAsset = {
      id: "asset_perlin",
      kind: "perlin",
      projectId: "project_test",
      name: "Perlin Old",
      originalFileName: "perlin-asset_perlin.png",
      mimeType: "image/png",
      width: 64,
      height: 48,
      orientation: 1,
      originalPath: "assets/original/asset_perlin.png",
      normalizedPath: "assets/normalized/asset_perlin.png",
      previewPath: "assets/previews/asset_perlin.webp",
      averageColor: "#225577",
      palette: ["#225577", "#88aacc"],
      luminance: 0.2,
      createdAt: "2026-04-01T00:00:00.000Z",
      recipe: {
        color: "#225577",
        scale: 0.5,
        detail: 0.5,
        contrast: 0.5,
        distortion: 0.5,
        seed: 42,
        },
      };

    try {
      const updated = await updateGeneratedSourceAsset(asset, {
        name: "Lagoon",
        color: "#1188aa",
        scale: 0.8,
        detail: 0.25,
        contrast: 0.6,
        distortion: 0.15,
        seed: 314159,
      });

      expect(updated.id).toBe(asset.id);
      expect(updated.kind).toBe("perlin");
      if (updated.kind !== "perlin") {
        throw new Error("Expected a perlin source asset.");
      }
      expect(updated.name).toBe("Lagoon");
      expect(updated.recipe).toEqual({
        color: "#1188aa",
        scale: 0.8,
        detail: 0.25,
        contrast: 0.6,
        distortion: 0.15,
        seed: 314159,
      });
      expect(primaryContext.putImageData).toHaveBeenCalledTimes(1);
      expect(writeBlob).toHaveBeenCalledTimes(3);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it("updates cellular, reaction, and waves sources without changing their ids", async () => {
    const { primaryCanvas, previewCanvas } = createCanvasMocks();
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(primaryCanvas as never)
      .mockReturnValueOnce(previewCanvas as never)
      .mockReturnValueOnce(primaryCanvas as never)
      .mockReturnValueOnce(previewCanvas as never)
      .mockReturnValueOnce(primaryCanvas as never)
      .mockReturnValueOnce(previewCanvas as never);
    const baseAsset = {
      projectId: "project_test",
      mimeType: "image/png",
      width: 64,
      height: 48,
      orientation: 1,
      averageColor: "#225577",
      palette: ["#225577", "#88aacc"],
      luminance: 0.2,
      createdAt: "2026-04-01T00:00:00.000Z",
    };
    const cellular: SourceAsset = {
      ...baseAsset,
      id: "asset_cellular",
      kind: "cellular",
      name: "Cellular Old",
      originalFileName: "cellular.png",
      originalPath: "assets/original/asset_cellular.png",
      normalizedPath: "assets/normalized/asset_cellular.png",
      previewPath: "assets/previews/asset_cellular.webp",
      recipe: {
        color: "#8b5cf6",
        scale: 0.4,
        jitter: 0.4,
        edge: 0.4,
        contrast: 0.4,
        seed: 1,
      },
    };
    const reaction: SourceAsset = {
      ...baseAsset,
      id: "asset_reaction",
      kind: "reaction",
      name: "Reaction Old",
      originalFileName: "reaction.png",
      originalPath: "assets/original/asset_reaction.png",
      normalizedPath: "assets/normalized/asset_reaction.png",
      previewPath: "assets/previews/asset_reaction.webp",
      recipe: {
        color: "#ef4444",
        scale: 0.4,
        diffusion: 0.4,
        balance: 0.4,
        distortion: 0.4,
        seed: 2,
      },
    };
    const waves: SourceAsset = {
      ...baseAsset,
      id: "asset_waves",
      kind: "waves",
      name: "Waves Old",
      originalFileName: "waves.png",
      originalPath: "assets/original/asset_waves.png",
      normalizedPath: "assets/normalized/asset_waves.png",
      previewPath: "assets/previews/asset_waves.webp",
      recipe: {
        color: "#0ea5e9",
        scale: 0.4,
        interference: 0.4,
        directionality: 0.4,
        distortion: 0.4,
        seed: 3,
      },
    };

    try {
      const nextCellular = await updateGeneratedSourceAsset(cellular, {
        name: "Cellular Next",
        color: "#6655cc",
        scale: 0.7,
        jitter: 0.3,
        edge: 0.8,
        contrast: 0.6,
        seed: 9,
      });
      const nextReaction = await updateGeneratedSourceAsset(reaction, {
        name: "Reaction Next",
        color: "#cc5533",
        scale: 0.8,
        diffusion: 0.3,
        balance: 0.6,
        distortion: 0.45,
        seed: 8,
      });
      const nextWaves = await updateGeneratedSourceAsset(waves, {
        name: "Waves Next",
        color: "#2299bb",
        scale: 0.8,
        interference: 0.2,
        directionality: 0.9,
        distortion: 0.45,
        seed: 7,
      });

      expect(nextCellular.id).toBe(cellular.id);
      expect(nextReaction.id).toBe(reaction.id);
      expect(nextWaves.id).toBe(waves.id);
      expect(nextCellular.kind).toBe("cellular");
      expect(nextReaction.kind).toBe("reaction");
      expect(nextWaves.kind).toBe("waves");
      expect(writeBlob).toHaveBeenCalledTimes(9);
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

  it("renders gradient previews through the shared canvas renderer", () => {
    const { primaryCanvas, primaryContext, radialGradient } = createCanvasMocks();
    primaryCanvas.width = 320;
    primaryCanvas.height = 240;

    renderGeneratedSourceToCanvas(primaryCanvas, {
      kind: "gradient",
      name: "Preview",
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
    });

    expect(primaryContext.createRadialGradient).toHaveBeenCalledWith(
      80,
      180,
      30,
      80,
      180,
      120,
    );
    expect(radialGradient.addColorStop).toHaveBeenNthCalledWith(1, 0, "#112233");
    expect(radialGradient.addColorStop).toHaveBeenNthCalledWith(2, 0.5, "#778899");
    expect(radialGradient.addColorStop).toHaveBeenNthCalledWith(3, 1, "#ddeeff");
  });

  it("renders perlin previews through the shared canvas renderer", () => {
    const { primaryCanvas, primaryContext } = createCanvasMocks();
    primaryCanvas.width = 96;
    primaryCanvas.height = 72;

    renderGeneratedSourceToCanvas(primaryCanvas, {
      kind: "perlin",
      name: "Preview",
      recipe: {
        color: "#225577",
        scale: 0.9,
        detail: 0.4,
        contrast: 0.7,
        distortion: 0.2,
        seed: 42,
      },
    });

    expect(primaryContext.createImageData).toHaveBeenCalledWith(96, 72);
    expect(primaryContext.putImageData).toHaveBeenCalledTimes(1);
  });

  it("renders cellular, reaction, and waves previews through the shared canvas renderer", () => {
    const { primaryCanvas, primaryContext } = createCanvasMocks();
    primaryCanvas.width = 96;
    primaryCanvas.height = 72;

    renderGeneratedSourceToCanvas(primaryCanvas, {
      kind: "cellular",
      name: "Cellular Preview",
      recipe: {
        color: "#6655cc",
        scale: 0.7,
        jitter: 0.2,
        edge: 0.8,
        contrast: 0.6,
        seed: 42,
      },
    });
    renderGeneratedSourceToCanvas(primaryCanvas, {
      kind: "reaction",
      name: "Reaction Preview",
      recipe: {
        color: "#cc5533",
        scale: 0.8,
        diffusion: 0.3,
        balance: 0.6,
        distortion: 0.45,
        seed: 7,
      },
    });
    renderGeneratedSourceToCanvas(primaryCanvas, {
      kind: "waves",
      name: "Waves Preview",
      recipe: {
        color: "#2299bb",
        scale: 0.8,
        interference: 0.2,
        directionality: 0.9,
        distortion: 0.45,
        seed: 9,
      },
    });

    expect(primaryContext.createImageData).toHaveBeenCalledWith(96, 72);
    expect(primaryContext.putImageData).toHaveBeenCalledTimes(3);
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

  it("includes the perlin recipe in source signatures", () => {
    const asset = normalizeSourceAsset({
      id: "asset_noise",
      kind: "perlin",
      projectId: "project_test",
      name: "Perlin",
      originalFileName: "noise.png",
      mimeType: "image/png",
      width: 320,
      height: 240,
      orientation: 1,
      originalPath: "assets/original/asset_noise.png",
      normalizedPath: "assets/normalized/asset_noise.png",
      previewPath: "assets/previews/asset_noise.webp",
      averageColor: "#225577",
      palette: ["#225577", "#88aacc"],
      luminance: 0.2,
      createdAt: "2026-04-01T00:00:00.000Z",
      recipe: {
        color: "#225577",
        scale: 0.9,
        detail: 0.4,
        contrast: 0.7,
        distortion: 0.2,
        seed: 42,
      },
    });

    const signature = getSourceContentSignature(asset);

    expect(signature).toContain("|#225577|0.9|0.4|0.7|0.2|42");
  });

  it("includes cellular, reaction, and waves recipes in source signatures", () => {
    const cellular = normalizeSourceAsset({
      id: "asset_cellular",
      kind: "cellular",
      projectId: "project_test",
      name: "Cellular",
      originalFileName: "cellular.png",
      mimeType: "image/png",
      width: 320,
      height: 240,
      orientation: 1,
      originalPath: "assets/original/asset_cellular.png",
      normalizedPath: "assets/normalized/asset_cellular.png",
      previewPath: "assets/previews/asset_cellular.webp",
      averageColor: "#6655cc",
      palette: ["#6655cc"],
      luminance: 0.2,
      createdAt: "2026-04-01T00:00:00.000Z",
      recipe: {
        color: "#6655cc",
        scale: 0.7,
        jitter: 0.2,
        edge: 0.8,
        contrast: 0.6,
        seed: 12,
      },
    });
    const reaction = normalizeSourceAsset({
      id: "asset_reaction",
      kind: "reaction",
      projectId: "project_test",
      name: "Reaction",
      originalFileName: "reaction.png",
      mimeType: "image/png",
      width: 320,
      height: 240,
      orientation: 1,
      originalPath: "assets/original/asset_reaction.png",
      normalizedPath: "assets/normalized/asset_reaction.png",
      previewPath: "assets/previews/asset_reaction.webp",
      averageColor: "#cc5533",
      palette: ["#cc5533"],
      luminance: 0.2,
      createdAt: "2026-04-01T00:00:00.000Z",
      recipe: {
        color: "#cc5533",
        scale: 0.8,
        diffusion: 0.3,
        balance: 0.6,
        distortion: 0.45,
        seed: 77,
      },
    });
    const waves = normalizeSourceAsset({
      id: "asset_waves",
      kind: "waves",
      projectId: "project_test",
      name: "Waves",
      originalFileName: "waves.png",
      mimeType: "image/png",
      width: 320,
      height: 240,
      orientation: 1,
      originalPath: "assets/original/asset_waves.png",
      normalizedPath: "assets/normalized/asset_waves.png",
      previewPath: "assets/previews/asset_waves.webp",
      averageColor: "#2299bb",
      palette: ["#2299bb"],
      luminance: 0.2,
      createdAt: "2026-04-01T00:00:00.000Z",
      recipe: {
        color: "#2299bb",
        scale: 0.8,
        interference: 0.2,
        directionality: 0.9,
        distortion: 0.45,
        seed: 88,
      },
    });

    expect(getSourceContentSignature(cellular)).toContain("|#6655cc|0.7|0.2|0.8|0.6|12");
    expect(getSourceContentSignature(reaction)).toContain("|#cc5533|0.8|0.3|0.6|0.45|77");
    expect(getSourceContentSignature(waves)).toContain("|#2299bb|0.8|0.2|0.9|0.45|88");
  });
});
