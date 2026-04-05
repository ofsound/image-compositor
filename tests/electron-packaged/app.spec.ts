import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";
import fs from "node:fs";
import path from "node:path";

function resolvePackagedExecutablePath() {
  const candidates = [
    path.join(
      process.cwd(),
      "release/mac-arm64/Image Grid.app/Contents/MacOS/Image Grid",
    ),
    path.join(
      process.cwd(),
      "release/mac/Image Grid.app/Contents/MacOS/Image Grid",
    ),
  ];

  const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executablePath) {
    throw new Error("Could not find a packaged Image Grid executable in release/.");
  }

  return executablePath;
}

test("packaged mac app boots with the app protocol", async () => {
  const executablePath = resolvePackagedExecutablePath();
  const app = await electron.launch({ executablePath });
  const page = await app.firstWindow();

  await expect(page.getByRole("button", { name: "Add Source" }).first()).toBeVisible();
  await expect.poll(async () => page.url()).toContain("app://-/");

  await app.close();
});
