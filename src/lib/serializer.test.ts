import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  getSelectedLayer,
  normalizeProjectDocument,
  normalizeProjectSnapshot,
  serializeProjectDocument,
} from "@/lib/project-defaults";
import { createProjectEditorView } from "@/lib/project-editor-view";
import { createImportCopy, loadProjectBundle } from "@/lib/serializer";
import type { ImportedProjectBundle } from "@/types/project";

function getProjectView(project: ImportedProjectBundle["projectDoc"]) {
  return createProjectEditorView(project);
}

function getVersionSnapshotLayer(snapshot: ImportedProjectBundle["versionDocs"][number]["snapshot"]) {
  const layer = getSelectedLayer(snapshot);
  if (!layer) {
    throw new Error("Expected a selected layer.");
  }
  return layer;
}

const bundle: ImportedProjectBundle = {
  manifest: {
    version: 1,
    projectId: "project_original",
    exportedAt: "2026-03-31T00:00:00.000Z",
    assetIds: ["asset_original"],
    versionIds: ["version_original"],
  },
  projectDoc: normalizeProjectDocument({
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
      gutterHorizontal: 0,
      gutterVertical: 0,
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
      symmetryCenterX: 0.5,
      symmetryCenterY: 0.5,
      symmetryAngleOffset: 0,
      symmetryJitter: 0,
      hidePercentage: 0,
      letterbox: 0,
      offsetX: 0,
      offsetY: 0,
      contentRotation: 0,
      wedgeAngle: 120,
      wedgeJitter: 0,
      hollowRatio: 0.48,
      randomness: 0.1,
      organicVariation: 0,
      flowCurvature: 0.44,
      flowCoherence: 0.72,
      flowBranchRate: 0.2,
      flowTaper: 0.34,
      threeDStructure: "sphere",
      threeDDistribution: 0,
      threeDDepth: 0.6,
      threeDCameraDistance: 0.62,
      threeDPanX: 0,
      threeDPanY: 0,
      threeDYaw: 28,
      threeDPitch: -18,
      threeDPerspective: 0.68,
      threeDBillboard: 0.78,
      threeDZJitter: 0.18,
    },
    sourceMapping: {
      strategy: "random",
      sourceWeights: {
        asset_original: 2.25,
      },
      preserveAspect: true,
      cropDistribution: "distributed",
      cropZoom: 1,
      luminanceSort: "ascending",
      paletteEmphasis: 0.5,
    },
    effects: {
      blur: 0,
      sharpen: 0,
      kaleidoscopeSegments: 1,
      kaleidoscopeCenterX: 0.5,
      kaleidoscopeCenterY: 0.5,
      kaleidoscopeAngleOffset: 0,
      kaleidoscopeMirrorMode: "alternate",
      kaleidoscopeRotationDrift: 0,
      kaleidoscopeScaleFalloff: 0,
      kaleidoscopeOpacity: 0.2,
      rotationJitter: 0,
      scaleJitter: 0,
      displacement: 0,
      distortion: 0,
    },
    compositing: {
      blendMode: "source-over",
      opacity: 1,
      overlap: 0,
      feather: 0,
    },
    finish: {
      shadowOffsetX: 18,
      shadowOffsetY: 24,
      shadowBlur: 36,
      shadowOpacity: 0.28,
      shadowColor: "#180f08",
      brightness: 1.12,
      contrast: 0.94,
      saturate: 1.18,
      hueRotate: 24,
      grayscale: 0.08,
      invert: 0.04,
      noise: 0.16,
      noiseMonochrome: 0.11,
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
  } as Parameters<typeof normalizeProjectDocument>[0]),
  versionDocs: [
    {
      id: "version_original",
      projectId: "project_original",
      label: "Version 1",
      createdAt: "2026-03-31T00:00:00.000Z",
      thumbnailPath: "versions/version_original.webp",
      snapshot: normalizeProjectSnapshot({
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
          gutterHorizontal: 0,
          gutterVertical: 0,
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
          symmetryCenterX: 0.5,
          symmetryCenterY: 0.5,
          symmetryAngleOffset: 0,
          symmetryJitter: 0,
          hidePercentage: 0,
          letterbox: 0,
          offsetX: 0,
          offsetY: 0,
          contentRotation: 0,
          wedgeAngle: 120,
          wedgeJitter: 0,
          hollowRatio: 0.48,
          randomness: 0.1,
          organicVariation: 0,
          flowCurvature: 0.44,
          flowCoherence: 0.72,
          flowBranchRate: 0.2,
          flowTaper: 0.34,
          threeDStructure: "sphere",
          threeDDistribution: 0,
          threeDDepth: 0.6,
          threeDCameraDistance: 0.62,
          threeDPanX: 0,
          threeDPanY: 0,
          threeDYaw: 28,
          threeDPitch: -18,
          threeDPerspective: 0.68,
          threeDBillboard: 0.78,
          threeDZJitter: 0.18,
        },
        sourceMapping: {
          strategy: "random",
          sourceWeights: {
            asset_original: 2.25,
          },
          preserveAspect: true,
          cropDistribution: "distributed",
          cropZoom: 1,
          luminanceSort: "ascending",
          paletteEmphasis: 0.5,
        },
        effects: {
          blur: 0,
          sharpen: 0,
          kaleidoscopeSegments: 1,
          kaleidoscopeCenterX: 0.5,
          kaleidoscopeCenterY: 0.5,
          kaleidoscopeAngleOffset: 0,
          kaleidoscopeMirrorMode: "alternate",
          kaleidoscopeRotationDrift: 0,
          kaleidoscopeScaleFalloff: 0,
          kaleidoscopeOpacity: 0.2,
          rotationJitter: 0,
          scaleJitter: 0,
          displacement: 0,
          distortion: 0,
        },
        compositing: {
          blendMode: "source-over",
          opacity: 1,
          overlap: 0,
          feather: 0,
        },
        finish: {
          shadowOffsetX: 18,
          shadowOffsetY: 24,
          shadowBlur: 36,
          shadowOpacity: 0.28,
          shadowColor: "#180f08",
          brightness: 1.12,
          contrast: 0.94,
          saturate: 1.18,
          hueRotate: 24,
          grayscale: 0.08,
          invert: 0.04,
          noise: 0.16,
          noiseMonochrome: 0.11,
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
      } as Parameters<typeof normalizeProjectSnapshot>[0]),
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

describe("serializeProjectDocument", () => {
  it("drops legacy source bias and remaps legacy assignment strategies", () => {
    const legacyProject = normalizeProjectDocument({
      ...serializeProjectDocument(bundle.projectDoc),
      sourceMapping: {
        ...getProjectView(bundle.projectDoc).sourceMapping,
        strategy: "weighted",
        sourceBias: 0.5,
      },
    } as Parameters<typeof normalizeProjectDocument>[0]);

    const serialized = serializeProjectDocument(legacyProject);

    expect(getProjectView(serialized).sourceMapping.strategy).toBe("random");
    expect(getProjectView(serialized).sourceMapping).not.toHaveProperty("sourceBias");
    expect(serialized.layers[0]?.sourceMapping).not.toHaveProperty("sourceBias");
  });
});

describe("createImportCopy", () => {
  it("remaps project, asset, version, and blob identifiers", () => {
    const copy = createImportCopy(bundle);

    expect(copy.projectDoc.id).not.toBe(bundle.projectDoc.id);
    expect(copy.projectDoc.title).toBe("Original Copy");
    expect(copy.projectDoc.deletedAt).toBeNull();
    expect(copy.assetDocs[0]?.projectId).toBe(copy.projectDoc.id);
    expect(copy.assetDocs[0]?.id).not.toBe(bundle.assetDocs[0]?.id);
    expect(getProjectView(copy.projectDoc).sourceIds).toEqual([copy.assetDocs[0]?.id]);
    expect(copy.versionDocs[0]?.id).not.toBe(bundle.versionDocs[0]?.id);
    expect(copy.versionDocs[0]?.projectId).toBe(copy.projectDoc.id);
    expect(copy.versionDocs[0] && getVersionSnapshotLayer(copy.versionDocs[0].snapshot).sourceIds).toEqual([copy.assetDocs[0]?.id]);
    expect(getProjectView(copy.projectDoc).sourceMapping.sourceWeights).toEqual({
      [copy.assetDocs[0]!.id]: 2.25,
    });
    expect(copy.versionDocs[0] && getVersionSnapshotLayer(copy.versionDocs[0].snapshot).sourceMapping.sourceWeights).toEqual({
      [copy.assetDocs[0]!.id]: 2.25,
    });
    expect(getProjectView(copy.projectDoc).finish).toEqual(getProjectView(bundle.projectDoc).finish);
    expect(copy.versionDocs[0] && getVersionSnapshotLayer(copy.versionDocs[0].snapshot).finish).toEqual(
      bundle.versionDocs[0] && getVersionSnapshotLayer(bundle.versionDocs[0].snapshot).finish,
    );
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
            mode: "linear",
            from: "#112233",
            to: "#ffaa00",
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
          },
        },
      ],
      manifest: {
        ...bundle.manifest,
        assetIds: ["asset_gradient"],
      },
      projectDoc: normalizeProjectDocument({
        ...bundle.projectDoc,
        sourceIds: ["asset_gradient"],
      } as Parameters<typeof normalizeProjectDocument>[0]),
      versionDocs: [
        {
          ...bundle.versionDocs[0]!,
          snapshot: normalizeProjectSnapshot({
            ...bundle.versionDocs[0]!.snapshot,
            sourceIds: ["asset_gradient"],
          } as Parameters<typeof normalizeProjectSnapshot>[0]),
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
      mode: "linear",
      from: "#112233",
      to: "#ffaa00",
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
    expect(getProjectView(copy.projectDoc).sourceIds).toEqual([copy.assetDocs[0]?.id]);
  });

  it("preserves perlin source metadata when copying imported bundles", () => {
    const generatedBundle: ImportedProjectBundle = {
      ...bundle,
      assetDocs: [
        {
          ...bundle.assetDocs[0]!,
          id: "asset_perlin",
          kind: "perlin",
          name: "Perlin One",
          recipe: {
            color: "#225577",
            scale: 0.9,
            detail: 0.4,
            contrast: 0.7,
            distortion: 0.2,
            seed: 42,
          },
        },
      ],
      manifest: {
        ...bundle.manifest,
        assetIds: ["asset_perlin"],
      },
      projectDoc: normalizeProjectDocument({
        ...bundle.projectDoc,
        sourceIds: ["asset_perlin"],
      } as Parameters<typeof normalizeProjectDocument>[0]),
      versionDocs: [
        {
          ...bundle.versionDocs[0]!,
          snapshot: normalizeProjectSnapshot({
            ...bundle.versionDocs[0]!.snapshot,
            sourceIds: ["asset_perlin"],
          } as Parameters<typeof normalizeProjectSnapshot>[0]),
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

    expect(copy.assetDocs[0]?.kind).toBe("perlin");
    const copiedAsset = copy.assetDocs[0];
    if (!copiedAsset || copiedAsset.kind !== "perlin") {
      throw new Error("Expected copied perlin source metadata.");
    }
    expect(copiedAsset.recipe).toEqual({
      color: "#225577",
      scale: 0.9,
      detail: 0.4,
      contrast: 0.7,
      distortion: 0.2,
      seed: 42,
    });
    expect(getProjectView(copy.projectDoc).sourceIds).toEqual([copy.assetDocs[0]?.id]);
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

    expect(getProjectView(loaded.projectDoc).sourceMapping.cropDistribution).toBe("center");
    expect(loaded.versionDocs[0] && getVersionSnapshotLayer(loaded.versionDocs[0].snapshot).sourceMapping.cropDistribution).toBe("center");
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

  it("preserves draw layer settings in version 4 bundles", async () => {
    const zip = new JSZip();
    const drawProject = normalizeProjectDocument({
      ...serializeProjectDocument(bundle.projectDoc),
      layers: serializeProjectDocument(bundle.projectDoc).layers.map((layer, index) =>
        index === 0
          ? {
            ...layer,
            layout: {
              ...layer.layout,
              family: "draw",
            },
            draw: {
              brushSize: 192,
              strokes: [
                {
                  id: "stroke_bundle",
                  points: [
                    { x: -20, y: 40 },
                    { x: 120, y: 160 },
                  ],
                },
              ],
            },
          }
          : layer,
      ),
    } as Parameters<typeof normalizeProjectDocument>[0]);
    const drawVersion = {
      ...bundle.versionDocs[0]!,
      snapshot: normalizeProjectSnapshot({
        ...bundle.versionDocs[0]!.snapshot,
        layers: drawProject.layers,
        selectedLayerId: drawProject.selectedLayerId,
      }),
    };

    zip.file(
      "manifest.json",
      JSON.stringify({
        ...bundle.manifest,
        version: 4,
      }),
    );
    zip.file("project.json", JSON.stringify(serializeProjectDocument(drawProject)));
    zip.file("versions.json", JSON.stringify([drawVersion]));
    zip.file("assets.json", JSON.stringify(bundle.assetDocs));
    for (const [path, blob] of Object.entries(bundle.assetBlobs)) {
      zip.file(path, blob);
    }
    for (const [path, blob] of Object.entries(bundle.versionBlobs)) {
      zip.file(path, blob);
    }

    const loaded = await loadProjectBundle(await zip.generateAsync({ type: "blob" }));
    const loadedLayer = getProjectView(loaded.projectDoc).layers[0]!;
    const loadedVersionLayer = getVersionSnapshotLayer(loaded.versionDocs[0]!.snapshot);

    expect(loadedLayer.layout.family).toBe("draw");
    expect(loadedLayer.draw.brushSize).toBe(192);
    expect(loadedLayer.draw.strokes).toEqual([
      {
        id: "stroke_bundle",
        points: [
          { x: -20, y: 40 },
          { x: 120, y: 160 },
        ],
      },
    ]);
    expect(loadedVersionLayer.draw.brushSize).toBe(192);
    expect(loadedVersionLayer.draw.strokes[0]?.id).toBe("stroke_bundle");
  });

  it("preserves words layer settings in version 4 bundles", async () => {
    const zip = new JSZip();
    const wordsProject = normalizeProjectDocument({
      ...serializeProjectDocument(bundle.projectDoc),
      layers: serializeProjectDocument(bundle.projectDoc).layers.map((layer, index) =>
        index === 0
          ? {
            ...layer,
            layout: {
              ...layer.layout,
              family: "words",
            },
            words: {
              mode: "plain-text",
              fontFamily: "cormorant-garamond",
              text: "HELLO\nWORLD",
              textColor: "#224466",
            },
          }
          : layer,
      ),
    } as Parameters<typeof normalizeProjectDocument>[0]);
    const wordsVersion = {
      ...bundle.versionDocs[0]!,
      snapshot: normalizeProjectSnapshot({
        ...bundle.versionDocs[0]!.snapshot,
        layers: wordsProject.layers,
        selectedLayerId: wordsProject.selectedLayerId,
      }),
    };

    zip.file(
      "manifest.json",
      JSON.stringify({
        ...bundle.manifest,
        version: 4,
      }),
    );
    zip.file("project.json", JSON.stringify(serializeProjectDocument(wordsProject)));
    zip.file("versions.json", JSON.stringify([wordsVersion]));
    zip.file("assets.json", JSON.stringify(bundle.assetDocs));
    for (const [path, blob] of Object.entries(bundle.assetBlobs)) {
      zip.file(path, blob);
    }
    for (const [path, blob] of Object.entries(bundle.versionBlobs)) {
      zip.file(path, blob);
    }

    const loaded = await loadProjectBundle(await zip.generateAsync({ type: "blob" }));
    const loadedLayer = getProjectView(loaded.projectDoc).layers[0]!;
    const loadedVersionLayer = getVersionSnapshotLayer(loaded.versionDocs[0]!.snapshot);

    expect(loadedLayer.layout.family).toBe("words");
    expect(loadedLayer.words).toEqual({
      mode: "plain-text",
      fontFamily: "cormorant-garamond",
      text: "HELLO\nWORLD",
      textColor: "#224466",
    });
    expect(loadedVersionLayer.words.fontFamily).toBe("cormorant-garamond");
    expect(loadedVersionLayer.words.text).toBe("HELLO\nWORLD");
  });

  it("preserves text geometry and shared words settings in version 4 bundles", async () => {
    const zip = new JSZip();
    const textGeometryProject = normalizeProjectDocument({
      ...serializeProjectDocument(bundle.projectDoc),
      layers: serializeProjectDocument(bundle.projectDoc).layers.map((layer, index) =>
        index === 0
          ? {
            ...layer,
            layout: {
              ...layer.layout,
              family: "grid",
              shapeMode: "text",
            },
            words: {
              mode: "plain-text",
              fontFamily: "jetbrains-mono",
              text: "TILED\nPHRASE",
              textColor: "#113355",
            },
          }
          : layer,
      ),
    } as Parameters<typeof normalizeProjectDocument>[0]);
    const textGeometryVersion = {
      ...bundle.versionDocs[0]!,
      snapshot: normalizeProjectSnapshot({
        ...bundle.versionDocs[0]!.snapshot,
        layers: textGeometryProject.layers,
        selectedLayerId: textGeometryProject.selectedLayerId,
      }),
    };

    zip.file(
      "manifest.json",
      JSON.stringify({
        ...bundle.manifest,
        version: 4,
      }),
    );
    zip.file("project.json", JSON.stringify(serializeProjectDocument(textGeometryProject)));
    zip.file("versions.json", JSON.stringify([textGeometryVersion]));
    zip.file("assets.json", JSON.stringify(bundle.assetDocs));
    for (const [path, blob] of Object.entries(bundle.assetBlobs)) {
      zip.file(path, blob);
    }
    for (const [path, blob] of Object.entries(bundle.versionBlobs)) {
      zip.file(path, blob);
    }

    const loaded = await loadProjectBundle(await zip.generateAsync({ type: "blob" }));
    const loadedLayer = getProjectView(loaded.projectDoc).layers[0]!;
    const loadedVersionLayer = getVersionSnapshotLayer(loaded.versionDocs[0]!.snapshot);

    expect(loadedLayer.layout.family).toBe("grid");
    expect(loadedLayer.layout.shapeMode).toBe("text");
    expect(loadedLayer.words.fontFamily).toBe("jetbrains-mono");
    expect(loadedLayer.words.text).toBe("TILED\nPHRASE");
    expect(loadedVersionLayer.layout.shapeMode).toBe("text");
    expect(loadedVersionLayer.words.textColor).toBe("#113355");
  });
});
