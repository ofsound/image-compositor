import { describe, expect, it } from "vitest";

import { hashToSeed, mulberry32 } from "@/lib/rng";

describe("mulberry32", () => {
  it("produces a stable sequence for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);

    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("creates a deterministic integer hash seed", () => {
    expect(hashToSeed("launch-study")).toBe(hashToSeed("launch-study"));
    expect(hashToSeed("launch-study")).not.toBe(hashToSeed("other-study"));
  });
});
