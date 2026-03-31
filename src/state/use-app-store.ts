import { create } from "zustand";

import { persistProcessedAsset } from "@/lib/assets";
import { db } from "@/lib/db";
import { downloadBlob } from "@/lib/download";
import { processImageFile } from "@/lib/image-worker-client";
import { createProjectDocument } from "@/lib/project-defaults";
import { exportProjectImage } from "@/lib/render";
import { exportProjectBundle, importProjectBundle } from "@/lib/serializer";
import type { ProjectDocument, ProjectVersion, SourceAsset } from "@/types/project";
import { makeId } from "@/lib/id";

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
  setActiveProject: (projectId: string) => Promise<void>;
  updateProject: (
    updater: (project: ProjectDocument) => ProjectDocument,
  ) => Promise<void>;
  importFiles: (files: FileList | File[]) => Promise<void>;
  randomizeSeed: () => Promise<void>;
  saveVersion: (label: string, thumbnailBlob?: Blob | null) => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;
  exportCurrentImage: (
    bitmapLookup: (asset: SourceAsset) => Promise<Blob | null>,
  ) => Promise<void>;
  exportCurrentBundle: () => Promise<void>;
  importBundleFile: (file: File) => Promise<void>;
}

function sortByUpdated(projects: ProjectDocument[]) {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getActiveProject(state: Pick<AppState, "projects" | "activeProjectId">) {
  return state.projects.find((project) => project.id === state.activeProjectId) ?? null;
}

async function persistProject(project: ProjectDocument) {
  await db.projects.put(project);
  await db.kv.put({ key: "activeProjectId", value: project.id });
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
    const [projects, assets, versions, activeProject] = await Promise.all([
      db.projects.toArray(),
      db.assets.toArray(),
      db.versions.toArray(),
      db.kv.get("activeProjectId"),
    ]);

    if (projects.length === 0) {
      const project = createProjectDocument("Launch Study");
      await persistProject(project);
      set({
        projects: [project],
        assets,
        versions,
        activeProjectId: project.id,
        ready: true,
        busy: false,
        status: "Ready.",
      });
      return;
    }

    const activeProjectId =
      activeProject?.value ?? sortByUpdated(projects)[0]?.id ?? null;
    set({
      projects: sortByUpdated(projects),
      assets,
      versions: [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      activeProjectId,
      ready: true,
      busy: false,
      status: "Ready.",
    });
  },

  setStatus(status) {
    set({ status });
  },

  async createProject() {
    const project = createProjectDocument(`Study ${get().projects.length + 1}`);
    await persistProject(project);
    set((state) => ({
      projects: sortByUpdated([project, ...state.projects]),
      activeProjectId: project.id,
      status: "Created a new project.",
    }));
  },

  async setActiveProject(projectId) {
    await db.kv.put({ key: "activeProjectId", value: projectId });
    set({ activeProjectId: projectId, status: "Project loaded." });
  },

  async updateProject(updater) {
    const project = getActiveProject(get());
    if (!project) return;

    const updatedProject = updater({
      ...project,
      updatedAt: new Date().toISOString(),
    });

    await persistProject(updatedProject);
    set((state) => ({
      projects: sortByUpdated(
        state.projects.map((entry) =>
          entry.id === updatedProject.id ? updatedProject : entry,
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
        const asset = await persistProcessedAsset(file, payload);
        importedAssets.push(asset);
        await db.assets.put(asset);
      }

      const nextProject = {
        ...activeProject,
        sourceIds: [...new Set([...activeProject.sourceIds, ...importedAssets.map((asset) => asset.id)])],
        updatedAt: new Date().toISOString(),
      };

      await persistProject(nextProject);

      set((state) => ({
        assets: [...state.assets, ...importedAssets].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
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

    await Promise.all([db.versions.put(version), persistProject(updatedProject)]);

    set((state) => ({
      versions: [version, ...state.versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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

    const updatedProject: ProjectDocument = {
      ...project,
      ...structuredClone(version.snapshot),
      currentVersionId: version.id,
      updatedAt: new Date().toISOString(),
    };

    await persistProject(updatedProject);
    set((state) => ({
      projects: sortByUpdated(
        state.projects.map((entry) => (entry.id === updatedProject.id ? updatedProject : entry)),
      ),
      status: `Restored "${version.label}".`,
    }));
  },

  async exportCurrentImage(bitmapLookup) {
    const project = getActiveProject(get());
    if (!project) return;
    const assets = get().assets.filter((asset) => project.sourceIds.includes(asset.id));
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
    const assets = get().assets.filter((asset) => project.sourceIds.includes(asset.id));
    set({ busy: true, status: "Packaging project bundle…" });
    const blob = await exportProjectBundle(project, versions, assets);
    downloadBlob(blob, `${project.title.toLowerCase().replace(/\s+/g, "-")}.image-grid.zip`);
    set({ busy: false, status: "Project bundle exported." });
  },

  async importBundleFile(file) {
    set({ busy: true, status: "Importing project bundle…" });
    const { projectDoc, versionDocs, assetDocs } = await importProjectBundle(file);
    const [projects, versions, assets] = await Promise.all([
      db.projects.toArray(),
      db.versions.toArray(),
      db.assets.toArray(),
    ]);
    set({
      projects: sortByUpdated(projects),
      versions: [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      assets,
      activeProjectId: projectDoc.id,
      busy: false,
      status: `Imported ${projectDoc.title}.`,
    });
    void versionDocs;
    void assetDocs;
  },
}));
