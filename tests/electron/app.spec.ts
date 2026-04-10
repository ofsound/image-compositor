import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";
import path from "node:path";

async function importGeneratedImage(page: Awaited<ReturnType<typeof launchApp>>["page"]) {
  await page.getByRole("button", { name: "Add Source" }).first().click();
  await expect(page.getByRole("button", { name: "Choose images" })).toBeVisible();
  await page.locator('input[type="file"]').nth(0).evaluate(async (node) => {
    const input = node as HTMLInputElement;
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas context.");

    context.fillStyle = "#0ea5e9";
    context.fillRect(0, 0, 48, 48);
    context.fillStyle = "#111827";
    context.fillRect(8, 8, 32, 32);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((fileBlob) => {
        if (!fileBlob) {
          reject(new Error("No blob generated."));
          return;
        }
        resolve(fileBlob);
      }, "image/png");
    });

    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "electron-spec.png", { type: "image/png" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function launchApp(userDataDir: string) {
  const app = await electron.launch({
    args: [path.join(process.cwd(), "dist-electron/main.js")],
    env: {
      ...process.env,
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
