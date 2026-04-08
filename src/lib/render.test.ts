import { describe, expect, it, vi } from "vitest";

import {
  createProjectDocument,
  normalizeLayoutSettings,
  normalizeProjectDocument,
  normalizeProjectSnapshot,
} from "@/lib/project-defaults";
import { exportProjectImage, renderProjectToCanvas } from "@/lib/render";
import { buildBitmapMap } from "@/lib/render";
import type { SourceAsset } from "@/types/project";

function createMockContext() {
  const drawImageCompositeOperations: string[] = [];
  const globalCompositeOperationAssignments: string[] = [];
  let globalCompositeOperation = "source-over";
  const context = {
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
    rect: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    getImageData: vi.fn(),
    createImageData: vi.fn(),
    putImageData: vi.fn(),
    drawImage: vi.fn((..._args: unknown[]) => {
      drawImageCompositeOperations.push(globalCompositeOperation);
    }),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    transform: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    lineWidth: 1,
    filter: "",
    drawImageCompositeOperations,
    globalCompositeOperationAssignments,
  };

  Object.defineProperty(context, "globalCompositeOperation", {
    get() {
      return globalCompositeOperation;
    },
    set(value: string) {
      globalCompositeOperation = value;
      globalCompositeOperationAssignments.push(value);
    },
    enumerable: true,
    configurable: true,
  });

  return context;
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
  it("rebuilds image bitmaps for distinct blobs with identical metadata", async () => {
    const createImageBitmapMock = vi.fn(async () => ({}) as ImageBitmap);
    vi.stubGlobal("createImageBitmap", createImageBitmapMock);
    const firstBlob = new Blob(["A"], { type: "image/png" });
    const secondBlob = new Blob(["B"], { type: "image/png" });

    try {
      const firstMap = await buildBitmapMap([asset], async () => firstBlob);
      const secondMap = await buildBitmapMap([asset], async () => secondBlob);

      expect(firstMap.get(asset.id)?.bitmap).toBeDefined();
      expect(secondMap.get(asset.id)?.bitmap).toBeDefined();
      expect(createImageBitmapMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

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

  it("renders organic blob slices from custom clip paths", async () => {
    const project = createProjectDocument("Organic Render");
    project.layout.family = "organic";
    project.layout.shapeMode = "blob";
    project.layout.density = 0.05;
    project.layout.symmetryMode = "none";
    project.compositing.overlap = 0;
    project.compositing.shadow = 0;
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
    expect(context.arc).not.toHaveBeenCalled();
    expect(context.moveTo).toHaveBeenCalled();
    expect(context.lineTo.mock.calls.length).toBeGreaterThan(10);
  });

  it("warps 3d slices through projected card quads", async () => {
    const project = createProjectDocument("3D Warp Render");
    project.layout.family = "3d";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.compositing.overlap = 0;
    project.compositing.shadow = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;

    const context = createMockContext();
    const surfaceContext = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;
    const surfaceCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => surfaceContext),
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(surfaceCanvas as never);

    try {
      await renderProjectToCanvas(
        project,
        [asset],
        new Map([[asset.id, { asset, bitmap: {} as ImageBitmap }]]),
        canvas,
      );
    } finally {
      createElementSpy.mockRestore();
    }

    expect(context.transform).toHaveBeenCalled();
    expect(context.drawImage).toHaveBeenCalled();
  });

  it("renders interlock slices as rotated triangle paths clipped to the inset area", async () => {
    const project = createProjectDocument("Interlock Render");
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 1;
    project.layout.shapeMode = "interlock";
    project.layout.gutter = 0;
    project.layout.symmetryMode = "none";
    project.compositing.overlap = 0;
    project.compositing.shadow = 0;
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
    expect(context.rect).toHaveBeenCalledWith(
      project.canvas.inset,
      project.canvas.inset,
      project.canvas.width - project.canvas.inset * 2,
      project.canvas.height - project.canvas.inset * 2,
    );
    expect(context.rotate).toHaveBeenCalledWith(Math.PI);
    expect(context.rotate).toHaveBeenCalledWith(-Math.PI);
  });

  it("renders wedge sweeps from the configured wedge angle", async () => {
    const project = createProjectDocument("Wedge Render");
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "wedge";
    project.layout.wedgeAngle = 180;
    project.layout.wedgeJitter = 0;
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

    expect(context.arc).toHaveBeenCalled();
    const [, , , startAngle, endAngle] = context.arc.mock.calls[0]!;
    expect(startAngle).toBe(-Math.PI / 2);
    expect(endAngle).toBe(Math.PI / 2);
  });

  it("renders a full-circle wedge cleanly at 360 degrees", async () => {
    const project = createProjectDocument("Wedge Full Circle Render");
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "wedge";
    project.layout.wedgeAngle = 360;
    project.layout.wedgeJitter = 0;
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

    expect(context.moveTo).not.toHaveBeenCalled();
    expect(context.arc).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      0,
      Math.PI * 2,
    );
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

  it("renders kaleidoscope clones from a frozen source canvas with configured transforms", async () => {
    const project = createProjectDocument("Kaleidoscope Render");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 3;
    project.effects.kaleidoscopeCenterX = 0.25;
    project.effects.kaleidoscopeCenterY = 0.75;
    project.effects.kaleidoscopeAngleOffset = 15;
    project.effects.kaleidoscopeMirrorMode = "alternate";
    project.effects.kaleidoscopeRotationDrift = 10;
    project.effects.kaleidoscopeScaleFalloff = 0.4;
    project.effects.kaleidoscopeOpacity = 0.35;

    const context = createMockContext();
    const sourceContext = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;
    const sourceCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => sourceContext),
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(sourceCanvas as never);

    try {
      await renderProjectToCanvas(project, [], new Map(), canvas);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(sourceCanvas.width).toBe(project.canvas.width);
    expect(sourceCanvas.height).toBe(project.canvas.height);
    expect(sourceContext.drawImage).not.toHaveBeenCalledWith(canvas, 0, 0);
    expect(context.drawImage).toHaveBeenNthCalledWith(1, sourceCanvas, 0, 0);
    expect(context.drawImage).toHaveBeenNthCalledWith(2, sourceCanvas, 0, 0);
    expect(context.translate).toHaveBeenCalledWith(
      project.canvas.width * 0.25,
      project.canvas.height * 0.75,
    );
    expect(context.rotate.mock.calls[0]?.[0]).toBeCloseTo(
      (Math.PI * 2) / 3 + (25 * Math.PI) / 180,
      10,
    );
    expect(context.rotate.mock.calls[1]?.[0]).toBeCloseTo(
      (Math.PI * 4) / 3 + (35 * Math.PI) / 180,
      10,
    );
    expect(context.scale).toHaveBeenNthCalledWith(1, 0.8, 0.8);
    expect(context.scale).toHaveBeenNthCalledWith(2, -0.6, 0.6);
  });

  it("applies the configured blend mode during kaleidoscope overlay draws", async () => {
    const project = createProjectDocument("Kaleidoscope Blend Mode");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 3;
    project.effects.kaleidoscopeOpacity = 0.5;
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.compositing.blendMode = "multiply";
    project.compositing.overlap = 0;
    project.compositing.shadow = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;

    const context = createMockContext();
    const sourceContext = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;
    const sourceCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => sourceContext),
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(sourceCanvas as never);

    try {
      await renderProjectToCanvas(
        project,
        [asset],
        new Map([[asset.id, { asset, bitmap: {} as ImageBitmap }]]),
        canvas,
      );
    } finally {
      createElementSpy.mockRestore();
    }

    expect(context.globalCompositeOperationAssignments).toContain("multiply");
    expect(context.drawImageCompositeOperations.at(-1)).toBe("multiply");
    expect(context.drawImageCompositeOperations.at(-2)).toBe("multiply");
    expect(sourceContext.drawImageCompositeOperations).toEqual(["multiply"]);
  });

  it("keeps non-kaleidoscope rendering on the slice blend mode path", async () => {
    const project = createProjectDocument("Slice Blend Mode");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.compositing.blendMode = "multiply";
    project.compositing.overlap = 0;
    project.compositing.shadow = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;

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

    expect(context.drawImageCompositeOperations).toEqual(["multiply"]);
  });

  it("uses the configured kaleidoscope mirror mode when scaling clones", async () => {
    const project = createProjectDocument("Kaleidoscope Mirror Mode");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 3;
    project.effects.kaleidoscopeMirrorMode = "mirror-all";

    const context = createMockContext();
    const sourceContext = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;
    const sourceCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => sourceContext),
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(sourceCanvas as never);

    try {
      await renderProjectToCanvas(project, [], new Map(), canvas);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(context.scale).toHaveBeenNthCalledWith(1, -1, 1);
    expect(context.scale).toHaveBeenNthCalledWith(2, -1, 1);
  });

  it("does not wipe the canvas background when kaleidoscope opacity is 100%", async () => {
    const project = createProjectDocument("Kaleidoscope Opaque");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 3;
    project.effects.kaleidoscopeOpacity = 1;
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.compositing.overlap = 0;
    project.compositing.shadow = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;

    const context = createMockContext();
    const sourceContext = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;
    const sourceCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => sourceContext),
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(sourceCanvas as never);

    try {
      await renderProjectToCanvas(
        project,
        [asset],
        new Map([[asset.id, { asset, bitmap: {} as ImageBitmap }]]),
        canvas,
      );
    } finally {
      createElementSpy.mockRestore();
    }

    expect(sourceContext.fillRect).not.toHaveBeenCalled();
    expect(sourceContext.drawImage).toHaveBeenCalled();
    expect(context.globalAlpha).toBe(1);
  });

  it("keeps single-image distributed strips on the full canvas image placement", async () => {
    const project = createProjectDocument("Distributed Strips");
    project.layout.family = "strips";
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 14;
    project.layout.symmetryMode = "none";
    project.layout.shapeMode = "rect";
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.sourceMapping.strategy = "sequential";
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

    expect(context.drawImage).toHaveBeenCalledTimes(4);
    for (const call of context.drawImage.mock.calls) {
      expect(call[1]).toBe(0);
      expect(call[2]).toBe(0);
      expect(call[3]).toBe(100);
      expect(call[4]).toBe(100);
      expect(call[5]).toBe(project.canvas.inset);
      expect(call[6]).toBe(project.canvas.inset);
      expect(call[7]).toBe(project.canvas.width - project.canvas.inset * 2);
      expect(call[8]).toBe(project.canvas.height - project.canvas.inset * 2);
    }
  });

  it("renders horizontal strips from the strip angle control without rotating source crops", async () => {
    const project = createProjectDocument("Horizontal Strips");
    project.layout.family = "strips";
    project.layout.stripAngle = 90;
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 0;
    project.layout.symmetryMode = "none";
    project.layout.shapeMode = "rect";
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.sourceMapping.strategy = "sequential";
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

    for (const call of context.drawImage.mock.calls) {
      expect(call[1]).toBe(0);
      expect(call[2]).toBe(0);
      expect(call[3]).toBe(100);
      expect(call[4]).toBe(100);
      expect(call[5]).toBe(project.canvas.inset);
      expect(call[6]).toBe(project.canvas.inset);
      expect(call[7]).toBe(project.canvas.width - project.canvas.inset * 2);
      expect(call[8]).toBe(project.canvas.height - project.canvas.inset * 2);
    }
    expect(context.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(context.rotate).toHaveBeenCalledWith(-Math.PI / 2);
  });

  it("keeps full-canvas source placement for intermediate strip angles", async () => {
    const project = createProjectDocument("Diagonal Strips");
    project.layout.family = "strips";
    project.layout.stripAngle = 135;
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 24;
    project.layout.symmetryMode = "none";
    project.layout.shapeMode = "rect";
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.sourceMapping.strategy = "sequential";
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
    for (const call of context.drawImage.mock.calls) {
      expect(call[1]).toBe(0);
      expect(call[2]).toBe(0);
      expect(call[3]).toBe(100);
      expect(call[4]).toBe(100);
      expect(call[5]).toBe(project.canvas.inset);
      expect(call[6]).toBe(project.canvas.inset);
      expect(call[7]).toBe(project.canvas.width - project.canvas.inset * 2);
      expect(call[8]).toBe(project.canvas.height - project.canvas.inset * 2);
    }
    expect(context.rotate).toHaveBeenCalledWith((135 * Math.PI) / 180);
    expect(context.rotate).toHaveBeenCalledWith((-135 * Math.PI) / 180);
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
