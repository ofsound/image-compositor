import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  CanonicalProjectPayload,
  ElectronBinaryPayload,
} from "./contract.js";
import type {
  CompositorLayer,
  ProjectDocument,
  ProjectVersion,
  SourceAsset,
} from "../src/types/project.js";

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function getAssetExtension(fileName: string) {
  return fileName.split(".").pop() || "bin";
}

function getAssetStoragePaths(assetId: string, originalFileName: string) {
  const extension = getAssetExtension(originalFileName);
  return {
    originalPath: `assets/original/${assetId}.${extension}`,
    normalizedPath: `assets/normalized/${assetId}.png`,
    previewPath: `assets/previews/${assetId}.webp`,
  };
}

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

function encodeJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readBinary(filePath: string) {
  try {
    const payload = await readFile(filePath);
    return payload.buffer.slice(
      payload.byteOffset,
      payload.byteOffset + payload.byteLength,
    );
  } catch {
    return null;
  }
}

async function ensureDir(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function writeBinary(filePath: string, payload: ElectronBinaryPayload) {
  await ensureDir(filePath);
  await writeFile(filePath, new Uint8Array(payload));
}

export class ProjectRepository {
  constructor(private readonly rootDir: string) {}

  private getProjectDir(projectId: string) {
    return path.join(this.rootDir, projectId);
  }

  private getProjectDocumentPath(projectId: string) {
    return path.join(this.getProjectDir(projectId), "project.json");
  }

  private getVersionsPath(projectId: string) {
    return path.join(this.getProjectDir(projectId), "versions.json");
  }

  private getAssetsPath(projectId: string) {
    return path.join(this.getProjectDir(projectId), "assets.json");
  }

  async listProjectDocuments() {
    await mkdir(this.rootDir, { recursive: true });
    const entries = await readdir(this.rootDir, { withFileTypes: true });
    const projects = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const projectPath = this.getProjectDocumentPath(entry.name);
          try {
            return await readJson<ProjectDocument>(projectPath);
          } catch {
            return null;
          }
        }),
    );

    return projects
      .filter((project): project is ProjectDocument => Boolean(project))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async loadProjectBundle(projectId: string): Promise<CanonicalProjectPayload | null> {
    const projectDir = this.getProjectDir(projectId);
    try {
      await stat(projectDir);
    } catch {
      return null;
    }

    const [projectDoc, versionDocs, assetDocs] = await Promise.all([
      readJson<ProjectDocument>(this.getProjectDocumentPath(projectId)),
      readJson<ProjectVersion[]>(this.getVersionsPath(projectId)).catch(() => []),
      readJson<SourceAsset[]>(this.getAssetsPath(projectId)).catch(() => []),
    ]);

    const assetBlobs = Object.fromEntries(
      (
        await Promise.all(
          assetDocs.flatMap(async (asset) => {
            const paths = [asset.originalPath, asset.normalizedPath, asset.previewPath];
            return Promise.all(
              paths.map(async (relativePath) => {
                const payload = await readBinary(path.join(projectDir, relativePath));
                return payload ? ([relativePath, payload] as const) : null;
              }),
            );
          }),
        )
      )
        .flat()
        .filter((entry): entry is readonly [string, ElectronBinaryPayload] => Boolean(entry)),
    );

    const versionBlobs = Object.fromEntries(
      (
        await Promise.all(
          versionDocs.map(async (version) => {
            if (!version.thumbnailPath) {
              return null;
            }
            const payload = await readBinary(path.join(projectDir, version.thumbnailPath));
            return payload ? ([version.thumbnailPath, payload] as const) : null;
          }),
        )
      ).filter((entry): entry is readonly [string, ElectronBinaryPayload] => Boolean(entry)),
    );

    return {
      projectDoc,
      versionDocs,
      assetDocs,
      assetBlobs,
      versionBlobs,
    };
  }

  async saveProjectDocument(projectDoc: ProjectDocument) {
    const filePath = this.getProjectDocumentPath(projectDoc.id);
    await ensureDir(filePath);
    await writeFile(filePath, encodeJson(projectDoc), "utf8");
  }

  async saveProjectBundle(payload: CanonicalProjectPayload) {
    const projectDir = this.getProjectDir(payload.projectDoc.id);
    await rm(projectDir, { recursive: true, force: true });
    await mkdir(projectDir, { recursive: true });

    await Promise.all([
      writeFile(this.getProjectDocumentPath(payload.projectDoc.id), encodeJson(payload.projectDoc), "utf8"),
      writeFile(this.getVersionsPath(payload.projectDoc.id), encodeJson(payload.versionDocs), "utf8"),
      writeFile(this.getAssetsPath(payload.projectDoc.id), encodeJson(payload.assetDocs), "utf8"),
      ...Object.entries(payload.assetBlobs).map(([relativePath, binary]) =>
        writeBinary(path.join(projectDir, relativePath), binary),
      ),
      ...Object.entries(payload.versionBlobs).map(([relativePath, binary]) =>
        writeBinary(path.join(projectDir, relativePath), binary),
      ),
    ]);
  }

  async deleteProject(projectId: string) {
    await rm(this.getProjectDir(projectId), { recursive: true, force: true });
  }

  async updateProjectDocument(
    projectId: string,
    updater: (projectDoc: ProjectDocument) => ProjectDocument,
  ) {
    const projectDoc = await readJson<ProjectDocument>(this.getProjectDocumentPath(projectId));
    const updated = updater(projectDoc);
    await this.saveProjectDocument(updated);
    return updated;
  }

  async duplicateProject(
    projectId: string,
    title?: string,
  ): Promise<CanonicalProjectPayload | null> {
    const bundle = await this.loadProjectBundle(projectId);
    if (!bundle) {
      return null;
    }

    const nextProjectId = makeId("project");
    const now = new Date().toISOString();
    const assetIdMap = new Map(bundle.assetDocs.map((asset) => [asset.id, makeId("asset")]));
    const versionIdMap = new Map(bundle.versionDocs.map((version) => [version.id, makeId("version")]));

    const assetDocs = bundle.assetDocs.map((asset) => {
      const nextAssetId = assetIdMap.get(asset.id) ?? asset.id;
      return {
        ...structuredClone(asset),
        id: nextAssetId,
        projectId: nextProjectId,
        ...getAssetStoragePaths(nextAssetId, asset.originalFileName),
        createdAt: now,
      } satisfies SourceAsset;
    });

    const sourceIdMap = new Map(
      assetDocs.map((asset, index) => [bundle.assetDocs[index]?.id ?? asset.id, asset.id]),
    );

    const versionDocs = bundle.versionDocs.map((version) => {
      const nextVersionId = versionIdMap.get(version.id) ?? version.id;
      return {
        ...structuredClone(version),
        id: nextVersionId,
        projectId: nextProjectId,
        thumbnailPath: version.thumbnailPath ? `versions/${nextVersionId}.webp` : null,
        snapshot: {
          ...structuredClone(version.snapshot),
          layers: version.snapshot.layers.map((layer: CompositorLayer) =>
            remapLayer(layer, sourceIdMap),
          ),
        },
      } satisfies ProjectVersion;
    });

    const projectDoc: ProjectDocument = {
      ...structuredClone(bundle.projectDoc),
      id: nextProjectId,
      title: title?.trim() || `${bundle.projectDoc.title} Copy`,
      layers: bundle.projectDoc.layers.map((layer: CompositorLayer) =>
        remapLayer(layer, sourceIdMap),
      ),
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
        if (!originalAsset) {
          return [];
        }

        return [
          [asset.originalPath, bundle.assetBlobs[originalAsset.originalPath]],
          [asset.normalizedPath, bundle.assetBlobs[originalAsset.normalizedPath]],
          [asset.previewPath, bundle.assetBlobs[originalAsset.previewPath]],
        ].filter((entry): entry is [string, ElectronBinaryPayload] => entry[1] instanceof ArrayBuffer);
      }),
    );

    const versionBlobs = Object.fromEntries(
      versionDocs.flatMap((version, index) => {
        const originalVersion = bundle.versionDocs[index];
        if (!originalVersion?.thumbnailPath || !version.thumbnailPath) {
          return [];
        }

        const thumbnail = bundle.versionBlobs[originalVersion.thumbnailPath];
        return thumbnail ? [[version.thumbnailPath, thumbnail] as const] : [];
      }),
    );

    return {
      projectDoc,
      versionDocs,
      assetDocs,
      assetBlobs,
      versionBlobs,
    };
  }
}
