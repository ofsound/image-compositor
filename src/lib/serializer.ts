import JSZip from "jszip";

import { getAssetStoragePaths } from "@/lib/assets";
import { db } from "@/lib/db";
import { readBlob, writeBlob } from "@/lib/opfs";
import { makeId } from "@/lib/id";
import {
  normalizeProjectDocument,
  normalizeProjectVersion,
} from "@/lib/project-defaults";
import type {
  ImportedProjectBundle,
  ProjectBundleManifest,
  ProjectDocument,
  ProjectVersion,
  SourceAsset,
} from "@/types/project";

export async function exportProjectBundle(
  project: ProjectDocument,
  versions: ProjectVersion[],
  assets: SourceAsset[],
) {
  const zip = new JSZip();
  const manifest: ProjectBundleManifest = {
    version: 1,
    projectId: project.id,
    exportedAt: new Date().toISOString(),
    assetIds: assets.map((asset) => asset.id),
    versionIds: versions.map((version) => version.id),
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("project.json", JSON.stringify(project, null, 2));
  zip.file("versions.json", JSON.stringify(versions, null, 2));
  zip.file("assets.json", JSON.stringify(assets, null, 2));

  for (const asset of assets) {
    const [original, normalized, preview] = await Promise.all([
      readBlob(asset.originalPath),
      readBlob(asset.normalizedPath),
      readBlob(asset.previewPath),
    ]);
    if (original) zip.file(asset.originalPath, original);
    if (normalized) zip.file(asset.normalizedPath, normalized);
    if (preview) zip.file(asset.previewPath, preview);
  }

  for (const version of versions) {
    if (!version.thumbnailPath) continue;
    const thumbnail = await readBlob(version.thumbnailPath);
    if (thumbnail) zip.file(version.thumbnailPath, thumbnail);
  }

  return zip.generateAsync({ type: "blob" });
}

export async function loadProjectBundle(bundle: Blob) {
  const zip = await JSZip.loadAsync(bundle);
  const [manifest, project, versions, assets] = await Promise.all([
    zip.file("manifest.json")?.async("string"),
    zip.file("project.json")?.async("string"),
    zip.file("versions.json")?.async("string"),
    zip.file("assets.json")?.async("string"),
  ]);

  if (!manifest || !project || !versions || !assets) {
    throw new Error("Bundle is missing required files.");
  }

  const parsedManifest = JSON.parse(manifest) as ProjectBundleManifest;
  const projectDoc = normalizeProjectDocument(JSON.parse(project) as ProjectDocument);
  const versionDocs = (JSON.parse(versions) as ProjectVersion[]).map((version) =>
    normalizeProjectVersion(version),
  );
  const assetDocs = JSON.parse(assets) as SourceAsset[];
  const assetBlobs: Record<string, Blob> = {};
  const versionBlobs: Record<string, Blob> = {};

  for (const asset of assetDocs) {
    const [original, normalized, preview] = await Promise.all([
      zip.file(asset.originalPath)?.async("blob"),
      zip.file(asset.normalizedPath)?.async("blob"),
      zip.file(asset.previewPath)?.async("blob"),
    ]);

    if (original) assetBlobs[asset.originalPath] = original;
    if (normalized) assetBlobs[asset.normalizedPath] = normalized;
    if (preview) assetBlobs[asset.previewPath] = preview;
  }

  for (const version of versionDocs) {
    if (!version.thumbnailPath) continue;
    const thumbnail = await zip.file(version.thumbnailPath)?.async("blob");
    if (thumbnail) versionBlobs[version.thumbnailPath] = thumbnail;
  }

  return {
    manifest: parsedManifest,
    projectDoc,
    versionDocs,
    assetDocs,
    assetBlobs,
    versionBlobs,
  } satisfies ImportedProjectBundle;
}

export async function persistImportedProjectBundle(bundle: ImportedProjectBundle) {
  const {
    projectDoc,
    versionDocs,
    assetDocs,
    assetBlobs,
    versionBlobs,
  } = bundle;

  await Promise.all([
    ...Object.entries(assetBlobs).map(([path, blob]) => writeBlob(path, blob)),
    ...Object.entries(versionBlobs).map(([path, blob]) => writeBlob(path, blob)),
  ]);

  await Promise.all([
    db.projects.put(projectDoc),
    db.versions.bulkPut(versionDocs),
    db.assets.bulkPut(assetDocs),
    db.kv.put({ key: "activeProjectId", value: projectDoc.id }),
  ]);

  return { projectDoc, versionDocs, assetDocs };
}

export function createImportCopy(bundle: ImportedProjectBundle) {
  const nextProjectId = makeId("project");
  const now = new Date().toISOString();
  const assetIdMap = new Map(bundle.assetDocs.map((asset) => [asset.id, makeId("asset")]));
  const versionIdMap = new Map(bundle.versionDocs.map((version) => [version.id, makeId("version")]));

  const assetDocs = bundle.assetDocs.map((asset) => {
    const nextAssetId = assetIdMap.get(asset.id) ?? asset.id;
    return {
      ...asset,
      id: nextAssetId,
      projectId: nextProjectId,
      ...getAssetStoragePaths(nextAssetId, asset.originalFileName),
      createdAt: now,
    } satisfies SourceAsset;
  });

  const sourceIdMap = new Map(assetDocs.map((asset, index) => [bundle.assetDocs[index]?.id ?? asset.id, asset.id]));
  const versionDocs = bundle.versionDocs.map((version) => {
    const nextVersionId = versionIdMap.get(version.id) ?? version.id;
    return {
      ...version,
      id: nextVersionId,
      projectId: nextProjectId,
      thumbnailPath: version.thumbnailPath ? `versions/${nextVersionId}.webp` : null,
      snapshot: {
        ...structuredClone(version.snapshot),
        sourceIds: version.snapshot.sourceIds.map((sourceId) => sourceIdMap.get(sourceId) ?? sourceId),
      },
    } satisfies ProjectVersion;
  });

  const projectDoc: ProjectDocument = {
    ...bundle.projectDoc,
    id: nextProjectId,
    title: `${bundle.projectDoc.title} Copy`,
    sourceIds: bundle.projectDoc.sourceIds.map((sourceId) => sourceIdMap.get(sourceId) ?? sourceId),
    currentVersionId: bundle.projectDoc.currentVersionId
      ? (versionIdMap.get(bundle.projectDoc.currentVersionId) ?? null)
      : null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const assetBlobs = Object.fromEntries(
    assetDocs.flatMap((asset, index) => {
      const originalAsset = bundle.assetDocs[index];
      if (!originalAsset) return [];
      return [
        [asset.originalPath, bundle.assetBlobs[originalAsset.originalPath]],
        [asset.normalizedPath, bundle.assetBlobs[originalAsset.normalizedPath]],
        [asset.previewPath, bundle.assetBlobs[originalAsset.previewPath]],
      ].filter((entry): entry is [string, Blob] => entry[1] instanceof Blob);
    }),
  );

  const versionBlobs = Object.fromEntries(
    versionDocs.flatMap((version, index) => {
      const originalVersion = bundle.versionDocs[index];
      if (!originalVersion?.thumbnailPath || !version.thumbnailPath) return [];
      const thumbnail = bundle.versionBlobs[originalVersion.thumbnailPath];
      return thumbnail ? [[version.thumbnailPath, thumbnail]] : [];
    }),
  );

  return {
    manifest: {
      ...bundle.manifest,
      projectId: nextProjectId,
      assetIds: assetDocs.map((asset) => asset.id),
      versionIds: versionDocs.map((version) => version.id),
    },
    projectDoc,
    versionDocs,
    assetDocs,
    assetBlobs,
    versionBlobs,
  } satisfies ImportedProjectBundle;
}
