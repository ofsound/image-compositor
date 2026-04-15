import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";
import path from "node:path";

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

test("opens a project in a second window and duplicates on same-project collision", async (_fixtures, testInfo) => {
  const userDataDir = path.join(testInfo.outputDir, "user-data");
  const { app, page } = await launchApp(userDataDir);

  await expect(page.getByRole("button", { name: "Add Source" }).first()).toBeVisible();

  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.getByRole("combobox").first()).toContainText("Study 2");

  await page.getByRole("button", { name: "Projects" }).click();
  const manageDialog = page.getByRole("dialog").filter({ hasText: "Manage projects" });
  await expect(manageDialog).toBeVisible();

  const activeProjectRows = manageDialog.getByRole("button", { name: "New Window" });
  await activeProjectRows.nth(1).click();

  await expect.poll(() => app.windows().length).toBe(2);

  await activeProjectRows.nth(1).click();
  const conflictDialog = page.getByRole("dialog").filter({ hasText: "Project already open" });
  await expect(conflictDialog).toBeVisible();
  await conflictDialog.getByRole("button", { name: "Duplicate as Copy" }).click();

  await expect.poll(() => app.windows().length).toBe(3);
  const copyWindow = app.windows().at(-1);
  if (!copyWindow) {
    throw new Error("Expected duplicate project window to exist.");
  }
  await copyWindow.setViewportSize({ width: 1600, height: 1000 });
  await expect(copyWindow.getByRole("combobox").first()).toContainText("Launch Study Copy");
  await app.close();
});
