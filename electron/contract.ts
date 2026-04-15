import type {
  ProjectDocument,
  ProjectVersion,
  SourceAsset,
} from "../src/types/project.js";

export type ElectronBinaryPayload = ArrayBuffer;

export interface CanonicalProjectPayload {
  projectDoc: ProjectDocument;
  versionDocs: ProjectVersion[];
  assetDocs: SourceAsset[];
  assetBlobs: Record<string, ElectronBinaryPayload>;
  versionBlobs: Record<string, ElectronBinaryPayload>;
}

export interface ProjectSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  locked: boolean;
  lockedByCurrentWindow: boolean;
}

export interface WindowBootstrapData {
  projectSummaries: ProjectSummary[];
  workspace: CanonicalProjectPayload | null;
}

export interface OpenProjectAlreadyOpenResult {
  kind: "already-open";
  projectId: string;
  title: string;
  lockedByCurrentWindow: boolean;
}

export interface OpenProjectOpenedResult {
  kind: "opened";
  target: "current" | "new";
  bootstrap: WindowBootstrapData | null;
}

export type OpenProjectResult =
  | OpenProjectAlreadyOpenResult
  | OpenProjectOpenedResult;

export interface DuplicateProjectResult {
  kind: "duplicated";
  target: "current" | "new";
  projectSummary: ProjectSummary;
  bootstrap: WindowBootstrapData | null;
}

export interface WindowDescriptor {
  windowId: number;
  projectId: string | null;
}

export interface ElectronAppApi {
  bootstrapWindow: () => Promise<WindowBootstrapData>;
  listProjects: () => Promise<ProjectSummary[]>;
  saveProjectDocument: (projectDoc: ProjectDocument) => Promise<ProjectSummary[]>;
  saveProjectBundle: (payload: CanonicalProjectPayload) => Promise<ProjectSummary[]>;
  checkoutProject: (options: {
    payload: CanonicalProjectPayload;
    target: "current" | "new";
  }) => Promise<OpenProjectResult>;
  openProject: (options: {
    projectId: string;
    target: "current" | "new";
  }) => Promise<OpenProjectResult>;
  duplicateProject: (options: {
    projectId: string;
    title?: string;
    target: "current" | "new";
  }) => Promise<DuplicateProjectResult>;
  focusProjectWindow: (projectId: string) => Promise<boolean>;
  renameProject: (options: { projectId: string; title: string }) => Promise<ProjectSummary[]>;
  trashProject: (projectId: string) => Promise<ProjectSummary[]>;
  restoreProject: (projectId: string) => Promise<ProjectSummary[]>;
  purgeProject: (projectId: string) => Promise<ProjectSummary[]>;
}
