import { app, BrowserWindow, ipcMain, nativeImage, session, shell } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  CanonicalProjectPayload,
  DuplicateProjectResult,
  OpenProjectResult,
  ProjectSummary,
  WindowBootstrapData,
} from "./contract.js";
import { ProjectRepository } from "./project-repository.js";
import { getAppUrl, registerAppProtocol } from "./protocol.js";
import type { ProjectDocument } from "../src/types/project.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererDistPath = path.resolve(__dirname, "../../dist/client");
const preloadPath = path.resolve(__dirname, "preload.js");
const devServerUrl = process.env.ELECTRON_RENDERER_URL?.trim() || null;
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);
const disableRendererSandbox = process.env.ELECTRON_DISABLE_RENDERER_SANDBOX === "1";
const PROJECT_REPOSITORY_DIR = "project-library";

interface WindowState {
  partition: string;
  projectId: string | null;
}

const windowStates = new Map<number, WindowState>();
const projectLocks = new Map<string, number>();
let repository: ProjectRepository;
let lastFocusedWindowId: number | null = null;

function shouldEnableRendererSandbox() {
  if (disableRendererSandbox) {
    return false;
  }

  if (process.platform === "linux" && !app.isPackaged) {
    return false;
  }

  return true;
}

function getAppIconPath() {
  const devIconPath = path.resolve(__dirname, "../../public/electron-icon.png");
  const packagedIconPath = path.resolve(rendererDistPath, "electron-icon.png");

  if (devServerUrl && existsSync(devIconPath)) {
    return devIconPath;
  }

  if (existsSync(packagedIconPath)) {
    return packagedIconPath;
  }

  return null;
}

function applyUserDataOverride() {
  const userDataPath = process.env.IMAGE_GRID_USER_DATA_DIR?.trim();

  if (userDataPath) {
    app.setPath("userData", userDataPath);
  }
}

function getWindowFromSender(webContentsId: number) {
  const webContents = BrowserWindow.getAllWindows()
    .map((candidate) => candidate.webContents)
    .find((candidate) => candidate.id === webContentsId);
  if (!webContents) {
    throw new Error("Could not resolve the active Electron window.");
  }

  const window = BrowserWindow.fromWebContents(webContents);

  if (!window) {
    throw new Error("Could not resolve the active Electron window.");
  }

  return window;
}

function getWindowState(windowId: number) {
  const state = windowStates.get(windowId);
  if (!state) {
    throw new Error(`Missing window state for window ${windowId}.`);
  }
  return state;
}

function getLockOwner(projectId: string) {
  const ownerWindowId = projectLocks.get(projectId);
  if (!ownerWindowId) {
    return null;
  }

  const ownerWindow = BrowserWindow.fromId(ownerWindowId);
  if (!ownerWindow || ownerWindow.isDestroyed()) {
    projectLocks.delete(projectId);
    return null;
  }

  return ownerWindowId;
}

function releaseProjectLock(windowId: number, projectId: string | null) {
  if (!projectId) {
    return;
  }

  if (projectLocks.get(projectId) === windowId) {
    projectLocks.delete(projectId);
  }
}

function assignProjectToWindow(windowId: number, projectId: string) {
  const ownerWindowId = getLockOwner(projectId);
  if (ownerWindowId && ownerWindowId !== windowId) {
    throw new Error("Project is already open in another window.");
  }

  const state = getWindowState(windowId);
  if (state.projectId === projectId) {
    return;
  }

  releaseProjectLock(windowId, state.projectId);
  state.projectId = projectId;
  projectLocks.set(projectId, windowId);
}

async function buildProjectSummaries(windowId: number): Promise<ProjectSummary[]> {
  const projects = await repository.listProjectDocuments();

  return projects.map((project) => {
    const ownerWindowId = getLockOwner(project.id);
    return {
      id: project.id,
      title: project.title,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      deletedAt: project.deletedAt,
      locked: Boolean(ownerWindowId),
      lockedByCurrentWindow: ownerWindowId === windowId,
    };
  });
}

async function buildBootstrap(windowId: number): Promise<WindowBootstrapData> {
  const state = getWindowState(windowId);
  const projectSummaries = await buildProjectSummaries(windowId);
  const workspace = state.projectId
    ? await repository.loadProjectBundle(state.projectId)
    : null;

  return { projectSummaries, workspace };
}

async function getInitialProjectId() {
  const projects = await repository.listProjectDocuments();
  return projects.find((project) => project.deletedAt === null)?.id ?? null;
}

async function createMainWindow(options?: { projectId?: string | null }) {
  const partition = `persist:workspace-${crypto.randomUUID()}`;
  const iconPath = getAppIconPath();
  const window = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1080,
    minHeight: 760,
    show: false,
    backgroundColor: "#0e0a06",
    ...(iconPath && process.platform !== "darwin" ? { icon: iconPath } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: shouldEnableRendererSandbox(),
      partition,
    },
  });

  windowStates.set(window.id, {
    partition,
    projectId: options?.projectId ?? null,
  });

  if (options?.projectId) {
    projectLocks.set(options.projectId, window.id);
  }

  if (!devServerUrl) {
    await registerAppProtocol(
      rendererDistPath,
      session.fromPartition(partition),
    );
  }

  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url);
      if (ALLOWED_EXTERNAL_PROTOCOLS.has(parsedUrl.protocol)) {
        void shell.openExternal(url);
      }
    } catch {
      // Ignore malformed URLs.
    }
    return { action: "deny" };
  });

  window.on("focus", () => {
    lastFocusedWindowId = window.id;
  });

  window.on("closed", () => {
    const state = windowStates.get(window.id);
    if (state) {
      releaseProjectLock(window.id, state.projectId);
      windowStates.delete(window.id);
    }

    if (lastFocusedWindowId === window.id) {
      lastFocusedWindowId = null;
    }
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  if (devServerUrl) {
    await window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return window;
  }

  await window.loadURL(getAppUrl());
  return window;
}

function getActiveWindow() {
  if (lastFocusedWindowId) {
    const focused = BrowserWindow.fromId(lastFocusedWindowId);
    if (focused && !focused.isDestroyed()) {
      return focused;
    }
  }

  return BrowserWindow.getAllWindows()[0] ?? null;
}

function focusWindow(windowId: number) {
  const window = BrowserWindow.fromId(windowId);
  if (!window || window.isDestroyed()) {
    return false;
  }

  if (window.isMinimized()) {
    window.restore();
  }
  window.focus();
  return true;
}

async function handleOpenProject(
  windowId: number,
  options: { projectId: string; target: "current" | "new" },
): Promise<OpenProjectResult> {
  const ownerWindowId = getLockOwner(options.projectId);
  const projectDoc = (await repository.listProjectDocuments()).find(
    (candidate) => candidate.id === options.projectId,
  );
  if (!projectDoc) {
    throw new Error("Project not found.");
  }

  if (ownerWindowId && (ownerWindowId !== windowId || options.target === "new")) {
    return {
      kind: "already-open",
      projectId: options.projectId,
      title: projectDoc.title,
      lockedByCurrentWindow: ownerWindowId === windowId,
    };
  }

  if (options.target === "new") {
    await createMainWindow({ projectId: options.projectId });
    return {
      kind: "opened",
      target: "new",
      bootstrap: null,
    };
  }

  assignProjectToWindow(windowId, options.projectId);
  return {
    kind: "opened",
    target: "current",
    bootstrap: await buildBootstrap(windowId),
  };
}

async function handleCheckoutProject(
  windowId: number,
  options: { payload: CanonicalProjectPayload; target: "current" | "new" },
): Promise<OpenProjectResult> {
  const ownerWindowId = getLockOwner(options.payload.projectDoc.id);
  if (ownerWindowId && ownerWindowId !== windowId) {
    return {
      kind: "already-open",
      projectId: options.payload.projectDoc.id,
      title: options.payload.projectDoc.title,
      lockedByCurrentWindow: false,
    };
  }

  await repository.saveProjectBundle(options.payload);

  if (options.target === "new") {
    await createMainWindow({ projectId: options.payload.projectDoc.id });
    return {
      kind: "opened",
      target: "new",
      bootstrap: null,
    };
  }

  assignProjectToWindow(windowId, options.payload.projectDoc.id);
  return {
    kind: "opened",
    target: "current",
    bootstrap: await buildBootstrap(windowId),
  };
}

async function closeIfOwnedProject(windowId: number, projectId: string) {
  const ownerWindowId = getLockOwner(projectId);
  if (ownerWindowId !== windowId) {
    return;
  }

  const window = BrowserWindow.fromId(windowId);
  if (!window || window.isDestroyed()) {
    return;
  }

  const state = getWindowState(windowId);
  releaseProjectLock(windowId, projectId);
  state.projectId = null;
  setImmediate(() => {
    if (!window.isDestroyed()) {
      window.close();
    }
  });
}

function assertUnlockedOrOwned(windowId: number, projectId: string) {
  const ownerWindowId = getLockOwner(projectId);
  if (ownerWindowId && ownerWindowId !== windowId) {
    throw new Error("Project is open in another window.");
  }
}

async function updateProjectMetadata(
  projectId: string,
  updater: (project: ProjectDocument) => ProjectDocument,
) {
  const updated = await repository.updateProjectDocument(projectId, updater);
  const ownerWindowId = getLockOwner(projectId);
  if (ownerWindowId) {
    const state = getWindowState(ownerWindowId);
    state.projectId = updated.deletedAt ? null : updated.id;
    if (updated.deletedAt) {
      releaseProjectLock(ownerWindowId, projectId);
    }
  }
  return updated;
}

applyUserDataOverride();

if (app.isPackaged) {
  const gotSingleInstanceLock = app.requestSingleInstanceLock();
  if (!gotSingleInstanceLock) {
    app.quit();
  }

  app.on("second-instance", () => {
    const activeWindow = getActiveWindow();
    if (activeWindow) {
      if (activeWindow.isMinimized()) {
        activeWindow.restore();
      }
      activeWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  const iconPath = getAppIconPath();
  if (iconPath && process.platform === "darwin") {
    app.dock?.setIcon(nativeImage.createFromPath(iconPath));
  }

  repository = new ProjectRepository(
    path.join(app.getPath("userData"), PROJECT_REPOSITORY_DIR),
  );

  const initialProjectId = await getInitialProjectId();
  await createMainWindow({ projectId: initialProjectId });

  ipcMain.handle("workspace:bootstrap-window", async (event) => {
    const window = getWindowFromSender(event.sender.id);
    return buildBootstrap(window.id);
  });

  ipcMain.handle("workspace:list-projects", async (event) => {
    const window = getWindowFromSender(event.sender.id);
    return buildProjectSummaries(window.id);
  });

  ipcMain.handle("workspace:save-project-document", async (event, projectDoc: ProjectDocument) => {
    const window = getWindowFromSender(event.sender.id);
    const windowState = getWindowState(window.id);
    if (windowState.projectId && windowState.projectId !== projectDoc.id) {
      assignProjectToWindow(window.id, projectDoc.id);
    }
    await repository.saveProjectDocument(projectDoc);
    return buildProjectSummaries(window.id);
  });

  ipcMain.handle("workspace:save-project-bundle", async (event, payload: CanonicalProjectPayload) => {
    const window = getWindowFromSender(event.sender.id);
    await repository.saveProjectBundle(payload);
    return buildProjectSummaries(window.id);
  });

  ipcMain.handle("workspace:checkout-project", async (event, options) => {
    const window = getWindowFromSender(event.sender.id);
    return handleCheckoutProject(window.id, options);
  });

  ipcMain.handle("workspace:open-project", async (event, options) => {
    const window = getWindowFromSender(event.sender.id);
    return handleOpenProject(window.id, options);
  });

  ipcMain.handle("workspace:duplicate-project", async (event, options): Promise<DuplicateProjectResult> => {
    const window = getWindowFromSender(event.sender.id);
    const payload = await repository.duplicateProject(options.projectId, options.title);
    if (!payload) {
      throw new Error("Project not found.");
    }
    await repository.saveProjectBundle(payload);

    if (options.target === "new") {
      await createMainWindow({ projectId: payload.projectDoc.id });
      return {
        kind: "duplicated",
        target: "new",
        projectSummary: (await buildProjectSummaries(window.id)).find(
          (project) => project.id === payload.projectDoc.id,
        )!,
        bootstrap: null,
      };
    }

    assignProjectToWindow(window.id, payload.projectDoc.id);
    const bootstrap = await buildBootstrap(window.id);
    return {
      kind: "duplicated",
      target: "current",
      projectSummary: bootstrap.projectSummaries.find(
        (project) => project.id === payload.projectDoc.id,
      )!,
      bootstrap,
    };
  });

  ipcMain.handle("workspace:focus-project-window", async (_event, projectId: string) => {
    const ownerWindowId = getLockOwner(projectId);
    return ownerWindowId ? focusWindow(ownerWindowId) : false;
  });

  ipcMain.handle("workspace:rename-project", async (event, options) => {
    const window = getWindowFromSender(event.sender.id);
    assertUnlockedOrOwned(window.id, options.projectId);
    await repository.updateProjectDocument(options.projectId, (project) => ({
      ...project,
      title: options.title.trim() || "Untitled Composition",
      updatedAt: new Date().toISOString(),
    }));
    return buildProjectSummaries(window.id);
  });

  ipcMain.handle("workspace:trash-project", async (event, projectId: string) => {
    const window = getWindowFromSender(event.sender.id);
    assertUnlockedOrOwned(window.id, projectId);
    await updateProjectMetadata(projectId, (project) => ({
      ...project,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    const summaries = await buildProjectSummaries(window.id);
    await closeIfOwnedProject(window.id, projectId);
    return summaries;
  });

  ipcMain.handle("workspace:restore-project", async (event, projectId: string) => {
    const window = getWindowFromSender(event.sender.id);
    assertUnlockedOrOwned(window.id, projectId);
    await updateProjectMetadata(projectId, (project) => ({
      ...project,
      deletedAt: null,
      updatedAt: new Date().toISOString(),
    }));
    return buildProjectSummaries(window.id);
  });

  ipcMain.handle("workspace:purge-project", async (event, projectId: string) => {
    const window = getWindowFromSender(event.sender.id);
    assertUnlockedOrOwned(window.id, projectId);
    await repository.deleteProject(projectId);
    const summaries = await buildProjectSummaries(window.id);
    await closeIfOwnedProject(window.id, projectId);
    return summaries;
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const initialProjectId = await getInitialProjectId();
      void createMainWindow({ projectId: initialProjectId });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
