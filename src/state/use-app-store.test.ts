import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, createGeneratedSourceAsset, deleteBlob, readBlob, writeBlob } = vi.hoisted(() => ({
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
  deleteBlob: vi.fn<() => Promise<void>>(async () => undefined),
  readBlob: vi.fn<(path: string) => Promise<Blob | null>>(async () => null),
  writeBlob: vi.fn<(path: string, blob: Blob) => Promise<void>>(async () => undefined),
}));

vi.mock("@/lib/assets", () => ({
  createGeneratedSourceAsset,
  duplicateSourceAsset: vi.fn(),
  normalizeSourceAsset: vi.fn((asset) => asset),
  persistProcessedAsset: vi.fn(),
  updateGeneratedSourceAsset: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/download", () => ({ downloadBlob: vi.fn() }));
vi.mock("@/lib/image-worker-client", () => ({ processImageFile: vi.fn() }));
vi.mock("@/lib/opfs", () => ({ deleteBlob, readBlob, writeBlob }));
vi.mock("@/lib/render", () => ({ exportProjectImage: vi.fn() }));
vi.mock("@/lib/serializer", () => ({
  createImportCopy: vi.fn(),
  exportProjectBundle: vi.fn(),
  loadProjectBundle: vi.fn(),
  persistImportedProjectBundle: vi.fn(),
}));

import { createProjectDocument } from "@/lib/project-defaults";
import { useAppStore } from "@/state/use-app-store";
import type { SourceAsset } from "@/types/project";

function resetStore() {
  const project = createProjectDocument("History Test");
  useAppStore.setState({
    ready: true,
    busy: false,
    status: "Ready.",
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
