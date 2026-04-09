import JSZip from "jszip";

import {
  parseBundleAssets,
  parseBundleManifest,
  parseBundleProject,
  parseBundleVersions,
} from "@/lib/bundle-validation";
import { getAssetStoragePaths, normalizeSourceAsset } from "@/lib/assets";
import { readBlob } from "@/lib/opfs";
import { makeId } from "@/lib/id";
import {
  normalizeProjectDocument,
  normalizeProjectSnapshot,
  normalizeProjectVersion,
  serializeProjectDocument,
  serializeProjectSnapshot,
  serializeProjectVersion,
  syncLegacyProjectFieldsToSelectedLayer,
} from "@/lib/project-defaults";
import { persistImportedProjectBundleAtomically } from "@/lib/workspace-storage";
import type {
  CompositorLayer,
  ImportedProjectBundle,
  ProjectBundleManifest,
  ProjectDocument,
  ProjectVersion,
  SourceAsset,
} from "@/types/project";

function remapSourceWeights(
  sourceWeights: Record<string, number> | undefined,
  sourceIdMap: Map<string, string>,
) {
  if (!sourceWeights) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(sourceWeights).map(([sourceId, weight]) => [
      sourceIdMap.get(sourceId) ?? sourceId,
      weight,
    ]),
  );
}

export async function exportProjectBundle(
  project: ProjectDocument,
  versions: ProjectVersion[],
  assets: SourceAsset[],
) {
  const zip = new JSZip();
  const manifest: ProjectBundleManifest = {
    version: 3,
    projectId: project.id,
    exportedAt: new Date().toISOString(),
    assetIds: assets.map((asset) => asset.id),
    versionIds: versions.map((version) => version.id),
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("project.json", JSON.stringify(serializeProjectDocument(project), null, 2));
  zip.file(
    "versions.json",
    JSON.stringify(versions.map((version) => serializeProjectVersion(version)), null, 2),
  );
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

  const parsedManifest = parseBundleManifest(JSON.parse(manifest));
  const parsedProject = parseBundleProject(JSON.parse(project));
  const parsedVersions = parseBundleVersions(JSON.parse(versions));
  const projectInput =
    parsedManifest.version === 1
      ? ({
          ...parsedProject,
          layers: undefined,
          selectedLayerId: undefined,
        } as unknown as ProjectDocument)
      : parsedProject;
  const versionInputs =
    parsedManifest.version === 1
      ? parsedVersions.map((version) => ({
          ...version,
          snapshot: {
            ...version.snapshot,
            layers: undefined,
            selectedLayerId: undefined,
          },
        }) as unknown as ProjectVersion)
      : parsedVersions;
  const projectDoc = normalizeProjectDocument(projectInput);
  const versionDocs = versionInputs.map((version) => normalizeProjectVersion(version));
  const assetDocs = parseBundleAssets(JSON.parse(assets)).map((asset) =>
    normalizeSourceAsset(asset),
  );
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
  return persistImportedProjectBundleAtomically(bundle);
}

function remapLayerSourceIds(
  sourceIds: string[],
  sourceIdMap: Map<string, string>,
) {
  return sourceIds.map((sourceId) => sourceIdMap.get(sourceId) ?? sourceId);
}

function remapLayer(
  layer: CompositorLayer,
  sourceIdMap: Map<string, string>,
): CompositorLayer {
  return {
    ...structuredClone(layer),
    sourceIds: remapLayerSourceIds(layer.sourceIds, sourceIdMap),
    sourceMapping: {
      ...structuredClone(layer.sourceMapping),
      sourceWeights: remapSourceWeights(layer.sourceMapping.sourceWeights, sourceIdMap),
    },
  };
}

export function createImportCopy(bundle: ImportedProjectBundle) {
  const nextProjectId = makeId("project");
  const now = new Date().toISOString();
  const sourceProject = normalizeProjectDocument(
    syncLegacyProjectFieldsToSelectedLayer(bundle.projectDoc),
  );
  const sourceProjectDocument = serializeProjectDocument(sourceProject);
  const sourceVersions = bundle.versionDocs.map((version) =>
    normalizeProjectVersion(version),
  );
  const assetIdMap = new Map(bundle.assetDocs.map((asset) => [asset.id, makeId("asset")]));
  const versionIdMap = new Map(sourceVersions.map((version) => [version.id, makeId("version")]));

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
  const versionDocs = sourceVersions.map((version) => {
    const nextVersionId = versionIdMap.get(version.id) ?? version.id;
    const versionSnapshot = serializeProjectSnapshot(version.snapshot);
    return {
      ...version,
      id: nextVersionId,
      projectId: nextProjectId,
      thumbnailPath: version.thumbnailPath ? `versions/${nextVersionId}.webp` : null,
      snapshot: normalizeProjectSnapshot({
        ...versionSnapshot,
        layers: versionSnapshot.layers.map((layer) => remapLayer(layer, sourceIdMap)),
      }),
    } satisfies ProjectVersion;
  });

  const projectDoc: ProjectDocument = normalizeProjectDocument({
    ...sourceProjectDocument,
    id: nextProjectId,
    title: `${sourceProject.title} Copy`,
    layers: sourceProjectDocument.layers.map((layer) => remapLayer(layer, sourceIdMap)),
    currentVersionId: sourceProject.currentVersionId
      ? (versionIdMap.get(sourceProject.currentVersionId) ?? null)
      : null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });

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
