import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { createImportCopy, loadProjectBundle } from "@/lib/serializer";
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
    canvas: {
      width: 100,
      height: 100,
      background: "#000000",
      backgroundAlpha: 0,
      inset: 0,
    },
    layout: {
      family: "grid",
      shapeMode: "rect",
      rectCornerRadius: 0,
      density: 0.5,
      stripAngle: 0,
      columns: 2,
      rows: 2,
      gutter: 0,
      blockDepth: 1,
      blockSplitRandomness: 0.5,
      blockMinSize: 140,
      blockSplitBias: 0.5,
      stripOrientation: "horizontal",
      radialSegments: 4,
      radialRings: 2,
      radialAngleOffset: 0,
      radialRingPhaseStep: 0,
      radialInnerRadius: 0,
      radialChildRotationMode: "tangent",
      symmetryMode: "none",
      symmetryCopies: 2,
      hidePercentage: 0,
      letterbox: 0,
      wedgeAngle: 120,
      wedgeJitter: 0,
      randomness: 0.1,
    },
    sourceMapping: {
      strategy: "random",
      sourceBias: 0.5,
      preserveAspect: true,
      cropDistribution: "distributed",
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
        canvas: {
          width: 100,
          height: 100,
          background: "#000000",
          backgroundAlpha: 0,
          inset: 0,
        },
        layout: {
          family: "grid",
          shapeMode: "rect",
          rectCornerRadius: 0,
          density: 0.5,
          stripAngle: 0,
          columns: 2,
          rows: 2,
          gutter: 0,
          blockDepth: 1,
          blockSplitRandomness: 0.5,
          blockMinSize: 140,
          blockSplitBias: 0.5,
          stripOrientation: "horizontal",
          radialSegments: 4,
          radialRings: 2,
          radialAngleOffset: 0,
          radialRingPhaseStep: 0,
          radialInnerRadius: 0,
          radialChildRotationMode: "tangent",
          symmetryMode: "none",
          symmetryCopies: 2,
          hidePercentage: 0,
          letterbox: 0,
          wedgeAngle: 120,
          wedgeJitter: 0,
          randomness: 0.1,
        },
        sourceMapping: {
          strategy: "random",
          sourceBias: 0.5,
          preserveAspect: true,
          cropDistribution: "distributed",
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
      kind: "image",
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

  it("preserves generated source metadata when copying imported bundles", () => {
    const generatedBundle: ImportedProjectBundle = {
      ...bundle,
      assetDocs: [
        {
          ...bundle.assetDocs[0]!,
          id: "asset_gradient",
          kind: "gradient",
          name: "Gradient One",
          recipe: {
            from: "#112233",
            to: "#ffaa00",
            direction: "vertical",
          },
        },
      ],
      manifest: {
        ...bundle.manifest,
        assetIds: ["asset_gradient"],
      },
      projectDoc: {
        ...bundle.projectDoc,
        sourceIds: ["asset_gradient"],
      },
      versionDocs: [
        {
          ...bundle.versionDocs[0]!,
          snapshot: {
            ...bundle.versionDocs[0]!.snapshot,
            sourceIds: ["asset_gradient"],
          },
        },
      ],
      assetBlobs: {},
    };

    generatedBundle.assetBlobs = {
      [generatedBundle.assetDocs[0]!.originalPath]: new Blob(["original"]),
      [generatedBundle.assetDocs[0]!.normalizedPath]: new Blob(["normalized"]),
      [generatedBundle.assetDocs[0]!.previewPath]: new Blob(["preview"]),
    };

    const copy = createImportCopy(generatedBundle);

    expect(copy.assetDocs[0]?.kind).toBe("gradient");
    const copiedAsset = copy.assetDocs[0];
    if (!copiedAsset || copiedAsset.kind !== "gradient") {
      throw new Error("Expected copied generated source metadata.");
    }
    expect(copiedAsset.recipe).toEqual({
      from: "#112233",
      to: "#ffaa00",
      direction: "vertical",
    });
    expect(copy.projectDoc.sourceIds).toEqual([copy.assetDocs[0]?.id]);
  });
});

describe("loadProjectBundle", () => {
  it("normalizes legacy bundles without crop distribution to centered mode", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify(bundle.manifest));
    zip.file(
      "project.json",
      JSON.stringify({
        ...bundle.projectDoc,
        sourceMapping: {
          strategy: "random",
          sourceBias: 0.5,
          preserveAspect: true,
          cropZoom: 1,
          luminanceSort: "ascending",
          paletteEmphasis: 0.5,
        },
      }),
    );
    zip.file(
      "versions.json",
      JSON.stringify([
        {
          ...bundle.versionDocs[0],
          snapshot: {
            ...bundle.versionDocs[0]?.snapshot,
            sourceMapping: {
              strategy: "random",
              sourceBias: 0.5,
              preserveAspect: true,
              cropZoom: 1,
              luminanceSort: "ascending",
              paletteEmphasis: 0.5,
            },
          },
        },
      ]),
    );
    zip.file("assets.json", JSON.stringify(bundle.assetDocs));
    for (const [path, blob] of Object.entries(bundle.assetBlobs)) {
      zip.file(path, blob);
    }
    for (const [path, blob] of Object.entries(bundle.versionBlobs)) {
      zip.file(path, blob);
    }

    const loaded = await loadProjectBundle(await zip.generateAsync({ type: "blob" }));

    expect(loaded.projectDoc.sourceMapping.cropDistribution).toBe("center");
    expect(loaded.versionDocs[0]?.snapshot.sourceMapping.cropDistribution).toBe("center");
  });

  it("normalizes legacy assets without kind to image sources", async () => {
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify(bundle.manifest));
    zip.file("project.json", JSON.stringify(bundle.projectDoc));
    zip.file("versions.json", JSON.stringify(bundle.versionDocs));
    zip.file(
      "assets.json",
      JSON.stringify([
        {
          ...bundle.assetDocs[0],
          kind: undefined,
        },
      ]),
    );
    for (const [path, blob] of Object.entries(bundle.assetBlobs)) {
      zip.file(path, blob);
    }
    for (const [path, blob] of Object.entries(bundle.versionBlobs)) {
      zip.file(path, blob);
    }

    const loaded = await loadProjectBundle(await zip.generateAsync({ type: "blob" }));

    expect(loaded.assetDocs[0]?.kind).toBe("image");
  });
});
