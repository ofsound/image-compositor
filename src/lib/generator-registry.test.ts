import { describe, expect, it } from "vitest";

import { buildRenderSlices } from "@/lib/generator-registry";
import { createProjectDocument } from "@/lib/project-defaults";
import { createProjectEditorView } from "@/lib/project-editor-view";
import type { CurveVariant, ImageSourceAsset, SourceAsset } from "@/types/project";

const assets: SourceAsset[] = [
  {
    id: "asset_a",
    kind: "image",
    fitMode: "stretch",
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
    fitMode: "stretch",
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

const paletteBlendAssets: SourceAsset[] = [
  {
    ...assets[0]!,
    id: "asset_palette_mid",
    name: "Palette Mid",
    palette: ["#24446a", "#2b5f88", "#3b78a3", "#4f8fba", "#6aa7d4"],
  },
  {
    ...assets[1]!,
    id: "asset_palette_low",
    name: "Palette Low",
    palette: ["#444444", "#4a4a4a", "#505050", "#565656", "#5c5c5c"],
  },
  {
    ...assets[0]!,
    id: "asset_palette_high",
    name: "Palette High",
    palette: ["#ff0033", "#00d66b", "#0066ff", "#ffd400", "#7a00ff"],
  },
];

const equalPaletteAssets: SourceAsset[] = [
  {
    ...assets[1]!,
    id: "asset_equal_first",
    name: "Equal First",
    palette: ["#112233", "#445566", "#778899"],
  },
  {
    ...assets[0]!,
    id: "asset_equal_second",
    name: "Equal Second",
    palette: ["#778899", "#445566", "#112233"],
  },
  {
    ...assets[0]!,
    id: "asset_equal_third",
    name: "Equal Third",
    palette: ["#445566", "#112233", "#778899"],
  },
];

function projectPoint(x: number, y: number, angleDegrees: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return x * Math.cos(radians) + y * Math.sin(radians);
}

function createProjectView(title: string) {
  return createProjectEditorView(createProjectDocument(title));
}

function getInsetProjectionRange(project: ReturnType<typeof createProjectView>, angleDegrees: number) {
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
  project: ReturnType<typeof createProjectView>,
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

function getSliceHeading(slice: {
  rotation: number;
  clipRotation: number;
}) {
  return normalizeAngleDifference(slice.rotation + slice.clipRotation);
}

function getSliceCenter(slice: {
  rect: { x: number; y: number; width: number; height: number };
}) {
  return {
    x: slice.rect.x + slice.rect.width / 2,
    y: slice.rect.y + slice.rect.height / 2,
  };
}

function countHeadingBuckets(
  slices: Array<{ rotation: number; clipRotation: number }>,
  bucketCount = 18,
) {
  return new Set(
    slices.map((slice) =>
      Math.round(
        ((getSliceHeading(slice) + Math.PI) / (Math.PI * 2)) * bucketCount,
      ),
    ),
  ).size;
}

function getQuadPoints(slice: { quadPoints: { x: number; y: number }[] | null }) {
  expect(slice.quadPoints).not.toBeNull();
  expect(slice.quadPoints).toHaveLength(4);
  return slice.quadPoints as [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ];
}

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function getQuadArea(slice: { quadPoints: { x: number; y: number }[] | null }) {
  const points = getQuadPoints(slice);
  let area = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }

  return Math.abs(area) / 2;
}

function getTopEdgeAngle(slice: { quadPoints: { x: number; y: number }[] | null }) {
  const [topLeft, topRight] = getQuadPoints(slice);
  return Math.atan2(topRight.y - topLeft.y, topRight.x - topLeft.x);
}

function getQuadEdgeSymmetryDelta(
  slice: { quadPoints: { x: number; y: number }[] | null },
) {
  const [topLeft, topRight, bottomRight, bottomLeft] = getQuadPoints(slice);
  const topWidth = getDistance(topLeft, topRight);
  const bottomWidth = getDistance(bottomLeft, bottomRight);
  const leftHeight = getDistance(topLeft, bottomLeft);
  const rightHeight = getDistance(topRight, bottomRight);

  return Math.abs(topWidth - bottomWidth) + Math.abs(leftHeight - rightHeight);
}

describe("buildRenderSlices", () => {
  it("builds deterministic slices for a seeded project", () => {
    const project = createProjectView("Determinism");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "blocks";
    project.layout.gutter = 0;
    project.layout.symmetryMode = "mirror-x";

    const first = buildRenderSlices(project, assets);
    const second = buildRenderSlices(project, assets);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it("uses the configured symmetry center as the mirror pivot", () => {
    const project = createProjectView("Symmetry Center");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.symmetryMode = "mirror-x";

    const centered = buildRenderSlices(project, [assets[0]!]);

    project.layout.symmetryCenterX = 0.25;
    const shifted = buildRenderSlices(project, [assets[0]!]);

    expect(centered.find((slice) => slice.id === "slice_0_mx")?.rect.x).not.toBe(
      shifted.find((slice) => slice.id === "slice_0_mx")?.rect.x,
    );
  });

  it("applies symmetry angle offset to radial clones", () => {
    const project = createProjectView("Symmetry Angle Offset");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.symmetryMode = "radial";
    project.layout.symmetryCopies = 4;

    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.layout.symmetryAngleOffset = 45;
    const offset = buildRenderSlices(project, [assets[0]!]);

    expect(
      offset.find((slice) => slice.id === "slice_0_r1")!.rotation -
        baseline.find((slice) => slice.id === "slice_0_r1")!.rotation,
    ).toBeCloseTo(Math.PI / 4, 6);
  });

  it("adds deterministic clone drift without moving the base slice", () => {
    const project = createProjectView("Symmetry Drift");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.symmetryMode = "mirror-x";

    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.layout.symmetryJitter = 1;
    const drifted = buildRenderSlices(project, [assets[0]!]);
    const driftedAgain = buildRenderSlices(project, [assets[0]!]);

    expect(drifted).toEqual(driftedAgain);
    expect(drifted.find((slice) => slice.id === "slice_0")?.rect).toEqual(
      baseline.find((slice) => slice.id === "slice_0")?.rect,
    );
    expect(drifted.find((slice) => slice.id === "slice_0_mx")?.rect).not.toEqual(
      baseline.find((slice) => slice.id === "slice_0_mx")?.rect,
    );
  });

  it("increases block slice count as block depth rises", () => {
    const project = createProjectView("Block Depth");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "blocks";
    project.layout.gutter = 0;
    project.layout.symmetryMode = "none";
    project.layout.blockMinSize = 32;

    project.layout.blockDepth = 1;
    const shallow = buildRenderSlices(project, [assets[0]!]);

    project.layout.blockDepth = 4;
    const deep = buildRenderSlices(project, [assets[0]!]);

    expect(deep.length).toBeGreaterThan(shallow.length);
  });

  it("stops block subdivision earlier as the minimum block size increases", () => {
    const project = createProjectView("Block Min Size");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "blocks";
    project.layout.gutter = 0;
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
    const project = createProjectView("Centered Blocks");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "blocks";
    project.layout.gutter = 0;
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
    const expectedWidth = (project.canvas.width - project.canvas.inset * 2) / 2 - 12;
    expect(slices[0]?.rect.width).toBeCloseTo(expectedWidth, 4);
    expect(slices[1]?.rect.width).toBeCloseTo(expectedWidth, 4);
    expect(slices[0]?.rect.height).toBeCloseTo(slices[1]?.rect.height ?? 0, 4);
  });

  it("applies layout gutter between block siblings on vertical and horizontal splits", () => {
    const project = createProjectView("Block Gutter XY");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "blocks";
    project.layout.symmetryMode = "none";
    project.layout.blockDepth = 1;
    project.layout.blockMinSize = 32;
    project.layout.blockSplitRandomness = 0;
    project.compositing.overlap = 0;

    project.layout.blockSplitBias = 1;
    project.layout.gutter = 0;
    const verticalNoGutter = buildRenderSlices(project, [assets[0]!]);
    project.layout.gutter = 100;
    const verticalWithGutter = buildRenderSlices(project, [assets[0]!]);
    expect(
      Math.max(...verticalWithGutter.map((slice) => slice.rect.width)),
    ).toBeLessThan(Math.max(...verticalNoGutter.map((slice) => slice.rect.width)));

    project.layout.blockSplitBias = 0;
    project.layout.gutter = 0;
    const horizontalNoGutter = buildRenderSlices(project, [assets[0]!]);
    project.layout.gutter = 100;
    const horizontalWithGutter = buildRenderSlices(project, [assets[0]!]);
    expect(
      Math.max(...horizontalWithGutter.map((slice) => slice.rect.height)),
    ).toBeLessThan(Math.max(...horizontalNoGutter.map((slice) => slice.rect.height)));
  });

  it("favors vertical block splits as block split bias rises", () => {
    const project = createProjectView("Block Bias");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "blocks";
    project.layout.gutter = 0;
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
    const project = createProjectView("Bounds");
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

  it("applies horizontal and vertical grid gutters independently", () => {
    const project = createProjectView("Grid Axis Gutters");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.symmetryMode = "none";
    project.layout.gutterHorizontal = 20;
    project.layout.gutterVertical = 30;
    project.compositing.overlap = 0;

    const [slice] = buildRenderSlices(project, [assets[0]!]);

    expect(slice?.rect.x).toBe(project.canvas.inset + 20);
    expect(slice?.rect.y).toBe(project.canvas.inset + 30);
    expect(slice?.rect.width).toBe(project.canvas.width - project.canvas.inset * 2 - 40);
    expect(slice?.rect.height).toBe(project.canvas.height - project.canvas.inset * 2 - 60);
  });

  it("uses radial segment and ring counts to determine the base slice count", () => {
    const project = createProjectView("Radial Count");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "radial";
    project.layout.symmetryMode = "none";
    project.layout.radialSegments = 7;
    project.layout.radialRings = 3;

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices).toHaveLength(21);
  });

  it("keeps the canvas center outside every radial slice when inner radius is positive", () => {
    const project = createProjectView("Radial Hole");
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
    const project = createProjectView("Radial Offset");
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
    const project = createProjectView("Radial Ring Phase");
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

  it("builds deterministic organic blob slices from the attractor field", () => {
    const project = createProjectView("Organic Determinism");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "organic";
    project.layout.shapeMode = "blob";
    project.layout.symmetryMode = "none";
    project.layout.density = 0.5;
    project.effects.rotationJitter = 0;

    const first = buildRenderSlices(project, [assets[0]!]);
    const second = buildRenderSlices(project, [assets[0]!]);

    expect(first).toEqual(second);
    expect(first.every((slice) => slice.clipPathPoints?.length)).toBe(true);
  });

  it("increases organic slice count as density rises", () => {
    const project = createProjectView("Organic Density");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "organic";
    project.layout.shapeMode = "blob";
    project.layout.symmetryMode = "none";

    project.layout.density = 0.2;
    const sparse = buildRenderSlices(project, [assets[0]!]);

    project.layout.density = 1;
    const dense = buildRenderSlices(project, [assets[0]!]);

    expect(dense.length).toBeGreaterThan(sparse.length);
  });

  it("re-seeds the organic distribution when the variation slider changes", () => {
    const project = createProjectView("Organic Variation");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "organic";
    project.layout.shapeMode = "blob";
    project.layout.symmetryMode = "none";
    project.layout.density = 0.5;

    project.layout.organicVariation = 0;
    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.layout.organicVariation = 137;
    const shifted = buildRenderSlices(project, [assets[0]!]);
    const shiftedRepeat = buildRenderSlices(project, [assets[0]!]);

    expect(shifted).toEqual(shiftedRepeat);
    expect(shifted).not.toEqual(baseline);
  });

  it("keeps organic blob paths inside the inset canvas bounds", () => {
    const project = createProjectView("Organic Bounds");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "organic";
    project.layout.shapeMode = "blob";
    project.layout.symmetryMode = "none";

    const slices = buildRenderSlices(project, [assets[0]!]);
    const left = project.canvas.inset;
    const top = project.canvas.inset;
    const right = project.canvas.width - project.canvas.inset;
    const bottom = project.canvas.height - project.canvas.inset;

    expect(
      slices.every((slice) =>
        slice.clipPathPoints?.every(
          (point) =>
            point.x >= left &&
            point.x <= right &&
            point.y >= top &&
            point.y <= bottom,
        ),
      ),
    ).toBe(true);
  });

  it("builds deterministic 3d slices for a seeded structure", () => {
    const project = createProjectView("3D Determinism");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "3d";
    project.layout.shapeMode = "rect";
    project.layout.threeDStructure = "sphere";
    project.layout.symmetryMode = "none";
    project.effects.rotationJitter = 0;

    const first = buildRenderSlices(project, [assets[0]!]);
    const second = buildRenderSlices(project, [assets[0]!]);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it("changes the 3d arrangement across structure modes", () => {
    const project = createProjectView("3D Structures");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "3d";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.effects.rotationJitter = 0;

    project.layout.threeDStructure = "sphere";
    const sphere = buildRenderSlices(project, [assets[0]!]);

    project.layout.threeDStructure = "torus";
    const torus = buildRenderSlices(project, [assets[0]!]);

    project.layout.threeDStructure = "attractor";
    const attractor = buildRenderSlices(project, [assets[0]!]);

    expect(torus).not.toEqual(sphere);
    expect(attractor).not.toEqual(sphere);
  });

  it("re-seeds the 3d arrangement when distribution changes", () => {
    const project = createProjectView("3D Distribution");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "3d";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";

    project.layout.threeDDistribution = 0;
    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.layout.threeDDistribution = 512;
    const shifted = buildRenderSlices(project, [assets[0]!]);

    expect(shifted).not.toEqual(baseline);
  });

  it("assigns more fog to farther 3d slices", () => {
    const project = createProjectView("3D Fog");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "3d";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";

    const slices = buildRenderSlices(project, [assets[0]!]);
    const fogValues = slices.map((slice) => slice.fogAmount);

    expect(Math.max(...fogValues)).toBeGreaterThan(0);
    expect(Math.min(...fogValues)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...fogValues)).toBeGreaterThan(Math.min(...fogValues));
  });

  it("applies scale jitter to 3d card size in projected quads", () => {
    const project = createProjectView("3D Scale Jitter");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "3d";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.threeDStructure = "sphere";
    project.layout.threeDBillboard = 1;
    project.layout.threeDYaw = 0;
    project.layout.threeDPitch = 0;
    project.layout.threeDZJitter = 0;
    project.effects.rotationJitter = 0;
    project.effects.distortion = 0;
    project.effects.scaleJitter = 0;

    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.effects.scaleJitter = 0.8;
    const jittered = buildRenderSlices(project, [assets[0]!]);
    const repeated = buildRenderSlices(project, [assets[0]!]);

    expect(jittered).toEqual(repeated);
    expect(jittered).toHaveLength(baseline.length);
    expect(
      jittered.some((slice, index) =>
        Math.abs(getQuadArea(slice) - getQuadArea(baseline[index]!)) > 1e-3,
      ),
    ).toBe(true);
  });

  it("applies rotation jitter as in-plane 3d card twist", () => {
    const project = createProjectView("3D Rotation Jitter");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "3d";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.threeDStructure = "sphere";
    project.layout.threeDBillboard = 1;
    project.layout.threeDYaw = 0;
    project.layout.threeDPitch = 0;
    project.layout.threeDZJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.distortion = 0;
    project.effects.rotationJitter = 0;

    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.effects.rotationJitter = 90;
    const jittered = buildRenderSlices(project, [assets[0]!]);
    const repeated = buildRenderSlices(project, [assets[0]!]);

    expect(jittered).toEqual(repeated);
    expect(jittered).toHaveLength(baseline.length);
    expect(
      jittered.some((slice, index) =>
        Math.abs(
          normalizeAngleDifference(
            getTopEdgeAngle(slice) - getTopEdgeAngle(baseline[index]!),
          ),
        ) > 1e-3,
      ),
    ).toBe(true);
  });

  it("applies distortion as perspective skew in 3d quads", () => {
    const project = createProjectView("3D Distortion");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "3d";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.threeDStructure = "sphere";
    project.layout.threeDBillboard = 1;
    project.layout.threeDYaw = 0;
    project.layout.threeDPitch = 0;
    project.layout.threeDZJitter = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.distortion = 0;

    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.effects.distortion = 0.8;
    const distorted = buildRenderSlices(project, [assets[0]!]);
    const repeated = buildRenderSlices(project, [assets[0]!]);

    expect(distorted).toEqual(repeated);
    expect(
      baseline.every((slice) => getQuadEdgeSymmetryDelta(slice) < 1e-6),
    ).toBe(true);
    expect(
      distorted.some((slice) => getQuadEdgeSymmetryDelta(slice) > 1e-3),
    ).toBe(true);
  });

  it("increases strip count as density rises while staying deterministic", () => {
    const project = createProjectView("Dense Strips");
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
    const project = createProjectView("Distributed Grid");
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

  it("uses per-image natural fit for distributed crop aspect", () => {
    const baseAsset = assets[0] as ImageSourceAsset;
    const naturalAsset: ImageSourceAsset = {
      ...baseAsset,
      fitMode: "natural",
    };
    const stretchAsset: ImageSourceAsset = {
      ...baseAsset,
      fitMode: "stretch",
    };
    const project = createProjectView("Distributed Natural Crop");
    project.sourceIds = [naturalAsset.id];
    project.layout.family = "grid";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.symmetryMode = "none";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;
    project.sourceMapping.cropZoom = 1;

    const [naturalSlice] = buildRenderSlices(project, [naturalAsset]);
    const [stretchSlice] = buildRenderSlices(project, [stretchAsset]);

    expect(naturalSlice?.sourceCrop).toEqual({
      x: expect.closeTo(1 / 6, 6),
      y: 0,
      width: expect.closeTo(2 / 3, 6),
      height: 1,
    });
    expect(stretchSlice?.sourceCrop).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });
  });

  it("builds staggered interlock grids with alternating triangle rotation", () => {
    const project = createProjectView("Interlock Grid");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.shapeMode = "interlock";
    project.layout.columns = 4;
    project.layout.rows = 3;
    project.layout.gutter = 0;
    project.layout.gutterHorizontal = 0;
    project.layout.gutterVertical = 0;
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
    const project = createProjectView("Distributed Strips");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 14;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "round-robin";
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
    const project = createProjectView("Horizontal Strips");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.stripAngle = 90;
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 0;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "round-robin";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const slices = buildRenderSlices(project, [assets[0]!]);
    expect(slices).toHaveLength(4);
    expect(slices.every((slice) => slice.clipRotation)).toBe(true);
    expect(slices.every((slice) => slice.sourceCrop === null)).toBe(true);
    expect(slices.every((slice) => slice.imageRect !== null)).toBe(true);
  });

  it("rotates the entire grid around the canvas center through the grid angle control", () => {
    const project = createProjectView("Rotated Grid");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.gutterHorizontal = 0;
    project.layout.gutterVertical = 0;
    project.layout.gridAngle = 45;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "round-robin";

    const baseline = buildRenderSlices(
      {
        ...project,
        layout: {
          ...project.layout,
          gridAngle: 0,
        },
      },
      [assets[0]!],
    );
    const rotated = buildRenderSlices(project, [assets[0]!]);
    const canvasCenter = {
      x: project.canvas.width / 2,
      y: project.canvas.height / 2,
    };
    const angleRadians = Math.PI / 4;

    expect(rotated).toHaveLength(baseline.length);
    expect(rotated.every((slice) => slice.clipRect !== null)).toBe(true);
    expect(rotated.every((slice) => slice.clipRotation)).toBe(true);

    const baselineCenter = getSliceCenter(baseline[0]!);
    const expectedCenter = {
      x:
        canvasCenter.x +
        (baselineCenter.x - canvasCenter.x) * Math.cos(angleRadians) -
        (baselineCenter.y - canvasCenter.y) * Math.sin(angleRadians),
      y:
        canvasCenter.y +
        (baselineCenter.x - canvasCenter.x) * Math.sin(angleRadians) +
        (baselineCenter.y - canvasCenter.y) * Math.cos(angleRadians),
    };
    const rotatedCenter = rotated
      .map((slice) => getSliceCenter(slice))
      .sort(
        (a, b) =>
          Math.hypot(a.x - expectedCenter.x, a.y - expectedCenter.y) -
          Math.hypot(b.x - expectedCenter.x, b.y - expectedCenter.y),
      )[0]!;

    expect(rotatedCenter.x).toBeCloseTo(expectedCenter.x, 3);
    expect(rotatedCenter.y).toBeCloseTo(expectedCenter.y, 3);
    expect(rotated.some((slice) => Math.abs(slice.clipRotation - angleRadians) < 1e-6)).toBe(true);
  });

  it("rotates interlock grids around the canvas center while preserving alternating triangle headings", () => {
    const project = createProjectView("Rotated Interlock Grid");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.shapeMode = "interlock";
    project.layout.columns = 4;
    project.layout.rows = 3;
    project.layout.gutterHorizontal = 0;
    project.layout.gutterVertical = 0;
    project.layout.gridAngle = 30;
    project.layout.symmetryMode = "none";
    project.compositing.overlap = 0;
    project.effects.rotationJitter = 0;
    project.sourceMapping.strategy = "round-robin";

    const baseline = buildRenderSlices(
      {
        ...project,
        layout: {
          ...project.layout,
          gridAngle: 0,
        },
      },
      [assets[0]!],
    );
    const rotated = buildRenderSlices(project, [assets[0]!]);
    const canvasCenter = {
      x: project.canvas.width / 2,
      y: project.canvas.height / 2,
    };
    const angleRadians = Math.PI / 6;
    const baselineCenter = getSliceCenter(baseline[0]!);
    const expectedCenter = {
      x:
        canvasCenter.x +
        (baselineCenter.x - canvasCenter.x) * Math.cos(angleRadians) -
        (baselineCenter.y - canvasCenter.y) * Math.sin(angleRadians),
      y:
        canvasCenter.y +
        (baselineCenter.x - canvasCenter.x) * Math.sin(angleRadians) +
        (baselineCenter.y - canvasCenter.y) * Math.cos(angleRadians),
    };
    const rotatedNearest = rotated
      .slice()
      .sort(
        (a, b) =>
          Math.hypot(
            getSliceCenter(a).x - expectedCenter.x,
            getSliceCenter(a).y - expectedCenter.y,
          ) -
          Math.hypot(
            getSliceCenter(b).x - expectedCenter.x,
            getSliceCenter(b).y - expectedCenter.y,
          ),
      )[0]!;

    expect(rotated).toHaveLength(baseline.length);
    expect(rotated.every((slice) => slice.shape === "interlock")).toBe(true);
    expect(rotated.every((slice) => slice.clipRect !== null)).toBe(true);
    expect(getSliceCenter(rotatedNearest).x).toBeCloseTo(expectedCenter.x, 3);
    expect(getSliceCenter(rotatedNearest).y).toBeCloseTo(expectedCenter.y, 3);
    expect(rotated.some((slice) => Math.abs(slice.clipRotation - angleRadians) < 1e-6)).toBe(true);
    expect(
      rotated.some(
        (slice) => Math.abs(slice.clipRotation - (Math.PI + angleRadians)) < 1e-6,
      ),
    ).toBe(true);
  });

  it("keeps multi-source distributed strips aligned to the full canvas without zoomed crops", () => {
    const project = createProjectView("Multi-source Strips");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "strips";
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 14;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "round-robin";
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
      const project = createProjectView(`Coverage ${angle}`);
      project.sourceIds = [assets[0]!.id];
      project.layout.family = "strips";
      project.layout.stripAngle = angle;
      project.layout.density = 0;
      project.layout.randomness = 0;
      project.layout.gutter = 0;
      project.layout.symmetryMode = "none";
      project.sourceMapping.strategy = "round-robin";
      project.sourceMapping.cropDistribution = "distributed";
      project.sourceMapping.preserveAspect = false;

      const { intervals } = getStripIntervals(project, angle);
      const range = getInsetProjectionRange(project, angle);

      expect(intervals[0]?.start).toBeCloseTo(range.min, 4);
      expect(intervals.at(-1)?.end).toBeCloseTo(range.max, 4);
    }
  });

  it("keeps the configured perpendicular gap between adjacent strips at intermediate angles", () => {
    const project = createProjectView("Gap Accuracy");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.stripAngle = 55;
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 24;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "round-robin";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const { intervals } = getStripIntervals(project, 55);

    for (let index = 1; index < intervals.length; index += 1) {
      expect(intervals[index]!.start - intervals[index - 1]!.end).toBeCloseTo(24, 4);
    }
  });

  it("clamps large strip gutters while preserving edge-to-edge coverage", () => {
    const project = createProjectView("Clamped Gap");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.stripAngle = 135;
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 400;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "round-robin";
    project.sourceMapping.cropDistribution = "distributed";
    project.sourceMapping.preserveAspect = false;

    const { intervals } = getStripIntervals(project, 135);
    const range = getInsetProjectionRange(project, 135);

    expect(intervals[0]?.start).toBeCloseTo(range.min, 4);
    expect(intervals.at(-1)?.end).toBeCloseTo(range.max, 4);
    expect(intervals.every((interval) => interval.end - interval.start >= 1)).toBe(true);
  });

  it("expands visible strip thickness when overlap increases even with zero gutter", () => {
    const project = createProjectView("Strip Overlap");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.stripAngle = 0;
    project.layout.density = 0;
    project.layout.randomness = 0;
    project.layout.gutter = 0;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "round-robin";
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

  it("keeps round-robin assignment while distributing unique crops per asset", () => {
    const project = createProjectView("Round Robin Crops");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 4;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "round-robin";
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

  it("biases round-robin assignment toward higher manual source weights", () => {
    const project = createProjectView("Round Robin Source Mix");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 4;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "round-robin";
    project.sourceMapping.sourceWeights = {
      asset_a: 3,
      asset_b: 1,
    };

    const slices = buildRenderSlices(project, assets);
    const countByAssetId = Object.fromEntries(
      [...new Set(slices.map((slice) => slice.assetId))].map((assetId) => [
        assetId,
        slices.filter((slice) => slice.assetId === assetId).length,
      ]),
    );

    expect(countByAssetId).toEqual({
      asset_a: 6,
      asset_b: 2,
    });
  });

  it("changes tone-map assignment when the luminance direction flips", () => {
    const toneAssets: SourceAsset[] = [
      {
        ...assets[0]!,
        id: "asset_dark",
        name: "Dark",
        luminance: 0.1,
      },
      {
        ...assets[0]!,
        id: "asset_mid",
        name: "Mid",
        luminance: 0.5,
      },
      {
        ...assets[1]!,
        id: "asset_light",
        name: "Light",
        luminance: 0.9,
      },
    ];
    const project = createProjectView("Tone Map");
    project.sourceIds = toneAssets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 3;
    project.layout.rows = 1;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "tone-map";

    project.sourceMapping.luminanceSort = "ascending";
    const ascendingSlices = buildRenderSlices(project, toneAssets);
    const ascending = new Map(
      ascendingSlices.map((slice) => [slice.id, slice.assetId]),
    );

    project.sourceMapping.luminanceSort = "descending";
    const descendingSlices = buildRenderSlices(project, toneAssets);
    const descending = new Map(
      descendingSlices.map((slice) => [slice.id, slice.assetId]),
    );

    expect([
      ascending.get("slice_0"),
      ascending.get("slice_1"),
      ascending.get("slice_2"),
    ]).toEqual(["asset_dark", "asset_mid", "asset_light"]);
    expect([
      descending.get("slice_0"),
      descending.get("slice_1"),
      descending.get("slice_2"),
    ]).toEqual(["asset_light", "asset_mid", "asset_dark"]);
  });

  it("keeps contrast assignment while distributing unique crops per asset", () => {
    const project = createProjectView("Contrast Crops");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 3;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "contrast";
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

  it("lets manual source weights mute random assignment without disabling the source", () => {
    const project = createProjectView("Random Source Mix");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 4;
    project.layout.rows = 2;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "random";
    project.sourceMapping.sourceWeights = {
      asset_a: 4,
      asset_b: 0,
    };

    const slices = buildRenderSlices(project, assets);

    expect(slices.every((slice) => slice.assetId === "asset_a")).toBe(true);
  });

  it("reduces immediate local duplicates under anti-repeat compared with random", () => {
    const countAdjacentDuplicates = (sliceIds: string[], columns: number) => {
      let duplicates = 0;
      for (let index = 0; index < sliceIds.length; index += 1) {
        const assetId = sliceIds[index]!;
        if (index % columns !== 0 && sliceIds[index - 1] === assetId) {
          duplicates += 1;
        }
        if (index >= columns && sliceIds[index - columns] === assetId) {
          duplicates += 1;
        }
      }
      return duplicates;
    };

    const project = createProjectView("Anti Repeat");
    project.sourceIds = assets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 4;
    project.layout.rows = 4;
    project.layout.symmetryMode = "none";
    project.activeSeed = 412_991;

    project.sourceMapping.strategy = "random";
    const randomAssignments = new Map(
      buildRenderSlices(project, assets).map((slice) => [slice.id, slice.assetId]),
    );

    project.sourceMapping.strategy = "anti-repeat";
    const antiRepeatAssignments = new Map(
      buildRenderSlices(project, assets).map((slice) => [slice.id, slice.assetId]),
    );

    expect(
      countAdjacentDuplicates(
        Array.from({ length: 16 }, (_, index) => randomAssignments.get(`slice_${index}`) ?? ""),
        4,
      ),
    ).toBeGreaterThan(
      countAdjacentDuplicates(
        Array.from(
          { length: 16 },
          (_, index) => antiRepeatAssignments.get(`slice_${index}`) ?? "",
        ),
        4,
      ),
    );
  });

  it("preserves source order when contrast strength is zero", () => {
    const project = createProjectView("Contrast Strength Source Order");
    project.sourceIds = paletteBlendAssets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 3;
    project.layout.rows = 1;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "contrast";
    project.sourceMapping.paletteEmphasis = 0;

    const slices = buildRenderSlices(project, paletteBlendAssets);
    const assetBySliceId = new Map(slices.map((slice) => [slice.id, slice.assetId]));

    expect([
      assetBySliceId.get("slice_0"),
      assetBySliceId.get("slice_1"),
      assetBySliceId.get("slice_2"),
    ]).toEqual(["asset_palette_mid", "asset_palette_low", "asset_palette_high"]);
  });

  it("fully reorders by contrast when contrast strength is one", () => {
    const project = createProjectView("Contrast Strength Order");
    project.sourceIds = paletteBlendAssets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 3;
    project.layout.rows = 1;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "contrast";
    project.sourceMapping.paletteEmphasis = 1;

    const slices = buildRenderSlices(project, paletteBlendAssets);
    const assetBySliceId = new Map(slices.map((slice) => [slice.id, slice.assetId]));

    expect([
      assetBySliceId.get("slice_0"),
      assetBySliceId.get("slice_1"),
      assetBySliceId.get("slice_2"),
    ]).toEqual(["asset_palette_high", "asset_palette_mid", "asset_palette_low"]);
  });

  it("interpolates contrast order between the source and contrast-ranked endpoints", () => {
    const project = createProjectView("Contrast Strength Intermediate");
    project.sourceIds = paletteBlendAssets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 3;
    project.layout.rows = 1;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "contrast";
    project.sourceMapping.paletteEmphasis = 0.5;

    const slices = buildRenderSlices(project, paletteBlendAssets);
    const assetBySliceId = new Map(slices.map((slice) => [slice.id, slice.assetId]));

    expect([
      assetBySliceId.get("slice_0"),
      assetBySliceId.get("slice_1"),
      assetBySliceId.get("slice_2"),
    ]).toEqual(["asset_palette_mid", "asset_palette_high", "asset_palette_low"]);
  });

  it("keeps equal contrast scores in source order", () => {
    const project = createProjectView("Contrast Strength Stable Ties");
    project.sourceIds = equalPaletteAssets.map((asset) => asset.id);
    project.layout.family = "grid";
    project.layout.columns = 3;
    project.layout.rows = 1;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "contrast";
    project.sourceMapping.paletteEmphasis = 1;

    const slices = buildRenderSlices(project, equalPaletteAssets);
    const assetBySliceId = new Map(slices.map((slice) => [slice.id, slice.assetId]));

    expect([
      assetBySliceId.get("slice_0"),
      assetBySliceId.get("slice_1"),
      assetBySliceId.get("slice_2"),
    ]).toEqual(["asset_equal_first", "asset_equal_second", "asset_equal_third"]);
  });

  it("gives symmetry clones distinct crop windows", () => {
    const project = createProjectView("Symmetry Crops");
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
    const project = createProjectView("Hidden Objects");
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
    const project = createProjectView("Letterbox Off");
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
    const project = createProjectView("Letterbox Inward");
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
    const project = createProjectView("Strip Letterbox");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "strips";
    project.layout.stripAngle = 64;
    project.layout.density = 0.78;
    project.layout.randomness = 0;
    project.layout.gutter = 154;
    project.layout.symmetryMode = "none";
    project.sourceMapping.strategy = "round-robin";
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
    const project = createProjectView("Letterbox Max");
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
    const project = createProjectView("Letterbox Then Hide");
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
    const project = createProjectView("Wedge Sweep");
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
    const project = createProjectView("Wedge Jitter");
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
    const project = createProjectView("Mixed Wedges");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.columns = 2;
    project.layout.rows = 2;
    project.layout.shapeMode = "mixed";
    project.layout.wedgeAngle = 90;
    project.layout.wedgeJitter = 0;

    const slices = buildRenderSlices(project, [assets[0]!]);

    for (const slice of slices) {
      if (slice.shape === "wedge" || slice.shape === "arc") {
        expect(slice.wedgeSweepRadians).toBe(Math.PI / 2);
      } else {
        expect(slice.wedgeSweepRadians).toBeNull();
      }
    }
  });

  it("cycles through mixed geometry shapes in radial layouts", () => {
    const project = createProjectView("Radial Mixed");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "radial";
    project.layout.symmetryMode = "none";
    project.layout.radialSegments = 4;
    project.layout.radialRings = 2;
    project.layout.shapeMode = "mixed";

    const slices = buildRenderSlices(project, [assets[0]!]);
    const shapes = new Set(slices.map((slice) => slice.shape));

    expect(shapes.size).toBeGreaterThan(1);
    expect(shapes).toEqual(new Set(["rect", "triangle", "ring", "arc", "wedge"]));
  });

  it("applies wedge controls only to wedge slices in radial mixed mode", () => {
    const project = createProjectView("Radial Mixed Wedges");
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
      if (slice.shape === "wedge" || slice.shape === "arc") {
        expect(slice.wedgeSweepRadians).toBe(Math.PI / 2);
      } else {
        expect(slice.wedgeSweepRadians).toBeNull();
      }
    }
  });

  it("keeps radial wedge layouts wedge-only", () => {
    const project = createProjectView("Radial Wedge Only");
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
    const project = createProjectView("Wedge Sliver");
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
    const project = createProjectView("Wedge Full Circle");
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
    const project = createProjectView("Radial No Rotation");
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
    const project = createProjectView("Radial Rotation Modes");
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
    const project = createProjectView("Radial Rotation Jitter");
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

  it("adds deterministic algorithmic rotation and scale variation to grid elements", () => {
    const project = createProjectView("Algorithmic Grid Modulation");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.columns = 2;
    project.layout.rows = 1;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.elementModulations.rotation = {
      ...project.effects.elementModulations.rotation,
      enabled: true,
      pattern: "linear",
      amount: 90,
    };
    project.effects.elementModulations.scale = {
      ...project.effects.elementModulations.scale,
      enabled: true,
      pattern: "linear",
      amount: 0.5,
    };

    const first = buildRenderSlices(project, [assets[0]!]);
    const second = buildRenderSlices(project, [assets[0]!]);
    const firstByX = [...first].sort((a, b) => a.rect.x - b.rect.x);

    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(firstByX[0]!.rotation).toBeCloseTo((-45 * Math.PI) / 180, 6);
    expect(firstByX[1]!.rotation).toBeCloseTo((45 * Math.PI) / 180, 6);
    expect(firstByX[0]!.scale).toBeCloseTo(0.75, 6);
    expect(firstByX[1]!.scale).toBeCloseTo(1.25, 6);
  });

  it("keeps all preset modulation patterns deterministic", () => {
    const patterns = [
      "sine",
      "triangle",
      "saw",
      "checker",
      "linear",
      "rings",
      "spiral",
    ] as const;

    for (const pattern of patterns) {
      const project = createProjectView(`Pattern ${pattern}`);
      project.sourceIds = [assets[0]!.id];
      project.layout.family = "grid";
      project.layout.shapeMode = "rect";
      project.layout.symmetryMode = "none";
      project.layout.columns = 3;
      project.layout.rows = 3;
      project.effects.rotationJitter = 0;
      project.effects.elementModulations.rotation = {
        ...project.effects.elementModulations.rotation,
        enabled: true,
        pattern,
        amount: 30,
        frequency: 2,
      };

      const first = buildRenderSlices(project, [assets[0]!]);
      const second = buildRenderSlices(project, [assets[0]!]);

      expect(first).toEqual(second);
      expect(first.some((slice) => Math.abs(slice.rotation) > 0.0001)).toBe(true);
    }
  });

  it("clamps algorithmic opacity and wedge sweep modulation", () => {
    const project = createProjectView("Algorithmic Clamp");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.shapeMode = "wedge";
    project.layout.symmetryMode = "none";
    project.layout.columns = 2;
    project.layout.rows = 1;
    project.layout.wedgeAngle = 10;
    project.layout.wedgeJitter = 0;
    project.effects.elementModulations.opacity = {
      ...project.effects.elementModulations.opacity,
      enabled: true,
      pattern: "linear",
      amount: 200,
    };
    project.effects.elementModulations.wedgeSweep = {
      ...project.effects.elementModulations.wedgeSweep,
      enabled: true,
      pattern: "linear",
      amount: 400,
    };

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices.every((slice) => slice.opacity >= 0 && slice.opacity <= 1)).toBe(true);
    expect(slices.some((slice) => slice.opacity < 1)).toBe(true);
    expect(
      slices.every((slice) =>
        slice.wedgeSweepRadians !== null &&
        slice.wedgeSweepRadians >= (0.5 * Math.PI) / 180 &&
        slice.wedgeSweepRadians <= Math.PI * 2,
      ),
    ).toBe(true);
  });

  it("modulates 3d depth and card twist deterministically", () => {
    const project = createProjectView("Algorithmic 3D");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "3d";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.threeDZJitter = 0;
    project.effects.rotationJitter = 0;
    project.effects.scaleJitter = 0;
    project.effects.distortion = 0;
    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.effects.elementModulations.threeDZ = {
      ...project.effects.elementModulations.threeDZ,
      enabled: true,
      pattern: "depth",
      amount: 0.25,
    };
    project.effects.elementModulations.threeDTwist = {
      ...project.effects.elementModulations.threeDTwist,
      enabled: true,
      pattern: "linear",
      amount: 90,
    };
    const modulated = buildRenderSlices(project, [assets[0]!]);
    const repeated = buildRenderSlices(project, [assets[0]!]);

    expect(modulated).toEqual(repeated);
    expect(modulated).toHaveLength(baseline.length);
    expect(
      modulated.some((slice, index) => {
        const baselineSlice = baseline[index]!;
        return (
          slice.rect.x !== baselineSlice.rect.x ||
          slice.rect.y !== baselineSlice.rect.y ||
          JSON.stringify(slice.quadPoints) !== JSON.stringify(baselineSlice.quadPoints)
        );
      }),
    ).toBe(true);
  });

  it("applies symmetry drift modulation only to symmetry clones", () => {
    const project = createProjectView("Algorithmic Symmetry");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.shapeMode = "rect";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.layout.symmetryMode = "none";
    project.layout.symmetryJitter = 0;
    project.effects.elementModulations.symmetryDrift = {
      ...project.effects.elementModulations.symmetryDrift,
      enabled: true,
      pattern: "checker",
      amount: 0.5,
    };

    const noSymmetry = buildRenderSlices(project, [assets[0]!]);
    project.effects.elementModulations.symmetryDrift.enabled = false;
    const noSymmetryBaseline = buildRenderSlices(project, [assets[0]!]);
    expect(noSymmetry).toEqual(noSymmetryBaseline);

    project.layout.symmetryMode = "mirror-x";
    project.effects.elementModulations.symmetryDrift.enabled = false;
    const baseline = buildRenderSlices(project, [assets[0]!]);
    project.effects.elementModulations.symmetryDrift.enabled = true;
    const modulated = buildRenderSlices(project, [assets[0]!]);

    expect(modulated).toHaveLength(baseline.length);
    expect(modulated[0]).toEqual(baseline[0]);
    expect(modulated.slice(1)).not.toEqual(baseline.slice(1));
  });

  it("keeps non-3d rotation, scale, and distortion on the 2d transform path", () => {
    const project = createProjectView("2D Effect Regression");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "grid";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.columns = 1;
    project.layout.rows = 1;
    project.effects.rotationJitter = 18;
    project.effects.scaleJitter = 0.8;
    project.effects.distortion = 0.8;

    const [slice] = buildRenderSlices(project, [assets[0]!]);

    expect(slice).toBeDefined();
    expect(Math.abs(slice!.rotation)).toBeGreaterThan(0);
    expect(slice!.scale).not.toBe(1);
    expect(slice!.distortion).toBeGreaterThan(0);
    expect(slice!.quadPoints).toBeNull();
  });

  it("builds deterministic flow slices for a seeded project", () => {
    const project = createProjectView("Flow Determinism");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "flow";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.effects.rotationJitter = 0;

    const first = buildRenderSlices(project, [assets[0]!]);
    const second = buildRenderSlices(project, [assets[0]!]);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((slice) => slice.clipRect)).toBe(true);
  });

  it("expands flow clip bounds as overlap increases", () => {
    const project = createProjectView("Flow Overlap");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "flow";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.effects.rotationJitter = 0;
    project.compositing.overlap = 0;

    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.compositing.overlap = 1;
    const overlapped = buildRenderSlices(project, [assets[0]!]);

    expect(overlapped).toHaveLength(baseline.length);
    expect(
      overlapped.reduce(
        (sum, slice) => sum + (slice.clipRect ? slice.clipRect.width * slice.clipRect.height : 0),
        0,
      ),
    ).toBeGreaterThan(
      baseline.reduce(
        (sum, slice) => sum + (slice.clipRect ? slice.clipRect.width * slice.clipRect.height : 0),
        0,
      ),
    );
  });

  it("increases flow heading diversity as curvature rises", () => {
    const project = createProjectView("Flow Curvature");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "flow";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.flowCoherence = 1;
    project.effects.rotationJitter = 0;

    project.layout.flowCurvature = 0;
    const straight = buildRenderSlices(project, [assets[0]!]);

    project.layout.flowCurvature = 1;
    const curved = buildRenderSlices(project, [assets[0]!]);

    expect(countHeadingBuckets(curved)).toBeGreaterThan(countHeadingBuckets(straight));
  });

  it("increases flow heading divergence as coherence falls", () => {
    const project = createProjectView("Flow Coherence");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "flow";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.flowCurvature = 0.8;
    project.effects.rotationJitter = 0;

    project.layout.flowCoherence = 1;
    const cohesive = buildRenderSlices(project, [assets[0]!]);

    project.layout.flowCoherence = 0;
    const divergent = buildRenderSlices(project, [assets[0]!]);

    expect(countHeadingBuckets(divergent)).toBeGreaterThan(countHeadingBuckets(cohesive));
  });

  it("adds branching slices as flow branch rate rises", () => {
    const project = createProjectView("Flow Branching");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "flow";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.flowCurvature = 0.75;
    project.layout.flowCoherence = 0.7;
    project.effects.rotationJitter = 0;

    project.layout.flowBranchRate = 0;
    const unbranched = buildRenderSlices(project, [assets[0]!]);

    project.layout.flowBranchRate = 1;
    const branched = buildRenderSlices(project, [assets[0]!]);

    expect(branched.length).toBeGreaterThan(unbranched.length);
  });

  it("changes flow slice widths with taper while preserving placement", () => {
    const project = createProjectView("Flow Taper");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "flow";
    project.layout.shapeMode = "rect";
    project.layout.symmetryMode = "none";
    project.layout.flowCurvature = 0.65;
    project.layout.flowCoherence = 0.82;
    project.layout.flowBranchRate = 0;
    project.effects.rotationJitter = 0;

    project.layout.flowTaper = 0;
    const untapered = buildRenderSlices(project, [assets[0]!]);

    project.layout.flowTaper = 1;
    const tapered = buildRenderSlices(project, [assets[0]!]);

    expect(tapered).toHaveLength(untapered.length);
    expect(
      tapered.every((slice, index) => {
        const taperedCenter = getSliceCenter(slice);
        const untaperedCenter = getSliceCenter(untapered[index]!);
        return (
          Math.abs(taperedCenter.x - untaperedCenter.x) < 1e-6 &&
          Math.abs(taperedCenter.y - untaperedCenter.y) < 1e-6 &&
          Math.abs(getSliceHeading(slice) - getSliceHeading(untapered[index]!)) <
            1e-6
        );
      }),
    ).toBe(true);
    expect(
      tapered.some(
        (slice, index) =>
          Math.abs(slice.rect.width * slice.rect.height - untapered[index]!.rect.width * untapered[index]!.rect.height) >
          1e-3,
      ),
    ).toBe(true);
  });

  it("renders a single draw stamp for a click-only stroke", () => {
    const project = createProjectView("Draw Click");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "draw";
    project.layout.shapeMode = "rect";
    project.draw.brushSize = 120;
    project.draw.strokes = [
      {
        id: "stroke_click",
        points: [{ x: 180, y: 220 }],
      },
    ];

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices).toHaveLength(1);
    expect(slices[0]?.rect.width).toBeGreaterThanOrEqual(120);
    expect(slices[0]?.rect.x).toBeLessThan(180);
    expect(slices[0]?.rect.y).toBeLessThan(220);
  });

  it("changes draw stamp count as density changes and preserves overscan", () => {
    const project = createProjectView("Draw Density");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "draw";
    project.layout.shapeMode = "rect";
    project.draw.brushSize = 120;
    project.draw.strokes = [
      {
        id: "stroke_density",
        points: [
          { x: -40, y: 180 },
          { x: 420, y: 180 },
        ],
      },
    ];

    project.layout.density = 0.2;
    const sparse = buildRenderSlices(project, [assets[0]!]);

    project.layout.density = 4;
    const dense = buildRenderSlices(project, [assets[0]!]);

    expect(dense.length).toBeGreaterThan(sparse.length);
    expect(
      dense.some((slice) => slice.rect.x < 0 || slice.rect.x + slice.rect.width > project.canvas.width),
    ).toBe(true);
  });

  it("does not clone draw slices when symmetry is enabled", () => {
    const project = createProjectView("Draw Symmetry");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "draw";
    project.layout.shapeMode = "rect";
    project.layout.density = 4;
    project.draw.brushSize = 100;
    project.draw.strokes = [
      {
        id: "stroke_symmetry",
        points: [
          { x: 200, y: 200 },
          { x: 360, y: 200 },
        ],
      },
    ];

    project.layout.symmetryMode = "none";
    const baseline = buildRenderSlices(project, [assets[0]!]);

    project.layout.symmetryMode = "quad";
    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices.length).toBe(baseline.length);
    expect(slices.every((slice) => slice.mirrorAxis === "none")).toBe(true);
  });

  it.each([
    "sierpinski-triangle",
    "sierpinski-carpet",
    "vicsek",
    "h-tree",
    "rosette",
    "binary-tree",
    "pythagoras-tree",
  ] as const)("builds deterministic slices for fractal variant %s", (variant) => {
    const project = createProjectView(`Fractal ${variant}`);
    project.sourceIds = [assets[0]!.id, assets[1]!.id];
    project.layout.family = "fractal";
    project.layout.fractalVariant = variant;

    const first = buildRenderSlices(project, assets);
    const second = buildRenderSlices(project, assets);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it.each(["triangle", "blob", "ring", "arc", "wedge"] as const)(
    "applies %s geometry to fractal cells",
    (shapeMode) => {
      const project = createProjectView(`Fractal ${shapeMode} Geometry`);
      project.sourceIds = [assets[0]!.id];
      project.layout.family = "fractal";
      project.layout.shapeMode = shapeMode;
      project.layout.fractalVariant = "rosette";
      project.layout.fractalIterations = 2;

      const slices = buildRenderSlices(project, [assets[0]!]);

      expect(slices.length).toBeGreaterThan(0);
      expect(slices.every((slice) => slice.shape === shapeMode)).toBe(true);
      if (shapeMode !== "blob") {
        expect(slices.every((slice) => slice.clipPathPoints === null)).toBe(true);
      }
    },
  );

  it("cycles mixed geometry through creative fractal slice masks", () => {
    const project = createProjectView("Fractal Mixed Geometry");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "fractal";
    project.layout.shapeMode = "mixed";
    project.layout.fractalVariant = "sierpinski-carpet";
    project.layout.fractalIterations = 2;

    const slices = buildRenderSlices(project, [assets[0]!]);
    const shapes = new Set(slices.map((slice) => slice.shape));

    expect(shapes).toEqual(
      new Set(["rect", "triangle", "blob", "ring", "arc", "wedge"]),
    );
  });

  it("changes fractal slice counts as rosette petals change", () => {
    const project = createProjectView("Fractal Rosette Controls");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "fractal";
    project.layout.fractalVariant = "rosette";
    project.layout.fractalIterations = 3;
    project.layout.fractalRosettePetals = 4;

    const sparse = buildRenderSlices(project, [assets[0]!]);

    project.layout.fractalRosettePetals = 9;
    const dense = buildRenderSlices(project, [assets[0]!]);

    expect(dense.length).toBeGreaterThan(sparse.length);
  });

  it("rotates sierpinski triangle output with the rotation control", () => {
    const project = createProjectView("Fractal Triangle Rotation");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "fractal";
    project.layout.fractalVariant = "sierpinski-triangle";
    project.layout.fractalIterations = 1;
    project.layout.fractalTriangleRotation = 0;

    const upright = buildRenderSlices(project, [assets[0]!]);

    project.layout.fractalTriangleRotation = 30;
    const rotated = buildRenderSlices(project, [assets[0]!]);

    expect(upright[0]?.clipPathPoints).not.toEqual(rotated[0]?.clipPathPoints);
  });

  it("clamps fractal recursion under radial symmetry and the global slice budget", () => {
    const project = createProjectView("Fractal Clamp");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "fractal";
    project.layout.fractalVariant = "sierpinski-carpet";
    project.layout.fractalIterations = 4;
    project.layout.symmetryMode = "radial";
    project.layout.symmetryCopies = 12;

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices.length).toBeLessThanOrEqual(1_200);
    expect(slices.length).toBe(384);
  });

  it("emits polygon clip paths for rosette petals", () => {
    const project = createProjectView("Fractal Rosette Paths");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "fractal";
    project.layout.fractalVariant = "rosette";

    const slices = buildRenderSlices(project, [assets[0]!]);

    expect(slices.some((slice) => (slice.clipPathPoints?.length ?? 0) >= 3)).toBe(true);
  });

  it.each(["h-tree", "binary-tree", "pythagoras-tree"] as const)(
    "keeps %s slices inside the inset canvas",
    (variant) => {
      const project = createProjectView(`Fractal Bounds ${variant}`);
      project.sourceIds = [assets[0]!.id];
      project.layout.family = "fractal";
      project.layout.fractalVariant = variant;
      project.layout.fractalIterations = 4;

      const slices = buildRenderSlices(project, [assets[0]!]);
      const left = project.canvas.inset;
      const right = project.canvas.width - project.canvas.inset;
      const top = project.canvas.inset;
      const bottom = project.canvas.height - project.canvas.inset;

      expect(
        slices.every((slice) => {
          const points =
            slice.quadPoints ??
            slice.clipPathPoints ??
            [
              { x: slice.rect.x, y: slice.rect.y },
              { x: slice.rect.x + slice.rect.width, y: slice.rect.y },
              {
                x: slice.rect.x + slice.rect.width,
                y: slice.rect.y + slice.rect.height,
              },
              { x: slice.rect.x, y: slice.rect.y + slice.rect.height },
            ];

          return points.every(
            (point) =>
              point.x >= left - 1 &&
              point.x <= right + 1 &&
              point.y >= top - 1 &&
              point.y <= bottom + 1,
          );
        }),
      ).toBe(true);
    },
  );

  it.each([
    "lissajous",
    "epicycloid",
    "hypotrochoid",
    "harmonograph",
    "superformula",
    "phyllotaxis",
    "strange-attractor",
  ] as const)("builds deterministic slices for curve variant %s", (variant) => {
    const project = createProjectView(`Curves ${variant}`);
    project.sourceIds = [assets[0]!.id, assets[1]!.id];
    project.layout.family = "curves";
    project.layout.curveVariant = variant;
    project.layout.curveSamples = 96;

    const first = buildRenderSlices(project, assets);
    const second = buildRenderSlices(project, assets);

    expect(first).toEqual(second);
    expect(first.length).toBe(96);
  });

  it.each(["triangle", "blob", "ring", "arc", "wedge"] as const)(
    "applies %s geometry to curve cells",
    (shapeMode) => {
      const project = createProjectView(`Curves ${shapeMode} Geometry`);
      project.sourceIds = [assets[0]!.id];
      project.layout.family = "curves";
      project.layout.shapeMode = shapeMode;
      project.layout.curveVariant = "lissajous";
      project.layout.curveSamples = 48;

      const slices = buildRenderSlices(project, [assets[0]!]);

      expect(slices).toHaveLength(48);
      expect(slices.every((slice) => slice.shape === shapeMode)).toBe(true);
    },
  );

  it("cycles mixed geometry through creative curve slice masks", () => {
    const project = createProjectView("Curves Mixed Geometry");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "curves";
    project.layout.shapeMode = "mixed";
    project.layout.curveVariant = "lissajous";
    project.layout.curveSamples = 48;

    const slices = buildRenderSlices(project, [assets[0]!]);
    const shapes = new Set(slices.map((slice) => slice.shape));

    expect(shapes).toEqual(
      new Set(["rect", "triangle", "blob", "ring", "arc", "wedge"]),
    );
  });

  it.each([
    ["lissajous", (project: ReturnType<typeof createProjectView>) => {
      project.layout.curveFrequencyX += 1;
      project.layout.curvePhase += 30;
    }],
    ["epicycloid", (project: ReturnType<typeof createProjectView>) => {
      project.layout.curveGearRatio = 0.52;
      project.layout.curvePenOffset = 1.6;
    }],
    ["hypotrochoid", (project: ReturnType<typeof createProjectView>) => {
      project.layout.curveGearRatio = 0.62;
      project.layout.curvePenOffset = 1.8;
    }],
    ["harmonograph", (project: ReturnType<typeof createProjectView>) => {
      project.layout.curveDamping = 0.22;
    }],
    ["superformula", (project: ReturnType<typeof createProjectView>) => {
      project.layout.curveSuperformulaM = 9;
      project.layout.curveSuperformulaN1 = 1.2;
    }],
    ["phyllotaxis", (project: ReturnType<typeof createProjectView>) => {
      project.layout.curvePhyllotaxisAngle = 111;
    }],
    ["strange-attractor", (project: ReturnType<typeof createProjectView>) => {
      project.layout.curveAttractorYaw = -42;
      project.layout.curveAttractorPitch = 28;
    }],
  ] as Array<[CurveVariant, (project: ReturnType<typeof createProjectView>) => void]>)(
    "changes curve output when %s controls change",
    (variant, mutate) => {
      const project = createProjectView(`Curves ${variant} Controls`);
      project.sourceIds = [assets[0]!.id];
      project.layout.family = "curves";
      project.layout.curveVariant = variant;
      project.layout.curveSamples = 80;

      const baseline = buildRenderSlices(project, [assets[0]!]);
      mutate(project);
      const changed = buildRenderSlices(project, [assets[0]!]);

      expect(changed.map((slice) => slice.rect)).not.toEqual(
        baseline.map((slice) => slice.rect),
      );
    },
  );

  it.each([
    "lissajous",
    "epicycloid",
    "hypotrochoid",
    "harmonograph",
    "superformula",
    "phyllotaxis",
    "strange-attractor",
  ] as const)("keeps %s curve slices inside the inset canvas", (variant) => {
    const project = createProjectView(`Curves Bounds ${variant}`);
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "curves";
    project.layout.curveVariant = variant;
    project.layout.curveSamples = 120;
    project.layout.curveRotation = 32;
    project.layout.curveScaleX = 0.86;
    project.layout.curveScaleY = 0.74;

    const slices = buildRenderSlices(project, [assets[0]!]);
    const left = project.canvas.inset;
    const right = project.canvas.width - project.canvas.inset;
    const top = project.canvas.inset;
    const bottom = project.canvas.height - project.canvas.inset;

    expect(
      slices.every((slice) => {
        const points =
          slice.quadPoints ??
          slice.clipPathPoints ??
          [
            { x: slice.rect.x, y: slice.rect.y },
            { x: slice.rect.x + slice.rect.width, y: slice.rect.y },
            {
              x: slice.rect.x + slice.rect.width,
              y: slice.rect.y + slice.rect.height,
            },
            { x: slice.rect.x, y: slice.rect.y + slice.rect.height },
          ];

        return points.every(
          (point) =>
            point.x >= left - 1 &&
            point.x <= right + 1 &&
            point.y >= top - 1 &&
            point.y <= bottom + 1,
        );
      }),
    ).toBe(true);
  });

  it("sorts strange attractor curve slices by projected depth", () => {
    const project = createProjectView("Curves Attractor Depth");
    project.sourceIds = [assets[0]!.id];
    project.layout.family = "curves";
    project.layout.curveVariant = "strange-attractor";
    project.layout.curveSamples = 96;

    const slices = buildRenderSlices(project, [assets[0]!]);
    const depths = slices.map((slice) => slice.depth);

    expect(new Set(depths.map((depth) => depth.toFixed(3))).size).toBeGreaterThan(8);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });
});
