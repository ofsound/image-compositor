import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";

const PNG_FIXTURE = fs.readFileSync(
  path.join(process.cwd(), "import", "shape5.png"),
);

async function importGeneratedImage(page: Awaited<ReturnType<typeof launchApp>>["page"]) {
  await page.getByRole("button", { name: "Add Source" }).first().click();
  await expect(page.getByRole("button", { name: "Choose images" })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "electron-spec.png",
    mimeType: "image/png",
    buffer: PNG_FIXTURE,
  });
}

async function launchApp(userDataDir: string) {
  const appEntry = path.join(process.cwd(), "dist-electron/electron/main.js");
  const { CI: _ci, ...childEnv } = process.env;
  const app = await electron.launch({
    args:
      process.platform === "linux"
        ? ["--no-sandbox", "--disable-setuid-sandbox", appEntry]
        : [appEntry],
    env: {
      ...childEnv,
      IMAGE_GRID_USER_DATA_DIR: userDataDir,
      ELECTRON_DISABLE_RENDERER_SANDBOX: "1",
    },
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1600, height: 1000 });
  return { app, page };
}

test("boots, imports an image, and preserves workspace on relaunch", async ({ browserName: _browserName }, testInfo) => {
  const userDataDir = path.join(testInfo.outputDir, "user-data");

  const firstRun = await launchApp(userDataDir);
  await expect(firstRun.page.getByRole("button", { name: "Add Source" }).first()).toBeVisible();
  await importGeneratedImage(firstRun.page);
  await expect(firstRun.page.getByText("electron-spec", { exact: true })).toBeVisible();
  await expect(firstRun.page.getByLabel("Disable electron-spec")).toBeVisible();
  await firstRun.app.close();

  const secondRun = await launchApp(userDataDir);
  await expect(secondRun.page.getByRole("button", { name: "Add Source" }).first()).toBeVisible();
  await expect(secondRun.page.getByText("electron-spec", { exact: true })).toBeVisible();
  await expect(secondRun.page.getByLabel("Disable electron-spec")).toBeVisible();
  await secondRun.app.close();
});
