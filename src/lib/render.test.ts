import { describe, expect, it, vi } from "vitest";

import { createProjectDocument } from "@/lib/project-defaults";
import { exportProjectImage, renderProjectToCanvas } from "@/lib/render";

function createMockContext() {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
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
