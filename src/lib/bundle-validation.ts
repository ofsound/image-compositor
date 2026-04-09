import type {
  ProjectBundleManifest,
  ProjectDocument,
  ProjectVersion,
  SourceAsset,
} from "@/types/project";

function assertRecord(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function assertString(record: Record<string, unknown>, key: string, label: string) {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label}.${key} must be a non-empty string.`);
  }
}

function assertOptionalString(
  record: Record<string, unknown>,
  key: string,
  label: string,
) {
  const value = record[key];
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new Error(`${label}.${key} must be a string when provided.`);
  }
}

function assertNullableString(
  record: Record<string, unknown>,
  key: string,
  label: string,
) {
  const value = record[key];
  if (value !== null && typeof value !== "string") {
    throw new Error(`${label}.${key} must be a string or null.`);
  }
}

function assertNumber(record: Record<string, unknown>, key: string, label: string) {
  const value = record[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label}.${key} must be a number.`);
  }
}

function assertStringArray(
  record: Record<string, unknown>,
  key: string,
  label: string,
) {
  const value = record[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label}.${key} must be an array of strings.`);
  }
}

export function parseBundleManifest(rawManifest: unknown): ProjectBundleManifest {
  const manifest = assertRecord(rawManifest, "Bundle manifest");
  const version = manifest.version;

  if (version !== 1 && version !== 2 && version !== 3) {
    throw new Error("Bundle manifest.version must be 1, 2, or 3.");
  }

  assertString(manifest, "projectId", "Bundle manifest");
  assertString(manifest, "exportedAt", "Bundle manifest");
  assertStringArray(manifest, "assetIds", "Bundle manifest");
  assertStringArray(manifest, "versionIds", "Bundle manifest");

  return {
    ...manifest,
    version,
    projectId: manifest.projectId as string,
    exportedAt: manifest.exportedAt as string,
    assetIds: [...(manifest.assetIds as string[])],
    versionIds: [...(manifest.versionIds as string[])],
  } as ProjectBundleManifest;
}

export function parseBundleProject(rawProject: unknown): ProjectDocument {
  const project = assertRecord(rawProject, "Bundle project");
  assertString(project, "id", "Bundle project");
  assertString(project, "title", "Bundle project");
  assertNullableString(project, "currentVersionId", "Bundle project");
  assertNullableString(project, "deletedAt", "Bundle project");
  assertString(project, "createdAt", "Bundle project");
  assertString(project, "updatedAt", "Bundle project");
  assertRecord(project.canvas, "Bundle project.canvas");

  return {
    ...project,
  } as unknown as ProjectDocument;
}

export function parseBundleVersions(rawVersions: unknown): ProjectVersion[] {
  if (!Array.isArray(rawVersions)) {
    throw new Error("Bundle versions must be an array.");
  }

  return rawVersions.map((entry, index) => {
    const version = assertRecord(entry, `Bundle version[${index}]`);
    assertString(version, "id", `Bundle version[${index}]`);
    assertString(version, "projectId", `Bundle version[${index}]`);
    assertString(version, "label", `Bundle version[${index}]`);
    assertString(version, "createdAt", `Bundle version[${index}]`);
    assertNullableString(version, "thumbnailPath", `Bundle version[${index}]`);
    assertRecord(version.snapshot, `Bundle version[${index}].snapshot`);
    return {
      ...version,
    } as unknown as ProjectVersion;
  });
}

export function parseBundleAssets(rawAssets: unknown): SourceAsset[] {
  if (!Array.isArray(rawAssets)) {
    throw new Error("Bundle assets must be an array.");
  }

  return rawAssets.map((entry, index) => {
    const asset = assertRecord(entry, `Bundle asset[${index}]`);
    assertString(asset, "id", `Bundle asset[${index}]`);
    assertString(asset, "projectId", `Bundle asset[${index}]`);
    assertString(asset, "name", `Bundle asset[${index}]`);
    assertString(asset, "originalFileName", `Bundle asset[${index}]`);
    assertString(asset, "mimeType", `Bundle asset[${index}]`);
    assertNumber(asset, "width", `Bundle asset[${index}]`);
    assertNumber(asset, "height", `Bundle asset[${index}]`);
    assertNumber(asset, "orientation", `Bundle asset[${index}]`);
    assertString(asset, "originalPath", `Bundle asset[${index}]`);
    assertString(asset, "normalizedPath", `Bundle asset[${index}]`);
    assertString(asset, "previewPath", `Bundle asset[${index}]`);
    assertString(asset, "averageColor", `Bundle asset[${index}]`);
    assertStringArray(asset, "palette", `Bundle asset[${index}]`);
    assertNumber(asset, "luminance", `Bundle asset[${index}]`);
    assertString(asset, "createdAt", `Bundle asset[${index}]`);
    assertOptionalString(asset, "kind", `Bundle asset[${index}]`);
    return {
      ...asset,
    } as unknown as SourceAsset;
  });
}
