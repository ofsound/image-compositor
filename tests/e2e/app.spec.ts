import { expect, test, type Page } from "@playwright/test";

async function importGeneratedImage(page: Page) {
  await page.getByRole("button", { name: "Add Source" }).first().click();
  await expect(page.getByRole("button", { name: "Choose images" })).toBeVisible();
  await page.locator('input[type="file"]').nth(0).evaluate(async (node) => {
    const input = node as HTMLInputElement;
    const canvas = document.createElement("canvas");
    canvas.width = 48;
    canvas.height = 48;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas context.");
    context.fillStyle = "#ea580c";
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
    transfer.items.add(new File([blob], "spec.png", { type: "image/png" }));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
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
