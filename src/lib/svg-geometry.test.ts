import { describe, expect, it } from "vitest";

import {
  sanitizeSvgGeometryMarkup,
  SVG_GEOMETRY_MAX_BYTES,
} from "@/lib/svg-geometry";

describe("sanitizeSvgGeometryMarkup", () => {
  it("accepts normal svg shapes and normalizes viewport metadata", () => {
    const markup = sanitizeSvgGeometryMarkup(
      '<svg viewBox="0 0 24 12"><path d="M0 0h24v12H0z"/></svg>',
    );

    expect(markup).toContain("<svg");
    expect(markup).toContain('viewBox="0 0 24 12"');
    expect(markup).toContain('width="24"');
    expect(markup).toContain('height="12"');
  });

  it("rejects scripts, event handlers, foreignObject, and external references", () => {
    expect(() =>
      sanitizeSvgGeometryMarkup('<svg><script>alert(1)</script></svg>'),
    ).toThrow(/script/i);
    expect(() =>
      sanitizeSvgGeometryMarkup('<svg onclick="alert(1)"><path /></svg>'),
    ).toThrow(/event handlers/i);
    expect(() =>
      sanitizeSvgGeometryMarkup("<svg><foreignObject /></svg>"),
    ).toThrow(/foreignobject/i);
    expect(() =>
      sanitizeSvgGeometryMarkup(
        '<svg><image href="https://example.com/a.png" /></svg>',
      ),
    ).toThrow(/external resources/i);
  });

  it("rejects oversized svg markup", () => {
    const oversized = `<svg>${" ".repeat(SVG_GEOMETRY_MAX_BYTES + 1)}</svg>`;

    expect(() => sanitizeSvgGeometryMarkup(oversized)).toThrow(/256 KB/i);
  });
});
