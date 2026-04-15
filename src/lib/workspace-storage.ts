import { normalizeSourceAsset } from "@/lib/assets";
import type { PreparedAssetRecord } from "@/lib/assets";
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

function getAssetBlobPaths(
  asset: Pick<SourceAsset, "originalPath" | "normalizedPath" | "previewPath">,
) {
  return [asset.originalPath, asset.normalizedPath, asset.previewPath];
}

function getPreparedAssetIds(assets: PreparedAssetRecord[], deletedAssets: SourceAsset[]) {
  return [...new Set([
    ...assets.map(({ asset }) => asset.id),
    ...deletedAssets.map((asset) => asset.id),
  ])];
}

function getPreparedAssetBlobPaths(assets: PreparedAssetRecord[], deletedAssets: SourceAsset[]) {
  return [
    ...assets.flatMap(({ asset }) => getAssetBlobPaths(asset)),
    ...deletedAssets.flatMap((asset) => getAssetBlobPaths(asset)),
  ];
}

async function writePreparedAssetBlobs(assets: PreparedAssetRecord[]) {
  await Promise.all(
    assets.flatMap(({ asset, blobs }) => [
      blobs.original ? writeBlob(asset.originalPath, blobs.original) : Promise.resolve(),
      blobs.normalized ? writeBlob(asset.normalizedPath, blobs.normalized) : Promise.resolve(),
      blobs.preview ? writeBlob(asset.previewPath, blobs.preview) : Promise.resolve(),
    ]),
  );
}

async function deleteAssetBlobs(assets: SourceAsset[]) {
  await Promise.all(
    assets.flatMap((asset) =>
      getAssetBlobPaths(asset).map((path) => deleteBlob(path)),
    ),
  );
}

async function restoreAssetRows(previousAssets: Array<SourceAsset | undefined>, assetIds: string[]) {
  if (assetIds.length === 0) {
    return;
  }

  await db.assets.bulkDelete(assetIds);
  const restorableAssets = previousAssets.filter(
    (asset): asset is SourceAsset => Boolean(asset),
  );
  if (restorableAssets.length > 0) {
    await db.assets.bulkPut(restorableAssets);
  }
}

async function restoreProjectRow(projectId: string, previousProject?: ProjectDocument) {
  if (previousProject) {
    await db.projects.put(previousProject);
    return;
  }

  await db.projects.delete(projectId);
}

async function restoreActiveProjectId(previousActiveProjectId?: KVRecord) {
  if (previousActiveProjectId) {
    await db.kv.put(previousActiveProjectId);
    return;
  }

  await db.kv.delete(ACTIVE_PROJECT_KEY);
}

async function persistAssetMutationAtomically(options: {
  projectDoc: ProjectDocument;
  putAssets?: PreparedAssetRecord[];
  deleteAssets?: SourceAsset[];
  activeProjectId?: string | null;
}) {
  const putAssets = options.putAssets ?? [];
  const deleteAssets = options.deleteAssets ?? [];
  const assetIds = getPreparedAssetIds(putAssets, deleteAssets);
  const [previousProject, previousAssets, previousActiveProjectId] = await Promise.all([
    db.projects.get(options.projectDoc.id),
    Promise.all(assetIds.map(async (assetId) => db.assets.get(assetId))),
    options.activeProjectId === undefined ? Promise.resolve(undefined) : db.kv.get(ACTIVE_PROJECT_KEY),
  ]);

  const blobSnapshot = await snapshotBlobPaths(
    getPreparedAssetBlobPaths(putAssets, deleteAssets),
  );

  try {
    await Promise.all([
      writePreparedAssetBlobs(putAssets),
      deleteAssetBlobs(deleteAssets),
    ]);

    if (options.activeProjectId === undefined) {
      await db.transaction("rw", db.projects, db.assets, async () => {
        await db.projects.put(serializeProjectDocument(options.projectDoc));
        if (deleteAssets.length > 0) {
          await db.assets.bulkDelete(deleteAssets.map((asset) => asset.id));
        }
        if (putAssets.length > 0) {
          await db.assets.bulkPut(putAssets.map(({ asset }) => asset));
        }
      });
    } else {
      await db.transaction("rw", db.projects, db.assets, db.kv, async () => {
        await db.projects.put(serializeProjectDocument(options.projectDoc));
        if (deleteAssets.length > 0) {
          await db.assets.bulkDelete(deleteAssets.map((asset) => asset.id));
        }
        if (putAssets.length > 0) {
          await db.assets.bulkPut(putAssets.map(({ asset }) => asset));
        }
        if (options.activeProjectId) {
          await db.kv.put({ key: ACTIVE_PROJECT_KEY, value: options.activeProjectId });
        } else {
          await db.kv.delete(ACTIVE_PROJECT_KEY);
        }
      });
    }
  } catch (error) {
    await restoreBlobSnapshot(blobSnapshot);

    if (options.activeProjectId === undefined) {
      await db.transaction("rw", db.projects, db.assets, async () => {
        await restoreProjectRow(options.projectDoc.id, previousProject);
        await restoreAssetRows(previousAssets, assetIds);
      });
    } else {
      await db.transaction("rw", db.projects, db.assets, db.kv, async () => {
        await restoreProjectRow(options.projectDoc.id, previousProject);
        await restoreAssetRows(previousAssets, assetIds);
        await restoreActiveProjectId(previousActiveProjectId);
      });
    }

    throw error;
  }
}

export async function captureAssetSnapshot(asset: SourceAsset): Promise<PreparedAssetRecord> {
  const [original, normalized, preview] = await Promise.all([
    readBlob(asset.originalPath),
    readBlob(asset.normalizedPath),
    readBlob(asset.previewPath),
  ]);

  return {
    asset: structuredClone(asset),
    blobs: {
      original,
      normalized,
      preview,
    },
  };
}

export async function persistAssetCreationsAtomically(options: {
  projectDoc: ProjectDocument;
  assets: PreparedAssetRecord[];
  activeProjectId?: string | null;
}) {
  await persistAssetMutationAtomically({
    projectDoc: options.projectDoc,
    putAssets: options.assets,
    activeProjectId: options.activeProjectId,
  });
}

export async function persistAssetUpdatesAtomically(options: {
  projectDoc: ProjectDocument;
  assets: PreparedAssetRecord[];
}) {
  await persistAssetMutationAtomically({
    projectDoc: options.projectDoc,
    putAssets: options.assets,
  });
}

export async function deleteAssetsAtomically(options: {
  projectDoc: ProjectDocument;
  assets: SourceAsset[];
}) {
  await persistAssetMutationAtomically({
    projectDoc: options.projectDoc,
    deleteAssets: options.assets,
  });
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

export async function clearWorkspaceDataAtomically() {
  const [projects, assets, versions] = await Promise.all([
    db.projects.toArray(),
    db.assets.toArray(),
    db.versions.toArray(),
  ]);

  const blobPaths = [
    ...assets.flatMap((asset) => [
      asset.originalPath,
      asset.normalizedPath,
      asset.previewPath,
    ]),
    ...versions
      .map((version) => version.thumbnailPath)
      .filter((thumbnailPath): thumbnailPath is string => Boolean(thumbnailPath)),
  ];

  await Promise.all(blobPaths.map((blobPath) => deleteBlob(blobPath)));
  await db.transaction("rw", [db.projects, db.assets, db.versions, db.kv, db.blobs], async () => {
    if (projects.length > 0) {
      await db.projects.bulkDelete(projects.map((project) => project.id));
    }
    if (assets.length > 0) {
      await db.assets.bulkDelete(assets.map((asset) => asset.id));
    }
    if (versions.length > 0) {
      await db.versions.bulkDelete(versions.map((version) => version.id));
    }
    await db.kv.delete(ACTIVE_PROJECT_KEY);
    await db.blobs.clear();
  });
}

export async function replaceWorkspaceWithImportedProjectBundle(
  bundle: ImportedProjectBundle,
) {
  await clearWorkspaceDataAtomically();
  return persistImportedProjectBundleAtomically(bundle);
}
