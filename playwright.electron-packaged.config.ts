import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/electron-packaged",
  use: {
    headless: true,
  },
  timeout: 60_000,
});
