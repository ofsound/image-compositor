import { app, BrowserWindow, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getAppUrl, registerAppProtocol } from "./protocol.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererDistPath = path.resolve(__dirname, "../dist/client");
const preloadPath = path.resolve(__dirname, "preload.js");
const devServerUrl = process.env.ELECTRON_RENDERER_URL?.trim() || null;

function applyUserDataOverride() {
  const userDataPath = process.env.IMAGE_GRID_USER_DATA_DIR?.trim();

  if (userDataPath) {
    app.setPath("userData", userDataPath);
  }
}

async function createMainWindow() {
  const window = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1080,
    minHeight: 760,
    show: false,
    backgroundColor: "#0e0a06",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
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

applyUserDataOverride();

app.whenReady().then(async () => {
  if (!devServerUrl) {
    await registerAppProtocol(rendererDistPath);
  }

  await createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
