import Dexie, { type Table } from "dexie";

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
  }
}

export const db = new ImageGridDb();
