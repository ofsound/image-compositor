import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  db,
  createGeneratedSourceAsset,
  persistProcessedAsset,
  processImageFile,
  deleteBlob,
  readBlob,
  updateGeneratedSourceAsset,
  writeBlob,
} = vi.hoisted(() => ({
  db: {
    assets: {
      put: vi.fn(async () => undefined),
      bulkPut: vi.fn(async () => undefined),
      bulkDelete: vi.fn(async () => undefined),
      toArray: vi.fn(async () => []),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(async () => []),
        })),
      })),
      get: vi.fn(async () => undefined),
    },
    projects: {
      put: vi.fn(async () => undefined),
      toArray: vi.fn(async () => []),
      get: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    },
    versions: {
      put: vi.fn(async () => undefined),
      bulkDelete: vi.fn(async () => undefined),
      toArray: vi.fn(async () => []),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(async () => []),
        })),
      })),
    },
    kv: {
      put: vi.fn(async () => undefined),
      get: vi.fn(async () => undefined),
    },
  },
  createGeneratedSourceAsset: vi.fn(),
  persistProcessedAsset: vi.fn(),
  processImageFile: vi.fn(),
  deleteBlob: vi.fn<() => Promise<void>>(async () => undefined),
  readBlob: vi.fn<(path: string) => Promise<Blob | null>>(async () => null),
  updateGeneratedSourceAsset: vi.fn(),
  writeBlob: vi.fn<(path: string, blob: Blob) => Promise<void>>(async () => undefined),
}));

vi.mock("@/lib/assets", () => ({
  createGeneratedSourceAsset,
  duplicateSourceAsset: vi.fn(),
  normalizeSourceAsset: vi.fn((asset) => asset),
  persistProcessedAsset,
  updateGeneratedSourceAsset,
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/download", () => ({ downloadBlob: vi.fn() }));
vi.mock("@/lib/image-worker-client", () => ({ processImageFile }));
vi.mock("@/lib/opfs", () => ({ deleteBlob, readBlob, writeBlob }));
vi.mock("@/lib/render", () => ({ exportProjectImage: vi.fn() }));
vi.mock("@/lib/serializer", () => ({
  createImportCopy: vi.fn(),
  exportProjectBundle: vi.fn(),
  loadProjectBundle: vi.fn(),
  persistImportedProjectBundle: vi.fn(),
}));

import {
  createCompositorLayer,
  createProjectDocument,
  normalizeProjectDocument,
  serializeProjectDocument,
} from "@/lib/project-defaults";
import { useAppStore } from "@/state/use-app-store";
import type {
  CellularSourceAsset,
  GradientSourceAsset,
  PerlinSourceAsset,
  ReactionSourceAsset,
  SourceAsset,
  WaveSourceAsset,
} from "@/types/project";

function resetStore() {
  const project = createProjectDocument("History Test");
  useAppStore.setState({
    ready: true,
    busy: false,
    status: "Ready.",
    sourceImportProgress: null,
    projects: [project],
    assets: [],
    versions: [],
    activeProjectId: project.id,
    historyByProject: {},
    canUndo: false,
    canRedo: false,
  });
  return project;
}

function createSolidAsset(projectId: string): SourceAsset {
  return {
    id: "asset_solid",
    kind: "solid",
    projectId,
    name: "Solid #123456",
    originalFileName: "solid-asset_solid.png",
    mimeType: "image/png",
    width: 3000,
    height: 3000,
    orientation: 1,
    originalPath: "assets/original/asset_solid.png",
    normalizedPath: "assets/normalized/asset_solid.png",
    previewPath: "assets/previews/asset_solid.webp",
    averageColor: "#123456",
    palette: ["#123456"],
    luminance: 0.25,
    createdAt: "2026-04-05T00:00:00.000Z",
    recipe: {
      color: "#123456",
    },
  };
}

function createImageAsset(projectId: string, id: string): SourceAsset {
  return {
    id,
    kind: "image",
    projectId,
    name: `Image ${id}`,
    originalFileName: `${id}.jpg`,
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    orientation: 1,
    originalPath: `assets/original/${id}.jpg`,
    normalizedPath: `assets/normalized/${id}.png`,
    previewPath: `assets/previews/${id}.webp`,
    averageColor: "#112233",
    palette: ["#112233"],
    luminance: 0.25,
    createdAt: "2026-04-05T00:00:00.000Z",
  };
}

function createGradientAsset(projectId: string): GradientSourceAsset {
  const base = createImageAsset(projectId, "asset_gradient");
  return {
    id: base.id,
    kind: "gradient",
    projectId: base.projectId,
    name: "Gradient",
    originalFileName: "asset_gradient.png",
    mimeType: "image/png",
    width: base.width,
    height: base.height,
    orientation: base.orientation,
    originalPath: "assets/original/asset_gradient.png",
    normalizedPath: base.normalizedPath,
    previewPath: base.previewPath,
    averageColor: base.averageColor,
    palette: base.palette,
    luminance: base.luminance,
    createdAt: base.createdAt,
    recipe: {
      mode: "conic",
      from: "#112233",
      to: "#ddeeff",
      direction: "vertical",
      viaColor: "#778899",
      viaPosition: 0.4,
      centerX: 0.35,
      centerY: 0.65,
      radialRadius: 1,
      radialInnerRadius: 0,
      conicAngle: 30,
      conicSpan: 180,
      conicRepeat: true,
    },
  };
}

function createPerlinAsset(projectId: string): PerlinSourceAsset {
  const base = createImageAsset(projectId, "asset_perlin");
  return {
    id: base.id,
    kind: "perlin",
    projectId: base.projectId,
    name: "Perlin",
    originalFileName: "asset_perlin.png",
    mimeType: "image/png",
    width: base.width,
    height: base.height,
    orientation: base.orientation,
    originalPath: "assets/original/asset_perlin.png",
    normalizedPath: base.normalizedPath,
    previewPath: base.previewPath,
    averageColor: base.averageColor,
    palette: base.palette,
    luminance: base.luminance,
    createdAt: base.createdAt,
    recipe: {
      color: "#0f766e",
      scale: 0.55,
      detail: 0.62,
      contrast: 0.47,
      distortion: 0.28,
      seed: 12345,
    },
  };
}

function createCellularAsset(projectId: string): CellularSourceAsset {
  const base = createImageAsset(projectId, "asset_cellular");
  return {
    id: base.id,
    kind: "cellular",
    projectId: base.projectId,
    name: "Cellular",
    originalFileName: "asset_cellular.png",
    mimeType: "image/png",
    width: base.width,
    height: base.height,
    orientation: base.orientation,
    originalPath: "assets/original/asset_cellular.png",
    normalizedPath: base.normalizedPath,
    previewPath: base.previewPath,
    averageColor: base.averageColor,
    palette: base.palette,
    luminance: base.luminance,
    createdAt: base.createdAt,
    recipe: {
      color: "#8b5cf6",
      scale: 0.55,
      jitter: 0.6,
      edge: 0.55,
      contrast: 0.45,
      seed: 54321,
    },
  };
}

function createReactionAsset(projectId: string): ReactionSourceAsset {
  const base = createImageAsset(projectId, "asset_reaction");
  return {
    id: base.id,
    kind: "reaction",
    projectId: base.projectId,
    name: "Reaction",
    originalFileName: "asset_reaction.png",
    mimeType: "image/png",
    width: base.width,
    height: base.height,
    orientation: base.orientation,
    originalPath: "assets/original/asset_reaction.png",
    normalizedPath: base.normalizedPath,
    previewPath: base.previewPath,
    averageColor: base.averageColor,
    palette: base.palette,
    luminance: base.luminance,
    createdAt: base.createdAt,
    recipe: {
      color: "#ef4444",
      scale: 0.55,
      diffusion: 0.55,
      balance: 0.5,
      distortion: 0.2,
      seed: 24680,
    },
  };
}

function createWaveAsset(projectId: string): WaveSourceAsset {
  const base = createImageAsset(projectId, "asset_waves");
  return {
    id: base.id,
    kind: "waves",
    projectId: base.projectId,
    name: "Waves",
    originalFileName: "asset_waves.png",
    mimeType: "image/png",
    width: base.width,
    height: base.height,
    orientation: base.orientation,
    originalPath: "assets/original/asset_waves.png",
    normalizedPath: base.normalizedPath,
    previewPath: base.previewPath,
    averageColor: base.averageColor,
    palette: base.palette,
    luminance: base.luminance,
    createdAt: base.createdAt,
    recipe: {
      color: "#0ea5e9",
      scale: 0.55,
      interference: 0.65,
      directionality: 0.6,
      distortion: 0.2,
      seed: 112233,
    },
  };
}

function createCustomizedLayerState(
  layer: ReturnType<typeof createCompositorLayer>,
  sourceId: string,
) {
  const customizedLayer = structuredClone(layer);
  customizedLayer.sourceIds = [sourceId];
  customizedLayer.inset = 12;
  customizedLayer.layout = {
    ...customizedLayer.layout,
    columns: 5,
    rows: 3,
  };
  customizedLayer.sourceMapping = {
    ...customizedLayer.sourceMapping,
    strategy: "weighted",
    sourceWeights: { [sourceId]: 2.25 },
    cropDistribution: "center",
  };
  customizedLayer.effects = {
    ...customizedLayer.effects,
    blur: 12,
    kaleidoscopeSegments: 4,
  };
  customizedLayer.compositing = {
    ...customizedLayer.compositing,
    blendMode: "screen",
    opacity: 0.55,
    overlap: 0.2,
    feather: 0.1,
  };
  customizedLayer.finish = {
    ...customizedLayer.finish,
    shadowOpacity: 0.3,
    brightness: 1.25,
    contrast: 1.1,
  };
  customizedLayer.activeSeed = 424242;

  return customizedLayer;
}

describe("useAppStore history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("undoes and redoes project snapshot changes", async () => {
    const initialProject = useAppStore.getState().projects[0]!;

    await useAppStore.getState().updateProject((project) => ({
      ...project,
      layout: {
        ...project.layout,
        columns: initialProject.layout.columns + 2,
      },
    }));

    expect(useAppStore.getState().projects[0]?.layout.columns).toBe(
      initialProject.layout.columns + 2,
    );
    expect(useAppStore.getState().canUndo).toBe(true);
    expect(useAppStore.getState().canRedo).toBe(false);

    await useAppStore.getState().undo();

    expect(useAppStore.getState().projects[0]?.layout.columns).toBe(
      initialProject.layout.columns,
    );
    expect(useAppStore.getState().canUndo).toBe(false);
    expect(useAppStore.getState().canRedo).toBe(true);

    await useAppStore.getState().redo();

    expect(useAppStore.getState().projects[0]?.layout.columns).toBe(
      initialProject.layout.columns + 2,
    );
    expect(useAppStore.getState().canUndo).toBe(true);
    expect(useAppStore.getState().canRedo).toBe(false);
  });

  it("clears redo history after a divergent project edit", async () => {
    const initialProject = useAppStore.getState().projects[0]!;

    await useAppStore.getState().updateProject((project) => ({
      ...project,
      layout: {
        ...project.layout,
        rows: initialProject.layout.rows + 1,
      },
    }));
    await useAppStore.getState().undo();

    expect(useAppStore.getState().canRedo).toBe(true);

    await useAppStore.getState().updateProject((project) => ({
      ...project,
      layout: {
        ...project.layout,
        gutter: initialProject.layout.gutter + 4,
      },
    }));

    expect(useAppStore.getState().projects[0]?.layout.rows).toBe(initialProject.layout.rows);
    expect(useAppStore.getState().projects[0]?.layout.gutter).toBe(
      initialProject.layout.gutter + 4,
    );
    expect(useAppStore.getState().canRedo).toBe(false);
  });

  it("reorders layers from an explicit id sequence", async () => {
    const project = useAppStore.getState().projects[0]!;
    const baseLayer = project.layers[0]!;
    const middleLayer = createCompositorLayer({
      name: "Layer 2",
      visible: true,
    });
    const topLayer = createCompositorLayer({
      name: "Layer 3",
      visible: true,
    });

    useAppStore.setState((state) => ({
      ...state,
      projects: [
        {
          ...project,
          layers: [baseLayer, middleLayer, topLayer],
          selectedLayerId: middleLayer.id,
        },
      ],
    }));

    await useAppStore.getState().reorderLayers([topLayer.id, baseLayer.id, middleLayer.id]);

    expect(useAppStore.getState().projects[0]?.layers.map((layer) => layer.id)).toEqual([
      topLayer.id,
      baseLayer.id,
      middleLayer.id,
    ]);
    expect(useAppStore.getState().projects[0]?.selectedLayerId).toBe(middleLayer.id);
    expect(useAppStore.getState().canUndo).toBe(true);
  });

  it("adds a new empty layer with default settings", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createSolidAsset(project.id);
    const customizedLayer = createCustomizedLayerState(project.layers[0]!, asset.id);

    useAppStore.setState((state) => ({
      ...state,
      assets: [asset],
      projects: [
        normalizeProjectDocument({
          ...serializeProjectDocument(project),
          layers: [customizedLayer],
          selectedLayerId: customizedLayer.id,
        }),
      ],
    }));

    await useAppStore.getState().addLayer();

    const updatedProject = useAppStore.getState().projects[0]!;
    const nextLayer = updatedProject.layers[1]!;
    const defaultLayer = createCompositorLayer({
      name: "Layer 2",
      visible: true,
    });

    expect(updatedProject.selectedLayerId).toBe(nextLayer.id);
    expect(nextLayer.name).toBe("Layer 2");
    expect(nextLayer.visible).toBe(true);
    expect(nextLayer.sourceIds).toEqual(defaultLayer.sourceIds);
    expect(nextLayer.inset).toBe(defaultLayer.inset);
    expect(nextLayer.layout).toEqual(defaultLayer.layout);
    expect(nextLayer.sourceMapping).toEqual(defaultLayer.sourceMapping);
    expect(nextLayer.effects).toEqual(defaultLayer.effects);
    expect(nextLayer.compositing).toEqual(defaultLayer.compositing);
    expect(nextLayer.finish).toEqual(defaultLayer.finish);
    expect(nextLayer.activeSeed).toBe(defaultLayer.activeSeed);
    expect(nextLayer.presets).toEqual(defaultLayer.presets);
    expect(nextLayer.passes).toEqual(defaultLayer.passes);
  });

  it("preserves the previous selected layer when adding a layer", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createSolidAsset(project.id);
    const customizedLayer = createCustomizedLayerState(project.layers[0]!, asset.id);

    useAppStore.setState((state) => ({
      ...state,
      assets: [asset],
      projects: [
        normalizeProjectDocument({
          ...serializeProjectDocument(project),
          layers: [customizedLayer],
          selectedLayerId: customizedLayer.id,
        }),
      ],
    }));

    await useAppStore.getState().addLayer();

    expect(useAppStore.getState().projects[0]?.layers[0]).toEqual(customizedLayer);
  });

  it("deleting the selected layer does not overwrite the remaining layer", async () => {
    const project = useAppStore.getState().projects[0]!;
    const retainedAsset = createSolidAsset(project.id);
    const deletedAsset = createImageAsset(project.id, "asset_deleted");
    const retainedLayer = createCustomizedLayerState(project.layers[0]!, retainedAsset.id);
    const selectedLayer = createCustomizedLayerState(
      createCompositorLayer({
        name: "Layer 2",
        visible: true,
      }),
      deletedAsset.id,
    );

    useAppStore.setState((state) => ({
      ...state,
      assets: [retainedAsset, deletedAsset],
      projects: [
        normalizeProjectDocument({
          ...serializeProjectDocument(project),
          layers: [retainedLayer, selectedLayer],
          selectedLayerId: selectedLayer.id,
        }),
      ],
    }));

    await useAppStore.getState().deleteLayer(selectedLayer.id);

    const updatedProject = useAppStore.getState().projects[0]!;
    expect(updatedProject.layers).toEqual([retainedLayer]);
    expect(updatedProject.selectedLayerId).toBe(retainedLayer.id);
  });

  it("undoes and redoes added sources", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createSolidAsset(project.id);
    createGeneratedSourceAsset.mockResolvedValue(asset);

    await useAppStore.getState().addSolidSource({
      name: "",
      color: "#123456",
    });

    expect(useAppStore.getState().assets.map((entry) => entry.id)).toEqual([asset.id]);
    expect(useAppStore.getState().projects[0]?.sourceIds).toEqual([asset.id]);
    expect(useAppStore.getState().canUndo).toBe(true);

    await useAppStore.getState().undo();

    expect(useAppStore.getState().assets).toHaveLength(0);
    expect(useAppStore.getState().projects[0]?.sourceIds).toEqual([]);
    expect(db.assets.bulkDelete).toHaveBeenCalledWith([asset.id]);
    expect(useAppStore.getState().canRedo).toBe(true);

    await useAppStore.getState().redo();

    expect(useAppStore.getState().assets.map((entry) => entry.id)).toEqual([asset.id]);
    expect(useAppStore.getState().projects[0]?.sourceIds).toEqual([asset.id]);
    expect(db.assets.bulkPut).toHaveBeenCalledWith([asset]);
    expect(useAppStore.getState().canRedo).toBe(false);
  });

  it("removes a source and restores it with undo/redo", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createSolidAsset(project.id);
    useAppStore.setState((state) => ({
      ...state,
      assets: [asset],
      projects: [
        {
          ...project,
          sourceIds: [asset.id],
        },
      ],
    }));

    vi.mocked(readBlob)
      .mockResolvedValueOnce(new Blob(["original"]))
      .mockResolvedValueOnce(new Blob(["normalized"]))
      .mockResolvedValueOnce(new Blob(["preview"]));

    await useAppStore.getState().removeSource(asset.id);

    expect(useAppStore.getState().assets).toHaveLength(0);
    expect(useAppStore.getState().projects[0]?.sourceIds).toEqual([]);
    expect(deleteBlob).toHaveBeenCalledTimes(3);
    expect(db.assets.bulkDelete).toHaveBeenCalledWith([asset.id]);
    expect(useAppStore.getState().canUndo).toBe(true);

    await useAppStore.getState().undo();

    expect(useAppStore.getState().assets.map((entry) => entry.id)).toEqual([asset.id]);
    expect(useAppStore.getState().projects[0]?.sourceIds).toEqual([asset.id]);
    expect(writeBlob).toHaveBeenCalledTimes(3);
    expect(db.assets.bulkPut).toHaveBeenCalledWith([asset]);
    expect(useAppStore.getState().canRedo).toBe(true);

    await useAppStore.getState().redo();

    expect(useAppStore.getState().assets).toHaveLength(0);
    expect(useAppStore.getState().projects[0]?.sourceIds).toEqual([]);
    expect(deleteBlob).toHaveBeenCalledTimes(6);
    expect(db.assets.bulkDelete).toHaveBeenLastCalledWith([asset.id]);
    expect(useAppStore.getState().canRedo).toBe(false);
  });
});

describe("useAppStore import progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("tracks source import progress across imported files and clears it on success", async () => {
    const project = useAppStore.getState().projects[0]!;
    const files = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
    ];
    const progressSnapshots: string[] = [];
    const firstPayload = { width: 10 } as never;
    const secondPayload = { width: 20 } as never;
    const firstAsset = createImageAsset(project.id, "asset_image_a");
    const secondAsset = createImageAsset(project.id, "asset_image_b");

    vi.mocked(processImageFile)
      .mockResolvedValueOnce(firstPayload)
      .mockResolvedValueOnce(secondPayload);
    vi.mocked(persistProcessedAsset)
      .mockImplementationOnce(async () => {
        progressSnapshots.push(
          JSON.stringify(useAppStore.getState().sourceImportProgress),
        );
        return firstAsset;
      })
      .mockImplementationOnce(async () => {
        progressSnapshots.push(
          JSON.stringify(useAppStore.getState().sourceImportProgress),
        );
        return secondAsset;
      });

    const importPromise = useAppStore.getState().importFiles(files);

    expect(useAppStore.getState().sourceImportProgress).toEqual({
      processed: 0,
      total: 2,
    });

    await importPromise;

    expect(progressSnapshots).toEqual([
      JSON.stringify({ processed: 0, total: 2 }),
      JSON.stringify({ processed: 1, total: 2 }),
    ]);
    expect(useAppStore.getState().sourceImportProgress).toBeNull();
    expect(useAppStore.getState().assets.map((asset) => asset.id)).toEqual([
      firstAsset.id,
      secondAsset.id,
    ]);
  });

  it("clears source import progress on failure", async () => {
    const files = [new File(["a"], "a.jpg", { type: "image/jpeg" })];
    vi.mocked(processImageFile).mockRejectedValueOnce(new Error("decode failed"));

    await useAppStore.getState().importFiles(files);

    expect(useAppStore.getState().sourceImportProgress).toBeNull();
    expect(useAppStore.getState().status).toBe("Import failed: decode failed");
  });

  it("does not use source import progress for generated sources", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createSolidAsset(project.id);
    createGeneratedSourceAsset.mockResolvedValue(asset);

    await useAppStore.getState().addSolidSource({
      name: "",
      color: "#123456",
    });

    expect(useAppStore.getState().sourceImportProgress).toBeNull();
  });

  it("adds perlin sources through the generated source pipeline", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createPerlinAsset(project.id);
    createGeneratedSourceAsset.mockResolvedValue(asset);

    await useAppStore.getState().addPerlinSource({
      name: "",
      color: "#0f766e",
      scale: 0.55,
      detail: 0.62,
      contrast: 0.47,
      distortion: 0.28,
      seed: 12345,
    });

    expect(createGeneratedSourceAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "perlin",
        recipe: expect.objectContaining({ seed: 12345 }),
      }),
      project.id,
      project.canvas,
    );
    expect(useAppStore.getState().assets.map((entry) => entry.id)).toEqual([asset.id]);
    expect(useAppStore.getState().projects[0]?.sourceIds).toEqual([asset.id]);
    expect(useAppStore.getState().status).toBe("Perlin source added.");
  });

  it("adds cellular sources through the generated source pipeline", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createCellularAsset(project.id);
    createGeneratedSourceAsset.mockResolvedValue(asset);

    await useAppStore.getState().addCellularSource({
      name: "",
      color: "#8b5cf6",
      scale: 0.55,
      jitter: 0.6,
      edge: 0.55,
      contrast: 0.45,
      seed: 54321,
    });

    expect(createGeneratedSourceAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "cellular",
        recipe: expect.objectContaining({ seed: 54321 }),
      }),
      project.id,
      project.canvas,
    );
    expect(useAppStore.getState().status).toBe("Cellular source added.");
  });

  it("adds reaction sources through the generated source pipeline", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createReactionAsset(project.id);
    createGeneratedSourceAsset.mockResolvedValue(asset);

    await useAppStore.getState().addReactionSource({
      name: "",
      color: "#ef4444",
      scale: 0.55,
      diffusion: 0.55,
      balance: 0.5,
      distortion: 0.2,
      seed: 24680,
    });

    expect(createGeneratedSourceAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "reaction",
        recipe: expect.objectContaining({ seed: 24680 }),
      }),
      project.id,
      project.canvas,
    );
    expect(useAppStore.getState().status).toBe("Reaction source added.");
  });

  it("adds waves sources through the generated source pipeline", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createWaveAsset(project.id);
    createGeneratedSourceAsset.mockResolvedValue(asset);

    await useAppStore.getState().addWaveSource({
      name: "",
      color: "#0ea5e9",
      scale: 0.55,
      interference: 0.65,
      directionality: 0.6,
      distortion: 0.2,
      seed: 112233,
    });

    expect(createGeneratedSourceAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "waves",
        recipe: expect.objectContaining({ seed: 112233 }),
      }),
      project.id,
      project.canvas,
    );
    expect(useAppStore.getState().status).toBe("Waves source added.");
  });

  it("updates generated gradients with the expanded recipe while keeping the asset id", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createGradientAsset(project.id);
    const updatedAsset: GradientSourceAsset = {
      ...asset,
      name: "Updated Gradient",
      recipe: {
        ...asset.recipe,
        mode: "radial",
        centerX: 0.5,
        centerY: 0.5,
        radialRadius: 0.75,
        radialInnerRadius: 0.1,
        conicRepeat: false,
      },
    };
    useAppStore.setState((state) => ({
      ...state,
      assets: [asset],
      projects: [{ ...project, sourceIds: [asset.id] }],
    }));
    vi.mocked(updateGeneratedSourceAsset).mockResolvedValueOnce(updatedAsset);

    await useAppStore.getState().updateGeneratedSource(asset.id, {
      name: "Updated Gradient",
      mode: "radial",
      from: "#112233",
      to: "#ddeeff",
      direction: "vertical",
      viaColor: "#778899",
      viaPosition: 0.4,
      centerX: 0.5,
      centerY: 0.5,
      radialRadius: 0.75,
      radialInnerRadius: 0.1,
      conicAngle: 30,
      conicSpan: 180,
      conicRepeat: false,
    });

    expect(updateGeneratedSourceAsset).toHaveBeenCalledWith(
      asset,
      expect.objectContaining({
        mode: "radial",
        radialRadius: 0.75,
        radialInnerRadius: 0.1,
      }),
    );
    expect(useAppStore.getState().assets[0]?.id).toBe(asset.id);
    expect(useAppStore.getState().assets[0]).toEqual(updatedAsset);
    expect(db.assets.put).toHaveBeenCalledWith(updatedAsset);
  });

  it("updates generated perlin sources while keeping the asset id", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createPerlinAsset(project.id);
    const updatedAsset: PerlinSourceAsset = {
      ...asset,
      name: "Updated Perlin",
      recipe: {
        ...asset.recipe,
        scale: 0.9,
        detail: 0.2,
        contrast: 0.7,
        distortion: 0.1,
        seed: 987654,
      },
    };
    useAppStore.setState((state) => ({
      ...state,
      assets: [asset],
      projects: [{ ...project, sourceIds: [asset.id] }],
    }));
    vi.mocked(updateGeneratedSourceAsset).mockResolvedValueOnce(updatedAsset);

    await useAppStore.getState().updateGeneratedSource(asset.id, {
      name: "Updated Perlin",
      color: "#0f766e",
      scale: 0.9,
      detail: 0.2,
      contrast: 0.7,
      distortion: 0.1,
      seed: 987654,
    });

    expect(updateGeneratedSourceAsset).toHaveBeenCalledWith(
      asset,
      expect.objectContaining({
        scale: 0.9,
        detail: 0.2,
        contrast: 0.7,
        distortion: 0.1,
        seed: 987654,
      }),
    );
    expect(useAppStore.getState().assets[0]?.id).toBe(asset.id);
    expect(useAppStore.getState().assets[0]).toEqual(updatedAsset);
    expect(useAppStore.getState().status).toBe("Perlin source updated.");
  });
});
