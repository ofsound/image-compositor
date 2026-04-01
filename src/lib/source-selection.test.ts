import { describe, expect, it } from "vitest";

import { toggleSourceId } from "@/lib/source-selection";

describe("toggleSourceId", () => {
  it("removes an enabled asset from source ids", () => {
    expect(toggleSourceId(["asset_a", "asset_b"], "asset_a")).toEqual([
      "asset_b",
    ]);
  });

  it("appends a disabled asset back into source ids", () => {
    expect(toggleSourceId(["asset_a"], "asset_b")).toEqual([
      "asset_a",
      "asset_b",
    ]);
  });
});
