import { normalizeSourceAsset } from "@/lib/assets";
import { db } from "@/lib/db";
import type { KVRecord } from "@/lib/db";
import {
  normalizeProjectDocument,
  normalizeProjectVersion,
  serializeProjectDocument,
  serializeProjectVersion,
} from "@/lib/project-defaults";
import { deleteBlob, readBlob, writeBlob } from "@/lib/opfs";
import type {
  ImportedProjectBundle,
  ProjectDocument,
  ProjectVersion,
  SourceAsset,
} from "@/types/project";

export interface WorkspaceSnapshotData {
  projects: ProjectDocument[];
  assets: SourceAsset[];
  versions: ProjectVersion[];
  activeProjectId: string | null;
}

const ACTIVE_PROJECT_KEY = "activeProjectId";

function sortProjectsByUpdated(projects: ProjectDocument[]) {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function sortAssetsByCreated(assets: SourceAsset[]) {
  return [...assets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function sortVersionsByCreated(versions: ProjectVersion[]) {
  return [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function snapshotBlobPaths(paths: string[]) {
  const uniquePaths = [...new Set(paths)];
  const entries = await Promise.all(
    uniquePaths.map(async (path) => [path, await readBlob(path)] as const),
  );

  return Object.fromEntries(entries) as Record<string, Blob | null>;
}

async function restoreBlobSnapshot(snapshot: Record<string, Blob | null>) {
  await Promise.all(
    Object.entries(snapshot).map(([path, blob]) =>
      blob ? writeBlob(path, blob) : deleteBlob(path),
    ),
  );
}

export async function persistActiveProjectId(projectId: string | null) {
  if (!projectId) {
    return;
  }

  await db.kv.put({ key: ACTIVE_PROJECT_KEY, value: projectId });
}

export async function loadWorkspaceSnapshotData(
  preferredActiveProjectId?: string | null,
): Promise<WorkspaceSnapshotData> {
  const [storedProjects, storedAssets, storedVersions, activeRecord] = await Promise.all([
    db.projects.toArray(),
    db.assets.toArray(),
    db.versions.toArray(),
    db.kv.get(ACTIVE_PROJECT_KEY),
  ]);

  return {
    projects: sortProjectsByUpdated(
      storedProjects.map((project) => normalizeProjectDocument(project)),
    ),
    assets: sortAssetsByCreated(
      storedAssets.map((asset) => normalizeSourceAsset(asset)),
    ),
    versions: sortVersionsByCreated(
      storedVersions.map((version) => normalizeProjectVersion(version)),
    ),
    activeProjectId: preferredActiveProjectId ?? activeRecord?.value ?? null,
  };
}

export async function putProjectDocument(project: ProjectDocument) {
  await db.projects.put(serializeProjectDocument(project));
}

export async function putProjectDocuments(projects: ProjectDocument[]) {
  await db.projects.bulkPut(projects.map((project) => serializeProjectDocument(project)));
}

export async function putProjectVersion(version: ProjectVersion) {
  await db.versions.put(serializeProjectVersion(version));
}

export async function putProjectVersions(versions: ProjectVersion[]) {
  await db.versions.bulkPut(versions.map((version) => serializeProjectVersion(version)));
}

export async function deleteProjectDataAtomically(projectId: string) {
  const [project, assets, versions] = await Promise.all([
    db.projects.get(projectId),
    db.assets.where("projectId").equals(projectId).toArray(),
    db.versions.where("projectId").equals(projectId).toArray(),
  ]);

  const blobSnapshot = await snapshotBlobPaths([
    ...assets.flatMap((asset) => [
      asset.originalPath,
      asset.normalizedPath,
      asset.previewPath,
    ]),
    ...versions
      .map((version) => version.thumbnailPath)
      .filter((path): path is string => Boolean(path)),
  ]);

  try {
    await Promise.all(
      Object.keys(blobSnapshot).map((path) => deleteBlob(path)),
    );

    await db.transaction("rw", db.projects, db.assets, db.versions, async () => {
      await db.assets.bulkDelete(assets.map((asset) => asset.id));
      await db.versions.bulkDelete(versions.map((version) => version.id));
      await db.projects.delete(projectId);
    });
  } catch (error) {
    await restoreBlobSnapshot(blobSnapshot);
    await db.transaction("rw", db.projects, db.assets, db.versions, async () => {
      if (project) {
        await db.projects.put(project);
      }
      if (assets.length > 0) {
        await db.assets.bulkPut(assets);
      }
      if (versions.length > 0) {
        await db.versions.bulkPut(versions);
      }
    });
    throw error;
  }
}

export async function persistImportedProjectBundleAtomically(
  bundle: ImportedProjectBundle,
) {
  const {
    projectDoc,
    versionDocs,
    assetDocs,
    assetBlobs,
    versionBlobs,
  } = bundle;

  const previousProject = await db.projects.get(projectDoc.id);
  const [previousAssets, previousVersions, previousActiveProjectId] = await Promise.all([
    Promise.all(assetDocs.map(async (asset) => db.assets.get(asset.id))),
    Promise.all(versionDocs.map(async (version) => db.versions.get(version.id))),
    db.kv.get(ACTIVE_PROJECT_KEY),
  ]);

  const blobSnapshot = await snapshotBlobPaths([
    ...Object.keys(assetBlobs),
    ...Object.keys(versionBlobs),
  ]);

  try {
    await Promise.all([
      ...Object.entries(assetBlobs).map(([path, blob]) => writeBlob(path, blob)),
      ...Object.entries(versionBlobs).map(([path, blob]) => writeBlob(path, blob)),
    ]);

    await db.transaction("rw", db.projects, db.assets, db.versions, db.kv, async () => {
      await db.projects.put(serializeProjectDocument(projectDoc));
      await db.assets.bulkPut(assetDocs);
      await db.versions.bulkPut(
        versionDocs.map((version) => serializeProjectVersion(version)),
      );
      await db.kv.put({ key: ACTIVE_PROJECT_KEY, value: projectDoc.id });
    });
  } catch (error) {
    await restoreBlobSnapshot(blobSnapshot);
    await db.transaction("rw", db.projects, db.assets, db.versions, db.kv, async () => {
      if (previousProject) {
        await db.projects.put(previousProject);
      } else {
        await db.projects.delete(projectDoc.id);
      }

      await db.assets.bulkDelete(assetDocs.map((asset) => asset.id));
      const restorableAssets = previousAssets.filter(
        (asset): asset is SourceAsset => Boolean(asset),
      );
      if (restorableAssets.length > 0) {
        await db.assets.bulkPut(restorableAssets);
      }

      await db.versions.bulkDelete(versionDocs.map((version) => version.id));
      const restorableVersions = previousVersions.filter(
        (version): version is ProjectVersion => Boolean(version),
      );
      if (restorableVersions.length > 0) {
        await db.versions.bulkPut(restorableVersions);
      }

      if (previousActiveProjectId) {
        await db.kv.put(previousActiveProjectId as KVRecord);
      } else {
        await db.kv.delete(ACTIVE_PROJECT_KEY);
      }
    });

    throw error;
  }

  return { projectDoc, versionDocs, assetDocs };
}
