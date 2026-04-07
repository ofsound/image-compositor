import { describe, expect, it } from "vitest";

import { buildRenderSlices } from "@/lib/generator-registry";
import { createProjectDocument } from "@/lib/project-defaults";
import type { SourceAsset } from "@/types/project";

const assets: SourceAsset[] = [
  {
    id: "asset_a",
    kind: "image",
    projectId: "project_test",
    name: "A",
    originalFileName: "a.jpg",
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    orientation: 1,
    originalPath: "a.jpg",
    normalizedPath: "a.png",
    previewPath: "a.webp",
    averageColor: "#112233",
    palette: ["#112233", "#445566"],
    luminance: 0.2,
    createdAt: "2026-03-30T00:00:00.000Z",
  },
  {
    id: "asset_b",
    kind: "image",
    projectId: "project_test",
    name: "B",
    originalFileName: "b.jpg",
    mimeType: "image/jpeg",
    width: 1000,
    height: 1200,
    orientation: 1,
    originalPath: "b.jpg",
    normalizedPath: "b.png",
    previewPath: "b.webp",
    averageColor: "#ffeedd",
    palette: ["#ffeedd", "#ccbbaa", "#997755"],
    luminance: 0.8,
    createdAt: "2026-03-30T00:00:00.000Z",
  },
];

function projectPoint(x: number, y: number, angleDegrees: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return x * Math.cos(radians) + y * Math.sin(radians);
}

function getInsetProjectionRange(project: ReturnType<typeof createProjectDocument>, angleDegrees: number) {
  const left = project.canvas.inset;
  const right = project.canvas.width - project.canvas.inset;
  const top = project.canvas.inset;
  const bottom = project.canvas.height - project.canvas.inset;
  const projections = [
    projectPoint(left, top, angleDegrees),
    projectPoint(right, top, angleDegrees),
    projectPoint(right, bottom, angleDegrees),
    projectPoint(left, bottom, angleDegrees),
  ];

  return {
    min: Math.min(...projections),
    max: Math.max(...projections),
  };
}

function getStripIntervals(
  project: ReturnType<typeof createProjectDocument>,
  angleDegrees: number,
) {
  const slices = buildRenderSlices(project, [assets[0]!]);
  const intervals = slices
    .map((slice) => {
      const bounds = slice.clipRect ?? slice.rect;
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const center = projectPoint(centerX, centerY, angleDegrees);

      return {
        start: center - bounds.width / 2,
        end: center + bounds.width / 2,
      };
    })
    .sort((a, b) => a.start - b.start);

  return { slices, intervals };
}

function getRectCenterAngle(slice: { rect: { x: number; y: number; width: number; height: number } }, project: ReturnType<typeof createProjectDocument>) {
  const centerX = slice.rect.x + slice.rect.width / 2 - project.canvas.width / 2;
  const centerY = slice.rect.y + slice.rect.height / 2 - project.canvas.height / 2;
  return Math.atan2(centerY, centerX);
}

function normalizeAngleDifference(angle: number) {
  const fullTurn = Math.PI * 2;
  return ((angle + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

describe("buildRenderSlices", () => {
  it("builds deterministic slices for a seeded project", () => {
    const project = createProjectDocument("Determinism");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "blocks";
    project.layout.symmetryMode = "mirror-x";

    const first = buildRenderSlices(project, assets);
    const second = buildRenderSlices(project, assets);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it("increases block slice count as block depth rises", () => {
    const project = createProjectDocument("Block Depth");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "blocks";
    project.layout.symmetryMode = "none";
    project.layout.blockMinSize = 32;

    project.layout.blockDepth = 1;
    const shallow = buildRenderSlices(project, [assets[0]!]);

    project.layout.blockDepth = 4;
    const deep = buildRenderSlices(project, [assets[0]!]);

    expect(deep.length).toBeGreaterThan(shallow.length);
  });

  it("stops block subdivision earlier as the minimum block size increases", () => {
    const project = createProjectDocument("Block Min Size");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "blocks";
    project.layout.symmetryMode = "none";
    project.layout.blockDepth = 5;

    project.layout.blockMinSize = 32;
    const compact = buildRenderSlices(project, [assets[0]!]);

    project.layout.blockMinSize = 400;
    const coarse = buildRenderSlices(project, [assets[0]!]);
    const averageArea = (slices: typeof compact) =>
      slices.reduce((sum, slice) => sum + slice.rect.width * slice.rect.height, 0) /
      slices.length;

    expect(coarse.length).toBeLessThan(compact.length);
    expect(averageArea(coarse)).toBeGreaterThan(averageArea(compact));
  });

  it("centers first-level block splits when split randomness is zero", () => {
    const project = createProjectDocument("Centered Blocks");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "blocks";
    project.layout.symmetryMode = "none";
    project.layout.blockDepth = 1;
    project.layout.blockMinSize = 32;
    project.layout.blockSplitRandomness = 0;
    project.layout.blockSplitBias = 1;
    project.compositing.overlap = 0;

    const slices = buildRenderSlices(project, [assets[0]!]).sort(
      (a, b) => a.rect.x - b.rect.x,
    );

    expect(slices).toHaveLength(2);
    expect(slices[0]?.rect.width).toBeCloseTo(1440, 4);
    expect(slices[1]?.rect.width).toBeCloseTo(1440, 4);
    expect(slices[0]?.rect.height).toBeCloseTo(slices[1]?.rect.height ?? 0, 4);
  });

  it("favors vertical block splits as block split bias rises", () => {
    const project = createProjectDocument("Block Bias");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "blocks";
    project.layout.symmetryMode = "none";
    project.layout.blockDepth = 1;
    project.layout.blockMinSize = 32;
    project.layout.blockSplitRandomness = 0;

    project.layout.blockSplitBias = 0;
    const horizontal = buildRenderSlices(project, [assets[0]!]);

    project.layout.blockSplitBias = 1;
    const vertical = buildRenderSlices(project, [assets[0]!]);

    expect(horizontal.every((slice) => slice.rect.width > slice.rect.height)).toBe(true);
    expect(vertical.every((slice) => slice.rect.width < slice.rect.height)).toBe(true);
  });

  it("keeps all rectangles within a sensible padded canvas range", () => {
    const project = createProjectDocument("Bounds");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.symmetryMode = "none";
    const slices = buildRenderSlices(project, assets);

    for (const slice of slices) {
      expect(slice.rect.width).toBeGreaterThan(0);
      expect(slice.rect.height).toBeGreaterThan(0);
      expect(slice.rect.x).toBeGreaterThan(-400);
      expect(slice.rect.y).toBeGreaterThan(-400);
      expect(slice.rect.x + slice.rect.width).toBeLessThan(project.canvas.width + 400);
      expect(slice.rect.y + slice.rect.height).toBeLessThan(project.canvas.height + 400);
    }
  });

  it("uses radial segment and ring counts to determine the base slice count", () => {
    const project = createProjectDocument("Radial Count");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "radial";
    project.layout.symmetryMode = "none";
    project.layout.radialSegments = 7;
    project.layout.radialRings = 3;

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices).toHaveLength(21);
  });

  it("keeps the canvas center outside every radial slice when inner radius is positive", () => {
    const project = createProjectDocument("Radial Hole");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "radial";
    project.layout.symmetryMode = "none";
    project.layout.radialSegments = 8;
    project.layout.radialRings = 2;
    project.layout.radialInnerRadius = 0.35;
    project.compositing.overlap = 0;

    const slices = buildRenderSlices(project, [assets[0]!]);
    const centerX = project.canvas.width / 2;
    const centerY = project.canvas.height / 2;

    expect(
      slices.every(
        (slice) =>
          !(
            slice.rect.x < centerX &&
            slice.rect.x + slice.rect.width > centerX &&
            slice.rect.y < centerY &&
            slice.rect.y + slice.rect.height > centerY
          ),
      ),
    ).toBe(true);
  });

  it("rotates the radial lattice deterministically with angle offset", () => {
    const project = createProjectDocument("Radial Offset");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "radial";
    project.layout.symmetryMode = "none";
    project.layout.radialSegments = 4;
    project.layout.radialRings = 1;
    project.layout.radialInnerRadius = 0.2;
    project.layout.radialChildRotationMode = "none";
    project.compositing.overlap = 0;

    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.layout.radialAngleOffset = 90;
    const rotated = buildRenderSlices(project, [assets[0]!]);

    const baselineSlice = baseline.find((slice) => slice.id === "slice_0");
    const rotatedSlice = rotated.find((slice) => slice.id === "slice_0");
    const angleDifference = normalizeAngleDifference(
      getRectCenterAngle(rotatedSlice!, project) -
        getRectCenterAngle(baselineSlice!, project),
    );

    expect(angleDifference).toBeCloseTo(Math.PI / 2, 1);
  });

  it("offsets each successive ring by the configured ring phase step", () => {
    const project = createProjectDocument("Radial Ring Phase");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "radial";
    project.layout.symmetryMode = "none";
    project.layout.radialSegments = 6;
    project.layout.radialRings = 2;
    project.layout.radialInnerRadius = 0.15;
    project.layout.radialRingPhaseStep = 30;
    project.layout.radialChildRotationMode = "outward";
    project.effects.rotationJitter = 0;

    const slices = buildRenderSlices(project, [assets[0]!]);
    const innerRingSlice = slices.find((slice) => slice.id === "slice_0");
    const outerRingSlice = slices.find((slice) => slice.id === "slice_6");
    const angleDifference = normalizeAngleDifference(
      outerRingSlice!.rotation - innerRingSlice!.rotation,
    );

    expect(angleDifference).toBeCloseTo((30 * Math.PI) / 180, 1);
  });

  it("increases strip count as density rises while staying deterministic", () => {
    const project = createProjectDocument("Dense Strips");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.symmetryMode = "none";
    project.layout.density = 1;

    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.layout.density = 2;
    const dense = buildRenderSlices(project, [assets[0]!]);
    const denseRepeat = buildRenderSlices(project, [assets[0]!]);

    expect(dense).toEqual(denseRepeat);
    expect(dense.length).toBeGreaterThan(baseline.length);
    expect(dense.every((slice) => slice.rect.width > 0 && slice.rect.height > 0)).toBe(true);
  });

  it("assigns unique distributed crops for a single-image 5x5 grid", () => {
    const project = createProjectDocument("Distributed Grid");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 5;
    project.layout.rows = 5;
    project.layout.symmetryMode = "none";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices).toHaveLength(25);
    expect(new Set(slices.map((slice) => JSON.stringify(slice.sourceCrop))).size).toBe(25);
  });

  it("builds staggered interlock grids with alternating triangle rotation", () => {
    const project = createProjectDocument("Interlock Grid");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.shapeMode = "interlock";
    project.layout.columns = 4;
    project.layout.rows = 3;
    project.layout.gutter = 0;
    project.layout.symmetryMode = "none";
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;

    const slices = buildRenderSlices(project, [assets[0]!]).sort(
      (a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x,
    );
    const rowGroups = Array.from({ length: project.layout.rows }, (_, row) =>
      slices.slice(
        row * project.layout.columns,
        (row + 1) * project.layout.columns,
      ),
    );
    const triangleWidth =
      rowGroups[0]?.[0]?.rect.width ?? 0;
    const triangleStep = triangleWidth / 2;
    const rightInset = project.canvas.width - project.canvas.inset;

    expect(slices).toHaveLength(project.layout.columns * project.layout.rows);
    expect(slices.every((slice) => slice.shape === "interlock")).toBe(true);
    expect(rowGroups[0]?.[1]?.rect.x).toBeCloseTo(
      (rowGroups[0]?.[0]?.rect.x ?? 0) + triangleStep,
      4,
    );
    expect(rowGroups[1]?.[0]?.rect.x).toBeCloseTo(
      (rowGroups[0]?.[0]?.rect.x ?? 0) - triangleStep,
      4,
    );
    expect(rowGroups[0]?.[0]?.clipRotation).toBe(0);
    expect(rowGroups[0]?.[1]?.clipRotation).toBe(Math.PI);
    expect(rowGroups[1]?.[0]?.clipRotation).toBe(Math.PI);
    expect((rowGroups[1]?.[0]?.rect.x ?? 0)).toBeLessThan(project.canvas.inset);
    expect(
      (rowGroups[0]?.at(-1)?.rect.x ?? 0) +
        (rowGroups[0]?.at(-1)?.rect.width ?? 0),
    ).toBeGreaterThan(rightInset);
  });

  it("draws single-image distributed strips against a full-canvas image rect", () => {
    const project = createProjectDocument("Distributed Strips");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 14;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "sequential";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, [assets[0]!]);
    expect(slices).toHaveLength(4);
    expect(slices.every((slice) => slice.sourceCrop === null)).toBe(true);
    expect(
      new Set(slices.map((slice) => JSON.stringify(slice.imageRect))).size,
    ).toBe(1);
    expect(slices[0]?.imageRect).toEqual({
      x: project.canvas.inset,
      y: project.canvas.inset,
      width: project.canvas.width - project.canvas.inset * 2,
      height: project.canvas.height - project.canvas.inset * 2,
    });
  });

  it("supports horizontal strips through the strip angle control", () => {
    const project = createProjectDocument("Horizontal Strips");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.stripAngle = 90;
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 0;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "sequential";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, [assets[0]!]);
    expect(slices).toHaveLength(4);
    expect(slices.every((slice) => slice.clipRotation)).toBe(true);
    expect(slices.every((slice) => slice.sourceCrop === null)).toBe(true);
    expect(slices.every((slice) => slice.imageRect !== null)).toBe(true);
  });

  it("keeps multi-source distributed strips aligned to the full canvas without zoomed crops", () => {
    const project = createProjectDocument("Multi-source Strips");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "strips";
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 14;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "sequential";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, assets);
    expect(slices).toHaveLength(4);
    expect(slices.every((slice) => slice.sourceCrop === null)).toBe(true);
    expect(
      new Set(slices.map((slice) => JSON.stringify(slice.imageRect))).size,
    ).toBe(1);
    expect(new Set(slices.map((slice) => slice.assetId))).toEqual(
      new Set(["asset_a", "asset_b"]),
    );
    expect(slices[0]?.imageRect).toEqual({
      x: project.canvas.inset,
      y: project.canvas.inset,
      width: project.canvas.width - project.canvas.inset * 2,
      height: project.canvas.height - project.canvas.inset * 2,
    });
  });

  it("covers the full inset canvas projection at representative strip angles", () => {
    for (const angle of [0, 21, 55, 90, 135]) {
      const project = createProjectDocument(`Coverage ${angle}`);
      project.sourceIds = [assets[0]!.id];
      project.layout.family = "strips";
      project.layout.stripAngle = angle;
      project.layout.density = 0;
      project.layout.randomness = 0;
      project.layout.gutter = 0;
      project.layout.symmetryMode = "none";
      project.sourceMapping.strategy = "sequential";
      project.sourceMapping.cropDistribution = "distributed";
      project.sourceMapping.preserveAspect = false;

      const { intervals } = getStripIntervals(project, angle);
      const range = getInsetProjectionRange(project, angle);

      expect(intervals[0]?.start).toBeCloseTo(range.min, 4);
      expect(intervals.at(-1)?.end).toBeCloseTo(range.max, 4);
    }
  });

  it("keeps the configured perpendicular gap between adjacent strips at intermediate angles", () => {
    const project = createProjectDocument("Gap Accuracy");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.stripAngle = 55;
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 24;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "sequential";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const { intervals } = getStripIntervals(project, 55);

    for (let index = 1; index < intervals.length; index += 1) {
      expect(intervals[index]!.start - intervals[index - 1]!.end).toBeCloseTo(24, 4);
    }
  });

  it("clamps large strip gutters while preserving edge-to-edge coverage", () => {
    const project = createProjectDocument("Clamped Gap");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.stripAngle = 135;
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 400;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "sequential";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const { intervals } = getStripIntervals(project, 135);
    const range = getInsetProjectionRange(project, 135);

    expect(intervals[0]?.start).toBeCloseTo(range.min, 4);
    expect(intervals.at(-1)?.end).toBeCloseTo(range.max, 4);
    expect(intervals.every((interval) => interval.end - interval.start >= 1)).toBe(true);
  });

  it("expands visible strip thickness when overlap increases even with zero gutter", () => {
    const project = createProjectDocument("Strip Overlap");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.stripAngle = 0;
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 0;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "sequential";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    project.compositing.overlap = 0;
    const baseline = getStripIntervals(project, 0);

    project.compositing.overlap = 1;
    const overlapped = getStripIntervals(project, 0);

    expect(overlapped.slices).toHaveLength(baseline.slices.length);
    expect(overlapped.intervals[0]!.end - overlapped.intervals[0]!.start).toBeGreaterThan(
      baseline.intervals[0]!.end - baseline.intervals[0]!.start,
    );
  });

  it("keeps sequential assignment while distributing unique crops per asset", () => {
    const project = createProjectDocument("Sequential Crops");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 4;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "sequential";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, assets);
    const assetBySliceId = new Map(slices.map((slice) => [slice.id, slice.assetId]));

    expect([
      assetBySliceId.get("slice_0"),
      assetBySliceId.get("slice_1"),
      assetBySliceId.get("slice_2"),
      assetBySliceId.get("slice_3"),
      assetBySliceId.get("slice_4"),
      assetBySliceId.get("slice_5"),
      assetBySliceId.get("slice_6"),
      assetBySliceId.get("slice_7"),
    ]).toEqual([
      "asset_a",
      "asset_b",
      "asset_a",
      "asset_b",
      "asset_a",
      "asset_b",
      "asset_a",
      "asset_b",
    ]);
    for (const assetId of ["asset_a", "asset_b"]) {
      const assetSlices = slices.filter((slice) => slice.assetId === assetId);
      expect(new Set(assetSlices.map((slice) => JSON.stringify(slice.sourceCrop))).size).toBe(
        assetSlices.length,
      );
    }
  });

  it("keeps palette assignment while distributing unique crops per asset", () => {
    const project = createProjectDocument("Palette Crops");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 3;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "palette";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, assets);
    const assetBySliceId = new Map(slices.map((slice) => [slice.id, slice.assetId]));

    expect([
      assetBySliceId.get("slice_0"),
      assetBySliceId.get("slice_1"),
      assetBySliceId.get("slice_2"),
      assetBySliceId.get("slice_3"),
      assetBySliceId.get("slice_4"),
      assetBySliceId.get("slice_5"),
    ]).toEqual(["asset_b", "asset_a", "asset_b", "asset_a", "asset_b", "asset_a"]);
    for (const assetId of ["asset_a", "asset_b"]) {
      const assetSlices = slices.filter((slice) => slice.assetId === assetId);
      expect(new Set(assetSlices.map((slice) => JSON.stringify(slice.sourceCrop))).size).toBe(
        assetSlices.length,
      );
    }
  });

  it("gives symmetry clones distinct crop windows", () => {
    const project = createProjectDocument("Symmetry Crops");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.symmetryMode = "mirror-x";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices.length).toBeGreaterThan(4);
    expect(new Set(slices.map((slice) => JSON.stringify(slice.sourceCrop))).size).toBe(
      slices.length,
    );
  });

  it("hides a percentage of the fully transformed object set", () => {
    const project = createProjectDocument("Hidden Objects");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.symmetryMode = "mirror-x";
    project.layout.hidePercentage = 0.5;
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices).toHaveLength(4);
    expect(new Set(slices.map((slice) => slice.id)).size).toBe(4);
  });

  it("keeps slice geometry unchanged when letterbox is zero", () => {
    const project = createProjectDocument("Letterbox Off");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const baseline = buildRenderSlices(project, [assets[0]!]);
    project.layout.letterbox = 0;
    const letterboxed = buildRenderSlices(project, [assets[0]!]);

    expect(letterboxed).toEqual(baseline);
  });

  it("moves objects inward and scales them down when letterbox is applied", () => {
    const project = createProjectDocument("Letterbox Inward");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";

    const baseline = buildRenderSlices(project, [assets[0]!]);
    project.layout.letterbox = 0.5;
    const letterboxed = buildRenderSlices(project, [assets[0]!]);
    const canvasCenterX = project.canvas.width / 2;
    const canvasCenterY = project.canvas.height / 2;

    expect(letterboxed).toHaveLength(baseline.length);

    for (let index = 0; index < baseline.length; index += 1) {
      const original = baseline[index]!;
      const transformed = letterboxed[index]!;
      const originalCenterX = original.rect.x + original.rect.width / 2;
      const originalCenterY = original.rect.y + original.rect.height / 2;
      const transformedCenterX = transformed.rect.x + transformed.rect.width / 2;
      const transformedCenterY = transformed.rect.y + transformed.rect.height / 2;
      const originalDistance = Math.hypot(
        originalCenterX - canvasCenterX,
        originalCenterY - canvasCenterY,
      );
      const transformedDistance = Math.hypot(
        transformedCenterX - canvasCenterX,
        transformedCenterY - canvasCenterY,
      );

      expect(transformed.rect.width).toBeLessThan(original.rect.width);
      expect(transformed.rect.height).toBeLessThan(original.rect.height);
      expect(transformedDistance).toBeLessThan(originalDistance);
    }
  });

  it("moves strips inward and scales their visible and source geometry when letterbox is applied", () => {
    const project = createProjectDocument("Strip Letterbox");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.stripAngle = 64;
    project.layout.density = 0.78;
    project.layout.randomness = 0;
    project.layout.gutter = 154;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "sequential";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const baseline = buildRenderSlices(project, [assets[0]!]);
    project.layout.letterbox = 0.5;
    const letterboxed = buildRenderSlices(project, [assets[0]!]);
    const canvasCenterX = project.canvas.width / 2;
    const canvasCenterY = project.canvas.height / 2;

    expect(letterboxed).toHaveLength(baseline.length);

    for (let index = 0; index < baseline.length; index += 1) {
      const original = baseline[index]!;
      const transformed = letterboxed[index]!;
      const originalBounds = original.clipRect ?? original.rect;
      const transformedBounds = transformed.clipRect ?? transformed.rect;
      const originalCenterX = originalBounds.x + originalBounds.width / 2;
      const originalCenterY = originalBounds.y + originalBounds.height / 2;
      const transformedCenterX = transformedBounds.x + transformedBounds.width / 2;
      const transformedCenterY = transformedBounds.y + transformedBounds.height / 2;
      const originalDistance = Math.hypot(
        originalCenterX - canvasCenterX,
        originalCenterY - canvasCenterY,
      );
      const transformedDistance = Math.hypot(
        transformedCenterX - canvasCenterX,
        transformedCenterY - canvasCenterY,
      );

      expect(transformedBounds.width).toBeLessThan(originalBounds.width);
      expect(transformedBounds.height).toBeLessThan(originalBounds.height);
      expect(transformedDistance).toBeLessThan(originalDistance);
      expect(transformed.imageRect).not.toBeNull();
      expect(original.imageRect).not.toBeNull();
      expect(transformed.imageRect!.width).toBeLessThan(original.imageRect!.width);
      expect(transformed.imageRect!.height).toBeLessThan(original.imageRect!.height);
    }
  });

  it("keeps nonzero object sizes at full letterbox", () => {
    const project = createProjectDocument("Letterbox Max");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";
    project.layout.letterbox = 1;

    const slices = buildRenderSlices(project, [assets[0]!]);

    for (const slice of slices) {
      expect(slice.rect.width).toBeGreaterThan(0);
      expect(slice.rect.height).toBeGreaterThan(0);
    }
  });

  it("hides objects after letterbox has been applied", () => {
    const project = createProjectDocument("Letterbox Then Hide");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.symmetryMode = "mirror-x";
    project.layout.letterbox = 0.5;
    project.layout.hidePercentage = 0;

    const letterboxedOnly = buildRenderSlices(project, [assets[0]!]);
    project.layout.hidePercentage = 0.5;
    const hidden = buildRenderSlices(project, [assets[0]!]);

    expect(hidden).toHaveLength(Math.round(letterboxedOnly.length * 0.5));
    expect(hidden.every((slice) => letterboxedOnly.some((candidate) => candidate.id === slice.id))).toBe(
      true,
    );
  });

  it("uses wedge angle deterministically for wedge slices", () => {
    const project = createProjectDocument("Wedge Sweep");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.shapeMode = "wedge";
    project.layout.wedgeAngle = 180;
    project.layout.wedgeJitter = 0;

    const first = buildRenderSlices(project, [assets[0]!]);
    const second = buildRenderSlices(project, [assets[0]!]);

    expect(first.map((slice) => slice.wedgeSweepRadians)).toEqual(
      second.map((slice) => slice.wedgeSweepRadians),
    );
    expect(first.every((slice) => slice.wedgeSweepRadians === Math.PI)).toBe(true);
  });

  it("keeps wedge jitter additive and clamped per wedge", () => {
    const project = createProjectDocument("Wedge Jitter");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.shapeMode = "wedge";
    project.layout.wedgeAngle = 300;
    project.layout.wedgeJitter = 120;

    const slices = buildRenderSlices(project, [assets[0]!]);

    for (const slice of slices) {
      expect(slice.wedgeSweepRadians).not.toBeNull();
      expect(slice.wedgeSweepRadians!).toBeGreaterThanOrEqual((300 * Math.PI) / 180);
      expect(slice.wedgeSweepRadians!).toBeLessThanOrEqual(Math.PI * 2);
    }
  });

  it("applies wedge controls only to wedge slices in mixed mode", () => {
    const project = createProjectDocument("Mixed Wedges");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.shapeMode = "mixed";
    project.layout.wedgeAngle = 90;
    project.layout.wedgeJitter = 0;

    const slices = buildRenderSlices(project, [assets[0]!]);

    for (const slice of slices) {
      if (slice.shape === "wedge") {
        expect(slice.wedgeSweepRadians).toBe(Math.PI / 2);
      } else {
        expect(slice.wedgeSweepRadians).toBeNull();
      }
    }
  });

  it("cycles through mixed geometry shapes in radial layouts", () => {
    const project = createProjectDocument("Radial Mixed");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "radial";
    project.layout.symmetryMode = "none";
    project.layout.radialSegments = 4;
    project.layout.radialRings = 2;
    project.layout.shapeMode = "mixed";

    const slices = buildRenderSlices(project, [assets[0]!]);
    const shapes = new Set(slices.map((slice) => slice.shape));

    expect(shapes.size).toBeGreaterThan(1);
    expect(shapes).toEqual(new Set(["rect", "triangle", "ring", "wedge"]));
  });

  it("applies wedge controls only to wedge slices in radial mixed mode", () => {
    const project = createProjectDocument("Radial Mixed Wedges");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "radial";
    project.layout.symmetryMode = "none";
    project.layout.radialSegments = 4;
    project.layout.radialRings = 2;
    project.layout.shapeMode = "mixed";
    project.layout.wedgeAngle = 90;
    project.layout.wedgeJitter = 0;

    const slices = buildRenderSlices(project, [assets[0]!]);

    for (const slice of slices) {
      if (slice.shape === "wedge") {
        expect(slice.wedgeSweepRadians).toBe(Math.PI / 2);
      } else {
        expect(slice.wedgeSweepRadians).toBeNull();
      }
    }
  });

  it("keeps radial wedge layouts wedge-only", () => {
    const project = createProjectDocument("Radial Wedge Only");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "radial";
    project.layout.symmetryMode = "none";
    project.layout.radialSegments = 4;
    project.layout.radialRings = 2;
    project.layout.shapeMode = "wedge";

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices.every((slice) => slice.shape === "wedge")).toBe(true);
  });

  it("keeps a visible sliver at zero wedge angle", () => {
    const project = createProjectDocument("Wedge Sliver");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "wedge";
    project.layout.wedgeAngle = 0;
    project.layout.wedgeJitter = 0;

    const [slice] = buildRenderSlices(project, [assets[0]!]);

    expect(slice?.wedgeSweepRadians).toBeCloseTo((0.5 * Math.PI) / 180);
  });

  it("clamps wedge sweeps to a full circle", () => {
    const project = createProjectDocument("Wedge Full Circle");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.shapeMode = "wedge";
    project.layout.wedgeAngle = 360;
    project.layout.wedgeJitter = 360;

    const [slice] = buildRenderSlices(project, [assets[0]!]);

    expect(slice?.wedgeSweepRadians).toBeCloseTo(Math.PI * 2);
  });

  it("keeps radial child rotation at zero when rotation mode is none", () => {
    const project = createProjectDocument("Radial No Rotation");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "radial";
    project.layout.symmetryMode = "none";
    project.layout.radialSegments = 4;
    project.layout.radialRings = 1;
    project.layout.radialChildRotationMode = "none";
    project.effects.rotationJitter = 0;

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices.every((slice) => slice.rotation === 0)).toBe(true);
  });

  it("uses midpoint-based outward and tangent radial child rotations", () => {
    const project = createProjectDocument("Radial Rotation Modes");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "radial";
    project.layout.symmetryMode = "none";
    project.layout.radialSegments = 4;
    project.layout.radialRings = 1;
    project.effects.rotationJitter = 0;

    project.layout.radialChildRotationMode = "outward";
    const outward = buildRenderSlices(project, [assets[0]!]);

    project.layout.radialChildRotationMode = "tangent";
    const tangent = buildRenderSlices(project, [assets[0]!]);

    expect(outward.find((slice) => slice.id === "slice_0")?.rotation).toBeCloseTo(
      Math.PI / 4,
      6,
    );
    expect(tangent.find((slice) => slice.id === "slice_0")?.rotation).toBeCloseTo(
      Math.PI * 0.75,
      6,
    );
  });

  it("keeps rotation jitter additive on top of the radial base rotation", () => {
    const project = createProjectDocument("Radial Rotation Jitter");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "radial";
    project.layout.symmetryMode = "none";
    project.layout.radialSegments = 5;
    project.layout.radialRings = 2;
    project.layout.radialChildRotationMode = "outward";
    project.effects.rotationJitter = 0;

    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.effects.rotationJitter = 10;
    const jittered = buildRenderSlices(project, [assets[0]!]);

    expect(jittered).toHaveLength(baseline.length);
    expect(
      jittered.some((slice, index) => slice.rotation !== baseline[index]?.rotation),
    ).toBe(true);

    for (let index = 0; index < baseline.length; index += 1) {
      expect(
        Math.abs(jittered[index]!.rotation - baseline[index]!.rotation),
      ).toBeLessThanOrEqual((5 * Math.PI) / 180 + 1e-8);
    }
  });
});
