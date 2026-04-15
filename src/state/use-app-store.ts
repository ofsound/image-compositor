import { create } from "zustand";

import {
  type CellularSourceInput,
  createGeneratedSourceAsset,
  duplicateSourceAsset,
  type GeneratedSourceInput,
  type PreparedAssetRecord,
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
  captureAssetSnapshot,
  deleteAssetsAtomically,
  deleteProjectDataAtomically,
  loadWorkspaceSnapshotData,
  persistActiveProjectId,
  persistAssetCreationsAtomically,
  persistAssetUpdatesAtomically,
  putProjectDocument,
  putProjectVersion,
} from "@/lib/workspace-storage";
import { createWorkspaceCommandRunner } from "@/state/workspace-command-runner";
import type {
  BundleImportInspection,
  CellularSourceAsset,
  CompositorLayer,
  DrawStroke,
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

type GeneratedSourceAction =
  | { kind: "solid"; input: SolidSourceInput; startStatus: string }
  | { kind: "gradient"; input: GradientSourceInput; startStatus: string }
  | { kind: "perlin"; input: PerlinSourceInput; startStatus: string }
  | { kind: "cellular"; input: CellularSourceInput; startStatus: string }
  | { kind: "reaction"; input: ReactionSourceInput; startStatus: string }
  | { kind: "waves"; input: WaveSourceInput; startStatus: string };

interface ProjectChangeHistoryEntry {
  kind: "project-change";
  projectId: string;
  before: ProjectSnapshot;
  after: ProjectSnapshot;
}

interface AddAssetsHistoryEntry {
  kind: "add-assets";
  projectId: string;
  assets: PreparedAssetRecord[];
  before: ProjectSnapshot;
  after: ProjectSnapshot;
}

interface RemoveAssetsHistoryEntry {
  kind: "remove-assets";
  projectId: string;
  assets: PreparedAssetRecord[];
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
  appendDrawStroke: (stroke: DrawStroke) => Promise<void>;
  clearDrawLayer: () => Promise<void>;
  toggleLayerVisibility: (layerId: string) => Promise<void>;
  reorderLayers: (layerIds: string[]) => Promise<void>;
  moveLayerUp: (layerId: string) => Promise<void>;
  moveLayerDown: (layerId: string) => Promise<void>;
  updateSelectedLayer: (
    updater: (layer: CompositorLayer) => CompositorLayer,
  ) => Promise<void>;
  updateProject: (
    updater: (project: ProjectDocument) => ProjectDocument,
    options?: { recordHistory?: boolean; queueKey?: string },
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

function clonePreparedAssetRecord(entry: PreparedAssetRecord): PreparedAssetRecord {
  return {
    asset: structuredClone(entry.asset),
    blobs: {
      original: entry.blobs.original,
      normalized: entry.blobs.normalized,
      preview: entry.blobs.preview,
    },
  };
}

function clonePreparedAssetRecords(entries: PreparedAssetRecord[]) {
  return entries.map((entry) => clonePreparedAssetRecord(entry));
}

const INTERACTIVE_PROJECT_FLUSH_DELAY_MS = 160;

async function persistAddedAssetsForProject(
  project: ProjectDocument,
  preparedAssets: PreparedAssetRecord[],
) {
  const nextProject = updateSelectedProjectLayer(project, (layer) => ({
    ...layer,
    sourceIds: [
      ...new Set([
        ...layer.sourceIds,
        ...preparedAssets.map(({ asset }) => asset.id),
      ]),
    ],
  }));
  const before = createProjectSnapshot(project);
  const after = createProjectSnapshot(nextProject);

  await persistAssetCreationsAtomically({
    projectDoc: nextProject,
    assets: preparedAssets,
  });

  return {
    nextProject,
    before,
    after,
    assets: preparedAssets.map(({ asset }) => asset),
    historyAssets: clonePreparedAssetRecords(preparedAssets),
  };
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

export const useAppStore = create<AppState>((set, get) => {
  const commandRunner = createWorkspaceCommandRunner<AppState>(set, get);
  interface PendingProjectCommit {
    before: ProjectSnapshot | null;
    projectId: string;
    recordHistory: boolean;
    timeoutId: ReturnType<typeof setTimeout>;
  }
  const pendingProjectCommits = new Map<string, PendingProjectCommit>();

  function patchProjectHistory(
    updatedProject: ProjectDocument,
    before: ProjectSnapshot | null,
    after?: ProjectSnapshot | null,
    options?: { recordHistory?: boolean },
  ) {
    set((state) => {
      const historyByProject =
        options?.recordHistory === false || before === null
          ? state.historyByProject
          : patchHistory(state.historyByProject, updatedProject.id, (history) => ({
              past: [
                ...history.past,
                {
                  kind: "project-change",
                  projectId: updatedProject.id,
                  before,
                  after: after ?? createProjectSnapshot(updatedProject),
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
  }

  function getPendingProjectFlushErrorStatus(error: unknown) {
    return error instanceof Error
      ? `Could not save pending project edits: ${error.message}`
      : "Could not save pending project edits.";
  }

  async function flushPendingProjectCommit(key: string) {
    const pendingCommit = pendingProjectCommits.get(key);
    if (!pendingCommit) return;

    pendingProjectCommits.delete(key);
    clearTimeout(pendingCommit.timeoutId);

    const currentProject = get().projects.find(
      (project) => project.id === pendingCommit.projectId,
    );
    if (!currentProject) return;

    const after = pendingCommit.before
      ? createProjectSnapshot(currentProject)
      : null;
    if (pendingCommit.before && after && snapshotsEqual(pendingCommit.before, after)) {
      set((state) => getHistoryFlags(state.historyByProject, state.activeProjectId));
      return;
    }

    await putProjectDocument(currentProject);
    patchProjectHistory(
      currentProject,
      pendingCommit.before,
      after,
      { recordHistory: pendingCommit.recordHistory },
    );
  }

  async function flushPendingProjectCommits() {
    const keys = [...pendingProjectCommits.keys()];
    for (const key of keys) {
      await flushPendingProjectCommit(key);
    }
  }

  async function runWorkspaceAction(
    task: () => Promise<void>,
    options?: {
      busy?: boolean;
      startStatus?: string;
      queue?: boolean;
      key?: string;
      getErrorStatus?: (error: unknown) => string;
      skipPendingProjectFlush?: boolean;
    },
  ) {
    let didFlushPendingProjects = false;
    try {
      if (!options?.skipPendingProjectFlush) {
        await flushPendingProjectCommits();
        didFlushPendingProjects = true;
      }
      await commandRunner.run(task, options);
    } catch (error) {
      if (!options?.skipPendingProjectFlush && !didFlushPendingProjects) {
        set({ status: getPendingProjectFlushErrorStatus(error) });
      }
      // Status updates are handled by per-action getErrorStatus handlers.
    }
  }

  async function addGeneratedSourceAction(action: GeneratedSourceAction) {
    await runWorkspaceAction(
      async () => {
        const activeProject = getActiveProject(get());
        if (!activeProject) return;

        const generatedInput: GeneratedSourceInput = (() => {
          switch (action.kind) {
            case "solid":
              return { kind: "solid", recipe: action.input, name: action.input.name };
            case "gradient":
              return { kind: "gradient", recipe: action.input, name: action.input.name };
            case "perlin":
              return { kind: "perlin", recipe: action.input, name: action.input.name };
            case "cellular":
              return { kind: "cellular", recipe: action.input, name: action.input.name };
            case "reaction":
              return { kind: "reaction", recipe: action.input, name: action.input.name };
            case "waves":
              return { kind: "waves", recipe: action.input, name: action.input.name };
          }
        })();

        const preparedAsset = await createGeneratedSourceAsset(
          generatedInput,
          activeProject.id,
          activeProject.canvas,
        );
        const { nextProject, before, after, assets, historyAssets } =
          await persistAddedAssetsForProject(activeProject, [preparedAsset]);
        const asset = assets[0]!;

        set((state) => {
          const historyByProject = patchHistory(
            state.historyByProject,
            nextProject.id,
            (history) => ({
              past: [
                ...history.past,
                {
                  kind: "add-assets",
                  projectId: nextProject.id,
                  assets: historyAssets,
                  before,
                  after,
                } satisfies AddAssetsHistoryEntry,
              ],
              future: [],
            }),
          );

          return {
            assets: sortAssetsByCreated([...state.assets, asset]),
            projects: upsertProject(state.projects, nextProject),
            historyByProject,
            status: `${formatGeneratedSourceKind(action.kind)} source added.`,
            ...getHistoryFlags(historyByProject, state.activeProjectId),
          };
        });
      },
      {
        busy: true,
        startStatus: action.startStatus,
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not add source: ${error.message}`
            : "Could not add source.",
      },
    );
  }

  return {
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
    await runWorkspaceAction(
      async () => {
        await syncWorkspace(set, {
          busy: false,
          historyByProject: get().historyByProject,
          ready: true,
          status: "Ready.",
        });
      },
      {
        busy: true,
        startStatus: "Loading local workspace…",
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not load workspace: ${error.message}`
            : "Could not load workspace.",
      },
    );
  },

  setStatus(status) {
    set({ status });
  },

  async createProject() {
    await runWorkspaceAction(
      async () => {
        const project = createProjectDocument(getNextProjectTitle(get().projects));
        await Promise.all([
          putProjectDocument(project),
          persistActiveProjectId(project.id),
        ]);
        await syncWorkspace(set, {
          activeProjectId: project.id,
          historyByProject: get().historyByProject,
          status: "Created a new project.",
        });
      },
      {
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not create project: ${error.message}`
            : "Could not create project.",
      },
    );
  },

  async renameProject(projectId, title) {
    await runWorkspaceAction(
      async () => {
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
      {
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not rename project: ${error.message}`
            : "Could not rename project.",
      },
    );
  },

  async duplicateProject(projectId, title) {
    await runWorkspaceAction(
      async () => {
        const sourceProject = get().projects.find(
          (entry) => entry.id === projectId && entry.deletedAt === null,
        );
        if (!sourceProject) return;

        const sourceProjectDocument = createProjectMutationBase(sourceProject);
        const nextProjectId = makeId("project");
        const nextTitle = title.trim() || `${sourceProject.title} Copy`;
        const projectAssets = get().assets.filter(
          (asset) => asset.projectId === sourceProject.id,
        );
        const duplicatedAssets = await Promise.all(
          projectAssets.map((asset) => duplicateSourceAsset(asset, nextProjectId)),
        );
        const sourceIdMap = new Map(
          projectAssets.map((asset, index) => [
            asset.id,
            duplicatedAssets[index]?.asset.id ?? asset.id,
          ]),
        );
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
                Object.entries(layer.sourceMapping.sourceWeights).map(
                  ([sourceId, weight]) => [sourceIdMap.get(sourceId) ?? sourceId, weight],
                ),
              ),
            },
          })),
          currentVersionId: null,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        await persistAssetCreationsAtomically({
          projectDoc: duplicateProject,
          assets: duplicatedAssets,
          activeProjectId: duplicateProject.id,
        });

        await syncWorkspace(set, {
          activeProjectId: duplicateProject.id,
          busy: false,
          historyByProject: get().historyByProject,
          status: "Project duplicated.",
        });
      },
      {
        busy: true,
        startStatus: "Duplicating project…",
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not duplicate project: ${error.message}`
            : "Could not duplicate project.",
      },
    );
  },

  async trashProject(projectId) {
    await runWorkspaceAction(
      async () => {
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
          activeProjectId:
            get().activeProjectId === projectId ? null : get().activeProjectId,
          historyByProject: get().historyByProject,
          status: "Project moved to trash.",
        });
      },
      {
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not trash project: ${error.message}`
            : "Could not trash project.",
      },
    );
  },

  async restoreProject(projectId) {
    await runWorkspaceAction(
      async () => {
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
      {
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not restore project: ${error.message}`
            : "Could not restore project.",
      },
    );
  },

  async purgeProject(projectId) {
    await runWorkspaceAction(
      async () => {
        await deleteProjectDataAtomically(projectId);
        const historyByProject = clearProjectHistory(
          get().historyByProject,
          projectId,
        );
        set(
          withHistoryFlags(
            { historyByProject },
            historyByProject,
            get().activeProjectId === projectId ? null : get().activeProjectId,
          ),
        );
        await syncWorkspace(set, {
          activeProjectId:
            get().activeProjectId === projectId ? null : get().activeProjectId,
          busy: false,
          historyByProject,
          status: "Project deleted permanently.",
        });
      },
      {
        busy: true,
        startStatus: "Deleting project permanently…",
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not delete project: ${error.message}`
            : "Could not delete project.",
      },
    );
  },

  async setActiveProject(projectId) {
    await runWorkspaceAction(
      async () => {
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
      {
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not load project: ${error.message}`
            : "Could not load project.",
      },
    );
  },

  async selectLayer(layerId) {
    await runWorkspaceAction(
      async () => {
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
      {
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not select layer: ${error.message}`
            : "Could not select layer.",
      },
    );
  },

  async addLayer() {
    await runWorkspaceAction(
      async () => {
        await get().updateProject((project) => {
          const baseProject = createProjectMutationBase(project);
          const selectedLayer = getSelectedLayer(baseProject);
          const insertIndex = selectedLayer
            ? baseProject.layers.findIndex((layer) => layer.id === selectedLayer.id) + 1
            : baseProject.layers.length;
          const nextLayer = createCompositorLayer({
            name: getNextLayerName(baseProject),
            visible: true,
          });
          const layers = [...baseProject.layers];
          layers.splice(insertIndex, 0, nextLayer);

          return {
            ...baseProject,
            layers,
            selectedLayerId: nextLayer.id,
          };
        });
      },
      {
        queue: false,
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not add layer: ${error.message}`
            : "Could not add layer.",
      },
    );
  },

  async deleteLayer(layerId) {
    await runWorkspaceAction(
      async () => {
        const project = getActiveProject(get());
        if (!project || project.layers.length <= 1) return;
        if (!project.layers.some((layer) => layer.id === layerId)) return;

        await get().updateProject((currentProject) => {
          const baseProject = createProjectMutationBase(currentProject);
          const layers = baseProject.layers.filter((layer) => layer.id !== layerId);
          const selectedLayerId =
            baseProject.selectedLayerId === layerId
              ? layers.at(-1)?.id ?? null
              : baseProject.selectedLayerId;

          return {
            ...baseProject,
            layers,
            selectedLayerId,
          };
        });
      },
      {
        queue: false,
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not delete layer: ${error.message}`
            : "Could not delete layer.",
      },
    );
  },

  async appendDrawStroke(stroke) {
    await runWorkspaceAction(
      async () => {
        if (stroke.points.length === 0) return;

        await get().updateProject((project) =>
          updateSelectedProjectLayer(project, (layer) => ({
            ...layer,
            draw: {
              ...layer.draw,
              strokes: [...layer.draw.strokes, structuredClone(stroke)],
            },
          })),
        );
      },
      {
        queue: false,
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not add draw stroke: ${error.message}`
            : "Could not add draw stroke.",
      },
    );
  },

  async clearDrawLayer() {
    await runWorkspaceAction(
      async () => {
        await get().updateProject((project) =>
          updateSelectedProjectLayer(project, (layer) => {
            if (layer.draw.strokes.length === 0) {
              return layer;
            }

            return {
              ...layer,
              draw: {
                ...layer.draw,
                strokes: [],
              },
            };
          }),
        );
      },
      {
        queue: false,
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not clear draw layer: ${error.message}`
            : "Could not clear draw layer.",
      },
    );
  },

  async toggleLayerVisibility(layerId) {
    await runWorkspaceAction(async () => {
      await get().updateProject((project) =>
        replaceLayer(project, layerId, (layer) => ({
          ...layer,
          visible: !layer.visible,
        })),
      );
    }, { queue: false });
  },

  async reorderLayers(layerIds) {
    await runWorkspaceAction(async () => {
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
    }, { queue: false });
  },

  async moveLayerUp(layerId) {
    await runWorkspaceAction(async () => {
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
    }, { queue: false });
  },

  async moveLayerDown(layerId) {
    await runWorkspaceAction(async () => {
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
    }, { queue: false });
  },

  async updateSelectedLayer(updater) {
    await runWorkspaceAction(
      async () => {
        await get().updateProject((project) =>
          updateSelectedProjectLayer(project, updater),
        );
      },
      {
        queue: false,
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not update layer: ${error.message}`
            : "Could not update layer.",
      },
    );
  },

  async updateProject(updater, options) {
    await runWorkspaceAction(
      async () => {
        const project = getActiveProject(get());
        if (!project) return;

        if (options?.queueKey) {
          const pendingCommit = pendingProjectCommits.get(options.queueKey);
          const draftProject = normalizeProjectDocument({
            ...createProjectMutationBase(project),
            updatedAt: new Date().toISOString(),
          });
          const updatedProject = normalizeProjectDocument(
            syncLegacyProjectFieldsToSelectedLayer(
              updater(draftProject),
            ),
          );

          if (pendingCommit) {
            clearTimeout(pendingCommit.timeoutId);
          }

          set((state) => {
            const flags = getHistoryFlags(state.historyByProject, state.activeProjectId);
            return {
              projects: upsertProject(state.projects, updatedProject),
              canUndo:
                flags.canUndo ||
                pendingCommit?.before !== null ||
                options.recordHistory !== false,
              canRedo: false,
            };
          });

          pendingProjectCommits.set(options.queueKey, {
            before:
              pendingCommit?.before ??
              (options.recordHistory === false ? null : createProjectSnapshot(project)),
            projectId: updatedProject.id,
            recordHistory:
              (pendingCommit?.recordHistory ?? false) || options.recordHistory !== false,
            timeoutId: setTimeout(() => {
              void flushPendingProjectCommit(options.queueKey!).catch((error) => {
                set({ status: getPendingProjectFlushErrorStatus(error) });
              });
            }, INTERACTIVE_PROJECT_FLUSH_DELAY_MS),
          });
          return;
        }

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
        patchProjectHistory(updatedProject, before, after, options);
      },
      {
        key: options?.queueKey,
        skipPendingProjectFlush: Boolean(options?.queueKey),
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not update project: ${error.message}`
            : "Could not update project.",
      },
    );
  },

  async importFiles(files) {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    set({
      sourceImportProgress: { processed: 0, total: fileList.length },
    });

    await runWorkspaceAction(
      async () => {
        const activeProject = getActiveProject(get());
        if (!activeProject) return;

        const importedAssets: PreparedAssetRecord[] = [];
        for (const file of fileList) {
          const payload = await processImageFile(file);
          const asset = await persistProcessedAsset(file, payload, activeProject.id);
          importedAssets.push(asset);
          set({
            sourceImportProgress: {
              processed: importedAssets.length,
              total: fileList.length,
            },
          });
        }

        const { nextProject, before, after, assets, historyAssets } =
          await persistAddedAssetsForProject(activeProject, importedAssets);

        set((state) => {
          const historyByProject = patchHistory(state.historyByProject, nextProject.id, (history) => ({
            past: [
              ...history.past,
              {
                kind: "add-assets",
                projectId: nextProject.id,
                assets: historyAssets,
                before,
                after,
              } satisfies AddAssetsHistoryEntry,
            ],
            future: [],
          }));

          return {
            assets: sortAssetsByCreated([...state.assets, ...assets]),
            projects: upsertProject(state.projects, nextProject),
            historyByProject,
            sourceImportProgress: null,
            status: `Imported ${assets.length} source image(s).`,
            ...getHistoryFlags(historyByProject, state.activeProjectId),
          };
        });
      },
      {
        busy: true,
        startStatus: `Importing ${fileList.length} source image(s)…`,
        getErrorStatus: (error) =>
          error instanceof Error ? `Import failed: ${error.message}` : "Import failed.",
      },
    );
    set({ sourceImportProgress: null });
  },

  async addSolidSource(input) {
    await addGeneratedSourceAction({
      kind: "solid",
      input,
      startStatus: "Creating solid source…",
    });
  },

  async addGradientSource(input) {
    await addGeneratedSourceAction({
      kind: "gradient",
      input,
      startStatus: "Creating gradient source…",
    });
  },

  async addPerlinSource(input) {
    await addGeneratedSourceAction({
      kind: "perlin",
      input,
      startStatus: "Creating perlin source…",
    });
  },

  async addCellularSource(input) {
    await addGeneratedSourceAction({
      kind: "cellular",
      input,
      startStatus: "Creating cellular source…",
    });
  },

  async addReactionSource(input) {
    await addGeneratedSourceAction({
      kind: "reaction",
      input,
      startStatus: "Creating reaction source…",
    });
  },

  async addWaveSource(input) {
    await addGeneratedSourceAction({
      kind: "waves",
      input,
      startStatus: "Creating waves source…",
    });
  },

  async removeSource(assetId) {
    await runWorkspaceAction(
      async () => {
        const activeProject = getActiveProject(get());
        if (!activeProject) return;

        const asset = get().assets.find(
          (entry) => entry.id === assetId && entry.projectId === activeProject.id,
        );
        if (!asset) return;

        const removedAsset = clonePreparedAssetRecord(
          await captureAssetSnapshot(asset),
        );

        const nextProject = removeSourceFromAllLayers(activeProject, asset.id);
        const before = createProjectSnapshot(activeProject);
        const after = createProjectSnapshot(nextProject);

        await deleteAssetsAtomically({
          projectDoc: nextProject,
          assets: [asset],
        });

        set((state) => {
          const historyByProject = patchHistory(
            state.historyByProject,
            nextProject.id,
            (history) => ({
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
            }),
          );

          return {
            assets: removeAssetsById(state.assets, [asset.id]),
            projects: upsertProject(state.projects, nextProject),
            historyByProject,
            status: "Source removed.",
            ...getHistoryFlags(historyByProject, state.activeProjectId),
          };
        });
      },
      {
        busy: true,
        startStatus: "Removing source…",
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not remove source: ${error.message}`
            : "Could not remove source.",
      },
    );
  },

  async updateGeneratedSource(assetId, input) {
    await runWorkspaceAction(
      async () => {
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

        const updatedAsset = await updateGeneratedSourceAsset(asset, input);

        const updatedProject = normalizeProjectDocument({
          ...createProjectMutationBase(activeProject),
          updatedAt: new Date().toISOString(),
        });
        await persistAssetUpdatesAtomically({
          projectDoc: updatedProject,
          assets: [updatedAsset],
        });

        set((state) => {
          const historyByProject = clearProjectHistory(
            state.historyByProject,
            updatedProject.id,
          );
          return {
            assets: sortAssetsByCreated(
              state.assets.map((entry) =>
                entry.id === updatedAsset.asset.id ? updatedAsset.asset : entry,
              ),
            ),
            projects: sortByUpdated(
              state.projects.map((entry) =>
                entry.id === updatedProject.id ? updatedProject : entry,
              ),
            ),
            historyByProject,
            status: `${formatGeneratedSourceKind(asset.kind)} source updated.`,
            ...getHistoryFlags(historyByProject, state.activeProjectId),
          };
        });
      },
      {
        busy: true,
        startStatus: "Updating source…",
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not update source: ${error.message}`
            : "Could not update source.",
      },
    );
  },

  async randomizeSeed() {
    await runWorkspaceAction(async () => {
      await get().updateSelectedLayer((layer) => ({
        ...layer,
        activeSeed: Math.floor(Math.random() * 1_000_000_000),
      }));
    }, { queue: false });
  },

  async saveVersion(label, thumbnailBlob) {
    await runWorkspaceAction(
      async () => {
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

        await Promise.all([
          putProjectVersion(version),
          putProjectDocument(updatedProject),
        ]);

        set((state) => ({
          versions: sortVersionsByCreated([version, ...state.versions]),
          projects: sortByUpdated(
            state.projects.map((entry) =>
              entry.id === updatedProject.id ? updatedProject : entry,
            ),
          ),
          status: "Saved a named version.",
        }));
      },
      {
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not save version: ${error.message}`
            : "Could not save version.",
      },
    );
  },

  async restoreVersion(versionId) {
    await runWorkspaceAction(
      async () => {
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
          const historyByProject = clearProjectHistory(
            state.historyByProject,
            updatedProject.id,
          );
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
      {
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not restore version: ${error.message}`
            : "Could not restore version.",
      },
    );
  },

  async exportCurrentImage(project, assets, _bitmapLookup) {
    await runWorkspaceAction(
      async () => {
        const bitmaps = await loadNormalizedAssetBitmapMap(assets);
        const blob = await exportProjectImage(project, assets, bitmaps);
        const extension = project.export.format === "image/jpeg" ? "jpg" : "png";
        downloadBlob(
          blob,
          `${project.title.toLowerCase().replace(/\s+/g, "-")}.${extension}`,
        );
        set({ status: "Export saved." });
      },
      {
        busy: true,
        startStatus: "Rendering export…",
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not export image: ${error.message}`
            : "Could not export image.",
      },
    );
  },

  async exportCurrentBundle() {
    await runWorkspaceAction(
      async () => {
        const project = getActiveProject(get());
        if (!project) return;
        const versions = get().versions.filter(
          (version) => version.projectId === project.id,
        );
        const assets = get().assets.filter((asset) => asset.projectId === project.id);
        const blob = await exportProjectBundle(project, versions, assets);
        downloadBlob(
          blob,
          `${project.title.toLowerCase().replace(/\s+/g, "-")}.image-compositor.zip`,
        );
        set({ status: "Project bundle exported." });
      },
      {
        busy: true,
        startStatus: "Packaging project bundle…",
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not export project bundle: ${error.message}`
            : "Could not export project bundle.",
      },
    );
  },

  async inspectBundleImport(file) {
    let inspection: BundleImportInspection | null = null;

    await runWorkspaceAction(
      async () => {
        const bundle = await loadProjectBundle(file);
        const conflictProject = normalizeProjectDocument(
          (await db.projects.get(bundle.projectDoc.id)) ?? bundle.projectDoc,
        );

        inspection = {
          fileName: file.name,
          projectId: bundle.projectDoc.id,
          projectTitle: bundle.projectDoc.title,
          bundle,
          conflictProject:
            conflictProject.id === bundle.projectDoc.id &&
            (await db.projects.get(bundle.projectDoc.id))
              ? conflictProject
              : null,
        };

        set({
          status: inspection.conflictProject
            ? "Import needs confirmation."
            : "Bundle ready to import.",
        });
      },
      {
        busy: true,
        startStatus: "Inspecting project bundle…",
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not inspect bundle: ${error.message}`
            : "Could not inspect bundle.",
      },
    );

    if (!inspection) {
      throw new Error("Bundle inspection did not complete.");
    }

    return inspection;
  },

  async resolveBundleImport(inspection, resolution) {
    await runWorkspaceAction(
      async () => {
        if (resolution === "replace" && inspection.conflictProject) {
          await deleteProjectDataAtomically(inspection.conflictProject.id);
        }

        const bundle =
          resolution === "copy" ? createImportCopy(inspection.bundle) : inspection.bundle;
        await persistImportedProjectBundle(bundle);
        const historyByProject = clearProjectHistory(
          get().historyByProject,
          bundle.projectDoc.id,
        );
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
      {
        busy: true,
        startStatus: "Importing project bundle…",
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not import project bundle: ${error.message}`
            : "Could not import project bundle.",
      },
    );
  },

  async undo() {
    await runWorkspaceAction(
      async () => {
        const project = getActiveProject(get());
        if (!project) return;

        const history = getProjectHistory(get().historyByProject, project.id);
        const entry = history.past.at(-1);
        if (!entry) return;

        if (entry.kind === "project-change") {
          const updatedProject = applySnapshotToProject(project, entry.before);
          await putProjectDocument(updatedProject);

          set((state) => {
            const historyByProject = patchHistory(
              state.historyByProject,
              project.id,
              (currentHistory) => ({
                past: currentHistory.past.slice(0, -1),
                future: [...currentHistory.future, entry],
              }),
            );

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
          const restoredAssets = entry.assets.map(({ asset }) => asset);
          const updatedProject = applySnapshotToProject(project, entry.before);

          await persistAssetCreationsAtomically({
            projectDoc: updatedProject,
            assets: entry.assets,
          });

          set((state) => {
            const historyByProject = patchHistory(
              state.historyByProject,
              project.id,
              (currentHistory) => ({
                past: currentHistory.past.slice(0, -1),
                future: [...currentHistory.future, entry],
              }),
            );

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
        const removedAssets = entry.assets.map(({ asset }) => asset);
        const assetIds = removedAssets.map((asset) => asset.id);

        await deleteAssetsAtomically({
          projectDoc: updatedProject,
          assets: removedAssets,
        });

        set((state) => {
          const historyByProject = patchHistory(
            state.historyByProject,
            project.id,
            (currentHistory) => ({
              past: currentHistory.past.slice(0, -1),
              future: [...currentHistory.future, entry],
            }),
          );

          return {
            assets: removeAssetsById(state.assets, assetIds),
            projects: upsertProject(state.projects, updatedProject),
            historyByProject,
            status: "Undo applied.",
            ...getHistoryFlags(historyByProject, state.activeProjectId),
          };
        });
      },
      {
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not undo: ${error.message}`
            : "Could not undo.",
      },
    );
  },

  async redo() {
    await runWorkspaceAction(
      async () => {
        const project = getActiveProject(get());
        if (!project) return;

        const history = getProjectHistory(get().historyByProject, project.id);
        const entry = history.future.at(-1);
        if (!entry) return;

        if (entry.kind === "project-change") {
          const updatedProject = applySnapshotToProject(project, entry.after);
          await putProjectDocument(updatedProject);

          set((state) => {
            const historyByProject = patchHistory(
              state.historyByProject,
              project.id,
              (currentHistory) => ({
                past: [...currentHistory.past, entry],
                future: currentHistory.future.slice(0, -1),
              }),
            );

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
          const removedAssets = entry.assets.map(({ asset }) => asset);
          const removedAssetIds = removedAssets.map((asset) => asset.id);
          const updatedProject = applySnapshotToProject(project, entry.after);

          await deleteAssetsAtomically({
            projectDoc: updatedProject,
            assets: removedAssets,
          });

          set((state) => {
            const historyByProject = patchHistory(
              state.historyByProject,
              project.id,
              (currentHistory) => ({
                past: [...currentHistory.past, entry],
                future: currentHistory.future.slice(0, -1),
              }),
            );

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

        await persistAssetCreationsAtomically({
          projectDoc: updatedProject,
          assets: entry.assets,
        });

        set((state) => {
          const historyByProject = patchHistory(
            state.historyByProject,
            project.id,
            (currentHistory) => ({
              past: [...currentHistory.past, entry],
              future: currentHistory.future.slice(0, -1),
            }),
          );

          return {
            assets: sortAssetsByCreated([
              ...state.assets,
              ...entry.assets.map(({ asset }) => asset),
            ]),
            projects: upsertProject(state.projects, updatedProject),
            historyByProject,
            status: "Redo applied.",
            ...getHistoryFlags(historyByProject, state.activeProjectId),
          };
        });
      },
      {
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not redo: ${error.message}`
            : "Could not redo.",
      },
    );
  },
  };
});
