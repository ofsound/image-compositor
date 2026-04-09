import { create } from "zustand";

import {
  type CellularSourceInput,
  createGeneratedSourceAsset,
  duplicateSourceAsset,
  persistProcessedAsset,
  updateGeneratedSourceAsset,
  type GradientSourceInput,
  type PerlinSourceInput,
  type ReactionSourceInput,
  type SolidSourceInput,
  type WaveSourceInput,
} from "@/lib/assets";
import { db } from "@/lib/db";
import { downloadBlob } from "@/lib/download";
import { processImageFile } from "@/lib/image-worker-client";
import { makeId } from "@/lib/id";
import { deleteBlob, readBlob, writeBlob } from "@/lib/opfs";
import {
  createCompositorLayer,
  createProjectDocument,
  getSelectedLayer,
  normalizeProjectDocument,
  normalizeProjectVersion,
  serializeProjectDocument,
  serializeProjectSnapshot,
  syncLegacyProjectFieldsToSelectedLayer,
} from "@/lib/project-defaults";
import { exportProjectImage } from "@/lib/render";
import { loadNormalizedAssetBitmapMap } from "@/lib/render-service";
import {
  createImportCopy,
  exportProjectBundle,
  loadProjectBundle,
  persistImportedProjectBundle,
} from "@/lib/serializer";
import {
  deleteProjectDataAtomically,
  loadWorkspaceSnapshotData,
  persistActiveProjectId,
  putProjectDocument,
  putProjectVersion,
} from "@/lib/workspace-storage";
import type {
  BundleImportInspection,
  CellularSourceAsset,
  CompositorLayer,
  GradientSourceAsset,
  PerlinSourceAsset,
  ProjectDocument,
  ProjectSnapshot,
  ProjectVersion,
  ReactionSourceAsset,
  SolidSourceAsset,
  SourceAsset,
  WaveSourceAsset,
} from "@/types/project";

type BundleImportResolution = "replace" | "copy";
type SourceImportProgress = { processed: number; total: number };

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
  before: ProjectSnapshot;
  after: ProjectSnapshot;
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
  before: ProjectSnapshot;
  after: ProjectSnapshot;
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
  sourceImportProgress: SourceImportProgress | null;
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
  selectLayer: (layerId: string) => Promise<void>;
  addLayer: () => Promise<void>;
  deleteLayer: (layerId: string) => Promise<void>;
  toggleLayerVisibility: (layerId: string) => Promise<void>;
  reorderLayers: (layerIds: string[]) => Promise<void>;
  moveLayerUp: (layerId: string) => Promise<void>;
  moveLayerDown: (layerId: string) => Promise<void>;
  updateSelectedLayer: (
    updater: (layer: CompositorLayer) => CompositorLayer,
  ) => Promise<void>;
  updateProject: (
    updater: (project: ProjectDocument) => ProjectDocument,
    options?: { recordHistory?: boolean },
  ) => Promise<void>;
  importFiles: (files: FileList | File[]) => Promise<void>;
  addSolidSource: (input: SolidSourceInput) => Promise<void>;
  addGradientSource: (input: GradientSourceInput) => Promise<void>;
  addPerlinSource: (input: PerlinSourceInput) => Promise<void>;
  addCellularSource: (input: CellularSourceInput) => Promise<void>;
  addReactionSource: (input: ReactionSourceInput) => Promise<void>;
  addWaveSource: (input: WaveSourceInput) => Promise<void>;
  removeSource: (assetId: string) => Promise<void>;
  updateGeneratedSource: (
    assetId: string,
    input:
      | SolidSourceInput
      | GradientSourceInput
      | PerlinSourceInput
      | CellularSourceInput
      | ReactionSourceInput
      | WaveSourceInput,
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

function formatGeneratedSourceKind(kind: Exclude<SourceAsset["kind"], "image">) {
  return kind[0]!.toUpperCase() + kind.slice(1);
}

function createProjectSnapshot(project: ProjectDocument): ProjectSnapshot {
  return structuredClone(
    serializeProjectSnapshot(normalizeProjectDocument(project)),
  );
}

function createProjectMutationBase(project: ProjectDocument) {
  return serializeProjectDocument(normalizeProjectDocument(project));
}

function applySnapshotToProject(
  project: ProjectDocument,
  snapshot: ProjectSnapshot,
): ProjectDocument {
  return normalizeProjectDocument({
    ...createProjectMutationBase(project),
    ...structuredClone(snapshot),
    updatedAt: new Date().toISOString(),
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

function replaceLayer(
  project: ProjectDocument,
  layerId: string,
  updater: (layer: CompositorLayer) => CompositorLayer,
) {
  const baseProject = createProjectMutationBase(project);

  return normalizeProjectDocument({
    ...baseProject,
    layers: baseProject.layers.map((layer) =>
      layer.id === layerId ? updater(layer) : layer,
    ),
    updatedAt: new Date().toISOString(),
  });
}

function updateSelectedProjectLayer(
  project: ProjectDocument,
  updater: (layer: CompositorLayer) => CompositorLayer,
) {
  const selectedLayer = getSelectedLayer(project);
  if (!selectedLayer) {
    return project;
  }

  return replaceLayer(project, selectedLayer.id, updater);
}

function removeSourceFromLayer(layer: CompositorLayer, assetId: string): CompositorLayer {
  const sourceWeights = { ...layer.sourceMapping.sourceWeights };
  delete sourceWeights[assetId];

  return {
    ...layer,
    sourceIds: layer.sourceIds.filter((sourceId) => sourceId !== assetId),
    sourceMapping: {
      ...layer.sourceMapping,
      sourceWeights,
    },
  };
}

function removeSourceFromAllLayers(project: ProjectDocument, assetId: string) {
  const baseProject = createProjectMutationBase(project);

  return normalizeProjectDocument({
    ...baseProject,
    layers: baseProject.layers.map((layer) =>
      removeSourceFromLayer(layer, assetId),
    ),
    updatedAt: new Date().toISOString(),
  });
}

function getNextLayerName(project: ProjectDocument) {
  return `Layer ${project.layers.length + 1}`;
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

async function loadWorkspaceSnapshot(preferredActiveProjectId?: string | null) {
  const snapshot = await loadWorkspaceSnapshotData(preferredActiveProjectId);
  let projects = snapshot.projects;
  const assets = snapshot.assets;
  const versions = snapshot.versions;
  let activeProjectId = snapshot.activeProjectId;
  const liveProjects = getLiveProjects(projects);

  if (!liveProjects.some((project) => project.id === activeProjectId)) {
    activeProjectId = sortByUpdated(liveProjects)[0]?.id ?? null;
  }

  if (liveProjects.length === 0) {
    const project = createProjectDocument(
      projects.length === 0 ? "Launch Study" : getNextProjectTitle(projects),
    );
    await putProjectDocument(project);
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

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  busy: false,
  status: "Booting workspace…",
  sourceImportProgress: null,
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
    await Promise.all([putProjectDocument(project), persistActiveProjectId(project.id)]);
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

    await putProjectDocument({
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
    const sourceProjectDocument = createProjectMutationBase(sourceProject);
    const nextProjectId = makeId("project");
    const nextTitle = title.trim() || `${sourceProject.title} Copy`;
    const projectAssets = get().assets.filter((asset) => asset.projectId === sourceProject.id);
    const duplicatedAssets = await Promise.all(
      projectAssets.map((asset) => duplicateSourceAsset(asset, nextProjectId)),
    );
    const sourceIdMap = new Map(projectAssets.map((asset, index) => [asset.id, duplicatedAssets[index]?.id ?? asset.id]));
    const now = new Date().toISOString();
    const duplicateProject: ProjectDocument = normalizeProjectDocument({
      ...sourceProjectDocument,
      id: nextProjectId,
      title: nextTitle,
      layers: sourceProjectDocument.layers.map((layer) => ({
        ...structuredClone(layer),
        sourceIds: layer.sourceIds.map(
          (sourceId) => sourceIdMap.get(sourceId) ?? sourceId,
        ),
        sourceMapping: {
          ...structuredClone(layer.sourceMapping),
          sourceWeights: Object.fromEntries(
            Object.entries(layer.sourceMapping.sourceWeights).map(([sourceId, weight]) => [
              sourceIdMap.get(sourceId) ?? sourceId,
              weight,
            ]),
          ),
        },
      })),
      currentVersionId: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await Promise.all([
      putProjectDocument(duplicateProject),
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

    await putProjectDocument({
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

    await putProjectDocument({
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
    await deleteProjectDataAtomically(projectId);
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

  async selectLayer(layerId) {
    const project = getActiveProject(get());
    if (!project || !project.layers.some((layer) => layer.id === layerId)) return;

    const baseProject = createProjectMutationBase(project);
    const updatedProject = normalizeProjectDocument({
      ...baseProject,
      selectedLayerId: layerId,
      updatedAt: new Date().toISOString(),
    });
    await putProjectDocument(updatedProject);

    set((state) => ({
      projects: upsertProject(state.projects, updatedProject),
      status: "Layer selected.",
      ...getHistoryFlags(state.historyByProject, state.activeProjectId),
    }));
  },

  async addLayer() {
    await get().updateProject((project) => {
      const selectedLayer = getSelectedLayer(project);
      const insertIndex = selectedLayer
        ? project.layers.findIndex((layer) => layer.id === selectedLayer.id) + 1
        : project.layers.length;
      const nextLayer = createCompositorLayer({
        name: getNextLayerName(project),
        visible: true,
      });
      const layers = [...project.layers];
      layers.splice(insertIndex, 0, nextLayer);

      return {
        ...project,
        layers,
        selectedLayerId: nextLayer.id,
      };
    });
  },

  async deleteLayer(layerId) {
    const project = getActiveProject(get());
    if (!project || project.layers.length <= 1) return;
    if (!project.layers.some((layer) => layer.id === layerId)) return;

    await get().updateProject((currentProject) => {
      const layers = currentProject.layers.filter((layer) => layer.id !== layerId);
      const selectedLayerId =
        currentProject.selectedLayerId === layerId
          ? layers.at(-1)?.id ?? null
          : currentProject.selectedLayerId;

      return {
        ...currentProject,
        layers,
        selectedLayerId,
      };
    });
  },

  async toggleLayerVisibility(layerId) {
    await get().updateProject((project) =>
      replaceLayer(project, layerId, (layer) => ({
        ...layer,
        visible: !layer.visible,
      })),
    );
  },

  async reorderLayers(layerIds) {
    await get().updateProject((project) => {
      if (layerIds.length !== project.layers.length) {
        return project;
      }

      const layerLookup = new Map(project.layers.map((layer) => [layer.id, layer]));
      const layers = layerIds
        .map((layerId) => layerLookup.get(layerId))
        .filter((layer): layer is CompositorLayer => Boolean(layer));

      if (layers.length !== project.layers.length) {
        return project;
      }

      return { ...project, layers };
    });
  },

  async moveLayerUp(layerId) {
    await get().updateProject((project) => {
      const index = project.layers.findIndex((layer) => layer.id === layerId);
      if (index < 0 || index >= project.layers.length - 1) {
        return project;
      }

      const layers = [...project.layers];
      const [layer] = layers.splice(index, 1);
      layers.splice(index + 1, 0, layer!);
      return { ...project, layers };
    });
  },

  async moveLayerDown(layerId) {
    await get().updateProject((project) => {
      const index = project.layers.findIndex((layer) => layer.id === layerId);
      if (index <= 0) {
        return project;
      }

      const layers = [...project.layers];
      const [layer] = layers.splice(index, 1);
      layers.splice(index - 1, 0, layer!);
      return { ...project, layers };
    });
  },

  async updateSelectedLayer(updater) {
    await get().updateProject((project) => updateSelectedProjectLayer(project, updater));
  },

  async updateProject(updater, options) {
    const project = getActiveProject(get());
    if (!project) return;

    const before = createProjectSnapshot(project);
    const draftProject = normalizeProjectDocument({
      ...createProjectMutationBase(project),
      updatedAt: new Date().toISOString(),
    });
    const updatedProject = normalizeProjectDocument(
      syncLegacyProjectFieldsToSelectedLayer(
        updater(draftProject),
      ),
    );
    const after = createProjectSnapshot(updatedProject);

    if (snapshotsEqual(before, after)) {
      return;
    }

    await putProjectDocument(updatedProject);
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

    set({
      busy: true,
      status: `Importing ${fileList.length} source image(s)…`,
      sourceImportProgress: { processed: 0, total: fileList.length },
    });

    try {
      const importedAssets: SourceAsset[] = [];
      for (const file of fileList) {
        const payload = await processImageFile(file);
        const asset = await persistProcessedAsset(file, payload, activeProject.id);
        importedAssets.push(asset);
        await db.assets.put(asset);
        set({
          sourceImportProgress: {
            processed: importedAssets.length,
            total: fileList.length,
          },
        });
      }

      const nextProject = updateSelectedProjectLayer(activeProject, (layer) => ({
        ...layer,
        sourceIds: [
          ...new Set([...layer.sourceIds, ...importedAssets.map((asset) => asset.id)]),
        ],
      }));
      const before = createProjectSnapshot(activeProject);
      const after = createProjectSnapshot(nextProject);

      await putProjectDocument(nextProject);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
          past: [
            ...history.past,
            {
              kind: "add-assets",
              projectId: nextProject.id,
              assets: structuredClone(importedAssets),
              before,
              after,
            } satisfies AddAssetsHistoryEntry,
          ],
          future: [],
        }));

        return {
          assets: sortAssetsByCreated([...state.assets, ...importedAssets]),
          projects: upsertProject(state.projects, nextProject),
          historyByProject,
          busy: false,
          sourceImportProgress: null,
          status: `Imported ${importedAssets.length} source image(s).`,
          ...getHistoryFlags(historyByProject, state.activeProjectId),
        };
      });
    } catch (error) {
      set({
        busy: false,
        sourceImportProgress: null,
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

      const nextProject = updateSelectedProjectLayer(activeProject, (layer) => ({
        ...layer,
        sourceIds: [...new Set([...layer.sourceIds, asset.id])],
      }));
      const before = createProjectSnapshot(activeProject);
      const after = createProjectSnapshot(nextProject);

      await putProjectDocument(nextProject);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
          past: [
            ...history.past,
            {
              kind: "add-assets",
              projectId: nextProject.id,
              assets: [structuredClone(asset)],
              before,
              after,
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

      const nextProject = updateSelectedProjectLayer(activeProject, (layer) => ({
        ...layer,
        sourceIds: [...new Set([...layer.sourceIds, asset.id])],
      }));
      const before = createProjectSnapshot(activeProject);
      const after = createProjectSnapshot(nextProject);

      await putProjectDocument(nextProject);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
          past: [
            ...history.past,
            {
              kind: "add-assets",
              projectId: nextProject.id,
              assets: [structuredClone(asset)],
              before,
              after,
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

  async addPerlinSource(input) {
    const activeProject = getActiveProject(get());
    if (!activeProject) return;

    set({ busy: true, status: "Creating perlin source…" });

    try {
      const asset = await createGeneratedSourceAsset(
        { kind: "perlin", recipe: input, name: input.name },
        activeProject.id,
        activeProject.canvas,
      );
      await db.assets.put(asset);

      const nextProject = updateSelectedProjectLayer(activeProject, (layer) => ({
        ...layer,
        sourceIds: [...new Set([...layer.sourceIds, asset.id])],
      }));
      const before = createProjectSnapshot(activeProject);
      const after = createProjectSnapshot(nextProject);

      await putProjectDocument(nextProject);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
          past: [
            ...history.past,
            {
              kind: "add-assets",
              projectId: nextProject.id,
              assets: [structuredClone(asset)],
              before,
              after,
            } satisfies AddAssetsHistoryEntry,
          ],
          future: [],
        }));

        return {
          assets: sortAssetsByCreated([...state.assets, asset]),
          projects: upsertProject(state.projects, nextProject),
          historyByProject,
          busy: false,
          status: "Perlin source added.",
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

  async addCellularSource(input) {
    const activeProject = getActiveProject(get());
    if (!activeProject) return;

    set({ busy: true, status: "Creating cellular source…" });

    try {
      const asset = await createGeneratedSourceAsset(
        { kind: "cellular", recipe: input, name: input.name },
        activeProject.id,
        activeProject.canvas,
      );
      await db.assets.put(asset);

      const nextProject = updateSelectedProjectLayer(activeProject, (layer) => ({
        ...layer,
        sourceIds: [...new Set([...layer.sourceIds, asset.id])],
      }));
      const before = createProjectSnapshot(activeProject);
      const after = createProjectSnapshot(nextProject);

      await putProjectDocument(nextProject);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
          past: [
            ...history.past,
            {
              kind: "add-assets",
              projectId: nextProject.id,
              assets: [structuredClone(asset)],
              before,
              after,
            } satisfies AddAssetsHistoryEntry,
          ],
          future: [],
        }));

        return {
          assets: sortAssetsByCreated([...state.assets, asset]),
          projects: upsertProject(state.projects, nextProject),
          historyByProject,
          busy: false,
          status: "Cellular source added.",
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

  async addReactionSource(input) {
    const activeProject = getActiveProject(get());
    if (!activeProject) return;

    set({ busy: true, status: "Creating reaction source…" });

    try {
      const asset = await createGeneratedSourceAsset(
        { kind: "reaction", recipe: input, name: input.name },
        activeProject.id,
        activeProject.canvas,
      );
      await db.assets.put(asset);

      const nextProject = updateSelectedProjectLayer(activeProject, (layer) => ({
        ...layer,
        sourceIds: [...new Set([...layer.sourceIds, asset.id])],
      }));
      const before = createProjectSnapshot(activeProject);
      const after = createProjectSnapshot(nextProject);

      await putProjectDocument(nextProject);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
          past: [
            ...history.past,
            {
              kind: "add-assets",
              projectId: nextProject.id,
              assets: [structuredClone(asset)],
              before,
              after,
            } satisfies AddAssetsHistoryEntry,
          ],
          future: [],
        }));

        return {
          assets: sortAssetsByCreated([...state.assets, asset]),
          projects: upsertProject(state.projects, nextProject),
          historyByProject,
          busy: false,
          status: "Reaction source added.",
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

  async addWaveSource(input) {
    const activeProject = getActiveProject(get());
    if (!activeProject) return;

    set({ busy: true, status: "Creating waves source…" });

    try {
      const asset = await createGeneratedSourceAsset(
        { kind: "waves", recipe: input, name: input.name },
        activeProject.id,
        activeProject.canvas,
      );
      await db.assets.put(asset);

      const nextProject = updateSelectedProjectLayer(activeProject, (layer) => ({
        ...layer,
        sourceIds: [...new Set([...layer.sourceIds, asset.id])],
      }));
      const before = createProjectSnapshot(activeProject);
      const after = createProjectSnapshot(nextProject);

      await putProjectDocument(nextProject);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
          past: [
            ...history.past,
            {
              kind: "add-assets",
              projectId: nextProject.id,
              assets: [structuredClone(asset)],
              before,
              after,
            } satisfies AddAssetsHistoryEntry,
          ],
          future: [],
        }));

        return {
          assets: sortAssetsByCreated([...state.assets, asset]),
          projects: upsertProject(state.projects, nextProject),
          historyByProject,
          busy: false,
          status: "Waves source added.",
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

      const nextProject = removeSourceFromAllLayers(activeProject, asset.id);
      const before = createProjectSnapshot(activeProject);
      const after = createProjectSnapshot(nextProject);

      await Promise.all([
        deleteAssetFiles([asset]),
        db.assets.bulkDelete([asset.id]),
        putProjectDocument(nextProject),
      ]);

      set((state) => {
        const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
          past: [
            ...history.past,
            {
              kind: "remove-assets",
              projectId: nextProject.id,
              assets: [removedAsset],
              before,
              after,
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
      (
        entry,
      ): entry is
        | SolidSourceAsset
        | GradientSourceAsset
        | PerlinSourceAsset
        | CellularSourceAsset
        | ReactionSourceAsset
        | WaveSourceAsset =>
        entry.id === assetId &&
        entry.projectId === activeProject.id &&
        entry.kind !== "image",
    );
    if (!asset) return;

    set({ busy: true, status: `Updating ${asset.kind} source…` });

    try {
      const updatedAsset = await updateGeneratedSourceAsset(asset, input);
      await db.assets.put(updatedAsset);

      const updatedProject = normalizeProjectDocument({
        ...createProjectMutationBase(activeProject),
        updatedAt: new Date().toISOString(),
      });
      await putProjectDocument(updatedProject);

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
          status: `${formatGeneratedSourceKind(asset.kind)} source updated.`,
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
    await get().updateSelectedLayer((layer) => ({
      ...layer,
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
      snapshot: createProjectSnapshot(project),
    };

    const updatedProject = normalizeProjectDocument({
      ...createProjectMutationBase(project),
      currentVersionId: version.id,
      updatedAt: new Date().toISOString(),
    });

    await Promise.all([putProjectVersion(version), putProjectDocument(updatedProject)]);

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

    const updatedProject = normalizeProjectDocument({
      ...createProjectMutationBase(project),
      ...structuredClone(normalizedVersion.snapshot),
      currentVersionId: normalizedVersion.id,
      updatedAt: new Date().toISOString(),
    });

    await putProjectDocument(updatedProject);
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

  async exportCurrentImage(project, assets, _bitmapLookup) {
    set({ busy: true, status: "Rendering export…" });
    const bitmaps = await loadNormalizedAssetBitmapMap(assets);
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
    downloadBlob(blob, `${project.title.toLowerCase().replace(/\s+/g, "-")}.image-compositor.zip`);
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
      await deleteProjectDataAtomically(inspection.conflictProject.id);
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
      const updatedProject = applySnapshotToProject(project, entry.before);
      await putProjectDocument(updatedProject);

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
      const updatedProject = applySnapshotToProject(project, entry.before);

      await Promise.all([
        restoreRemovedAssetSnapshots(entry.assets),
        db.assets.bulkPut(restoredAssets),
        putProjectDocument(updatedProject),
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

    const updatedProject = applySnapshotToProject(project, entry.before);
    const assetIds = entry.assets.map((asset) => asset.id);

    await Promise.all([
      db.assets.bulkDelete(assetIds),
      putProjectDocument(updatedProject),
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
      const updatedProject = applySnapshotToProject(project, entry.after);
      await putProjectDocument(updatedProject);

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
      const updatedProject = applySnapshotToProject(project, entry.after);

      await Promise.all([
        deleteAssetFiles(removedAssets),
        db.assets.bulkDelete(removedAssetIds),
        putProjectDocument(updatedProject),
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

    const updatedProject = applySnapshotToProject(project, entry.after);

    await Promise.all([
      db.assets.bulkPut(entry.assets),
      putProjectDocument(updatedProject),
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
