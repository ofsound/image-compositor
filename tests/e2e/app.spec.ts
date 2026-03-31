import { expect, test } from "@playwright/test";

test("boots and imports a source image", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Local generative compositor")).toBeVisible({
    timeout: 15_000,
  });
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

  await expect(page.getByText("spec")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export Image" })).toBeEnabled({
    timeout: 15_000,
  });
});
