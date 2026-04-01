import { describe, expect, it } from "vitest";

import { lockExportDimensionsToCanvas } from "@/lib/export-sizing";

describe("lockExportDimensionsToCanvas", () => {
  it("locks export height to the canvas aspect ratio when width changes", () => {
    expect(
      lockExportDimensionsToCanvas(
        { width: 1800, height: 1200 },
        { width: 3840, height: 2400 },
        "width",
      ),
    ).toEqual({ width: 3840, height: 2560 });
  });

  it("locks export width to the canvas aspect ratio when height changes", () => {
    expect(
      lockExportDimensionsToCanvas(
        { width: 1800, height: 1200 },
        { width: 3000, height: 3072 },
        "height",
      ),
    ).toEqual({ width: 4608, height: 3072 });
  });

  it("keeps export dimensions within supported bounds while preserving aspect", () => {
    expect(
      lockExportDimensionsToCanvas(
        { width: 1200, height: 3200 },
        { width: 7680, height: 20480 },
        "width",
      ),
    ).toEqual({ width: 2880, height: 7680 });
  });
});
