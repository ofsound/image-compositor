import { describe, expect, it, vi } from "vitest";

import {
  createProjectDocument,
  normalizeLayoutSettings,
  normalizeProjectDocument,
  normalizeProjectSnapshot,
} from "@/lib/project-defaults";
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
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    filter: "",
  };
}

const asset: SourceAsset = {
  id: "asset_a",
  kind: "image",
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
  it("defaults missing rect corner radius values to zero during normalization", () => {
    const project = createProjectDocument("Normalize Radius");
    const snapshot = structuredClone(project);

    delete (project.layout as Partial<typeof project.layout>).rectCornerRadius;
    delete (snapshot.layout as Partial<typeof snapshot.layout>).rectCornerRadius;

    expect(normalizeProjectDocument(project).layout.rectCornerRadius).toBe(0);
    expect(normalizeProjectSnapshot(snapshot).layout.rectCornerRadius).toBe(0);
    expect(normalizeLayoutSettings(undefined).rectCornerRadius).toBe(0);
  });

  it("creates new projects with a square rect corner radius default", () => {
    const project = createProjectDocument("Square Default");

    expect(project.layout.rectCornerRadius).toBe(0);
  });

  it("uses the configured rect corner radius scale", async () => {
    const project = createProjectDocument("Rect Radius");
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layout.rectCornerRadius = 1;
    project.layout.symmetryMode = "none";
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;

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

    expect(context.roundRect).toHaveBeenCalled();
    const [, , width, height, radius] = context.roundRect.mock.calls[0]!;
    expect(radius).toBe(Math.min(width, height) / 2);
  });

  it("keeps non-rect shapes unaffected by the rect corner radius setting", async () => {
    const project = createProjectDocument("Triangle Radius");
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "triangle";
    project.layout.rectCornerRadius = 1;
    project.layout.symmetryMode = "none";
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;

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

    expect(context.roundRect).not.toHaveBeenCalled();
    expect(context.lineTo).toHaveBeenCalled();
  });

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

    expect(canvas.getContext).toHaveBeenCalledWith(
      "2d",
      expect.objectContaining({ colorSpace: "srgb" }),
    );
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
    project.canvas.width = 1800;
    project.canvas.height = 1200;
    project.export.format = "image/png-transparent";
    project.export.width = 3840;
    project.export.height = 2560;
    project.export.scale = 1;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;

    const sceneContext = createMockContext();
    const exportContext = createMockContext();
    const sceneCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => sceneContext),
      toBlob: vi.fn(),
    } as unknown as HTMLCanvasElement;
    const exportCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => exportContext),
      toBlob: vi.fn((callback: BlobCallback, type?: string) =>
        callback(new Blob(["png"], { type })),
      ),
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(sceneCanvas as never)
      .mockReturnValueOnce(exportCanvas as never);

    try {
      const blob = await exportProjectImage(project, [], new Map());
      expect(blob.type).toBe("image/png");
      expect(sceneCanvas.getContext).toHaveBeenCalledWith(
        "2d",
        expect.objectContaining({ colorSpace: "srgb" }),
      );
      expect(exportCanvas.getContext).toHaveBeenCalledWith(
        "2d",
        expect.objectContaining({ colorSpace: "srgb" }),
      );
      expect(sceneCanvas.width).toBe(1800);
      expect(sceneCanvas.height).toBe(1200);
      expect(exportCanvas.width).toBe(3840);
      expect(exportCanvas.height).toBe(2560);
      expect(sceneContext.fillRect).toHaveBeenCalledOnce();
      expect(exportContext.drawImage).toHaveBeenCalledWith(sceneCanvas, 0, 0, 3840, 2560);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it("applies the configured background alpha to the scene render", async () => {
    const project = createProjectDocument("Background Alpha");
    project.canvas.background = "#123456";
    project.canvas.backgroundAlpha = 0.35;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;

    const context = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    await renderProjectToCanvas(project, [], new Map(), canvas);

    expect(context.fillStyle).toBe("#12345659");
    expect(context.fillRect).toHaveBeenCalledOnce();
  });
});
