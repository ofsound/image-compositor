import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");
const cwd = process.cwd();
const rendererUrl = "http://127.0.0.1:5173";
const electronEntry = path.join(cwd, "dist-electron/electron/main.js");
const children = [];

function spawnChild(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
    ...options,
  });

  children.push(child);
  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
  return child;
}

async function waitForFile(filePath, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await access(filePath);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(`Timed out waiting for ${filePath}.`);
}

async function waitForUrl(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Wait for the server to come up.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

function shutdown(exitCode = 0) {
  while (children.length > 0) {
    const child = children.pop();
    child?.kill("SIGTERM");
  }
  process.exit(exitCode);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}

spawnChild("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "5173", "--strictPort"]);
spawnChild("npm", ["run", "build:electron:main", "--", "--watch", "--preserveWatchOutput"]);

await Promise.all([waitForUrl(rendererUrl), waitForFile(electronEntry)]);

const electronProcess = spawnChild(
  electronBinary,
  [electronEntry],
  {
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: rendererUrl,
    },
  },
);

electronProcess.on("exit", (code) => {
  shutdown(code ?? 0);
});
