import { describe, expect, it, vi } from "vitest";

import {
  createProjectDocument,
  getSelectedLayer,
  normalizeLayoutSettings,
  normalizeProjectDocument,
  normalizeProjectSnapshot,
} from "@/lib/project-defaults";
import { createProjectEditorView } from "@/lib/project-editor-view";
import {
  exportProjectImage,
  renderProjectLayerToCanvas,
  renderProjectToCanvas,
} from "@/lib/render";
import { buildBitmapMap } from "@/lib/render";
import type { SourceAsset } from "@/types/project";

function createProjectView(title: string) {
  const project = createProjectEditorView(createProjectDocument(title));
  project.sourceIds = [asset.id];
  if (project.layers[0]) {
    project.layers[0].sourceIds = [asset.id];
  }
  return project;
}

function createMockContext() {
  const drawImageCompositeOperations: string[] = [];
  const globalCompositeOperationAssignments: string[] = [];
  const globalAlphaAssignments: number[] = [];
  const filterAssignments: string[] = [];
  const shadowColorAssignments: string[] = [];
  const shadowBlurAssignments: number[] = [];
  const shadowOffsetXAssignments: number[] = [];
  const shadowOffsetYAssignments: number[] = [];
  let globalCompositeOperation = "source-over";
  let filter = "";
  let shadowColor = "";
  let shadowBlur = 0;
  let shadowOffsetX = 0;
  let shadowOffsetY = 0;
  let globalAlpha = 1;
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
    fillText: vi.fn(),
    clearRect: vi.fn(),
    rect: vi.fn(),
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    measureText: vi.fn((text: string) => ({
      width: Math.max(text.length, 1) * 120,
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
    globalAlphaAssignments,
    lineWidth: 1,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
    filterAssignments,
    shadowColorAssignments,
    shadowBlurAssignments,
    shadowOffsetXAssignments,
    shadowOffsetYAssignments,
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

  Object.defineProperty(context, "filter", {
    get() {
      return filter;
    },
    set(value: string) {
      filter = value;
      filterAssignments.push(value);
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(context, "globalAlpha", {
    get() {
      return globalAlpha;
    },
    set(value: number) {
      globalAlpha = value;
      globalAlphaAssignments.push(value);
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(context, "shadowColor", {
    get() {
      return shadowColor;
    },
    set(value: string) {
      shadowColor = value;
      shadowColorAssignments.push(value);
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(context, "shadowBlur", {
    get() {
      return shadowBlur;
    },
    set(value: number) {
      shadowBlur = value;
      shadowBlurAssignments.push(value);
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(context, "shadowOffsetX", {
    get() {
      return shadowOffsetX;
    },
    set(value: number) {
      shadowOffsetX = value;
      shadowOffsetXAssignments.push(value);
    },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(context, "shadowOffsetY", {
    get() {
      return shadowOffsetY;
    },
    set(value: number) {
      shadowOffsetY = value;
      shadowOffsetYAssignments.push(value);
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

async function renderNoiseOutput(options: {
  width: number;
  height: number;
  pixels: number[];
  noise: number;
  noiseMonochrome: number;
  activeSeed?: number;
  layerId?: string;
}) {
  const {
    width,
    height,
    pixels,
    noise,
    noiseMonochrome,
    activeSeed = 187310,
    layerId = "layer_noise",
  } = options;
  const project = createProjectView("Noise Render");
  project.canvas.width = width;
  project.canvas.height = height;
  project.effects.sharpen = 0;
  project.effects.kaleidoscopeSegments = 1;
  project.finish.noise = noise;
  project.finish.noiseMonochrome = noiseMonochrome;
  project.layers[0]!.finish.noise = noise;
  project.layers[0]!.finish.noiseMonochrome = noiseMonochrome;
  project.activeSeed = activeSeed;
  project.layers[0]!.activeSeed = activeSeed;
  project.layers[0]!.id = layerId;

  const context = createMockContext();
  const layerContext = createMockContext();
  layerContext.getImageData.mockImplementation(() => ({
    data: new Uint8ClampedArray(pixels),
    width,
    height,
  }) as ImageData);
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
  } as unknown as HTMLCanvasElement;
  const layerCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => layerContext),
  } as unknown as HTMLCanvasElement;
  const createElementSpy = vi
    .spyOn(document, "createElement")
    .mockReturnValueOnce(layerCanvas as never);

  try {
    await renderProjectToCanvas(project, [], new Map(), canvas);
  } finally {
    createElementSpy.mockRestore();
  }

  const putImageDataCall = layerContext.putImageData.mock.calls.at(-1);
  expect(putImageDataCall).toBeDefined();

  const imageData = putImageDataCall?.[0] as ImageData;
  return Array.from(imageData.data);
}

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

  it("renders plain-text words layers without any source assets", async () => {
    const project = createProjectView("Words Plain");
    project.layout.family = "words";
    project.words.mode = "plain-text";
    project.words.text = "HELLO\nWORLD";
    project.words.fontFamily = "jetbrains-mono";
    project.words.textColor = "#224466";
    project.layers[0]!.layout.family = "words";
    project.layers[0]!.words = structuredClone(project.words);

    const mainContext = createMockContext();
    const createdContexts: ReturnType<typeof createMockContext>[] = [];
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mainContext),
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation(((
      _tagName: string,
    ) => {
      const context = createMockContext();
      createdContexts.push(context);
      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => context),
      } as unknown as HTMLCanvasElement;
    }) as never);

    try {
      await renderProjectToCanvas(project, [], new Map(), canvas);
    } finally {
      createElementSpy.mockRestore();
    }

    expect(createdContexts.some((context) => context.fillText.mock.calls.length > 0)).toBe(true);
    expect(mainContext.drawImage).toHaveBeenCalled();
  });

  it("renders image-filled words layers by masking source imagery into the text block", async () => {
    const project = createProjectView("Words Fill");
    project.sourceIds = [asset.id];
    project.layout.family = "words";
    project.words.mode = "image-fill";
    project.words.text = "MASK";
    project.layers[0]!.sourceIds = [asset.id];
    project.layers[0]!.layout.family = "words";
    project.layers[0]!.words = structuredClone(project.words);

    const mainContext = createMockContext();
    const createdContexts: ReturnType<typeof createMockContext>[] = [];
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mainContext),
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation(((
      _tagName: string,
    ) => {
      const context = createMockContext();
      createdContexts.push(context);
      return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => context),
      } as unknown as HTMLCanvasElement;
    }) as never);

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

    expect(
      createdContexts.some((context) =>
        context.globalCompositeOperationAssignments.includes("destination-in"),
      ),
    ).toBe(true);
    expect(mainContext.drawImage).toHaveBeenCalled();
  });

  it("defaults missing rect corner radius values to zero during normalization", () => {
    const project = createProjectView("Normalize Radius");
    const snapshot = structuredClone(project);

    delete (project.layout as Partial<typeof project.layout>).rectCornerRadius;
    delete (snapshot.layout as Partial<typeof snapshot.layout>).rectCornerRadius;

    expect(createProjectEditorView(normalizeProjectDocument(project)).layout.rectCornerRadius).toBe(0);
    expect(getSelectedLayer(normalizeProjectSnapshot(snapshot))?.layout.rectCornerRadius).toBe(0);
    expect(normalizeLayoutSettings(undefined).rectCornerRadius).toBe(0);
  });

  it("creates new projects with a square rect corner radius default", () => {
    const project = createProjectView("Square Default");

    expect(project.layout.rectCornerRadius).toBe(0);
  });

  it("renders a single layer without compositing the full stack", async () => {
    const project = createProjectView("Single Layer");
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layers[0]!.sourceIds = [asset.id];
    project.layers.push({
      ...structuredClone(project.layers[0]!),
      id: "layer_above",
      name: "Above",
      compositing: {
        ...project.layers[0]!.compositing,
        blendMode: "multiply",
      },
    });

    const context = createMockContext();
    const canvas = document.createElement("canvas");
    canvas.width = project.canvas.width;
    canvas.height = project.canvas.height;
    vi.spyOn(canvas, "getContext").mockReturnValue(context as never);

    await renderProjectLayerToCanvas(
      project,
      project.layers[0]!,
      [asset],
      new Map([[asset.id, { asset, bitmap: {} as ImageBitmap }]]),
      canvas,
    );

    expect(context.drawImage).toHaveBeenCalled();
    expect(context.globalCompositeOperationAssignments).not.toContain("multiply");
  });

  it("clears the target canvas when rendering a transparent layer preview", async () => {
    const project = createProjectView("Transparent Layer");
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layers[0]!.sourceIds = [asset.id];

    const context = createMockContext();
    const canvas = document.createElement("canvas");
    canvas.width = project.canvas.width;
    canvas.height = project.canvas.height;
    vi.spyOn(canvas, "getContext").mockReturnValue(context as never);

    await renderProjectLayerToCanvas(
      project,
      project.layers[0]!,
      [asset],
      new Map([[asset.id, { asset, bitmap: {} as ImageBitmap }]]),
      canvas,
      { includeBackground: false },
    );

    expect(context.clearRect).toHaveBeenCalledWith(
      0,
      0,
      project.canvas.width,
      project.canvas.height,
    );
    expect(context.fillRect).not.toHaveBeenCalled();
  });

  it("keeps a layer blank when it has no enabled sources", async () => {
    const project = createProjectView("Blank Layer");
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.sourceIds = [];
    project.layers[0]!.sourceIds = [];

    const context = createMockContext();
    const canvas = document.createElement("canvas");
    canvas.width = project.canvas.width;
    canvas.height = project.canvas.height;
    vi.spyOn(canvas, "getContext").mockReturnValue(context as never);

    await renderProjectLayerToCanvas(
      project,
      project.layers[0]!,
      [asset],
      new Map([[asset.id, { asset, bitmap: {} as ImageBitmap }]]),
      canvas,
      { includeBackground: false },
    );

    expect(context.clearRect).toHaveBeenCalledWith(
      0,
      0,
      project.canvas.width,
      project.canvas.height,
    );
    expect(context.drawImage).not.toHaveBeenCalled();
  });

  it("preserves layer compositing and finish settings in isolated layer previews", async () => {
    const project = createProjectView("Layer Finish");
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layers[0]!.sourceIds = [asset.id];
    project.layers[0]!.compositing.blendMode = "multiply";
    project.layers[0]!.compositing.opacity = 0.45;
    project.layers[0]!.finish.shadowOpacity = 0.6;
    project.layers[0]!.finish.shadowBlur = 12;
    project.layers[0]!.finish.shadowOffsetX = 4;
    project.layers[0]!.finish.shadowOffsetY = -3;
    project.compositing = structuredClone(project.layers[0]!.compositing);
    project.finish = structuredClone(project.layers[0]!.finish);

    const targetContext = createMockContext();
    const layerContext = createMockContext();
    const queuedContexts = [targetContext, layerContext];
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(() => (queuedContexts.shift() ?? layerContext) as never);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = project.canvas.width;
      canvas.height = project.canvas.height;

      await renderProjectLayerToCanvas(
        project,
        project.layers[0]!,
        [asset],
        new Map([[asset.id, { asset, bitmap: {} as ImageBitmap }]]),
        canvas,
        { includeBackground: false },
      );
    } finally {
      getContextSpy.mockRestore();
    }

    expect(targetContext.globalCompositeOperationAssignments).toContain("multiply");
    expect(targetContext.globalAlphaAssignments).toContain(0.45);
    expect(targetContext.shadowBlurAssignments).toContain(12);
    expect(targetContext.shadowOffsetXAssignments).toContain(4);
    expect(targetContext.shadowOffsetYAssignments).toContain(-3);
  });

  it("uses the configured rect corner radius scale", async () => {
    const project = createProjectView("Rect Radius");
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
    const project = createProjectView("Triangle Radius");
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
    const project = createProjectView("Organic Render");
    project.layout.family = "organic";
    project.layout.shapeMode = "blob";
    project.layout.density = 0.05;
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
    expect(context.arc).not.toHaveBeenCalled();
    expect(context.moveTo).toHaveBeenCalled();
    expect(context.lineTo.mock.calls.length).toBeGreaterThan(10);
  });

  it("warps 3d slices through projected card quads", async () => {
    const project = createProjectView("3D Warp Render");
    project.layout.family = "3d";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.canvas.backgroundAlpha = 1;
    project.compositing.overlap = 0;
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
    expect(surfaceContext.fillRect).toHaveBeenCalled();
  });

  it("renders interlock slices as rotated triangle paths clipped to the inset area", async () => {
    const project = createProjectView("Interlock Render");
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 1;
    project.layout.shapeMode = "interlock";
    project.layout.gutter = 0;
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
    const project = createProjectView("Wedge Render");
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

  it("uses the hollow ratio for ring geometry", async () => {
    const project = createProjectView("Ring Hollow Ratio");
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "ring";
    project.layout.hollowRatio = 0.8;
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

    expect(context.arc).toHaveBeenCalledTimes(2);
    const [outerCall, innerCall] = context.arc.mock.calls;
    expect(innerCall?.[2]).toBeCloseTo((outerCall?.[2] as number) * 0.8, 6);
  });

  it("renders arc geometry as a hollow open sweep", async () => {
    const project = createProjectView("Arc Render");
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "arc";
    project.layout.wedgeAngle = 210;
    project.layout.wedgeJitter = 0;
    project.layout.hollowRatio = 0.7;
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

    expect(context.arc).toHaveBeenCalledTimes(2);
    expect(context.lineTo).toHaveBeenCalled();
    const [outerCall, innerCall] = context.arc.mock.calls;
    expect((outerCall?.[4] as number) - (outerCall?.[3] as number)).toBeCloseTo(
      (210 * Math.PI) / 180,
      6,
    );
    expect(innerCall?.[5]).toBe(true);
  });

  it("renders a full-circle wedge cleanly at 360 degrees", async () => {
    const project = createProjectView("Wedge Full Circle Render");
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
    const project = createProjectView("Transparent Export");
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
    const project = createProjectView("Opaque Render");
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
    const project = createProjectView("Centered Crop");
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
    const project = createProjectView("Distributed Crop");
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
    const project = createProjectView("Kaleidoscope Render");
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

  it("applies the configured blend mode when compositing kaleidoscope layers", async () => {
    const project = createProjectView("Kaleidoscope Blend Mode");
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
      .mockReturnValueOnce(sourceCanvas as never);

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
    expect(context.drawImageCompositeOperations.length).toBeGreaterThan(1);
    expect(context.drawImageCompositeOperations.every((mode) => mode === "multiply")).toBe(true);
    expect(sourceContext.drawImageCompositeOperations).toEqual(["multiply"]);
  });

  it("renders non-kaleidoscope multiply layers on the direct path below full opacity", async () => {
    const project = createProjectView("Slice Blend Mode");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.compositing.blendMode = "multiply";
    project.compositing.opacity = 0.42;
    project.compositing.overlap = 0;
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
    const createElementSpy = vi.spyOn(document, "createElement");

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

    expect(createElementSpy).not.toHaveBeenCalled();
    expect(context.drawImageCompositeOperations).toEqual(["multiply"]);
    expect(context.globalAlphaAssignments).toContain(0.42);
  });

  it("keeps per-slice blend mode for overlapping slices below full opacity", async () => {
    const project = createProjectView("Overlap Blend Mode");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.compositing.blendMode = "multiply";
    project.compositing.opacity = 0.58;
    project.compositing.overlap = 1;
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
    const createElementSpy = vi.spyOn(document, "createElement");

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

    expect(createElementSpy).not.toHaveBeenCalled();
    expect(context.drawImageCompositeOperations.length).toBeGreaterThan(1);
    expect(context.drawImageCompositeOperations.every((mode) => mode === "multiply")).toBe(true);
    expect(context.globalAlphaAssignments).toContain(0.58);
  });

  it("keeps default finish layers on the direct render path", async () => {
    const project = createProjectView("Direct Finish Path");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.compositing.overlap = 0;
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
    const createElementSpy = vi.spyOn(document, "createElement");

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

    expect(createElementSpy).not.toHaveBeenCalled();
  });

  it("routes sharpened layers through the offscreen compositing path", async () => {
    const project = createProjectView("Sharpen Offscreen");
    project.canvas.width = 3;
    project.canvas.height = 3;
    project.effects.sharpen = 0.35;
    project.effects.kaleidoscopeSegments = 1;
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;

    const context = createMockContext();
    const layerContext = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;
    const layerCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => layerContext),
    } as unknown as HTMLCanvasElement;
    const sharpenPixels = new Uint8ClampedArray(project.canvas.width * project.canvas.height * 4);
    layerContext.getImageData.mockImplementation(() => ({
      data: sharpenPixels,
      width: project.canvas.width,
      height: project.canvas.height,
    }) as ImageData);
    layerContext.createImageData.mockImplementation((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }) as ImageData);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(layerCanvas as never);

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

    expect(layerContext.drawImage).toHaveBeenCalled();
    expect(context.drawImage).toHaveBeenCalledWith(layerCanvas, 0, 0);
  });

  it("routes noise-only finish layers through the offscreen compositing path", async () => {
    const output = await renderNoiseOutput({
      width: 2,
      height: 1,
      pixels: [100, 120, 140, 255, 100, 120, 140, 255],
      noise: 0.35,
      noiseMonochrome: 0,
      activeSeed: 2026,
      layerId: "layer_offscreen",
    });

    expect(output).not.toEqual([100, 120, 140, 255, 100, 120, 140, 255]);
  });

  it("applies finish noise deterministically for identical layer seed and id", async () => {
    const first = await renderNoiseOutput({
      width: 1,
      height: 1,
      pixels: [120, 100, 80, 255],
      noise: 0.5,
      noiseMonochrome: 0.25,
      activeSeed: 4242,
      layerId: "layer_deterministic",
    });
    const second = await renderNoiseOutput({
      width: 1,
      height: 1,
      pixels: [120, 100, 80, 255],
      noise: 0.5,
      noiseMonochrome: 0.25,
      activeSeed: 4242,
      layerId: "layer_deterministic",
    });

    expect(second).toEqual(first);
  });

  it("keeps a pixel's noise stable when neighboring alpha coverage changes", async () => {
    const baseline = await renderNoiseOutput({
      width: 2,
      height: 1,
      pixels: [100, 100, 100, 255, 100, 100, 100, 255],
      noise: 0.45,
      noiseMonochrome: 0.2,
      activeSeed: 1234,
      layerId: "layer_stable",
    });
    const neighborChanged = await renderNoiseOutput({
      width: 2,
      height: 1,
      pixels: [100, 100, 100, 255, 100, 100, 100, 0],
      noise: 0.45,
      noiseMonochrome: 0.2,
      activeSeed: 1234,
      layerId: "layer_stable",
    });

    expect(neighborChanged[0]).toBe(baseline[0]);
    expect(neighborChanged[1]).toBe(baseline[1]);
    expect(neighborChanged[2]).toBe(baseline[2]);
  });

  it("scales finish noise intensity with alpha", async () => {
    const opaque = await renderNoiseOutput({
      width: 1,
      height: 1,
      pixels: [120, 120, 120, 255],
      noise: 0.5,
      noiseMonochrome: 0.2,
      activeSeed: 999,
      layerId: "layer_alpha",
    });
    const translucent = await renderNoiseOutput({
      width: 1,
      height: 1,
      pixels: [120, 120, 120, 64],
      noise: 0.5,
      noiseMonochrome: 0.2,
      activeSeed: 999,
      layerId: "layer_alpha",
    });

    const base = 120;
    const opaqueDeltas = [
      Math.abs(opaque[0]! - base),
      Math.abs(opaque[1]! - base),
      Math.abs(opaque[2]! - base),
    ];
    const translucentDeltas = [
      Math.abs(translucent[0]! - base),
      Math.abs(translucent[1]! - base),
      Math.abs(translucent[2]! - base),
    ];
    const opaquePeak = Math.max(...opaqueDeltas);
    const translucentPeak = Math.max(...translucentDeltas);

    expect(opaquePeak).toBeGreaterThan(0);
    expect(translucentPeak).toBeLessThan(opaquePeak);
    expect(translucentPeak).toBeLessThanOrEqual(Math.ceil(opaquePeak * 0.35));
  });

  it("translates layer content by canvas width and height fractions on the direct composite path", async () => {
    const project = createProjectView("Layer Offset Direct");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.offsetX = 0.5;
    project.layout.offsetY = -0.25;
    project.compositing.overlap = 0;
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

    expect(context.translate.mock.calls).toContainEqual([
      project.canvas.width * 0.5,
      project.canvas.height * -0.25,
    ]);
  });

  it("translates layer content on the offscreen composite path", async () => {
    const project = createProjectView("Layer Offset Offscreen");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.offsetX = -0.4;
    project.layout.offsetY = 0.6;
    project.compositing.blendMode = "multiply";
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;

    const context = createMockContext();
    const layerContext = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;
    const layerCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => layerContext),
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(layerCanvas as never);

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

    expect(context.translate.mock.calls).toContainEqual([
      project.canvas.width * -0.4,
      project.canvas.height * 0.6,
    ]);
  });

  it("rotates layer content about the canvas center on the direct composite path", async () => {
    const project = createProjectView("Layer Rotation Direct");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.offsetX = 0;
    project.layout.offsetY = 0;
    project.layout.contentRotation = 127;
    project.compositing.overlap = 0;
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

    const expected = (127 * Math.PI) / 180;
    expect(
      context.rotate.mock.calls.some(
        ([angle]) => typeof angle === "number" && Math.abs(angle - expected) < 1e-9,
      ),
    ).toBe(true);
  });

  it("applies finish color adjustments and drop shadow during layer compositing", async () => {
    const project = createProjectView("Layer Finish");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;
    project.finish.brightness = 1.3;
    project.finish.contrast = 0.85;
    project.finish.saturate = 1.2;
    project.finish.hueRotate = 45;
    project.finish.grayscale = 0.25;
    project.finish.invert = 0.1;
    project.finish.shadowOffsetX = 14;
    project.finish.shadowOffsetY = 20;
    project.finish.shadowBlur = 28;
    project.finish.shadowOpacity = 0.5;

    const context = createMockContext();
    const layerContext = createMockContext();
    const finishContext = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;
    const layerCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => layerContext),
    } as unknown as HTMLCanvasElement;
    const finishCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => finishContext),
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(layerCanvas as never)
      .mockReturnValueOnce(finishCanvas as never);

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

    expect(finishContext.filterAssignments).toContain(
      "brightness(130%) contrast(85%) saturate(120%) hue-rotate(45deg) grayscale(25%) invert(10%)",
    );
    expect(context.shadowColorAssignments).toContain("#180f0880");
    expect(context.shadowBlurAssignments).toContain(28);
    expect(context.shadowOffsetXAssignments).toContain(14);
    expect(context.shadowOffsetYAssignments).toContain(20);
    expect(context.drawImage).toHaveBeenCalledWith(finishCanvas, 0, 0);
  });

  it("preserves blend mode and opacity when finish effects force offscreen compositing", async () => {
    const project = createProjectView("Finish Blend");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 1;
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.compositing.blendMode = "multiply";
    project.compositing.opacity = 0.42;
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.displacement = 0;
    project.effects.distortion = 0;
    project.finish.brightness = 1.1;

    const context = createMockContext();
    const layerContext = createMockContext();
    const finishContext = createMockContext();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;
    const layerCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => layerContext),
    } as unknown as HTMLCanvasElement;
    const finishCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => finishContext),
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValueOnce(layerCanvas as never)
      .mockReturnValueOnce(finishCanvas as never);

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
    expect(context.globalAlphaAssignments).toContain(0.42);
  });

  it("uses the configured kaleidoscope mirror mode when scaling clones", async () => {
    const project = createProjectView("Kaleidoscope Mirror Mode");
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
    const project = createProjectView("Kaleidoscope Opaque");
    project.effects.sharpen = 0;
    project.effects.kaleidoscopeSegments = 3;
    project.effects.kaleidoscopeOpacity = 1;
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "rect";
    project.compositing.overlap = 0;
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
    const project = createProjectView("Distributed Strips");
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
    project.sourceMapping.strategy = "round-robin";
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
    const project = createProjectView("Horizontal Strips");
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
    project.sourceMapping.strategy = "round-robin";
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
    const project = createProjectView("Diagonal Strips");
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
    project.sourceMapping.strategy = "round-robin";
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
    const project = createProjectView("Transparent PNG");
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
    const project = createProjectView("Background Alpha");
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
