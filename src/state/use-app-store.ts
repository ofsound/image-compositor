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
import {
  captureCanonicalProjectPayload,
  fromCanonicalProjectPayload,
  getElectronApi,
  isElectronWorkspace,
  toCanonicalProjectPayload,
} from "@/lib/electron-workspace";
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
  replaceWorkspaceWithImportedProjectBundle,
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
import type {
  OpenProjectResult,
  ProjectSummary,
} from "../../electron/contract";

export type RandomizeLayerScope = "visible" | "selected";

export interface RandomizeVariantOptions {
  layerScope: RandomizeLayerScope;
  /**
   * Regenerate procedural sources (perlin/cellular/reaction/waves) with new recipe seeds.
   * When at least one source is updated, undo history for this project is cleared (same as editing a generated source).
   */
  includeTextures?: boolean;
}

function nextRandomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

function getRandomizeTargetLayerIds(
  project: ProjectDocument,
  layerScope: RandomizeLayerScope,
): Set<string> {
  const ids = new Set<string>();
  if (layerScope === "visible") {
    for (const layer of project.layers) {
      if (layer.visible) {
        ids.add(layer.id);
      }
    }
  } else {
    const selected = getSelectedLayer(project);
    if (selected) {
      ids.add(selected.id);
    }
  }
  return ids;
}

function collectProceduralAssetsForLayers(
  project: ProjectDocument,
  storeAssets: SourceAsset[],
  targetLayerIds: Set<string>,
  projectId: string,
): SourceAsset[] {
  const byId = new Map(storeAssets.map((a) => [a.id, a] as const));
  const seen = new Set<string>();
  const out: SourceAsset[] = [];
  for (const layer of project.layers) {
    if (!targetLayerIds.has(layer.id)) {
      continue;
    }
    for (const sourceId of layer.sourceIds) {
      if (seen.has(sourceId)) {
        continue;
      }
      const asset = byId.get(sourceId);
      if (!asset || asset.projectId !== projectId) {
        continue;
      }
      if (
        asset.kind === "perlin" ||
        asset.kind === "cellular" ||
        asset.kind === "reaction" ||
        asset.kind === "waves"
      ) {
        seen.add(sourceId);
        out.push(asset);
      }
    }
  }
  return out;
}

async function regenerateProceduralAssetWithNewSeed(
  asset: SourceAsset,
): Promise<PreparedAssetRecord> {
  const seed = nextRandomSeed();
  if (asset.kind === "perlin") {
    return updateGeneratedSourceAsset(asset, {
      name: asset.name,
      color: asset.recipe.color,
      scale: asset.recipe.scale,
      detail: asset.recipe.detail,
      contrast: asset.recipe.contrast,
      distortion: asset.recipe.distortion,
      seed,
    });
  }
  if (asset.kind === "cellular") {
    return updateGeneratedSourceAsset(asset, {
      name: asset.name,
      color: asset.recipe.color,
      scale: asset.recipe.scale,
      jitter: asset.recipe.jitter,
      edge: asset.recipe.edge,
      contrast: asset.recipe.contrast,
      seed,
    });
  }
  if (asset.kind === "reaction") {
    return updateGeneratedSourceAsset(asset, {
      name: asset.name,
      color: asset.recipe.color,
      scale: asset.recipe.scale,
      diffusion: asset.recipe.diffusion,
      balance: asset.recipe.balance,
      distortion: asset.recipe.distortion,
      seed,
    });
  }
  if (asset.kind === "waves") {
    return updateGeneratedSourceAsset(asset, {
      name: asset.name,
      color: asset.recipe.color,
      scale: asset.recipe.scale,
      interference: asset.recipe.interference,
      directionality: asset.recipe.directionality,
      distortion: asset.recipe.distortion,
      seed,
    });
  }
  throw new Error(`Unsupported procedural asset kind: ${(asset as SourceAsset).kind}`);
}

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
type ExportFilenameReservations = Record<string, boolean>;

interface AppState {
  ready: boolean;
  busy: boolean;
  status: string;
  sourceImportProgress: SourceImportProgress | null;
  projects: ProjectDocument[];
  projectSummaries: ProjectSummary[];
  assets: SourceAsset[];
  versions: ProjectVersion[];
  activeProjectId: string | null;
  historyByProject: HistoryByProject;
  exportFilenameReservations: ExportFilenameReservations;
  canUndo: boolean;
  canRedo: boolean;
  bootstrap: () => Promise<void>;
  setStatus: (status: string) => void;
  createProject: () => Promise<void>;
  renameProject: (projectId: string, title: string) => Promise<void>;
  duplicateProject: (projectId: string, title: string) => Promise<void>;
  duplicateProjectInNewWindow: (projectId: string, title: string) => Promise<void>;
  openProjectInNewWindow: (projectId: string) => Promise<OpenProjectResult | null>;
  focusProjectWindow: (projectId: string) => Promise<boolean>;
  trashProject: (projectId: string) => Promise<void>;
  restoreProject: (projectId: string) => Promise<void>;
  purgeProject: (projectId: string) => Promise<void>;
  setActiveProject: (projectId: string) => Promise<OpenProjectResult | null>;
  selectLayer: (layerId: string) => Promise<void>;
  addLayer: () => Promise<void>;
  duplicateLayer: (layerId: string) => Promise<void>;
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
  randomizeVariant: (options: RandomizeVariantOptions) => Promise<void>;
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

function getProjectExportSlug(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, "-") || "composition";
}

function reserveUniqueExportFilename(
  reservations: ExportFilenameReservations,
  preferredFilename: string,
) {
  const extensionMatch = preferredFilename.match(/(\.[^.]+)$/);
  const extension = extensionMatch?.[1] ?? "";
  const stem = extension
    ? preferredFilename.slice(0, -extension.length)
    : preferredFilename;
  let filename = preferredFilename;
  let suffix = 2;

  while (reservations[filename]) {
    filename = `${stem}-${suffix}${extension}`;
    suffix += 1;
  }

  return {
    filename,
    reservations: {
      ...reservations,
      [filename]: true,
    },
  };
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

function getNextProjectTitle(projects: Array<Pick<ProjectSummary, "deletedAt">>) {
  return `Study ${projects.filter((project) => project.deletedAt === null).length + 1}`;
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

function getDuplicateLayerName(project: ProjectDocument, layerName: string) {
  const baseName = `${layerName.trim() || "Layer"} Copy`;
  const existingNames = new Set(project.layers.map((layer) => layer.name));
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  let copyIndex = 2;
  while (existingNames.has(`${baseName} ${copyIndex}`)) {
    copyIndex += 1;
  }

  return `${baseName} ${copyIndex}`;
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
    projectSummaries: projects.map((project) => ({
      id: project.id,
      title: project.title,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      deletedAt: project.deletedAt,
      locked: false,
      lockedByCurrentWindow: false,
    })),
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

async function replaceWorkspaceWithCanonicalPayload(
  payload: Awaited<ReturnType<typeof toCanonicalProjectPayload>>,
) {
  await replaceWorkspaceWithImportedProjectBundle(
    fromCanonicalProjectPayload(payload),
  );
}

export const useAppStore = create<AppState>((set, get) => {
  const commandRunner = createWorkspaceCommandRunner<AppState>(set, get);
  const electronApi = getElectronApi();
  const useElectron = isElectronWorkspace();
  interface PendingProjectCommit {
    before: ProjectSnapshot | null;
    projectId: string;
    recordHistory: boolean;
    timeoutId: ReturnType<typeof setTimeout>;
  }
  const pendingProjectCommits = new Map<string, PendingProjectCommit>();

  async function applyElectronBootstrap(
    bootstrap: Awaited<ReturnType<NonNullable<typeof electronApi>["bootstrapWindow"]>>,
    status: string,
  ) {
    if (!bootstrap.workspace) {
      set(
        withHistoryFlags(
          {
            ready: true,
            busy: false,
            status,
            projects: [],
            projectSummaries: bootstrap.projectSummaries,
            assets: [],
            versions: [],
            activeProjectId: null,
          },
          get().historyByProject,
          null,
        ),
      );
      return;
    }

    await replaceWorkspaceWithCanonicalPayload(bootstrap.workspace);
    const project = normalizeProjectDocument(bootstrap.workspace.projectDoc);
    const assets = sortAssetsByCreated(
      bootstrap.workspace.assetDocs.map((asset: SourceAsset) => structuredClone(asset)),
    );
    const versions = sortVersionsByCreated(
      bootstrap.workspace.versionDocs.map((version: ProjectVersion) =>
        normalizeProjectVersion(structuredClone(version)),
      ),
    );

    set(
      withHistoryFlags(
        {
          ready: true,
          busy: false,
          status,
          projects: [project],
          projectSummaries: bootstrap.projectSummaries,
          assets,
          versions,
          activeProjectId: project.id,
          historyByProject: {},
        },
        {},
        project.id,
      ),
    );
  }

  async function refreshElectronProjectSummaries() {
    if (!electronApi) {
      return;
    }

    const projectSummaries = await electronApi.listProjects();
    set({ projectSummaries });
  }

  async function syncElectronProjectDocument(projectDoc: ProjectDocument) {
    if (!electronApi) {
      return;
    }

    const projectSummaries = await electronApi.saveProjectDocument(projectDoc);
    set({ projectSummaries });
  }

  async function syncElectronActiveProjectBundle(projectOverride?: ProjectDocument) {
    if (!electronApi) {
      return;
    }

    const project = projectOverride ?? getActiveProject(get());
    if (!project) {
      return;
    }

    const payload = await captureCanonicalProjectPayload({
      project,
      versions: get().versions.filter((version) => version.projectId === project.id),
      assets: get().assets.filter((asset) => asset.projectId === project.id),
    });
    const projectSummaries = await electronApi.saveProjectBundle(payload);
    set({ projectSummaries });
  }

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
    if (useElectron) {
      await syncElectronProjectDocument(currentProject);
    }
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

        if (useElectron) {
          await syncElectronActiveProjectBundle(nextProject);
        }
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
  projectSummaries: [],
  assets: [],
  versions: [],
  activeProjectId: null,
  historyByProject: {},
  exportFilenameReservations: {},
  canUndo: false,
  canRedo: false,

  async bootstrap() {
    await runWorkspaceAction(
      async () => {
        if (electronApi) {
          const bootstrap = await electronApi.bootstrapWindow();
          if (!bootstrap.workspace && bootstrap.projectSummaries.length === 0) {
            const project = createProjectDocument("Launch Study");
            const result = await electronApi.checkoutProject({
              payload: await captureCanonicalProjectPayload({
                project,
                versions: [],
                assets: [],
              }),
              target: "current",
            });

            if (result.kind !== "opened" || !result.bootstrap) {
              throw new Error("Could not create the initial project.");
            }

            await applyElectronBootstrap(result.bootstrap, "Ready.");
            return;
          }

          await applyElectronBootstrap(bootstrap, "Ready.");
          return;
        }

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
        if (electronApi) {
          const project = createProjectDocument(getNextProjectTitle(get().projectSummaries));
          const result = await electronApi.checkoutProject({
            payload: await captureCanonicalProjectPayload({
              project,
              versions: [],
              assets: [],
            }),
            target: "current",
          });

          if (result.kind !== "opened" || !result.bootstrap) {
            throw new Error("Could not create project.");
          }

          await applyElectronBootstrap(result.bootstrap, "Created a new project.");
          return;
        }

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
        if (electronApi) {
          const nextTitle = title.trim() || "Untitled Composition";
          const activeProject = getActiveProject(get());
          if (activeProject?.id === projectId) {
            const updatedProject = {
              ...activeProject,
              title: nextTitle,
              updatedAt: new Date().toISOString(),
            };
            await putProjectDocument(updatedProject);
            await syncElectronProjectDocument(updatedProject);
            set((state) => ({
              projects: upsertProject(state.projects, updatedProject),
              status: "Project renamed.",
              ...getHistoryFlags(state.historyByProject, state.activeProjectId),
            }));
          } else {
            const projectSummaries = await electronApi.renameProject({
              projectId,
              title: nextTitle,
            });
            set({ projectSummaries, status: "Project renamed." });
          }
          return;
        }

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
        if (electronApi) {
          const result = await electronApi.duplicateProject({
            projectId,
            title: title.trim() || undefined,
            target: "current",
          });

          if (result.bootstrap) {
            await applyElectronBootstrap(result.bootstrap, "Project duplicated.");
          } else {
            await refreshElectronProjectSummaries();
            set({ status: "Project duplicated." });
          }
          return;
        }

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

  async duplicateProjectInNewWindow(projectId, title) {
    if (!electronApi) {
      await get().duplicateProject(projectId, title);
      return;
    }

    await runWorkspaceAction(
      async () => {
        await electronApi.duplicateProject({
          projectId,
          title: title.trim() || undefined,
          target: "new",
        });
        await refreshElectronProjectSummaries();
        set({ status: "Project duplicated in a new window." });
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
        if (electronApi) {
          const projectSummaries = await electronApi.trashProject(projectId);
          set({ projectSummaries, status: "Project moved to trash." });
          return;
        }

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
        if (electronApi) {
          const projectSummaries = await electronApi.restoreProject(projectId);
          set({ projectSummaries, status: "Project restored." });
          return;
        }

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
        if (electronApi) {
          const projectSummaries = await electronApi.purgeProject(projectId);
          set({ projectSummaries, status: "Project deleted permanently." });
          return;
        }

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
    let result: OpenProjectResult | null = null;
    await runWorkspaceAction(
      async () => {
        if (electronApi) {
          const openResult = await electronApi.openProject({
            projectId,
            target: "current",
          });
          result = openResult;
          if (openResult.kind === "opened") {
            if (openResult.bootstrap) {
              await applyElectronBootstrap(openResult.bootstrap, "Project loaded.");
            }
          } else {
            set({ status: `"${openResult.title}" is already open in another window.` });
          }
          return;
        }

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
    return result;
  },

  async openProjectInNewWindow(projectId) {
    if (!electronApi) {
      return null;
    }

    let result: OpenProjectResult | null = null;
    await runWorkspaceAction(
      async () => {
        const openResult = await electronApi.openProject({
          projectId,
          target: "new",
        });
        result = openResult;
        if (openResult.kind === "opened") {
          await refreshElectronProjectSummaries();
          set({ status: "Opened in a new window." });
        } else {
          set({ status: `"${openResult.title}" is already open in another window.` });
        }
      },
      {
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not open project in new window: ${error.message}`
            : "Could not open project in new window.",
      },
    );
    return result;
  },

  async focusProjectWindow(projectId) {
    if (!electronApi) {
      return false;
    }

    return electronApi.focusProjectWindow(projectId);
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
        if (useElectron) {
          await syncElectronProjectDocument(updatedProject);
        }

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

  async duplicateLayer(layerId) {
    await runWorkspaceAction(
      async () => {
        const project = getActiveProject(get());
        if (!project || !project.layers.some((layer) => layer.id === layerId)) return;

        await get().updateProject((currentProject) => {
          const baseProject = createProjectMutationBase(currentProject);
          const sourceLayerIndex = baseProject.layers.findIndex(
            (layer) => layer.id === layerId,
          );
          const sourceLayer = baseProject.layers[sourceLayerIndex];
          if (!sourceLayer) {
            return baseProject;
          }

          const duplicateLayer: CompositorLayer = {
            ...structuredClone(sourceLayer),
            id: makeId("layer"),
            name: getDuplicateLayerName(baseProject, sourceLayer.name),
          };
          const layers = [...baseProject.layers];
          layers.splice(sourceLayerIndex + 1, 0, duplicateLayer);

          return {
            ...baseProject,
            canvas: {
              ...baseProject.canvas,
              inset: sourceLayer.inset,
            },
            layers,
            selectedLayerId: duplicateLayer.id,
          };
        });
      },
      {
        queue: false,
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not duplicate layer: ${error.message}`
            : "Could not duplicate layer.",
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
        if (useElectron) {
          await syncElectronProjectDocument(updatedProject);
        }
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

        if (useElectron) {
          await syncElectronActiveProjectBundle(nextProject);
        }
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

        if (useElectron) {
          await syncElectronActiveProjectBundle(nextProject);
        }
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

        if (useElectron) {
          await syncElectronActiveProjectBundle(updatedProject);
        }
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

  async randomizeVariant(options: RandomizeVariantOptions) {
    await runWorkspaceAction(
      async () => {
        const project = getActiveProject(get());
        if (!project) {
          return;
        }

        const targetIds = getRandomizeTargetLayerIds(project, options.layerScope);
        if (targetIds.size === 0) {
          set({ status: "No layers to shuffle." });
          return;
        }

        const proceduralAssets = collectProceduralAssetsForLayers(
          project,
          get().assets,
          targetIds,
          project.id,
        );

        const wantsTextures = Boolean(options.includeTextures);
        const shouldRegenerateTextures =
          wantsTextures && proceduralAssets.length > 0;

        if (!shouldRegenerateTextures) {
          await get().updateProject((draft) => {
            const ids = getRandomizeTargetLayerIds(draft, options.layerScope);
            if (ids.size === 0) {
              return draft;
            }

            return normalizeProjectDocument({
              ...draft,
              layers: draft.layers.map((layer) =>
                ids.has(layer.id)
                  ? { ...layer, activeSeed: nextRandomSeed() }
                  : layer,
              ),
              updatedAt: new Date().toISOString(),
            });
          });

          const layerWord =
            options.layerScope === "visible"
              ? `Shuffled seeds on ${targetIds.size} visible layer${targetIds.size === 1 ? "" : "s"}.`
              : "Shuffled seed on selected layer.";
          const suffix =
            wantsTextures && proceduralAssets.length === 0
              ? " No procedural sources to regenerate."
              : "";
          set({ status: `${layerWord}${suffix}` });
          return;
        }

        const draftProject = normalizeProjectDocument({
          ...createProjectMutationBase(project),
          updatedAt: new Date().toISOString(),
        });
        const updatedProject = normalizeProjectDocument(
          syncLegacyProjectFieldsToSelectedLayer({
            ...draftProject,
            layers: draftProject.layers.map((layer) =>
              targetIds.has(layer.id)
                ? { ...layer, activeSeed: nextRandomSeed() }
                : layer,
            ),
            updatedAt: new Date().toISOString(),
          }),
        );

        const preparedRecords: PreparedAssetRecord[] = [];
        for (const asset of proceduralAssets) {
          preparedRecords.push(await regenerateProceduralAssetWithNewSeed(asset));
        }

        await persistAssetUpdatesAtomically({
          projectDoc: updatedProject,
          assets: preparedRecords,
        });

        set((state) => {
          const historyByProject = clearProjectHistory(
            state.historyByProject,
            updatedProject.id,
          );
          let nextAssets = state.assets;
          for (const record of preparedRecords) {
            nextAssets = nextAssets.map((entry) =>
              entry.id === record.asset.id ? record.asset : entry,
            );
          }

          return {
            assets: sortAssetsByCreated(nextAssets),
            projects: sortByUpdated(
              state.projects.map((entry) =>
                entry.id === updatedProject.id ? updatedProject : entry,
              ),
            ),
            historyByProject,
            status: `Shuffled seeds and regenerated ${preparedRecords.length} procedural source${preparedRecords.length === 1 ? "" : "s"}. Undo history cleared.`,
            ...getHistoryFlags(historyByProject, state.activeProjectId),
          };
        });

        if (useElectron) {
          await syncElectronActiveProjectBundle(updatedProject);
        }
      },
      {
        busy: true,
        startStatus: "Randomizing…",
        queue: false,
        getErrorStatus: (error) =>
          error instanceof Error
            ? `Could not randomize: ${error.message}`
            : "Could not randomize.",
      },
    );
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

        if (useElectron) {
          await syncElectronActiveProjectBundle(updatedProject);
        }
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

        if (useElectron) {
          await syncElectronProjectDocument(updatedProject);
        }
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
        const preferredFilename = `${getProjectExportSlug(project.title)}.${extension}`;
        const { filename, reservations } = reserveUniqueExportFilename(
          get().exportFilenameReservations,
          preferredFilename,
        );
        downloadBlob(blob, filename);
        set({
          exportFilenameReservations: reservations,
          status: "Export saved.",
        });
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
        let conflictProject: ProjectDocument | null = null;

        if (electronApi) {
          const summary = get().projectSummaries.find(
            (project) => project.id === bundle.projectDoc.id,
          );
          if (summary) {
            conflictProject = {
              ...bundle.projectDoc,
              title: summary.title,
              deletedAt: summary.deletedAt,
              createdAt: summary.createdAt,
              updatedAt: summary.updatedAt,
            };
          }
        } else {
          const storedProject = await db.projects.get(bundle.projectDoc.id);
          if (storedProject) {
            conflictProject = normalizeProjectDocument(storedProject);
          }
        }

        inspection = {
          fileName: file.name,
          projectId: bundle.projectDoc.id,
          projectTitle: bundle.projectDoc.title,
          bundle,
          conflictProject,
        };

        set({
          status: conflictProject
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
        if (electronApi) {
          const bundle =
            resolution === "copy" ? createImportCopy(inspection.bundle) : inspection.bundle;
          const result = await electronApi.checkoutProject({
            payload: await toCanonicalProjectPayload(bundle),
            target: "current",
          });

          if (result.kind !== "opened" || !result.bootstrap) {
            throw new Error("Could not open imported project.");
          }

          await applyElectronBootstrap(
            result.bootstrap,
            resolution === "copy"
              ? `Imported ${bundle.projectDoc.title} as a copy.`
              : `Imported ${bundle.projectDoc.title}.`,
          );
          return;
        }

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
          if (useElectron) {
            await syncElectronProjectDocument(updatedProject);
          }
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
          if (useElectron) {
            await syncElectronActiveProjectBundle(updatedProject);
          }
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
        if (useElectron) {
          await syncElectronActiveProjectBundle(updatedProject);
        }
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
          if (useElectron) {
            await syncElectronProjectDocument(updatedProject);
          }
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
          if (useElectron) {
            await syncElectronActiveProjectBundle(updatedProject);
          }
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
        if (useElectron) {
          await syncElectronActiveProjectBundle(updatedProject);
        }
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
