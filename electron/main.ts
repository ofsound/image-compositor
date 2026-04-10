import { app, BrowserWindow, nativeImage, shell } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getAppUrl, registerAppProtocol } from "./protocol.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererDistPath = path.resolve(__dirname, "../dist/client");
const preloadPath = path.resolve(__dirname, "preload.js");
const devServerUrl = process.env.ELECTRON_RENDERER_URL?.trim() || null;
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);
const disableRendererSandbox = process.env.ELECTRON_DISABLE_RENDERER_SANDBOX === "1";
const disableChromiumSandbox = process.env.ELECTRON_DISABLE_CHROMIUM_SANDBOX === "1";

if (disableChromiumSandbox && process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-setuid-sandbox");
}

function shouldEnableRendererSandbox() {
  if (disableRendererSandbox) {
    return false;
  }

  // Unpackaged Linux CI frequently lacks sandbox prerequisites (user namespaces /
  // setuid helper), which can cause Electron to terminate at launch.
  if (process.platform === "linux" && !app.isPackaged) {
    return false;
  }

  return true;
}

function getAppIconPath() {
  const devIconPath = path.resolve(__dirname, "../public/electron-icon.png");
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

async function createMainWindow() {
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
    },
  });

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
  const iconPath = getAppIconPath();
  if (iconPath && process.platform === "darwin") {
    app.dock?.setIcon(nativeImage.createFromPath(iconPath));
  }

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
