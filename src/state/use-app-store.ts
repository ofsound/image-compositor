import { create } from "zustand";

import { duplicateSourceAsset, persistProcessedAsset } from "@/lib/assets";
import { db } from "@/lib/db";
import { downloadBlob } from "@/lib/download";
import { processImageFile } from "@/lib/image-worker-client";
import { makeId } from "@/lib/id";
import { deleteBlob } from "@/lib/opfs";
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
  ProjectDocument,
  ProjectVersion,
  SourceAsset,
} from "@/types/project";

type BundleImportResolution = "replace" | "copy";

interface AppState {
  ready: boolean;
  busy: boolean;
  status: string;
  projects: ProjectDocument[];
  assets: SourceAsset[];
  versions: ProjectVersion[];
  activeProjectId: string | null;
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
  ) => Promise<void>;
  importFiles: (files: FileList | File[]) => Promise<void>;
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
  const assets = sortAssetsByCreated(storedAssets);
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
    ready?: boolean;
    status: string;
  },
) {
  const snapshot = await loadWorkspaceSnapshot(options.activeProjectId);
  set({
    ...snapshot,
    busy: options.busy ?? false,
    ready: options.ready ?? true,
    status: options.status,
  });
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

  async bootstrap() {
    set({ busy: true, status: "Loading local workspace…" });
    await syncWorkspace(set, { busy: false, ready: true, status: "Ready." });
  },

  setStatus(status) {
    set({ status });
  },

  async createProject() {
    const project = createProjectDocument(getNextProjectTitle(get().projects));
    await Promise.all([db.projects.put(project), persistActiveProjectId(project.id)]);
    await syncWorkspace(set, {
      activeProjectId: project.id,
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
      status: "Project restored.",
    });
  },

  async purgeProject(projectId) {
    set({ busy: true, status: "Deleting project permanently…" });
    await deleteProjectData(projectId);
    await syncWorkspace(set, {
      activeProjectId: get().activeProjectId === projectId ? null : get().activeProjectId,
      busy: false,
      status: "Project deleted permanently.",
    });
  },

  async setActiveProject(projectId) {
    const project = get().projects.find(
      (entry) => entry.id === projectId && entry.deletedAt === null,
    );
    if (!project) return;
    await persistActiveProjectId(projectId);
    set({ activeProjectId: projectId, status: "Project loaded." });
  },

  async updateProject(updater) {
    const project = getActiveProject(get());
    if (!project) return;

    const updatedProject = updater({
      ...project,
      updatedAt: new Date().toISOString(),
    });

    await db.projects.put(updatedProject);
    set((state) => ({
      projects: sortByUpdated(
        state.projects.map((entry) =>
          entry.id === updatedProject.id ? normalizeProjectDocument(updatedProject) : entry,
        ),
      ),
      status: "Draft saved locally.",
    }));
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

      set((state) => ({
        assets: sortAssetsByCreated([...state.assets, ...importedAssets]),
        projects: sortByUpdated(
          state.projects.map((entry) => (entry.id === nextProject.id ? nextProject : entry)),
        ),
        busy: false,
        status: `Imported ${importedAssets.length} source image(s).`,
      }));
    } catch (error) {
      set({
        busy: false,
        status:
          error instanceof Error ? `Import failed: ${error.message}` : "Import failed.",
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
    set((state) => ({
      projects: sortByUpdated(
        state.projects.map((entry) => (entry.id === updatedProject.id ? updatedProject : entry)),
      ),
      status: `Restored "${normalizedVersion.label}".`,
    }));
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

    await syncWorkspace(set, {
      activeProjectId: bundle.projectDoc.id,
      busy: false,
      status:
        resolution === "copy"
          ? `Imported ${bundle.projectDoc.title} as a copy.`
          : `Imported ${bundle.projectDoc.title}.`,
    });
  },
}));
