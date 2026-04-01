import { describe, expect, it } from "vitest";

import { createImportCopy } from "@/lib/serializer";
import type { ImportedProjectBundle } from "@/types/project";

const bundle: ImportedProjectBundle = {
  manifest: {
    version: 1,
    projectId: "project_original",
    exportedAt: "2026-03-31T00:00:00.000Z",
    assetIds: ["asset_original"],
    versionIds: ["version_original"],
  },
  projectDoc: {
    id: "project_original",
    title: "Original",
    currentVersionId: "version_original",
    deletedAt: null,
    createdAt: "2026-03-31T00:00:00.000Z",
    updatedAt: "2026-03-31T00:00:00.000Z",
    sourceIds: ["asset_original"],
    canvas: { width: 100, height: 100, background: "#000000", inset: 0 },
    layout: {
      family: "grid",
      shapeMode: "rect",
      density: 0.5,
      columns: 2,
      rows: 2,
      gutter: 0,
      blockDepth: 1,
      stripOrientation: "horizontal",
      radialSegments: 4,
      radialRings: 2,
      symmetryMode: "none",
      symmetryCopies: 2,
      randomness: 0.1,
    },
    sourceMapping: {
      strategy: "random",
      sourceBias: 0.5,
      preserveAspect: true,
      cropZoom: 1,
      luminanceSort: "ascending",
      paletteEmphasis: 0.5,
    },
    effects: {
      blur: 0,
      sharpen: 0,
      mirror: false,
      kaleidoscopeSegments: 1,
      rotationJitter: 0,
      scaleJitter: 0,
      displacement: 0,
      distortion: 0,
    },
    compositing: {
      blendMode: "source-over",
      opacity: 1,
      overlap: 0,
      shadow: 0,
      feather: 0,
    },
    export: {
      format: "image/png",
      quality: 1,
      width: 100,
      height: 100,
      scale: 1,
    },
    activeSeed: 1,
    presets: [],
    passes: [],
  },
  versionDocs: [
    {
      id: "version_original",
      projectId: "project_original",
      label: "Version 1",
      createdAt: "2026-03-31T00:00:00.000Z",
      thumbnailPath: "versions/version_original.webp",
      snapshot: {
        sourceIds: ["asset_original"],
        canvas: { width: 100, height: 100, background: "#000000", inset: 0 },
        layout: {
          family: "grid",
          shapeMode: "rect",
          density: 0.5,
          columns: 2,
          rows: 2,
          gutter: 0,
          blockDepth: 1,
          stripOrientation: "horizontal",
          radialSegments: 4,
          radialRings: 2,
          symmetryMode: "none",
          symmetryCopies: 2,
          randomness: 0.1,
        },
        sourceMapping: {
          strategy: "random",
          sourceBias: 0.5,
          preserveAspect: true,
          cropZoom: 1,
          luminanceSort: "ascending",
          paletteEmphasis: 0.5,
        },
        effects: {
          blur: 0,
          sharpen: 0,
          mirror: false,
          kaleidoscopeSegments: 1,
          rotationJitter: 0,
          scaleJitter: 0,
          displacement: 0,
          distortion: 0,
        },
        compositing: {
          blendMode: "source-over",
          opacity: 1,
          overlap: 0,
          shadow: 0,
          feather: 0,
        },
        export: {
          format: "image/png",
          quality: 1,
          width: 100,
          height: 100,
          scale: 1,
        },
        activeSeed: 1,
        presets: [],
        passes: [],
      },
    },
  ],
  assetDocs: [
    {
      id: "asset_original",
      projectId: "project_original",
      name: "Original",
      originalFileName: "original.png",
      mimeType: "image/png",
      width: 100,
      height: 100,
      orientation: 1,
      originalPath: "assets/original/asset_original.png",
      normalizedPath: "assets/normalized/asset_original.png",
      previewPath: "assets/previews/asset_original.webp",
      averageColor: "#123456",
      palette: ["#123456"],
      luminance: 0.4,
      createdAt: "2026-03-31T00:00:00.000Z",
    },
  ],
  assetBlobs: {
    "assets/original/asset_original.png": new Blob(["original"]),
    "assets/normalized/asset_original.png": new Blob(["normalized"]),
    "assets/previews/asset_original.webp": new Blob(["preview"]),
  },
  versionBlobs: {
    "versions/version_original.webp": new Blob(["thumb"]),
  },
};

describe("createImportCopy", () => {
  it("remaps project, asset, version, and blob identifiers", () => {
    const copy = createImportCopy(bundle);

    expect(copy.projectDoc.id).not.toBe(bundle.projectDoc.id);
    expect(copy.projectDoc.title).toBe("Original Copy");
    expect(copy.projectDoc.deletedAt).toBeNull();
    expect(copy.assetDocs[0]?.projectId).toBe(copy.projectDoc.id);
    expect(copy.assetDocs[0]?.id).not.toBe(bundle.assetDocs[0]?.id);
    expect(copy.projectDoc.sourceIds).toEqual([copy.assetDocs[0]?.id]);
    expect(copy.versionDocs[0]?.id).not.toBe(bundle.versionDocs[0]?.id);
    expect(copy.versionDocs[0]?.projectId).toBe(copy.projectDoc.id);
    expect(copy.versionDocs[0]?.snapshot.sourceIds).toEqual([copy.assetDocs[0]?.id]);
    expect(copy.projectDoc.currentVersionId).toBe(copy.versionDocs[0]?.id);
    expect(Object.keys(copy.assetBlobs)).toEqual([
      copy.assetDocs[0]?.originalPath,
      copy.assetDocs[0]?.normalizedPath,
      copy.assetDocs[0]?.previewPath,
    ]);
    expect(Object.keys(copy.versionBlobs)).toEqual([copy.versionDocs[0]?.thumbnailPath]);
  });
});
