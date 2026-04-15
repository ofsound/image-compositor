import { contextBridge, ipcRenderer } from "electron";

import type { ElectronAppApi } from "./contract.js";

const api: ElectronAppApi = {
  bootstrapWindow: () => ipcRenderer.invoke("workspace:bootstrap-window"),
  listProjects: () => ipcRenderer.invoke("workspace:list-projects"),
  saveProjectDocument: (projectDoc) =>
    ipcRenderer.invoke("workspace:save-project-document", projectDoc),
  saveProjectBundle: (payload) =>
    ipcRenderer.invoke("workspace:save-project-bundle", payload),
  checkoutProject: (options) =>
    ipcRenderer.invoke("workspace:checkout-project", options),
  openProject: (options) =>
    ipcRenderer.invoke("workspace:open-project", options),
  duplicateProject: (options) =>
    ipcRenderer.invoke("workspace:duplicate-project", options),
  focusProjectWindow: (projectId) =>
    ipcRenderer.invoke("workspace:focus-project-window", projectId),
  renameProject: (options) =>
    ipcRenderer.invoke("workspace:rename-project", options),
  trashProject: (projectId) =>
    ipcRenderer.invoke("workspace:trash-project", projectId),
  restoreProject: (projectId) =>
    ipcRenderer.invoke("workspace:restore-project", projectId),
  purgeProject: (projectId) =>
    ipcRenderer.invoke("workspace:purge-project", projectId),
};

contextBridge.exposeInMainWorld("compositorElectron", api);
