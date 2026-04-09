import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  project: undefined as Record<string, unknown> | undefined,
  assets: [] as Record<string, unknown>[],
  versions: [] as Record<string, unknown>[],
  kvRecord: undefined as { key: string; value: string } | undefined,
  blobs: new Map<string, Blob>(),
  failProjectDelete: false,
  failProjectPut: false,
}));

const db = vi.hoisted(() => ({
  transaction: vi.fn(async (...args: unknown[]) => {
    const callback = args.at(-1);
    if (typeof callback !== "function") {
      throw new Error("Missing transaction callback.");
    }

    return callback();
  }),
  projects: {
    get: vi.fn(async (id: string) =>
      state.project?.id === id ? state.project : undefined,
    ),
    put: vi.fn(async (project: Record<string, unknown>) => {
      if (state.failProjectPut) {
        throw new Error("project put failed");
      }

      state.project = project;
    }),
    delete: vi.fn(async (id: string) => {
      if (state.failProjectDelete) {
        throw new Error("project delete failed");
      }

      if (state.project?.id === id) {
        state.project = undefined;
      }
    }),
    toArray: vi.fn(async () => (state.project ? [state.project] : [])),
  },
  assets: {
    get: vi.fn(async (id: string) =>
      state.assets.find((asset) => asset.id === id),
    ),
    bulkPut: vi.fn(async (assets: Record<string, unknown>[]) => {
      for (const asset of assets) {
        state.assets = [
          ...state.assets.filter((entry) => entry.id !== asset.id),
          asset,
        ];
      }
    }),
    bulkDelete: vi.fn(async (ids: string[]) => {
      const idSet = new Set(ids);
      state.assets = state.assets.filter((asset) => !idSet.has(String(asset.id)));
    }),
    toArray: vi.fn(async () => [...state.assets]),
    where: vi.fn((key: string) => ({
      equals: vi.fn((value: string) => ({
        toArray: vi.fn(async () =>
          state.assets.filter((asset) => asset[key] === value),
        ),
      })),
    })),
  },
  versions: {
    get: vi.fn(async (id: string) =>
      state.versions.find((version) => version.id === id),
    ),
    bulkPut: vi.fn(async (versions: Record<string, unknown>[]) => {
      for (const version of versions) {
        state.versions = [
          ...state.versions.filter((entry) => entry.id !== version.id),
          version,
        ];
      }
    }),
    bulkDelete: vi.fn(async (ids: string[]) => {
      const idSet = new Set(ids);
      state.versions = state.versions.filter(
        (version) => !idSet.has(String(version.id)),
      );
    }),
    toArray: vi.fn(async () => [...state.versions]),
    where: vi.fn((key: string) => ({
      equals: vi.fn((value: string) => ({
        toArray: vi.fn(async () =>
          state.versions.filter((version) => version[key] === value),
        ),
      })),
    })),
  },
  kv: {
    get: vi.fn(async () => state.kvRecord),
    put: vi.fn(async (record: { key: string; value: string }) => {
      state.kvRecord = record;
    }),
    delete: vi.fn(async () => {
      state.kvRecord = undefined;
    }),
  },
}));

const deleteBlob = vi.hoisted(() =>
  vi.fn(async (path: string) => {
    state.blobs.delete(path);
  }),
);
const readBlob = vi.hoisted(() =>
  vi.fn(async (path: string) => state.blobs.get(path) ?? null),
);
const writeBlob = vi.hoisted(() =>
  vi.fn(async (path: string, blob: Blob) => {
    state.blobs.set(path, blob);
  }),
);

vi.mock("@/lib/assets", () => ({
  normalizeSourceAsset: vi.fn((asset) => asset),
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/opfs", () => ({ deleteBlob, readBlob, writeBlob }));

import {
  createProjectDocument,
  serializeProjectDocument,
} from "@/lib/project-defaults";
import {
  deleteProjectDataAtomically,
  persistImportedProjectBundleAtomically,
} from "@/lib/workspace-storage";
import type { ImportedProjectBundle, ProjectVersion, SourceAsset } from "@/types/project";

function createImageAsset(projectId: string, id = "asset_1"): SourceAsset {
  return {
    id,
    kind: "image",
    projectId,
    name: "Asset",
    originalFileName: `${id}.png`,
    mimeType: "image/png",
    width: 100,
    height: 100,
    orientation: 1,
    originalPath: `assets/original/${id}.png`,
    normalizedPath: `assets/normalized/${id}.png`,
    previewPath: `assets/previews/${id}.webp`,
    averageColor: "#112233",
    palette: ["#112233"],
    luminance: 0.25,
    createdAt: "2026-04-09T00:00:00.000Z",
  };
}

function createVersion(projectId: string, snapshot = createProjectDocument("Snapshot")): ProjectVersion {
  return {
    id: "version_1",
    projectId,
    label: "Snapshot 1",
    createdAt: "2026-04-09T00:00:00.000Z",
    thumbnailPath: "versions/version_1.webp",
    snapshot,
  };
}

describe("workspace storage", () => {
  beforeEach(() => {
    state.project = undefined;
    state.assets = [];
    state.versions = [];
    state.kvRecord = undefined;
    state.blobs = new Map();
    state.failProjectDelete = false;
    state.failProjectPut = false;
    vi.clearAllMocks();
  });

  it("restores blobs and records when permanent delete fails", async () => {
    const project = createProjectDocument("Delete Me");
    const asset = createImageAsset(project.id);
    const version = createVersion(project.id, project);

    state.project = serializeProjectDocument(project) as unknown as Record<string, unknown>;
    state.assets = [asset] as unknown as Record<string, unknown>[];
    state.versions = [version] as unknown as Record<string, unknown>[];
    state.blobs.set(asset.originalPath, new Blob(["original"]));
    state.blobs.set(asset.normalizedPath, new Blob(["normalized"]));
    state.blobs.set(asset.previewPath, new Blob(["preview"]));
    state.blobs.set(version.thumbnailPath!, new Blob(["thumb"]));
    state.failProjectDelete = true;

    await expect(deleteProjectDataAtomically(project.id)).rejects.toThrow(
      "project delete failed",
    );

    expect(state.project).toBeDefined();
    expect(state.assets).toHaveLength(1);
    expect(state.versions).toHaveLength(1);
    expect(await state.blobs.get(asset.originalPath)?.text()).toBe("original");
    expect(await state.blobs.get(version.thumbnailPath!)?.text()).toBe("thumb");
    expect(writeBlob).toHaveBeenCalled();
  });

  it("rolls imported bundles back when persistence fails mid-transaction", async () => {
    const existingProject = createProjectDocument("Existing");
    const existingAsset = createImageAsset(existingProject.id);
    const existingVersion = createVersion(existingProject.id, existingProject);
    const importedProject = createProjectDocument("Imported");
    importedProject.id = existingProject.id;
    const importedAsset = createImageAsset(importedProject.id);
    const importedVersion = createVersion(importedProject.id, importedProject);

    state.project = serializeProjectDocument(existingProject) as unknown as Record<string, unknown>;
    state.assets = [existingAsset] as unknown as Record<string, unknown>[];
    state.versions = [existingVersion] as unknown as Record<string, unknown>[];
    state.kvRecord = { key: "activeProjectId", value: existingProject.id };
    state.blobs.set(existingAsset.originalPath, new Blob(["old-original"]));
    state.blobs.set(existingAsset.normalizedPath, new Blob(["old-normalized"]));
    state.blobs.set(existingAsset.previewPath, new Blob(["old-preview"]));
    state.blobs.set(existingVersion.thumbnailPath!, new Blob(["old-thumb"]));
    state.failProjectPut = true;

    const bundle: ImportedProjectBundle = {
      manifest: {
        version: 3,
        projectId: importedProject.id,
        exportedAt: "2026-04-09T00:00:00.000Z",
        assetIds: [importedAsset.id],
        versionIds: [importedVersion.id],
      },
      projectDoc: importedProject,
      versionDocs: [importedVersion],
      assetDocs: [importedAsset],
      assetBlobs: {
        [importedAsset.originalPath]: new Blob(["new-original"]),
        [importedAsset.normalizedPath]: new Blob(["new-normalized"]),
        [importedAsset.previewPath]: new Blob(["new-preview"]),
      },
      versionBlobs: {
        [importedVersion.thumbnailPath!]: new Blob(["new-thumb"]),
      },
    };

    await expect(
      persistImportedProjectBundleAtomically(bundle),
    ).rejects.toThrow("project put failed");

    expect(state.project).toEqual(serializeProjectDocument(existingProject));
    expect(state.assets).toEqual([existingAsset]);
    expect(state.versions).toEqual([existingVersion]);
    expect(state.kvRecord).toEqual({
      key: "activeProjectId",
      value: existingProject.id,
    });
    expect(await state.blobs.get(existingAsset.originalPath)?.text()).toBe(
      "old-original",
    );
    expect(await state.blobs.get(existingVersion.thumbnailPath!)?.text()).toBe(
      "old-thumb",
    );
  });
});
