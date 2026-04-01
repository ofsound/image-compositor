import { describe, expect, it, vi } from "vitest";

import { createProjectDocument } from "@/lib/project-defaults";
import { exportProjectImage, renderProjectToCanvas } from "@/lib/render";
import type { SourceAsset } from "@/types/project";

function createMockContext() {
  return {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clip: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    roundRect: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    getImageData: vi.fn(),
    createImageData: vi.fn(),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
  };
}

const asset: SourceAsset = {
  id: "asset_a",
  projectId: "project_test",
  name: "A",
  originalFileName: "a.jpg",
  mimeType: "image/jpeg",
  width: 100,
  height: 100,
  orientation: 1,
  originalPath: "a.jpg",
  normalizedPath: "a.png",
  previewPath: "a.webp",
  averageColor: "#112233",
  palette: ["#112233", "#445566"],
  luminance: 0.2,
  createdAt: "2026-03-30T00:00:00.000Z",
};

describe("renderProjectToCanvas", () => {
  it("can skip the background pass for transparent export rendering", async () => {
    const project = createProjectDocument("Transparent Export");
    project.canvas.width = 64;
    project.canvas.height = 48;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;

    const context = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    await renderProjectToCanvas(project, [], new Map(), canvas, {
      includeBackground: false,
    });

    expect(context.fillRect).not.toHaveBeenCalled();
  });

  it("keeps the background pass for default rendering", async () => {
    const project = createProjectDocument("Opaque Render");
    project.canvas.width = 64;
    project.canvas.height = 48;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;

    const context = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    await renderProjectToCanvas(project, [], new Map(), canvas);

    expect(context.fillRect).toHaveBeenCalledOnce();
  });

  it("uses centered crops when crop distribution is center", async () => {
    const project = createProjectDocument("Centered Crop");
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";
    project.layout.shapeMode = "rect";
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.sourceMapping.preserveAspect = false;
    project.sourceMapping.cropDistribution = "center";

    const context = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    await renderProjectToCanvas(
      project,
      [asset],
      new Map([[asset.id, { asset, bitmap: {} as ImageBitmap }]]),
      canvas,
    );

    expect(context.drawImage).toHaveBeenCalled();
    const sourceWidths = context.drawImage.mock.calls.map((call) => call[3]);
    const sourceHeights = context.drawImage.mock.calls.map((call) => call[4]);
    expect(sourceWidths.every((value) => value === 100)).toBe(true);
    expect(sourceHeights.every((value) => value === 100)).toBe(true);
  });

  it("uses distributed source crops when crop distribution is enabled", async () => {
    const project = createProjectDocument("Distributed Crop");
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";
    project.layout.shapeMode = "rect";
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.sourceMapping.preserveAspect = false;
    project.sourceMapping.cropDistribution = "distributed";

    const context = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    await renderProjectToCanvas(
      project,
      [asset],
      new Map([[asset.id, { asset, bitmap: {} as ImageBitmap }]]),
      canvas,
    );

    expect(context.drawImage).toHaveBeenCalled();
    const sourceWidths = context.drawImage.mock.calls.map((call) => call[3]);
    const sourceHeights = context.drawImage.mock.calls.map((call) => call[4]);
    expect(sourceWidths.every((value) => value === 50)).toBe(true);
    expect(sourceHeights.every((value) => value === 50)).toBe(true);
  });
});

describe("exportProjectImage", () => {
  it("exports transparent png projects as image/png blobs", async () => {
    const project = createProjectDocument("Transparent PNG");
    project.export.format = "image/png-transparent";
    project.export.width = 64;
    project.export.height = 48;
    project.export.scale = 1;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;

    const context = createMockContext();
    const convertToBlob = vi.fn(async ({ type }: { type: string }) => new Blob(["png"], { type }));

    const previousOffscreenCanvas = globalThis.OffscreenCanvas;
    Object.defineProperty(globalThis, "OffscreenCanvas", {
      configurable: true,
      writable: true,
      value: class {
        width = 0;
        height = 0;

        getContext() {
          return context;
        }

        convertToBlob = convertToBlob;
      },
    });

    try {
      const blob = await exportProjectImage(project, [], new Map());
      expect(blob.type).toBe("image/png");
      expect(context.fillRect).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, "OffscreenCanvas", {
        configurable: true,
        writable: true,
        value: previousOffscreenCanvas,
      });
    }
  });
});
