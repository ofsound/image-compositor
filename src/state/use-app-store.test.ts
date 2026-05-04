import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  db,
  captureAssetSnapshot,
  createGeneratedSourceAsset,
  deleteAssetsAtomically,
  downloadBlob,
  buildBitmapMap,
  renderProjectLayerToCanvas,
  renderProjectToCanvas,
  exportProjectImage,
  exportProjectBundle,
  loadProjectBundle,
  persistImportedProjectBundle,
  persistAssetCreationsAtomically,
  persistAssetUpdatesAtomically,
  loadWorkspaceSnapshotData,
  persistActiveProjectId,
  persistProcessedAsset,
  processImageFile,
  putProjectDocument,
  putProjectVersion,
  updateGeneratedSourceAsset,
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
  captureAssetSnapshot: vi.fn(),
  createGeneratedSourceAsset: vi.fn(),
  deleteAssetsAtomically: vi.fn(async () => undefined),
  downloadBlob: vi.fn(),
  buildBitmapMap: vi.fn(async () => new Map()),
  renderProjectLayerToCanvas: vi.fn(async () => undefined),
  renderProjectToCanvas: vi.fn(async () => undefined),
  exportProjectImage: vi.fn(async () => new Blob(["export"])),
  exportProjectBundle: vi.fn(),
  loadProjectBundle: vi.fn(),
  persistImportedProjectBundle: vi.fn(async () => undefined),
  loadWorkspaceSnapshotData: vi.fn(async () => ({
    projects: [],
    assets: [],
    versions: [],
    activeProjectId: null,
  })),
  persistActiveProjectId: vi.fn(async () => undefined),
  persistAssetCreationsAtomically: vi.fn(async () => undefined),
  persistAssetUpdatesAtomically: vi.fn(async () => undefined),
  persistProcessedAsset: vi.fn(),
  processImageFile: vi.fn(),
  putProjectDocument: vi.fn(async () => undefined),
  putProjectVersion: vi.fn(async () => undefined),
  updateGeneratedSourceAsset: vi.fn(),
}));

vi.mock("@/lib/assets", () => ({
  createGeneratedSourceAsset,
  duplicateSourceAsset: vi.fn(),
  getSourceContentSignature: vi.fn((asset: { id?: string }) => asset.id ?? "asset"),
  normalizeSourceAsset: vi.fn((asset) => asset),
  persistProcessedAsset,
  updateGeneratedSourceAsset,
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/download", () => ({ downloadBlob }));
vi.mock("@/lib/image-worker-client", () => ({ processImageFile }));
vi.mock("@/lib/render", () => ({
  buildBitmapMap,
  exportProjectImage,
  renderProjectLayerToCanvas,
  renderProjectToCanvas,
}));
vi.mock("@/lib/serializer", () => ({
  createImportCopy: vi.fn(),
  exportProjectBundle,
  loadProjectBundle,
  persistImportedProjectBundle,
}));
vi.mock("@/lib/workspace-storage", () => ({
  captureAssetSnapshot,
  deleteAssetsAtomically,
  deleteProjectDataAtomically: vi.fn(async () => undefined),
  loadWorkspaceSnapshotData,
  persistActiveProjectId,
  persistAssetCreationsAtomically,
  persistAssetUpdatesAtomically,
  putProjectDocument,
  putProjectVersion,
}));

import {
  createCompositorLayer,
  createProjectDocument,
  normalizeProjectDocument,
  serializeProjectDocument,
} from "@/lib/project-defaults";
import { createProjectEditorView } from "@/lib/project-editor-view";
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
    projectSummaries: [
      {
        id: project.id,
        title: project.title,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        deletedAt: project.deletedAt,
        locked: false,
        lockedByCurrentWindow: false,
      },
    ],
    assets: [],
    versions: [],
    activeProjectId: project.id,
    historyByProject: {},
    exportFilenameReservations: {},
    canUndo: false,
    canRedo: false,
  });
  return project;
}

function getActiveProjectView() {
  const project = useAppStore.getState().projects[0];
  return project ? createProjectEditorView(project) : null;
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

function createPreparedAssetRecord(asset: SourceAsset, label = asset.id) {
  return {
    asset,
    blobs: {
      original: new Blob([`${label}-original`]),
      normalized: new Blob([`${label}-normalized`]),
      preview: new Blob([`${label}-preview`]),
    },
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
  customizedLayer.layout = {
    ...customizedLayer.layout,
    columns: 5,
    rows: 3,
  };
  customizedLayer.sourceMapping = {
    ...customizedLayer.sourceMapping,
    strategy: "random",
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
    const initialProject = getActiveProjectView()!;

    await useAppStore.getState().updateSelectedLayer((layer) => ({
      ...layer,
      layout: {
        ...layer.layout,
        columns: initialProject.layout.columns + 2,
      },
    }));

    expect(getActiveProjectView()?.layout.columns).toBe(
      initialProject.layout.columns + 2,
    );
    expect(useAppStore.getState().canUndo).toBe(true);
    expect(useAppStore.getState().canRedo).toBe(false);

    await useAppStore.getState().undo();

    expect(getActiveProjectView()?.layout.columns).toBe(
      initialProject.layout.columns,
    );
    expect(useAppStore.getState().canUndo).toBe(false);
    expect(useAppStore.getState().canRedo).toBe(true);

    await useAppStore.getState().redo();

    expect(getActiveProjectView()?.layout.columns).toBe(
      initialProject.layout.columns + 2,
    );
    expect(useAppStore.getState().canUndo).toBe(true);
    expect(useAppStore.getState().canRedo).toBe(false);
  });

  it("serializes concurrent selected-layer edits", async () => {
    const before = getActiveProjectView()!;
    const initialRows = before.layout.rows;
    const initialColumns = before.layout.columns;

    await Promise.all([
      useAppStore.getState().updateSelectedLayer((layer) => ({
        ...layer,
        layout: {
          ...layer.layout,
          rows: initialRows + 2,
        },
      })),
      useAppStore.getState().updateSelectedLayer((layer) => ({
        ...layer,
        layout: {
          ...layer.layout,
          columns: initialColumns + 3,
        },
      })),
    ]);

    const after = getActiveProjectView()!;
    expect(after.layout.rows).toBe(initialRows + 2);
    expect(after.layout.columns).toBe(initialColumns + 3);
  });

  it("batches queued editor updates into one persisted history entry", async () => {
    vi.useFakeTimers();
    const initialProject = getActiveProjectView()!;

    try {
      await useAppStore.getState().updateProject(
        (project) => ({
          ...project,
          layers: project.layers.map((layer, index) =>
            index === 0
              ? {
                  ...layer,
                  layout: {
                    ...layer.layout,
                    columns: initialProject.layout.columns + 1,
                  },
                }
              : layer,
          ),
        }),
        { queueKey: "ui-editor-update" },
      );
      await useAppStore.getState().updateProject(
        (project) => ({
          ...project,
          layers: project.layers.map((layer, index) =>
            index === 0
              ? {
                  ...layer,
                  layout: {
                    ...layer.layout,
                    columns: initialProject.layout.columns + 3,
                  },
                }
              : layer,
          ),
        }),
        { queueKey: "ui-editor-update" },
      );

      expect(getActiveProjectView()?.layout.columns).toBe(
        initialProject.layout.columns + 3,
      );
      expect(putProjectDocument).not.toHaveBeenCalled();
      expect(useAppStore.getState().canUndo).toBe(true);

      await vi.advanceTimersByTimeAsync(160);

      expect(putProjectDocument).toHaveBeenCalledTimes(1);
      expect(useAppStore.getState().canUndo).toBe(true);

      await useAppStore.getState().undo();

      expect(getActiveProjectView()?.layout.columns).toBe(
        initialProject.layout.columns,
      );
      expect(useAppStore.getState().canRedo).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears redo history after a divergent project edit", async () => {
    const initialProject = getActiveProjectView()!;

    await useAppStore.getState().updateSelectedLayer((layer) => ({
      ...layer,
      layout: {
        ...layer.layout,
        rows: initialProject.layout.rows + 1,
      },
    }));
    await useAppStore.getState().undo();

    expect(useAppStore.getState().canRedo).toBe(true);

    await useAppStore.getState().updateSelectedLayer((layer) => ({
      ...layer,
      layout: {
        ...layer.layout,
        gutter: initialProject.layout.gutter + 4,
      },
    }));

    expect(getActiveProjectView()?.layout.rows).toBe(initialProject.layout.rows);
    expect(getActiveProjectView()?.layout.gutter).toBe(
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

  it("duplicates a layer next to the original and selects the copy", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createSolidAsset(project.id);
    const customizedLayer = createCustomizedLayerState(project.layers[0]!, asset.id);
    customizedLayer.name = "Texture";

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

    await useAppStore.getState().duplicateLayer(customizedLayer.id);

    const updatedProject = useAppStore.getState().projects[0]!;
    const sourceLayer = updatedProject.layers[0]!;
    const duplicateLayer = updatedProject.layers[1]!;

    expect(updatedProject.layers).toHaveLength(2);
    expect(updatedProject.selectedLayerId).toBe(duplicateLayer.id);
    expect(duplicateLayer.id).not.toBe(sourceLayer.id);
    expect(duplicateLayer.name).toBe("Texture Copy");
    expect(duplicateLayer).toEqual({
      ...sourceLayer,
      id: duplicateLayer.id,
      name: "Texture Copy",
    });
  });

  it("increments duplicate layer names when a copy already exists", async () => {
    const project = useAppStore.getState().projects[0]!;
    const sourceLayer = createCompositorLayer({
      name: "Layer",
      visible: true,
    });
    const existingCopy = createCompositorLayer({
      name: "Layer Copy",
      visible: true,
    });

    useAppStore.setState((state) => ({
      ...state,
      projects: [
        normalizeProjectDocument({
          ...serializeProjectDocument(project),
          layers: [sourceLayer, existingCopy],
          selectedLayerId: sourceLayer.id,
        }),
      ],
    }));

    await useAppStore.getState().duplicateLayer(sourceLayer.id);

    const updatedProject = useAppStore.getState().projects[0]!;
    expect(updatedProject.layers.map((layer) => layer.name)).toEqual([
      "Layer",
      "Layer Copy 2",
      "Layer Copy",
    ]);
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
    expect(updatedProject.layers).toHaveLength(1);
    expect(updatedProject.layers[0]).toEqual(
      expect.objectContaining({
        id: retainedLayer.id,
        sourceIds: retainedLayer.sourceIds,
        layout: expect.objectContaining({
          columns: retainedLayer.layout.columns,
          rows: retainedLayer.layout.rows,
        }),
        sourceMapping: expect.objectContaining({
          strategy: retainedLayer.sourceMapping.strategy,
          sourceWeights: retainedLayer.sourceMapping.sourceWeights,
        }),
        effects: expect.objectContaining({
          blur: retainedLayer.effects.blur,
          kaleidoscopeSegments: retainedLayer.effects.kaleidoscopeSegments,
        }),
        compositing: expect.objectContaining({
          blendMode: retainedLayer.compositing.blendMode,
          opacity: retainedLayer.compositing.opacity,
        }),
        finish: expect.objectContaining({
          shadowOpacity: retainedLayer.finish.shadowOpacity,
          brightness: retainedLayer.finish.brightness,
        }),
        activeSeed: retainedLayer.activeSeed,
      }),
    );
    expect(updatedProject.selectedLayerId).toBe(retainedLayer.id);
  });

  it("undoes and redoes added sources", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createSolidAsset(project.id);
    const preparedAsset = createPreparedAssetRecord(asset);
    createGeneratedSourceAsset.mockResolvedValue(preparedAsset);

    await useAppStore.getState().addSolidSource({
      name: "",
      color: "#123456",
    });

    expect(useAppStore.getState().assets.map((entry) => entry.id)).toEqual([asset.id]);
    expect(getActiveProjectView()?.sourceIds).toEqual([asset.id]);
    expect(useAppStore.getState().canUndo).toBe(true);

    await useAppStore.getState().undo();

    expect(useAppStore.getState().assets).toHaveLength(0);
    expect(getActiveProjectView()?.sourceIds).toEqual([]);
    expect(deleteAssetsAtomically).toHaveBeenCalledWith(
      expect.objectContaining({
        assets: [asset],
      }),
    );
    expect(useAppStore.getState().canRedo).toBe(true);

    await useAppStore.getState().redo();

    expect(useAppStore.getState().assets.map((entry) => entry.id)).toEqual([asset.id]);
    expect(getActiveProjectView()?.sourceIds).toEqual([asset.id]);
    expect(persistAssetCreationsAtomically).toHaveBeenCalledWith(
      expect.objectContaining({
        assets: [preparedAsset],
      }),
    );
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
    const preparedAsset = createPreparedAssetRecord(asset);
    vi.mocked(captureAssetSnapshot).mockResolvedValueOnce(preparedAsset);

    await useAppStore.getState().removeSource(asset.id);

    expect(useAppStore.getState().assets).toHaveLength(0);
    expect(getActiveProjectView()?.sourceIds).toEqual([]);
    expect(deleteAssetsAtomically).toHaveBeenCalledWith(
      expect.objectContaining({
        assets: [asset],
      }),
    );
    expect(useAppStore.getState().canUndo).toBe(true);

    await useAppStore.getState().undo();

    expect(useAppStore.getState().assets.map((entry) => entry.id)).toEqual([asset.id]);
    expect(getActiveProjectView()?.sourceIds).toEqual([asset.id]);
    expect(persistAssetCreationsAtomically).toHaveBeenCalledWith(
      expect.objectContaining({
        assets: [preparedAsset],
      }),
    );
    expect(useAppStore.getState().canRedo).toBe(true);

    await useAppStore.getState().redo();

    expect(useAppStore.getState().assets).toHaveLength(0);
    expect(getActiveProjectView()?.sourceIds).toEqual([]);
    expect(deleteAssetsAtomically).toHaveBeenLastCalledWith(
      expect.objectContaining({
        assets: [asset],
      }),
    );
    expect(useAppStore.getState().canRedo).toBe(false);
  });

  it("appends draw strokes as a single undoable history entry", async () => {
    await useAppStore.getState().updateSelectedLayer((layer) => ({
      ...layer,
      layout: {
        ...layer.layout,
        family: "draw",
      },
    }));

    await useAppStore.getState().appendDrawStroke({
      id: "stroke_test",
      points: [
        { x: 10, y: 20 },
        { x: 40, y: 60 },
      ],
    });

    expect(getActiveProjectView()?.draw.strokes).toEqual([
      {
        id: "stroke_test",
        points: [
          { x: 10, y: 20 },
          { x: 40, y: 60 },
        ],
      },
    ]);
    expect(useAppStore.getState().canUndo).toBe(true);

    await useAppStore.getState().undo();
    expect(getActiveProjectView()?.draw.strokes).toEqual([]);
    expect(useAppStore.getState().canRedo).toBe(true);

    await useAppStore.getState().redo();
    expect(getActiveProjectView()?.draw.strokes).toEqual([
      {
        id: "stroke_test",
        points: [
          { x: 10, y: 20 },
          { x: 40, y: 60 },
        ],
      },
    ]);
  });

  it("clears draw strokes and restores them with undo", async () => {
    const project = useAppStore.getState().projects[0]!;
    const selectedLayer = project.layers[0]!;
    useAppStore.setState((state) => ({
      ...state,
      projects: [
        normalizeProjectDocument({
          ...serializeProjectDocument(project),
          layers: [
            {
              ...selectedLayer,
              layout: {
                ...selectedLayer.layout,
                family: "draw",
              },
              draw: {
                ...selectedLayer.draw,
                strokes: [
                  {
                    id: "stroke_keep",
                    points: [
                      { x: 100, y: 120 },
                      { x: 180, y: 220 },
                    ],
                  },
                ],
              },
            },
          ],
          selectedLayerId: selectedLayer.id,
        }),
      ],
    }));

    await useAppStore.getState().clearDrawLayer();

    expect(getActiveProjectView()?.draw.strokes).toEqual([]);

    await useAppStore.getState().undo();

    expect(getActiveProjectView()?.draw.strokes).toEqual([
      {
        id: "stroke_keep",
        points: [
          { x: 100, y: 120 },
          { x: 180, y: 220 },
        ],
      },
    ]);
  });

  it("keeps source state unchanged when atomic removal fails", async () => {
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
    vi.mocked(captureAssetSnapshot).mockResolvedValueOnce(createPreparedAssetRecord(asset));
    vi.mocked(deleteAssetsAtomically).mockRejectedValueOnce(new Error("delete failed"));

    await useAppStore.getState().removeSource(asset.id);

    expect(useAppStore.getState().assets.map((entry) => entry.id)).toEqual([asset.id]);
    expect(useAppStore.getState().status).toBe("Could not remove source: delete failed");
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
        return createPreparedAssetRecord(firstAsset);
      })
      .mockImplementationOnce(async () => {
        progressSnapshots.push(
          JSON.stringify(useAppStore.getState().sourceImportProgress),
        );
        return createPreparedAssetRecord(secondAsset);
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

  it("rolls back imported source state when atomic persistence fails", async () => {
    const project = useAppStore.getState().projects[0]!;
    const files = [new File(["a"], "a.jpg", { type: "image/jpeg" })];
    const payload = { width: 10 } as never;
    const asset = createImageAsset(project.id, "asset_image_fail");

    vi.mocked(processImageFile).mockResolvedValueOnce(payload);
    vi.mocked(persistProcessedAsset).mockResolvedValueOnce(createPreparedAssetRecord(asset));
    vi.mocked(persistAssetCreationsAtomically).mockRejectedValueOnce(new Error("disk full"));

    await useAppStore.getState().importFiles(files);

    expect(useAppStore.getState().assets).toHaveLength(0);
    expect(getActiveProjectView()?.sourceIds).toEqual([]);
    expect(useAppStore.getState().sourceImportProgress).toBeNull();
    expect(useAppStore.getState().status).toBe("Import failed: disk full");
  });

  it("does not use source import progress for generated sources", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createSolidAsset(project.id);
    createGeneratedSourceAsset.mockResolvedValue(createPreparedAssetRecord(asset));

    await useAppStore.getState().addSolidSource({
      name: "",
      color: "#123456",
    });

    expect(useAppStore.getState().sourceImportProgress).toBeNull();
  });

  it("adds perlin sources through the generated source pipeline", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createPerlinAsset(project.id);
    createGeneratedSourceAsset.mockResolvedValue(createPreparedAssetRecord(asset));

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
    expect(getActiveProjectView()?.sourceIds).toEqual([asset.id]);
    expect(useAppStore.getState().status).toBe("Perlin source added.");
  });

  it("adds cellular sources through the generated source pipeline", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createCellularAsset(project.id);
    createGeneratedSourceAsset.mockResolvedValue(createPreparedAssetRecord(asset));

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
    createGeneratedSourceAsset.mockResolvedValue(createPreparedAssetRecord(asset));

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
    createGeneratedSourceAsset.mockResolvedValue(createPreparedAssetRecord(asset));

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
    const updatedPreparedAsset = createPreparedAssetRecord(updatedAsset);
    vi.mocked(updateGeneratedSourceAsset).mockResolvedValueOnce(updatedPreparedAsset);

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
    expect(persistAssetUpdatesAtomically).toHaveBeenCalledWith(
      expect.objectContaining({
        assets: [updatedPreparedAsset],
      }),
    );
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
    const updatedPreparedAsset = createPreparedAssetRecord(updatedAsset);
    vi.mocked(updateGeneratedSourceAsset).mockResolvedValueOnce(updatedPreparedAsset);

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
    expect(persistAssetUpdatesAtomically).toHaveBeenCalledWith(
      expect.objectContaining({
        assets: [updatedPreparedAsset],
      }),
    );
    expect(useAppStore.getState().status).toBe("Perlin source updated.");
  });

  it("keeps generated sources unchanged when atomic update persistence fails", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createPerlinAsset(project.id);
    const updatedAsset: PerlinSourceAsset = {
      ...asset,
      name: "Updated Perlin",
      recipe: {
        ...asset.recipe,
        scale: 0.9,
      },
    };

    useAppStore.setState((state) => ({
      ...state,
      assets: [asset],
      projects: [{ ...project, sourceIds: [asset.id] }],
    }));
    vi.mocked(updateGeneratedSourceAsset).mockResolvedValueOnce(
      createPreparedAssetRecord(updatedAsset),
    );
    vi.mocked(persistAssetUpdatesAtomically).mockRejectedValueOnce(
      new Error("persist failed"),
    );

    await useAppStore.getState().updateGeneratedSource(asset.id, {
      name: "Updated Perlin",
      color: "#0f766e",
      scale: 0.9,
      detail: asset.recipe.detail,
      contrast: asset.recipe.contrast,
      distortion: asset.recipe.distortion,
      seed: asset.recipe.seed,
    });

    expect(useAppStore.getState().assets[0]).toEqual(asset);
    expect(useAppStore.getState().status).toBe("Could not update source: persist failed");
  });

  it("clears busy state when export rendering fails", async () => {
    const project = useAppStore.getState().projects[0]!;
    vi.mocked(exportProjectImage).mockRejectedValueOnce(new Error("render failed"));

    await useAppStore.getState().exportCurrentImage(project, [], async () => null);

    expect(useAppStore.getState().busy).toBe(false);
    expect(useAppStore.getState().status).toBe(
      "Could not export image: render failed",
    );
    expect(useAppStore.getState().exportFilenameReservations).toEqual({});
  });

  it("suggests unique image export filenames during the current session", async () => {
    const project = useAppStore.getState().projects[0]!;

    await useAppStore.getState().exportCurrentImage(project, [], async () => null);
    await useAppStore.getState().exportCurrentImage(project, [], async () => null);
    await useAppStore.getState().exportCurrentImage(project, [], async () => null);

    expect(downloadBlob).toHaveBeenNthCalledWith(
      1,
      expect.any(Blob),
      "history-test.png",
    );
    expect(downloadBlob).toHaveBeenNthCalledWith(
      2,
      expect.any(Blob),
      "history-test-2.png",
    );
    expect(downloadBlob).toHaveBeenNthCalledWith(
      3,
      expect.any(Blob),
      "history-test-3.png",
    );
  });

  it("tracks image export filename reservations per exact extension", async () => {
    const project = {
      ...useAppStore.getState().projects[0]!,
      export: {
        ...useAppStore.getState().projects[0]!.export,
        format: "image/jpeg" as const,
      },
    };

    await useAppStore.getState().exportCurrentImage(project, [], async () => null);
    await useAppStore.getState().exportCurrentImage(project, [], async () => null);

    expect(downloadBlob).toHaveBeenNthCalledWith(
      1,
      expect.any(Blob),
      "history-test.jpg",
    );
    expect(downloadBlob).toHaveBeenNthCalledWith(
      2,
      expect.any(Blob),
      "history-test-2.jpg",
    );
  });

  it("keeps workspace stable when bundle import persistence fails", async () => {
    const project = useAppStore.getState().projects[0]!;
    const beforeState = useAppStore.getState();

    vi.mocked(persistImportedProjectBundle).mockRejectedValueOnce(
      new Error("disk full"),
    );

    await useAppStore.getState().resolveBundleImport(
      {
        fileName: "sample.image-compositor.zip",
        projectId: project.id,
        projectTitle: project.title,
        conflictProject: project,
        bundle: {
          manifest: {
            version: 3,
            projectId: project.id,
            exportedAt: new Date().toISOString(),
            assetIds: [],
            versionIds: [],
          },
          projectDoc: project,
          versionDocs: [],
          assetDocs: [],
          assetBlobs: {},
          versionBlobs: {},
        },
      },
      "replace",
    );

    expect(useAppStore.getState().busy).toBe(false);
    expect(useAppStore.getState().status).toBe(
      "Could not import project bundle: disk full",
    );
    expect(useAppStore.getState().activeProjectId).toBe(beforeState.activeProjectId);
  });
});

describe("randomizeVariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("updates activeSeed on every visible layer in one undo step", async () => {
    await useAppStore.getState().addLayer();
    const beforeProject = useAppStore.getState().projects[0]!;
    expect(beforeProject.layers.length).toBe(2);
    const seedsBefore = beforeProject.layers.map((layer) => layer.activeSeed);

    let index = 0;
    const values = [0.1, 0.2, 0.3, 0.4];
    vi.spyOn(Math, "random").mockImplementation(() => values[index++] ?? 0.99);

    await useAppStore.getState().randomizeVariant({ layerScope: "visible" });

    const afterProject = useAppStore.getState().projects[0]!;
    expect(afterProject.layers.map((layer) => layer.activeSeed)).not.toEqual(seedsBefore);
    expect(useAppStore.getState().canUndo).toBe(true);
  });

  it("updates only the selected layer when layerScope is selected", async () => {
    await useAppStore.getState().addLayer();
    const layer0Id = useAppStore.getState().projects[0]!.layers[0]!.id;
    await useAppStore.getState().selectLayer(layer0Id);

    const seed0Before = useAppStore.getState().projects[0]!.layers[0]!.activeSeed;
    const seed1Before = useAppStore.getState().projects[0]!.layers[1]!.activeSeed;

    vi.spyOn(Math, "random").mockReturnValue(0.5);

    await useAppStore.getState().randomizeVariant({ layerScope: "selected" });

    const after = useAppStore.getState().projects[0]!;
    expect(after.layers.find((layer) => layer.id === layer0Id)!.activeSeed).not.toBe(
      seed0Before,
    );
    expect(after.layers.find((layer) => layer.id !== layer0Id)!.activeSeed).toBe(
      seed1Before,
    );
  });

  it("regenerates procedural sources and clears history when includeTextures is true", async () => {
    const project = useAppStore.getState().projects[0]!;
    const asset = createPerlinAsset(project.id);

    useAppStore.setState((state) => ({
      ...state,
      assets: [asset],
    }));

    await useAppStore.getState().updateProject((draft) => ({
      ...draft,
      layers: draft.layers.map((layer, index) =>
        index === 0 ? { ...layer, sourceIds: [asset.id] } : layer,
      ),
    }));

    await useAppStore.getState().updateSelectedLayer((layer) => ({
      ...layer,
      layout: {
        ...layer.layout,
        columns: layer.layout.columns + 1,
      },
    }));
    expect(useAppStore.getState().canUndo).toBe(true);

    const updatedAsset: PerlinSourceAsset = {
      ...asset,
      recipe: { ...asset.recipe, seed: 888_888 },
    };
    vi.mocked(updateGeneratedSourceAsset).mockResolvedValue(
      createPreparedAssetRecord(updatedAsset),
    );
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    await useAppStore.getState().randomizeVariant({
      layerScope: "selected",
      includeTextures: true,
    });

    expect(updateGeneratedSourceAsset).toHaveBeenCalled();
    expect(persistAssetUpdatesAtomically).toHaveBeenCalled();
    expect(useAppStore.getState().canUndo).toBe(false);
    expect(
      (useAppStore.getState().assets[0] as PerlinSourceAsset).recipe.seed,
    ).toBe(888_888);
  });
});
