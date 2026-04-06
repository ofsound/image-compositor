import { create } from "zustand";

import {
  createGeneratedSourceAsset,
  duplicateSourceAsset,
  normalizeSourceAsset,
  persistProcessedAsset,
  updateGeneratedSourceAsset,
  type GradientSourceInput,
  type SolidSourceInput,
} from "@/lib/assets";
import { db } from "@/lib/db";
import { downloadBlob } from "@/lib/download";
import { processImageFile } from "@/lib/image-worker-client";
import { makeId } from "@/lib/id";
import { deleteBlob, readBlob, writeBlob } from "@/lib/opfs";
import {
  createProjectDocument,
  normalizeProjectDocument,
  normalizeProjectVersion,
} from "@/lib/project-defaults";
import { exportProjectImage } from "@/lib/render";
import {
  createImportCopy,
  exportProjectBundle,
  loadProjectBundle,
  persistImportedProjectBundle,
} from "@/lib/serializer";
import type {
  BundleImportInspection,
  GradientSourceAsset,
  ProjectDocument,
  ProjectSnapshot,
  ProjectVersion,
  SolidSourceAsset,
  SourceAsset,
} from "@/types/project";

type BundleImportResolution = "replace" | "copy";

interface ProjectChangeHistoryEntry {
  kind: "project-change";
  projectId: string;
  before: ProjectSnapshot;
  after: ProjectSnapshot;
}

interface AddAssetsHistoryEntry {
  kind: "add-assets";
  projectId: string;
  assets: SourceAsset[];
  sourceIdsBefore: string[];
  sourceIdsAfter: string[];
}

interface RemovedAssetSnapshot {
  asset: SourceAsset;
  blobs: {
    original: Blob | null;
    normalized: Blob | null;
    preview: Blob | null;
  };
}

interface RemoveAssetsHistoryEntry {
  kind: "remove-assets";
  projectId: string;
  assets: RemovedAssetSnapshot[];
  sourceIdsBefore: string[];
  sourceIdsAfter: string[];
}

type HistoryEntry =
  | ProjectChangeHistoryEntry
  | AddAssetsHistoryEntry
  | RemoveAssetsHistoryEntry;

interface ProjectHistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

type HistoryByProject = Record<string, ProjectHistoryState>;

interface AppState {
  ready: boolean;
  busy: boolean;
  status: string;
  projects: ProjectDocument[];
  assets: SourceAsset[];
  versions: ProjectVersion[];
  activeProjectId: string | null;
  historyByProject: HistoryByProject;
  canUndo: boolean;
  canRedo: boolean;
  bootstrap: () => Promise<void>;
  setStatus: (status: string) => void;
  createProject: () => Promise<void>;
  renameProject: (projectId: string, title: string) => Promise<void>;
  duplicateProject: (projectId: string, title: string) => Promise<void>;
  trashProject: (projectId: string) => Promise<void>;
  restoreProject: (projectId: string) => Promise<void>;
  purgeProject: (projectId: string) => Promise<void>;
  setActiveProject: (projectId: string) => Promise<void>;
  updateProject: (
    updater: (project: ProjectDocument) => ProjectDocument,
    options?: { recordHistory?: boolean },
  ) => Promise<void>;
  importFiles: (files: FileList | File[]) => Promise<void>;
  addSolidSource: (input: SolidSourceInput) => Promise<void>;
  addGradientSource: (input: GradientSourceInput) => Promise<void>;
  removeSource: (assetId: string) => Promise<void>;
  updateGeneratedSource: (
    assetId: string,
    input: SolidSourceInput | GradientSourceInput,
  ) => Promise<void>;
  randomizeSeed: () => Promise<void>;
  saveVersion: (label: string, thumbnailBlob?: Blob | null) => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;
  exportCurrentImage: (
    project: ProjectDocument,
    assets: SourceAsset[],
    bitmapLookup: (asset: SourceAsset) => Promise<Blob | null>,
  ) => Promise<void>;
  exportCurrentBundle: () => Promise<void>;
  inspectBundleImport: (file: File) => Promise<BundleImportInspection>;
  resolveBundleImport: (
    inspection: BundleImportInspection,
    resolution: BundleImportResolution,
  ) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

function sortByUpdated(projects: ProjectDocument[]) {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function sortAssetsByCreated(assets: SourceAsset[]) {
  return [...assets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function sortVersionsByCreated(versions: ProjectVersion[]) {
  return [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function getLiveProjects(projects: ProjectDocument[]) {
  return projects.filter((project) => project.deletedAt === null);
}

function getActiveProject(state: Pick<AppState, "projects" | "activeProjectId">) {
  return (
    state.projects.find(
      (project) => project.id === state.activeProjectId && project.deletedAt === null,
    ) ?? null
  );
}

function getNextProjectTitle(projects: ProjectDocument[]) {
  return `Study ${getLiveProjects(projects).length + 1}`;
}

function createProjectSnapshot(project: ProjectDocument): ProjectSnapshot {
  return structuredClone({
    sourceIds: project.sourceIds,
    canvas: project.canvas,
    layout: project.layout,
    sourceMapping: project.sourceMapping,
    effects: project.effects,
    compositing: project.compositing,
    export: project.export,
    activeSeed: project.activeSeed,
    presets: project.presets,
    passes: project.passes,
  });
}

function snapshotsEqual(a: ProjectSnapshot, b: ProjectSnapshot) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function getProjectHistory(historyByProject: HistoryByProject, projectId: string | null) {
  if (!projectId) {
    return { past: [], future: [] } satisfies ProjectHistoryState;
  }

  return historyByProject[projectId] ?? { past: [], future: [] };
}

function getHistoryFlags(historyByProject: HistoryByProject, projectId: string | null) {
  const history = getProjectHistory(historyByProject, projectId);
  return {
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

function patchHistory(
  historyByProject: HistoryByProject,
  projectId: string,
  updater: (history: ProjectHistoryState) => ProjectHistoryState,
) {
  return {
    ...historyByProject,
    [projectId]: updater(getProjectHistory(historyByProject, projectId)),
  };
}

function clearProjectHistory(historyByProject: HistoryByProject, projectId: string) {
  if (!(projectId in historyByProject)) return historyByProject;

  const nextHistory = { ...historyByProject };
  delete nextHistory[projectId];
  return nextHistory;
}

function withHistoryFlags(
  partial: Partial<AppState>,
  historyByProject: HistoryByProject,
  activeProjectId: string | null,
) {
  return {
    ...partial,
    ...getHistoryFlags(historyByProject, activeProjectId),
  };
}

function upsertProject(projects: ProjectDocument[], project: ProjectDocument) {
  return sortByUpdated(
    projects.map((entry) => (entry.id === project.id ? normalizeProjectDocument(project) : entry)),
  );
}

function removeAssetsById(assets: SourceAsset[], assetIds: string[]) {
  const assetIdSet = new Set(assetIds);
  return sortAssetsByCreated(assets.filter((asset) => !assetIdSet.has(asset.id)));
}

async function restoreRemovedAssetSnapshots(assets: RemovedAssetSnapshot[]) {
  for (const entry of assets) {
    const { asset, blobs } = entry;
    const writes: Promise<void>[] = [];
    if (blobs.original) {
      writes.push(writeBlob(asset.originalPath, blobs.original));
    }
    if (blobs.normalized) {
      writes.push(writeBlob(asset.normalizedPath, blobs.normalized));
    }
    if (blobs.preview) {
      writes.push(writeBlob(asset.previewPath, blobs.preview));
    }
    await Promise.all(writes);
  }
}

async function deleteAssetFiles(assets: SourceAsset[]) {
  await Promise.all(
    assets.flatMap((asset) => [
      deleteBlob(asset.originalPath),
      deleteBlob(asset.normalizedPath),
      deleteBlob(asset.previewPath),
    ]),
  );
}

async function persistActiveProjectId(projectId: string | null) {
  if (!projectId) return;
  await db.kv.put({ key: "activeProjectId", value: projectId });
}

async function loadWorkspaceSnapshot(preferredActiveProjectId?: string | null) {
  const [storedProjects, storedAssets, storedVersions, activeRecord] = await Promise.all([
    db.projects.toArray(),
    db.assets.toArray(),
    db.versions.toArray(),
    db.kv.get("activeProjectId"),
  ]);

  let projects = sortByUpdated(storedProjects.map((project) => normalizeProjectDocument(project)));
  const assets = sortAssetsByCreated(storedAssets.map((asset) => normalizeSourceAsset(asset)));
  const versions = sortVersionsByCreated(
    storedVersions.map((version) => normalizeProjectVersion(version)),
  );
  let activeProjectId = preferredActiveProjectId ?? activeRecord?.value ?? null;
  const liveProjects = getLiveProjects(projects);

  if (!liveProjects.some((project) => project.id === activeProjectId)) {
    activeProjectId = sortByUpdated(liveProjects)[0]?.id ?? null;
  }

  if (liveProjects.length === 0) {
    const project = createProjectDocument(
      projects.length === 0 ? "Launch Study" : getNextProjectTitle(projects),
    );
    await db.projects.put(project);
    projects = sortByUpdated([project, ...projects]);
    activeProjectId = project.id;
  }

  await persistActiveProjectId(activeProjectId);

  return {
    projects,
    assets,
    versions,
    activeProjectId,
  };
}

async function syncWorkspace(
  set: (partial: Partial<AppState>) => void,
  options: {
    activeProjectId?: string | null;
    busy?: boolean;
    historyByProject: HistoryByProject;
    ready?: boolean;
    status: string;
  },
) {
  const snapshot = await loadWorkspaceSnapshot(options.activeProjectId);
  set(
    withHistoryFlags(
      {
        ...snapshot,
        busy: options.busy ?? false,
        ready: options.ready ?? true,
        status: options.status,
      },
      options.historyByProject,
      snapshot.activeProjectId,
    ),
  );
}

async function deleteProjectData(projectId: string) {
  const [assets, versions] = await Promise.all([
    db.assets.where("projectId").equals(projectId).toArray(),
    db.versions.where("projectId").equals(projectId).toArray(),
  ]);

  await Promise.all([
    ...assets.flatMap((asset) => [
      deleteBlob(asset.originalPath),
      deleteBlob(asset.normalizedPath),
      deleteBlob(asset.previewPath),
    ]),
    ...versions
      .map((version) => version.thumbnailPath)
      .filter((path): path is string => Boolean(path))
      .map((path) => deleteBlob(path)),
  ]);

  await Promise.all([
    db.assets.bulkDelete(assets.map((asset) => asset.id)),
    db.versions.bulkDelete(versions.map((version) => version.id)),
    db.projects.delete(projectId),
  ]);
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  busy: false,
  status: "Booting workspace…",
  projects: [],
  assets: [],
  versions: [],
  activeProjectId: null,
  historyByProject: {},
  canUndo: false,
  canRedo: false,

  async bootstrap() {
    set({ busy: true, status: "Loading local workspace…" });
    await syncWorkspace(set, {
      busy: false,
      historyByProject: get().historyByProject,
      ready: true,
      status: "Ready.",
    });
  },

  setStatus(status) {
    set({ status });
  },

  async createProject() {
    const project = createProjectDocument(getNextProjectTitle(get().projects));
    await Promise.all([db.projects.put(project), persistActiveProjectId(project.id)]);
    await syncWorkspace(set, {
      activeProjectId: project.id,
      historyByProject: get().historyByProject,
      status: "Created a new project.",
    });
  },

  async renameProject(projectId, title) {
    const nextTitle = title.trim() || "Untitled Composition";
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) return;

    await db.projects.put({
      ...project,
      title: nextTitle,
      updatedAt: new Date().toISOString(),
    });

    await syncWorkspace(set, {
      activeProjectId: get().activeProjectId,
      historyByProject: get().historyByProject,
      status: "Project renamed.",
    });
  },

  async duplicateProject(projectId, title) {
    const sourceProject = get().projects.find(
      (entry) => entry.id === projectId && entry.deletedAt === null,
    );
    if (!sourceProject) return;

    set({ busy: true, status: "Duplicating project…" });
    const nextProjectId = makeId("project");
    const nextTitle = title.trim() || `${sourceProject.title} Copy`;
    const projectAssets = get().assets.filter((asset) => asset.projectId === sourceProject.id);
    const duplicatedAssets = await Promise.all(
      projectAssets.map((asset) => duplicateSourceAsset(asset, nextProjectId)),
    );
    const sourceIdMap = new Map(projectAssets.map((asset, index) => [asset.id, duplicatedAssets[index]?.id ?? asset.id]));
    const now = new Date().toISOString();
    const duplicateProject: ProjectDocument = {
      ...sourceProject,
      id: nextProjectId,
      title: nextTitle,
      sourceIds: sourceProject.sourceIds.map((sourceId) => sourceIdMap.get(sourceId) ?? sourceId),
      currentVersionId: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await Promise.all([
      db.projects.put(duplicateProject),
      db.assets.bulkPut(duplicatedAssets),
      persistActiveProjectId(duplicateProject.id),
    ]);

    await syncWorkspace(set, {
      activeProjectId: duplicateProject.id,
      busy: false,
      historyByProject: get().historyByProject,
      status: "Project duplicated.",
    });
  },

  async trashProject(projectId) {
    const project = get().projects.find(
      (entry) => entry.id === projectId && entry.deletedAt === null,
    );
    if (!project) return;

    await db.projects.put({
      ...project,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await syncWorkspace(set, {
      activeProjectId: get().activeProjectId === projectId ? null : get().activeProjectId,
      historyByProject: get().historyByProject,
      status: "Project moved to trash.",
    });
  },

  async restoreProject(projectId) {
    const project = get().projects.find((entry) => entry.id === projectId);
    if (!project) return;

    await db.projects.put({
      ...project,
      deletedAt: null,
      updatedAt: new Date().toISOString(),
    });

    await syncWorkspace(set, {
      activeProjectId: get().activeProjectId,
      historyByProject: get().historyByProject,
      status: "Project restored.",
    });
  },

  async purgeProject(projectId) {
    set({ busy: true, status: "Deleting project permanently…" });
    await deleteProjectData(projectId);
    const historyByProject = clearProjectHistory(get().historyByProject, projectId);
    set(
      withHistoryFlags(
        { historyByProject },
        historyByProject,
        get().activeProjectId === projectId ? null : get().activeProjectId,
      ),
    );
    await syncWorkspace(set, {
      activeProjectId: get().activeProjectId === projectId ? null : get().activeProjectId,
      busy: false,
      historyByProject,
      status: "Project deleted permanently.",
    });
  },

  async setActiveProject(projectId) {
    const project = get().projects.find(
      (entry) => entry.id === projectId && entry.deletedAt === null,
    );
    if (!project) return;
    await persistActiveProjectId(projectId);
    set(
      withHistoryFlags(
        { activeProjectId: projectId, status: "Project loaded." },
        get().historyByProject,
        projectId,
      ),
    );
  },

  async updateProject(updater, options) {
    const project = getActiveProject(get());
    if (!project) return;

    const before = createProjectSnapshot(project);
    const updatedProject = updater({
      ...project,
      updatedAt: new Date().toISOString(),
    });
    const after = createProjectSnapshot(updatedProject);

    if (snapshotsEqual(before, after)) {
      return;
    }

    await db.projects.put(updatedProject);
    set((state) => {
      const historyByProject =
        options?.recordHistory === false
          ? state.historyByProject
          : patchHistory(state.historyByProject, updatedProject.id, (history) => ({
              past: [
                ...history.past,
                {
                  kind: "project-change",
                  projectId: updatedProject.id,
                  before,
                  after,
                } satisfies ProjectChangeHistoryEntry,
              ],
              future: [],
            }));

      return {
        projects: upsertProject(state.projects, updatedProject),
        historyByProject,
        status: "Draft saved locally.",
        ...getHistoryFlags(historyByProject, state.activeProjectId),
      };
    });
  },

  async importFiles(files) {
    const activeProject = getActiveProject(get());
    if (!activeProject) return;
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    set({ busy: true, status: `Importing ${fileList.length} source image(s)…` });

    try {
      const importedAssets: SourceAsset[] = [];
      for (const file of fileList) {
        const payload = await processImageFile(file);
        const asset = await persistProcessedAsset(file, payload, activeProject.id);
        importedAssets.push(asset);
        await db.assets.put(asset);
      }

      const nextProject = {
        ...activeProject,
        sourceIds: [
          ...new Set([
            ...activeProject.sourceIds,
            ...importedAssets.map((asset) => asset.id),
          ]),
        ],
        updatedAt: new Date().toISOString(),
      };

      await db.projects.put(nextProject);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
          past: [
            ...history.past,
            {
              kind: "add-assets",
              projectId: nextProject.id,
              assets: structuredClone(importedAssets),
              sourceIdsBefore: structuredClone(activeProject.sourceIds),
              sourceIdsAfter: structuredClone(nextProject.sourceIds),
            } satisfies AddAssetsHistoryEntry,
          ],
          future: [],
        }));

        return {
          assets: sortAssetsByCreated([...state.assets, ...importedAssets]),
          projects: upsertProject(state.projects, nextProject),
          historyByProject,
          busy: false,
          status: `Imported ${importedAssets.length} source image(s).`,
          ...getHistoryFlags(historyByProject, state.activeProjectId),
        };
      });
    } catch (error) {
      set({
        busy: false,
        status:
          error instanceof Error ? `Import failed: ${error.message}` : "Import failed.",
      });
    }
  },

  async addSolidSource(input) {
    const activeProject = getActiveProject(get());
    if (!activeProject) return;

    set({ busy: true, status: "Creating solid source…" });

    try {
      const asset = await createGeneratedSourceAsset(
        { kind: "solid", recipe: input, name: input.name },
        activeProject.id,
        activeProject.canvas,
      );
      await db.assets.put(asset);

      const nextProject = {
        ...activeProject,
        sourceIds: [...new Set([...activeProject.sourceIds, asset.id])],
        updatedAt: new Date().toISOString(),
      };

      await db.projects.put(nextProject);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
          past: [
            ...history.past,
            {
              kind: "add-assets",
              projectId: nextProject.id,
              assets: [structuredClone(asset)],
              sourceIdsBefore: structuredClone(activeProject.sourceIds),
              sourceIdsAfter: structuredClone(nextProject.sourceIds),
            } satisfies AddAssetsHistoryEntry,
          ],
          future: [],
        }));

        return {
          assets: sortAssetsByCreated([...state.assets, asset]),
          projects: upsertProject(state.projects, nextProject),
          historyByProject,
          busy: false,
          status: "Solid source added.",
          ...getHistoryFlags(historyByProject, state.activeProjectId),
        };
      });
    } catch (error) {
      set({
        busy: false,
        status:
          error instanceof Error ? `Could not add source: ${error.message}` : "Could not add source.",
      });
    }
  },

  async addGradientSource(input) {
    const activeProject = getActiveProject(get());
    if (!activeProject) return;

    set({ busy: true, status: "Creating gradient source…" });

    try {
      const asset = await createGeneratedSourceAsset(
        { kind: "gradient", recipe: input, name: input.name },
        activeProject.id,
        activeProject.canvas,
      );
      await db.assets.put(asset);

      const nextProject = {
        ...activeProject,
        sourceIds: [...new Set([...activeProject.sourceIds, asset.id])],
        updatedAt: new Date().toISOString(),
      };

      await db.projects.put(nextProject);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
          past: [
            ...history.past,
            {
              kind: "add-assets",
              projectId: nextProject.id,
              assets: [structuredClone(asset)],
              sourceIdsBefore: structuredClone(activeProject.sourceIds),
              sourceIdsAfter: structuredClone(nextProject.sourceIds),
            } satisfies AddAssetsHistoryEntry,
          ],
          future: [],
        }));

        return {
          assets: sortAssetsByCreated([...state.assets, asset]),
          projects: upsertProject(state.projects, nextProject),
          historyByProject,
          busy: false,
          status: "Gradient source added.",
          ...getHistoryFlags(historyByProject, state.activeProjectId),
        };
      });
    } catch (error) {
      set({
        busy: false,
        status:
          error instanceof Error ? `Could not add source: ${error.message}` : "Could not add source.",
      });
    }
  },

  async removeSource(assetId) {
    const activeProject = getActiveProject(get());
    if (!activeProject) return;

    const asset = get().assets.find(
      (entry) => entry.id === assetId && entry.projectId === activeProject.id,
    );
    if (!asset) return;

    set({ busy: true, status: `Removing ${asset.name}…` });

    try {
      const removedAsset: RemovedAssetSnapshot = {
        asset: structuredClone(asset),
        blobs: {
          original: await readBlob(asset.originalPath),
          normalized: await readBlob(asset.normalizedPath),
          preview: await readBlob(asset.previewPath),
        },
      };

      const nextProject = {
        ...activeProject,
        sourceIds: activeProject.sourceIds.filter((sourceId) => sourceId !== asset.id),
        updatedAt: new Date().toISOString(),
      };

      await Promise.all([
        deleteAssetFiles([asset]),
        db.assets.bulkDelete([asset.id]),
        db.projects.put(nextProject),
      ]);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
          past: [
            ...history.past,
            {
              kind: "remove-assets",
              projectId: nextProject.id,
              assets: [removedAsset],
              sourceIdsBefore: structuredClone(activeProject.sourceIds),
              sourceIdsAfter: structuredClone(nextProject.sourceIds),
            } satisfies RemoveAssetsHistoryEntry,
          ],
          future: [],
        }));

        return {
          assets: removeAssetsById(state.assets, [asset.id]),
          projects: upsertProject(state.projects, nextProject),
          historyByProject,
          busy: false,
          status: "Source removed.",
          ...getHistoryFlags(historyByProject, state.activeProjectId),
        };
      });
    } catch (error) {
      set({
        busy: false,
        status:
          error instanceof Error ? `Could not remove source: ${error.message}` : "Could not remove source.",
      });
    }
  },

  async updateGeneratedSource(assetId, input) {
    const activeProject = getActiveProject(get());
    if (!activeProject) return;

    const asset = get().assets.find(
      (entry): entry is SolidSourceAsset | GradientSourceAsset =>
        entry.id === assetId &&
        entry.projectId === activeProject.id &&
        entry.kind !== "image",
    );
    if (!asset) return;

    set({ busy: true, status: `Updating ${asset.kind} source…` });

    try {
      const updatedAsset = await updateGeneratedSourceAsset(asset, input);
      await db.assets.put(updatedAsset);

      const updatedProject = {
        ...activeProject,
        updatedAt: new Date().toISOString(),
      };
      await db.projects.put(updatedProject);

      set((state) => {
        const historyByProject = clearProjectHistory(state.historyByProject, updatedProject.id);
        return {
          assets: sortAssetsByCreated(
            state.assets.map((entry) => (entry.id === updatedAsset.id ? updatedAsset : entry)),
          ),
          projects: sortByUpdated(
            state.projects.map((entry) => (entry.id === updatedProject.id ? updatedProject : entry)),
          ),
          historyByProject,
          busy: false,
          status: `${asset.kind === "solid" ? "Solid" : "Gradient"} source updated.`,
          ...getHistoryFlags(historyByProject, state.activeProjectId),
        };
      });
    } catch (error) {
      set({
        busy: false,
        status:
          error instanceof Error
            ? `Could not update source: ${error.message}`
            : "Could not update source.",
      });
    }
  },

  async randomizeSeed() {
    await get().updateProject((project) => ({
      ...project,
      activeSeed: Math.floor(Math.random() * 1_000_000_000),
    }));
  },

  async saveVersion(label, thumbnailBlob) {
    const project = getActiveProject(get());
    if (!project) return;

    const versionId = makeId("version");
    const thumbnailPath = thumbnailBlob ? `versions/${versionId}.webp` : null;
    if (thumbnailBlob && thumbnailPath) {
      const { writeBlob } = await import("@/lib/opfs");
      await writeBlob(thumbnailPath, thumbnailBlob);
    }

    const version: ProjectVersion = {
      id: versionId,
      projectId: project.id,
      label: label || `Snapshot ${new Date().toLocaleString()}`,
      createdAt: new Date().toISOString(),
      thumbnailPath,
      snapshot: {
        sourceIds: project.sourceIds,
        canvas: structuredClone(project.canvas),
        layout: structuredClone(project.layout),
        sourceMapping: structuredClone(project.sourceMapping),
        effects: structuredClone(project.effects),
        compositing: structuredClone(project.compositing),
        export: structuredClone(project.export),
        activeSeed: project.activeSeed,
        presets: structuredClone(project.presets),
        passes: structuredClone(project.passes),
      },
    };

    const updatedProject = {
      ...project,
      currentVersionId: version.id,
      updatedAt: new Date().toISOString(),
    };

    await Promise.all([db.versions.put(version), db.projects.put(updatedProject)]);

    set((state) => ({
      versions: sortVersionsByCreated([version, ...state.versions]),
      projects: sortByUpdated(
        state.projects.map((entry) => (entry.id === updatedProject.id ? updatedProject : entry)),
      ),
      status: "Saved a named version.",
    }));
  },

  async restoreVersion(versionId) {
    const version = get().versions.find((entry) => entry.id === versionId);
    const project = getActiveProject(get());
    if (!version || !project) return;
    const normalizedVersion = normalizeProjectVersion(version);

    const updatedProject: ProjectDocument = {
      ...project,
      ...structuredClone(normalizedVersion.snapshot),
      currentVersionId: normalizedVersion.id,
      updatedAt: new Date().toISOString(),
    };

    await db.projects.put(updatedProject);
    set((state) => {
      const historyByProject = clearProjectHistory(state.historyByProject, updatedProject.id);
      return withHistoryFlags(
        {
          projects: upsertProject(state.projects, updatedProject),
          historyByProject,
          status: `Restored "${normalizedVersion.label}".`,
        },
        historyByProject,
        state.activeProjectId,
      );
    });
  },

  async exportCurrentImage(project, assets, bitmapLookup) {
    const { buildBitmapMap } = await import("@/lib/render");
    set({ busy: true, status: "Rendering export…" });
    const bitmaps = await buildBitmapMap(assets, bitmapLookup);
    const blob = await exportProjectImage(project, assets, bitmaps);
    const extension = project.export.format === "image/jpeg" ? "jpg" : "png";
    downloadBlob(blob, `${project.title.toLowerCase().replace(/\s+/g, "-")}.${extension}`);
    set({ busy: false, status: "Export saved." });
  },

  async exportCurrentBundle() {
    const project = getActiveProject(get());
    if (!project) return;
    const versions = get().versions.filter((version) => version.projectId === project.id);
    const assets = get().assets.filter((asset) => asset.projectId === project.id);
    set({ busy: true, status: "Packaging project bundle…" });
    const blob = await exportProjectBundle(project, versions, assets);
    downloadBlob(blob, `${project.title.toLowerCase().replace(/\s+/g, "-")}.image-grid.zip`);
    set({ busy: false, status: "Project bundle exported." });
  },

  async inspectBundleImport(file) {
    set({ busy: true, status: "Inspecting project bundle…" });
    const bundle = await loadProjectBundle(file);
    const conflictProject = normalizeProjectDocument(
      (await db.projects.get(bundle.projectDoc.id)) ?? bundle.projectDoc,
    );

    const inspection: BundleImportInspection = {
      fileName: file.name,
      projectId: bundle.projectDoc.id,
      projectTitle: bundle.projectDoc.title,
      bundle,
      conflictProject:
        conflictProject.id === bundle.projectDoc.id && (await db.projects.get(bundle.projectDoc.id))
          ? conflictProject
          : null,
    };

    set({
      busy: false,
      status: inspection.conflictProject
        ? "Import needs confirmation."
        : "Bundle ready to import.",
    });

    return inspection;
  },

  async resolveBundleImport(inspection, resolution) {
    set({ busy: true, status: "Importing project bundle…" });

    if (resolution === "replace" && inspection.conflictProject) {
      await deleteProjectData(inspection.conflictProject.id);
    }

    const bundle = resolution === "copy" ? createImportCopy(inspection.bundle) : inspection.bundle;
    await persistImportedProjectBundle(bundle);
    const historyByProject = clearProjectHistory(get().historyByProject, bundle.projectDoc.id);
    set(
      withHistoryFlags(
        { historyByProject },
        historyByProject,
        bundle.projectDoc.id,
      ),
    );

    await syncWorkspace(set, {
      activeProjectId: bundle.projectDoc.id,
      busy: false,
      historyByProject,
      status:
        resolution === "copy"
          ? `Imported ${bundle.projectDoc.title} as a copy.`
          : `Imported ${bundle.projectDoc.title}.`,
    });
  },

  async undo() {
    const project = getActiveProject(get());
    if (!project) return;

    const history = getProjectHistory(get().historyByProject, project.id);
    const entry = history.past.at(-1);
    if (!entry) return;

    if (entry.kind === "project-change") {
      const updatedProject: ProjectDocument = {
        ...project,
        ...structuredClone(entry.before),
        updatedAt: new Date().toISOString(),
      };
      await db.projects.put(updatedProject);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, project.id, (currentHistory) => ({
          past: currentHistory.past.slice(0, -1),
          future: [...currentHistory.future, entry],
        }));

        return {
          projects: upsertProject(state.projects, updatedProject),
          historyByProject,
          status: "Undo applied.",
          ...getHistoryFlags(historyByProject, state.activeProjectId),
        };
      });
      return;
    }

    if (entry.kind === "remove-assets") {
      const restoredAssets = entry.assets.map((removedAsset) => removedAsset.asset);
      const updatedProject: ProjectDocument = {
        ...project,
        sourceIds: structuredClone(entry.sourceIdsBefore),
        updatedAt: new Date().toISOString(),
      };

      await Promise.all([
        restoreRemovedAssetSnapshots(entry.assets),
        db.assets.bulkPut(restoredAssets),
        db.projects.put(updatedProject),
      ]);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, project.id, (currentHistory) => ({
          past: currentHistory.past.slice(0, -1),
          future: [...currentHistory.future, entry],
        }));

        return {
          assets: sortAssetsByCreated([...state.assets, ...restoredAssets]),
          projects: upsertProject(state.projects, updatedProject),
          historyByProject,
          status: "Undo applied.",
          ...getHistoryFlags(historyByProject, state.activeProjectId),
        };
      });
      return;
    }

    const updatedProject: ProjectDocument = {
      ...project,
      sourceIds: structuredClone(entry.sourceIdsBefore),
      updatedAt: new Date().toISOString(),
    };
    const assetIds = entry.assets.map((asset) => asset.id);

    await Promise.all([
      db.assets.bulkDelete(assetIds),
      db.projects.put(updatedProject),
    ]);

    set((state) => {
      const historyByProject = patchHistory(state.historyByProject, project.id, (currentHistory) => ({
        past: currentHistory.past.slice(0, -1),
        future: [...currentHistory.future, entry],
      }));

      return {
        assets: removeAssetsById(state.assets, assetIds),
        projects: upsertProject(state.projects, updatedProject),
        historyByProject,
        status: "Undo applied.",
        ...getHistoryFlags(historyByProject, state.activeProjectId),
      };
    });
  },

  async redo() {
    const project = getActiveProject(get());
    if (!project) return;

    const history = getProjectHistory(get().historyByProject, project.id);
    const entry = history.future.at(-1);
    if (!entry) return;

    if (entry.kind === "project-change") {
      const updatedProject: ProjectDocument = {
        ...project,
        ...structuredClone(entry.after),
        updatedAt: new Date().toISOString(),
      };
      await db.projects.put(updatedProject);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, project.id, (currentHistory) => ({
          past: [...currentHistory.past, entry],
          future: currentHistory.future.slice(0, -1),
        }));

        return {
          projects: upsertProject(state.projects, updatedProject),
          historyByProject,
          status: "Redo applied.",
          ...getHistoryFlags(historyByProject, state.activeProjectId),
        };
      });
      return;
    }

    if (entry.kind === "remove-assets") {
      const removedAssets = entry.assets.map((removedAsset) => removedAsset.asset);
      const removedAssetIds = removedAssets.map((asset) => asset.id);
      const updatedProject: ProjectDocument = {
        ...project,
        sourceIds: structuredClone(entry.sourceIdsAfter),
        updatedAt: new Date().toISOString(),
      };

      await Promise.all([
        deleteAssetFiles(removedAssets),
        db.assets.bulkDelete(removedAssetIds),
        db.projects.put(updatedProject),
      ]);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, project.id, (currentHistory) => ({
          past: [...currentHistory.past, entry],
          future: currentHistory.future.slice(0, -1),
        }));

        return {
          assets: removeAssetsById(state.assets, removedAssetIds),
          projects: upsertProject(state.projects, updatedProject),
          historyByProject,
          status: "Redo applied.",
          ...getHistoryFlags(historyByProject, state.activeProjectId),
        };
      });
      return;
    }

    const updatedProject: ProjectDocument = {
      ...project,
      sourceIds: structuredClone(entry.sourceIdsAfter),
      updatedAt: new Date().toISOString(),
    };

    await Promise.all([
      db.assets.bulkPut(entry.assets),
      db.projects.put(updatedProject),
    ]);

    set((state) => {
      const historyByProject = patchHistory(state.historyByProject, project.id, (currentHistory) => ({
        past: [...currentHistory.past, entry],
        future: currentHistory.future.slice(0, -1),
      }));

      return {
        assets: sortAssetsByCreated([...state.assets, ...entry.assets]),
        projects: upsertProject(state.projects, updatedProject),
        historyByProject,
        status: "Redo applied.",
        ...getHistoryFlags(historyByProject, state.activeProjectId),
      };
    });
  },
}));
