import { describe, expect, it } from "vitest";

import {
  getSourceWeight,
  normalizeSourceWeights,
  normalizeSourceWeight,
  setSourceWeight,
} from "@/lib/source-weights";

describe("source weights", () => {
  it("falls back to the default weight for missing values", () => {
    expect(getSourceWeight(undefined, "asset_a")).toBe(1);
    expect(normalizeSourceWeight(undefined)).toBe(1);
  });

  it("clamps stored weights to the supported range", () => {
    expect(normalizeSourceWeight(-2)).toBe(0);
    expect(normalizeSourceWeight(9)).toBe(4);
  });

  it("drops default weights from persisted storage", () => {
    expect(
      normalizeSourceWeights({
        asset_a: 1,
        asset_b: 2.5,
        asset_c: Number.NaN,
      }),
    ).toEqual({
      asset_b: 2.5,
    });
  });

  it("stores non-default weights and removes reset values", () => {
    expect(setSourceWeight({}, "asset_a", 2.25)).toEqual({
      asset_a: 2.25,
    });
    expect(setSourceWeight({ asset_a: 2.25 }, "asset_a", 1)).toEqual({});
  });
});
