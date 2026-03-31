import JSZip from "jszip";

import { db } from "@/lib/db";
import { readBlob, writeBlob } from "@/lib/opfs";
import type {
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

export async function importProjectBundle(bundle: File) {
  const zip = await JSZip.loadAsync(bundle);
  const [project, versions, assets] = await Promise.all([
    zip.file("project.json")?.async("string"),
    zip.file("versions.json")?.async("string"),
    zip.file("assets.json")?.async("string"),
  ]);

  if (!project || !versions || !assets) {
    throw new Error("Bundle is missing required files.");
  }

  const projectDoc = JSON.parse(project) as ProjectDocument;
  const versionDocs = JSON.parse(versions) as ProjectVersion[];
  const assetDocs = JSON.parse(assets) as SourceAsset[];

  for (const asset of assetDocs) {
    const [original, normalized, preview] = await Promise.all([
      zip.file(asset.originalPath)?.async("blob"),
      zip.file(asset.normalizedPath)?.async("blob"),
      zip.file(asset.previewPath)?.async("blob"),
    ]);

    if (original) await writeBlob(asset.originalPath, original);
    if (normalized) await writeBlob(asset.normalizedPath, normalized);
    if (preview) await writeBlob(asset.previewPath, preview);
  }

  for (const version of versionDocs) {
    if (!version.thumbnailPath) continue;
    const thumbnail = await zip.file(version.thumbnailPath)?.async("blob");
    if (thumbnail) await writeBlob(version.thumbnailPath, thumbnail);
  }

  await Promise.all([
    db.projects.put(projectDoc),
    db.versions.bulkPut(versionDocs),
    db.assets.bulkPut(assetDocs),
    db.kv.put({ key: "activeProjectId", value: projectDoc.id }),
  ]);

  return { projectDoc, versionDocs, assetDocs };
}
