import { describe, expect, it } from "vitest";

import {
  parseBundleAssets,
  parseBundleManifest,
} from "@/lib/bundle-validation";

describe("bundle validation", () => {
  it("rejects unsupported bundle manifest versions", () => {
    expect(() =>
      parseBundleManifest({
        version: 99,
        projectId: "project_1",
        exportedAt: "2026-04-09T00:00:00.000Z",
        assetIds: ["asset_1"],
        versionIds: ["version_1"],
      }),
    ).toThrow("Bundle manifest.version must be 1, 2, or 3.");
  });

  it("rejects bundle assets with invalid numeric metadata", () => {
    expect(() =>
      parseBundleAssets([
        {
          id: "asset_1",
          projectId: "project_1",
          name: "Broken Asset",
          originalFileName: "broken.png",
          mimeType: "image/png",
          width: "1200",
          height: 800,
          orientation: 1,
          originalPath: "assets/original/broken.png",
          normalizedPath: "assets/normalized/broken.png",
          previewPath: "assets/previews/broken.webp",
          averageColor: "#112233",
          palette: ["#112233"],
          luminance: 0.25,
          createdAt: "2026-04-09T00:00:00.000Z",
          kind: "image",
        },
      ]),
    ).toThrow("Bundle asset[0].width must be a number.");
  });
});
