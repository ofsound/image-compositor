import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const PNG_FIXTURE = fs.readFileSync(
  path.join(process.cwd(), "import", "shape5.png"),
);

async function importGeneratedImage(page: Page) {
  await page.getByRole("button", { name: "Add Source" }).first().click();
  await expect(page.getByRole("button", { name: "Choose images" })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "spec.png",
    mimeType: "image/png",
    buffer: PNG_FIXTURE,
  });
}

test("boots and imports a source image", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add Source" }).first()).toBeVisible({
    timeout: 15_000,
  });
  await importGeneratedImage(page);

  await expect(page.getByText("spec", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Disable spec")).toBeVisible({
    timeout: 15_000,
  });
});

test("supports multi-layer export and bundle import workflows across reload", async ({ page }, testInfo) => {
  const bundlePath = testInfo.outputPath("workflow.image-compositor.zip");
  const exportPath = testInfo.outputPath("workflow.png");

  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add Source" }).first()).toBeVisible({
    timeout: 15_000,
  });

  await importGeneratedImage(page);
  await expect(page.getByText("spec", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Add Layer", exact: true }).first().click();
  await page.getByRole("button", { name: /Layer 2/ }).first().waitFor({ state: "attached" });
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeEnabled({
    timeout: 15_000,
  });

  const [bundleDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Bundle" }).click(),
  ]);
  await bundleDownload.saveAs(bundlePath);

  const [imageDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export", exact: true }).click(),
  ]);
  await imageDownload.saveAs(exportPath);

  await page.reload();
  await expect(page.getByRole("button", { name: "Add Source" }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("spec", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Layer 2/ }).first().waitFor({ state: "attached" });

  await page.locator('input[accept=".zip"]').setInputFiles(bundlePath);
  await expect(page.getByRole("dialog")).toContainText("Import conflict");
  await page.getByRole("button", { name: "Import as copy" }).click();
  await expect(page.getByRole("combobox").first()).toContainText("Copy");
});
