import Dexie, { type Table } from "dexie";

import { normalizeSourceAsset } from "@/lib/assets";
import {
  normalizeProjectDocument,
  normalizeProjectVersion,
} from "@/lib/project-defaults";
import type {
  ProjectDocument,
  ProjectVersion,
  SourceAsset,
} from "@/types/project";

export interface KVRecord {
  key: string;
  value: string;
}

export interface BlobRecord {
  path: string;
  blob: Blob;
}

export class ImageGridDb extends Dexie {
  assets!: Table<SourceAsset, string>;
  projects!: Table<ProjectDocument, string>;
  versions!: Table<ProjectVersion, string>;
  kv!: Table<KVRecord, string>;
  blobs!: Table<BlobRecord, string>;

  constructor() {
    super("image-grid-db");
    this.version(1).stores({
      assets: "id, createdAt, name, mimeType",
      projects: "id, updatedAt, title",
      versions: "id, projectId, createdAt",
      kv: "&key",
      blobs: "&path",
    });
    this.version(2)
      .stores({
        assets: "id, projectId, createdAt, name, mimeType",
        projects: "id, updatedAt, deletedAt, title",
        versions: "id, projectId, createdAt",
        kv: "&key",
        blobs: "&path",
      })
      .upgrade(async (tx) => {
        const projectsTable = tx.table<ProjectDocument, string>("projects");
        const assetsTable = tx.table<SourceAsset, string>("assets");
        const projects = await projectsTable.toArray();
        const ownership = new Map<string, string>();

        for (const project of projects) {
          const legacySourceIds = Array.isArray((project as { sourceIds?: string[] }).sourceIds)
            ? ((project as { sourceIds?: string[] }).sourceIds ?? [])
            : [];
          const normalizedProject = {
            ...project,
            deletedAt: project.deletedAt ?? null,
          };
          await projectsTable.put(normalizedProject);

          for (const sourceId of legacySourceIds) {
            if (!ownership.has(sourceId)) {
              ownership.set(sourceId, project.id);
            }
          }
        }

        const assets = await assetsTable.toArray();
        for (const asset of assets) {
          await assetsTable.put({
            ...asset,
            projectId: asset.projectId ?? ownership.get(asset.id) ?? "",
          });
        }
      });
    this.version(3)
      .stores({
        assets: "id, projectId, createdAt, name, mimeType, kind",
        projects: "id, updatedAt, deletedAt, title",
        versions: "id, projectId, createdAt",
        kv: "&key",
        blobs: "&path",
      })
      .upgrade(async (tx) => {
        const assetsTable = tx.table<SourceAsset, string>("assets");
        const assets = await assetsTable.toArray();

        for (const asset of assets) {
          await assetsTable.put(normalizeSourceAsset(asset));
        }
      });
    this.version(4)
      .stores({
        assets: "id, projectId, createdAt, name, mimeType, kind",
        projects: "id, updatedAt, deletedAt, title",
        versions: "id, projectId, createdAt",
        kv: "&key",
        blobs: "&path",
      })
      .upgrade(async (tx) => {
        const projectsTable = tx.table<ProjectDocument, string>("projects");
        const versionsTable = tx.table<ProjectVersion, string>("versions");
        const [projects, versions] = await Promise.all([
          projectsTable.toArray(),
          versionsTable.toArray(),
        ]);

        for (const project of projects) {
          await projectsTable.put(normalizeProjectDocument(project));
        }

        for (const version of versions) {
          await versionsTable.put(normalizeProjectVersion(version));
        }
      });
  }
}

export const db = new ImageGridDb();
