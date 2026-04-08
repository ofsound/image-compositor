import type {
  GeometryShape,
  LayoutFamily,
  NormalizedRect,
  RenderPoint,
  ProjectDocument,
  RenderRect,
  RenderSlice,
  SourceAsset,
  SourceAssignmentStrategy,
  ThreeDStructureMode,
} from "@/types/project";
import { mulberry32 } from "@/lib/rng";
import { clamp, lerp } from "@/lib/utils";

interface GeneratorContext {
  project: ProjectDocument;
  assets: SourceAsset[];
}

type ConcreteGeometryShape = Exclude<GeometryShape, "mixed">;
type MixedCycleShape = Exclude<GeometryShape, "mixed" | "interlock" | "blob">;

interface LayoutCell extends RenderRect {
  shape: ConcreteGeometryShape;
  clipRect?: RenderRect;
  clipPathPoints?: RenderPoint[];
  quadPoints?: RenderPoint[];
  clipRotation?: number;
  rotation?: number;
  rotationX?: number;
  rotationY?: number;
  depthValue?: number;
}

interface Point {
  x: number;
  y: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface ThreeDAnchor {
  position: Point3D;
  tangent: Point3D;
  normal: Point3D;
}

const MIN_WEDGE_SWEEP_DEGREES = 0.5;
const MAX_BLOCK_SPLIT_OFFSET = 0.18;
const ORGANIC_VARIATION_MAX = 4_096;
const THREE_D_DISTRIBUTION_MAX = 4_096;

function degToRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function assignShape(
  index: number,
  shapeMode: GeometryShape,
  family: LayoutFamily,
) {
  if (shapeMode === "interlock") return "triangle";
  if (shapeMode !== "mixed") return shapeMode;
  const cycle: ConcreteGeometryShape[] =
    family === "organic"
      ? ["blob", "ring", "wedge"]
      : (["rect", "triangle", "ring", "wedge"] as MixedCycleShape[]);
  return cycle[index % cycle.length]!;
}

function insetRect(
  rect: RenderRect,
  horizontalAmount: number,
  verticalAmount = horizontalAmount,
): RenderRect {
  return {
    x: rect.x + horizontalAmount,
    y: rect.y + verticalAmount,
    width: Math.max(1, rect.width - horizontalAmount * 2),
    height: Math.max(1, rect.height - verticalAmount * 2),
  };
}

function getRectCenter(rect: RenderRect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function getBoundsForPoints(points: RenderPoint[]): RenderRect {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function scalePointsFromCenter(
  points: RenderPoint[],
  center: Point,
  factor: number,
) {
  return points.map((point) => ({
    x: center.x + (point.x - center.x) * factor,
    y: center.y + (point.y - center.y) * factor,
  }));
}

function translatePoints(points: RenderPoint[], dx: number, dy: number) {
  return points.map((point) => ({
    x: point.x + dx,
    y: point.y + dy,
  }));
}

function rotatePoints(points: RenderPoint[], angle: number, center: Point) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return points.map((point) => {
    const x = point.x - center.x;
    const y = point.y - center.y;

    return {
      x: center.x + x * cos - y * sin,
      y: center.y + x * sin + y * cos,
    };
  });
}

function getRotatedBounds(rect: RenderRect, radians: number): RenderRect {
  const { x: centerX, y: centerY } = getRectCenter(rect);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map((corner) => ({
    x: centerX + corner.x * cos - corner.y * sin,
    y: centerY + corner.x * sin + corner.y * cos,
  }));

  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function projectPoint(point: Point, axis: Point) {
  return point.x * axis.x + point.y * axis.y;
}

function addPoint3D(a: Point3D, b: Point3D): Point3D {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  };
}

function subtractPoint3D(a: Point3D, b: Point3D): Point3D {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

function scalePoint3D(point: Point3D, scalar: number): Point3D {
  return {
    x: point.x * scalar,
    y: point.y * scalar,
    z: point.z * scalar,
  };
}

function getPoint3DLength(point: Point3D) {
  return Math.hypot(point.x, point.y, point.z);
}

function normalizePoint3D(point: Point3D): Point3D {
  const length = getPoint3DLength(point);
  if (length < 0.0001) {
    return { x: 0, y: 0, z: 1 };
  }

  return scalePoint3D(point, 1 / length);
}

function crossPoint3D(a: Point3D, b: Point3D): Point3D {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function rotatePoint3D(point: Point3D, yawRadians: number, pitchRadians: number) {
  const yawCos = Math.cos(yawRadians);
  const yawSin = Math.sin(yawRadians);
  const pitchCos = Math.cos(pitchRadians);
  const pitchSin = Math.sin(pitchRadians);
  const yawRotated = {
    x: point.x * yawCos - point.z * yawSin,
    y: point.y,
    z: point.x * yawSin + point.z * yawCos,
  };

  return {
    x: yawRotated.x,
    y: yawRotated.y * pitchCos - yawRotated.z * pitchSin,
    z: yawRotated.y * pitchSin + yawRotated.z * pitchCos,
  };
}

function getInsetCanvasCorners(project: ProjectDocument): Point[] {
  const left = project.canvas.inset;
  const right = project.canvas.width - project.canvas.inset;
  const top = project.canvas.inset;
  const bottom = project.canvas.height - project.canvas.inset;

  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function normalizeStripThicknesses(
  thicknesses: number[],
  visibleSpan: number,
) {
  const nextThicknesses = [...thicknesses];

  for (let iteration = 0; iteration < nextThicknesses.length; iteration += 1) {
    let deficit = 0;
    let flexible = 0;

    for (let index = 0; index < nextThicknesses.length; index += 1) {
      if (nextThicknesses[index]! < 1) {
        deficit += 1 - nextThicknesses[index]!;
        nextThicknesses[index] = 1;
      } else {
        flexible += nextThicknesses[index]! - 1;
      }
    }

    if (deficit <= 0 || flexible <= 0) {
      break;
    }

    for (let index = 0; index < nextThicknesses.length; index += 1) {
      const available = nextThicknesses[index]! - 1;
      if (available <= 0) continue;
      nextThicknesses[index] -= deficit * (available / flexible);
    }
  }

  const total = nextThicknesses.reduce((sum, thickness) => sum + thickness, 0);
  if (total === 0) {
    return Array.from({ length: nextThicknesses.length }, () => visibleSpan / nextThicknesses.length);
  }

  return nextThicknesses.map((thickness) => (thickness / total) * visibleSpan);
}

function buildStripThicknesses(
  count: number,
  visibleSpan: number,
  randomness: number,
  rng: ReturnType<typeof mulberry32>,
) {
  if (count <= 1) return [visibleSpan];

  const baseThickness = visibleSpan / count;
  const rawThicknesses = Array.from({ length: count }, () =>
    baseThickness + (rng.next() - 0.5) * randomness * 40,
  );

  return normalizeStripThicknesses(rawThicknesses, visibleSpan);
}

function generateGrid(context: GeneratorContext) {
  const {
    project: { canvas, layout, compositing },
  } = context;
  const cells: LayoutCell[] = [];
  const innerWidth = canvas.width - canvas.inset * 2;
  const innerHeight = canvas.height - canvas.inset * 2;
  const rowHeight = innerHeight / layout.rows;
  const insetAmountHorizontal =
    layout.gutterHorizontal * (1 - compositing.overlap);
  const insetAmountVertical = layout.gutterVertical * (1 - compositing.overlap);

  if (layout.shapeMode === "interlock") {
    const triangleWidth = (2 * innerWidth) / layout.columns;
    const triangleStep = triangleWidth / 2;

    for (let row = 0; row < layout.rows; row += 1) {
      const rowOffset = row % 2 === 0 ? 0 : -triangleStep;

      for (let column = 0; column < layout.columns; column += 1) {
        const rect = {
          x: canvas.inset + rowOffset + column * triangleStep,
          y: canvas.inset + row * rowHeight,
          width: triangleWidth,
          height: rowHeight,
        };
        cells.push({
          ...insetRect(rect, insetAmountHorizontal, insetAmountVertical),
          shape: "interlock",
          clipRotation: (row + column) % 2 === 0 ? 0 : Math.PI,
        });
      }
    }

    return cells;
  }

  const columnWidth = innerWidth / layout.columns;

  for (let row = 0; row < layout.rows; row += 1) {
    for (let column = 0; column < layout.columns; column += 1) {
      const rect = {
        x: canvas.inset + column * columnWidth,
        y: canvas.inset + row * rowHeight,
        width: columnWidth,
        height: rowHeight,
      };
      cells.push({
        ...insetRect(rect, insetAmountHorizontal, insetAmountVertical),
        shape: assignShape(
          row * layout.columns + column,
          layout.shapeMode,
          layout.family,
        ),
      });
    }
  }

  return cells;
}

function generateStrips(context: GeneratorContext) {
  const {
    project: { layout, compositing },
  } = context;
  const rng = mulberry32(context.project.activeSeed + 17);
  const count = Math.max(4, Math.round(4 + layout.density * 16));
  const cells: LayoutCell[] = [];
  const angleRadians = (layout.stripAngle * Math.PI) / 180;
  const normalAxis = {
    x: Math.cos(angleRadians),
    y: Math.sin(angleRadians),
  };
  const tangentAxis = {
    x: -Math.sin(angleRadians),
    y: Math.cos(angleRadians),
  };
  const corners = getInsetCanvasCorners(context.project);
  const normalValues = corners.map((corner) => projectPoint(corner, normalAxis));
  const tangentValues = corners.map((corner) => projectPoint(corner, tangentAxis));
  const minNormal = Math.min(...normalValues);
  const maxNormal = Math.max(...normalValues);
  const minTangent = Math.min(...tangentValues);
  const maxTangent = Math.max(...tangentValues);
  const normalSpan = maxNormal - minNormal;
  const tangentSpan = maxTangent - minTangent + 2;
  const requestedGap = layout.gutter * (1 - compositing.overlap);
  const maxGap =
    count > 1 ? Math.max(0, (normalSpan - count) / (count - 1)) : 0;
  const interStripGap = Math.min(requestedGap, maxGap);
  const visibleSpan = Math.max(count, normalSpan - interStripGap * (count - 1));
  const thicknesses = buildStripThicknesses(count, visibleSpan, layout.randomness, rng);
  const tangentCenter = (minTangent + maxTangent) / 2;
  let cursor = minNormal;

  for (let index = 0; index < count; index += 1) {
    const thickness = thicknesses[index] ?? visibleSpan / count;
    const stripCenter = cursor + thickness / 2;
    const center = {
      x: normalAxis.x * stripCenter + tangentAxis.x * tangentCenter,
      y: normalAxis.y * stripCenter + tangentAxis.y * tangentCenter,
    };
    const clipRect = {
      x: center.x - thickness / 2,
      y: center.y - tangentSpan / 2,
      width: thickness,
      height: tangentSpan,
    };
    cells.push({
      ...getRotatedBounds(clipRect, angleRadians),
      clipRect,
      clipRotation: angleRadians,
      shape: assignShape(index, layout.shapeMode, layout.family),
    });
    cursor += thickness + interStripGap;
  }

  return cells;
}

function getBlockSplitRatio(
  randomness: number,
  rng: ReturnType<typeof mulberry32>,
) {
  const halfRange = MAX_BLOCK_SPLIT_OFFSET * clamp(randomness, 0, 1);
  if (halfRange === 0) {
    return 0.5;
  }

  return lerp(0.5 - halfRange, 0.5 + halfRange, rng.next());
}

function getBlockVerticalSplitProbability(rect: RenderRect, splitBias: number) {
  const aspectDelta = (rect.width - rect.height) / Math.max(rect.width, rect.height, 1);
  const aspectPreference = clamp(0.5 + aspectDelta * 0.35, 0, 1);
  return clamp(aspectPreference + (clamp(splitBias, 0, 1) - 0.5), 0, 1);
}

function subdivide(
  rect: RenderRect,
  depth: number,
  rng: ReturnType<typeof mulberry32>,
  cells: LayoutCell[],
  shapeMode: GeometryShape,
  overlap: number,
  minSize: number,
  splitRandomness: number,
  splitBias: number,
) {
  if (depth === 0 || rect.width < minSize || rect.height < minSize) {
    cells.push({
      ...insetRect(rect, 6 * (1 - overlap)),
      shape: assignShape(cells.length, shapeMode, "blocks"),
    });
    return;
  }

  const splitVertical =
    rng.next() < getBlockVerticalSplitProbability(rect, splitBias);
  const split = getBlockSplitRatio(splitRandomness, rng);

  if (splitVertical) {
    const widthA = rect.width * split;
    subdivide(
      { x: rect.x, y: rect.y, width: widthA, height: rect.height },
      depth - 1,
      rng,
      cells,
      shapeMode,
      overlap,
      minSize,
      splitRandomness,
      splitBias,
    );
    subdivide(
      { x: rect.x + widthA, y: rect.y, width: rect.width - widthA, height: rect.height },
      depth - 1,
      rng,
      cells,
      shapeMode,
      overlap,
      minSize,
      splitRandomness,
      splitBias,
    );
  } else {
    const heightA = rect.height * split;
    subdivide(
      { x: rect.x, y: rect.y, width: rect.width, height: heightA },
      depth - 1,
      rng,
      cells,
      shapeMode,
      overlap,
      minSize,
      splitRandomness,
      splitBias,
    );
    subdivide(
      { x: rect.x, y: rect.y + heightA, width: rect.width, height: rect.height - heightA },
      depth - 1,
      rng,
      cells,
      shapeMode,
      overlap,
      minSize,
      splitRandomness,
      splitBias,
    );
  }
}

function generateBlocks(context: GeneratorContext) {
  const {
    project: { canvas, layout, compositing, activeSeed },
  } = context;
  const rng = mulberry32(activeSeed + 101);
  const cells: LayoutCell[] = [];
  subdivide(
    {
      x: canvas.inset,
      y: canvas.inset,
      width: canvas.width - canvas.inset * 2,
      height: canvas.height - canvas.inset * 2,
    },
    layout.blockDepth,
    rng,
    cells,
    layout.shapeMode,
    compositing.overlap,
    layout.blockMinSize,
    layout.blockSplitRandomness,
    layout.blockSplitBias,
  );
  return cells;
}

function generateRadial(context: GeneratorContext) {
  const {
    project: { canvas, layout },
  } = context;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const maxRadius = Math.min(canvas.width, canvas.height) / 2 - canvas.inset;
  const innerRadiusPx = maxRadius * clamp(layout.radialInnerRadius, 0, 0.85);
  const segmentSweep = (Math.PI * 2) / layout.radialSegments;
  const cells: LayoutCell[] = [];

  for (let ring = 0; ring < layout.radialRings; ring += 1) {
    const ringOuter =
      innerRadiusPx +
      (maxRadius - innerRadiusPx) * ((ring + 1) / layout.radialRings);
    const ringInner =
      innerRadiusPx +
      (maxRadius - innerRadiusPx) * (ring / layout.radialRings);
    const ringOffset = degToRad(
      layout.radialAngleOffset + ring * layout.radialRingPhaseStep,
    );
    for (let segment = 0; segment < layout.radialSegments; segment += 1) {
      const angle = ringOffset + segmentSweep * segment;
      const nextAngle = angle + segmentSweep;
      const midAngle = angle + segmentSweep / 2;
      const points = [
        { x: centerX + Math.cos(angle) * ringInner, y: centerY + Math.sin(angle) * ringInner },
        { x: centerX + Math.cos(nextAngle) * ringInner, y: centerY + Math.sin(nextAngle) * ringInner },
        { x: centerX + Math.cos(angle) * ringOuter, y: centerY + Math.sin(angle) * ringOuter },
        { x: centerX + Math.cos(nextAngle) * ringOuter, y: centerY + Math.sin(nextAngle) * ringOuter },
      ];
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      let rotation = 0;

      if (layout.radialChildRotationMode === "outward") {
        rotation = midAngle;
      } else if (layout.radialChildRotationMode === "tangent") {
        rotation = midAngle + Math.PI / 2;
      }

      cells.push({
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(64, Math.max(...xs) - Math.min(...xs)),
        height: Math.max(64, Math.max(...ys) - Math.min(...ys)),
        shape: assignShape(segment + ring, layout.shapeMode, layout.family),
        rotation,
      });
    }
  }

  return cells;
}

interface OrganicAttractor {
  x: number;
  y: number;
  strength: number;
  radius: number;
  swirl: number;
}

function evaluateOrganicField(
  point: Point,
  attractors: OrganicAttractor[],
  innerRect: RenderRect,
  phase: number,
) {
  const normalizedX = (point.x - innerRect.x) / Math.max(innerRect.width, 1);
  const normalizedY = (point.y - innerRect.y) / Math.max(innerRect.height, 1);
  let score = 0;
  let vectorX = 0;
  let vectorY = 0;

  for (const attractor of attractors) {
    const dx = attractor.x - point.x;
    const dy = attractor.y - point.y;
    const distance = Math.hypot(dx, dy) + 1;
    const influence =
      attractor.strength *
      Math.exp(-((distance / attractor.radius) ** 2));
    score += influence;
    vectorX += (dx / distance) * influence + (-dy / distance) * attractor.swirl;
    vectorY += (dy / distance) * influence + (dx / distance) * attractor.swirl;
  }

  const wave =
    Math.sin((normalizedX * 2.2 + normalizedY * 1.6) * Math.PI + phase) * 0.14 +
    Math.cos((normalizedY * 2.8 - normalizedX * 0.9) * Math.PI - phase * 0.6) *
      0.12;
  const edgeFalloff =
    Math.sin(Math.PI * clamp(normalizedX, 0, 1)) *
    Math.sin(Math.PI * clamp(normalizedY, 0, 1));

  return {
    score: score * (0.55 + edgeFalloff * 0.45) + wave,
    angle: Math.atan2(vectorY, vectorX || 0.0001),
  };
}

function clampPointToRect(point: RenderPoint, rect: RenderRect) {
  return {
    x: clamp(point.x, rect.x, rect.x + rect.width),
    y: clamp(point.y, rect.y, rect.y + rect.height),
  };
}

function buildOrganicBlobPoints(
  center: Point,
  radiusX: number,
  radiusY: number,
  angle: number,
  innerRect: RenderRect,
  rng: ReturnType<typeof mulberry32>,
) {
  const pointCount = 18;
  const phaseA = rng.next() * Math.PI * 2;
  const phaseB = rng.next() * Math.PI * 2;
  const phaseC = rng.next() * Math.PI * 2;
  const harmonicA = 0.16 + rng.next() * 0.09;
  const harmonicB = 0.08 + rng.next() * 0.07;
  const harmonicC = 0.04 + rng.next() * 0.05;
  const points: RenderPoint[] = [];

  for (let index = 0; index < pointCount; index += 1) {
    const theta = (Math.PI * 2 * index) / pointCount;
    const radiusScale = clamp(
      1 +
        harmonicA * Math.sin(theta * 2 + phaseA) +
        harmonicB * Math.cos(theta * 3 + phaseB) +
        harmonicC * Math.sin(theta * 5 + phaseC),
      0.62,
      1.45,
    );
    const anisotropy = 1 + 0.22 * Math.cos(theta - angle);
    const localRadiusX = radiusX * radiusScale * anisotropy;
    const localRadiusY = radiusY * radiusScale * (2 - anisotropy);
    const rotatedTheta = theta + angle * 0.18;
    const rawPoint = {
      x: center.x + Math.cos(rotatedTheta) * localRadiusX,
      y: center.y + Math.sin(rotatedTheta) * localRadiusY,
    };

    points.push(clampPointToRect(rawPoint, innerRect));
  }

  return points;
}

function getOrganicVariationCurve(variation: number) {
  const normalized = clamp(variation / ORGANIC_VARIATION_MAX, 0, 1);
  return 1 - (1 - normalized) ** 1.8;
}

function getThreeDDistributionCurve(variation: number) {
  const normalized = clamp(variation / THREE_D_DISTRIBUTION_MAX, 0, 1);
  return 1 - (1 - normalized) ** 1.55;
}

function generateOrganic(context: GeneratorContext) {
  const {
    project: { canvas, layout, activeSeed },
  } = context;
  const variationCurve = getOrganicVariationCurve(layout.organicVariation);
  const variationSeedOffset = Math.round(variationCurve * 4_194_301);
  const rng = mulberry32(activeSeed + 313 + variationSeedOffset);
  const innerRect = {
    x: canvas.inset,
    y: canvas.inset,
    width: canvas.width - canvas.inset * 2,
    height: canvas.height - canvas.inset * 2,
  };
  const count = Math.max(6, Math.round(8 + layout.density * 28));
  const attractorCount = 3 + Math.floor(rng.next() * 3);
  const attractors: OrganicAttractor[] = Array.from(
    { length: attractorCount },
    () => ({
      x: innerRect.x + innerRect.width * (0.16 + rng.next() * 0.68),
      y: innerRect.y + innerRect.height * (0.16 + rng.next() * 0.68),
      strength: 0.7 + rng.next() * 0.9,
      radius:
        Math.min(innerRect.width, innerRect.height) * (0.16 + rng.next() * 0.18),
      swirl: (rng.next() - 0.5) * 0.18,
    }),
  );
  const phase =
    rng.next() * Math.PI * 2 + variationCurve * Math.PI * 18;
  const candidateColumns = Math.max(4, Math.ceil(Math.sqrt(count * 2.5)));
  const candidateRows = Math.max(
    4,
    Math.ceil((count * 2.5) / candidateColumns),
  );
  const candidates: Array<{
    center: Point;
    score: number;
    angle: number;
  }> = [];

  for (let row = 0; row < candidateRows; row += 1) {
    for (let column = 0; column < candidateColumns; column += 1) {
      const center = {
        x:
          innerRect.x +
          ((column +
            0.5 +
            (rng.next() - 0.5) * lerp(0.42, 0.82, variationCurve)) /
            candidateColumns) *
            innerRect.width,
        y:
          innerRect.y +
          ((row +
            0.5 +
            (rng.next() - 0.5) * lerp(0.42, 0.82, variationCurve)) /
            candidateRows) *
            innerRect.height,
      };
      const field = evaluateOrganicField(center, attractors, innerRect, phase);
      candidates.push({
        center,
        score: field.score + (rng.next() - 0.5) * 0.08,
        angle: field.angle,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected: typeof candidates = [];
  const minimumSpacing =
    Math.min(innerRect.width, innerRect.height) / Math.sqrt(count) * 0.58;

  for (const candidate of candidates) {
    const proximityFactor = clamp(
      1.05 - Math.max(0, candidate.score - candidates.at(0)!.score * 0.55),
      0.6,
      1.05,
    );
    const minDistance = minimumSpacing * proximityFactor;
    const tooClose = selected.some(
      (entry) =>
        Math.hypot(
          entry.center.x - candidate.center.x,
          entry.center.y - candidate.center.y,
        ) < minDistance,
    );

    if (tooClose) continue;
    selected.push(candidate);
    if (selected.length >= count) break;
  }

  const fallbackCandidates = selected.length < count ? candidates : [];
  for (const candidate of fallbackCandidates) {
    if (selected.length >= count) break;
    if (selected.some((entry) => entry.center === candidate.center)) continue;
    selected.push(candidate);
  }

  const scoreRange = {
    min: Math.min(...selected.map((candidate) => candidate.score)),
    max: Math.max(...selected.map((candidate) => candidate.score)),
  };
  const baseRadius =
    Math.min(innerRect.width, innerRect.height) / Math.sqrt(count) * 0.42;

  return selected.map<LayoutCell>((candidate, index) => {
    const scoreT =
      scoreRange.max - scoreRange.min < 0.0001
        ? 0.5
        : (candidate.score - scoreRange.min) /
          (scoreRange.max - scoreRange.min);
    const radiusX = baseRadius * (0.95 + scoreT * 0.55) * (0.88 + rng.next() * 0.32);
    const radiusY = baseRadius * (0.82 + scoreT * 0.48) * (0.9 + rng.next() * 0.28);
    const shape = assignShape(index, layout.shapeMode, layout.family);
    const rect = {
      x: candidate.center.x - radiusX,
      y: candidate.center.y - radiusY,
      width: radiusX * 2,
      height: radiusY * 2,
    };

    if (shape !== "blob") {
      return {
        ...rect,
        shape,
        rotation: candidate.angle * 0.35,
      };
    }

    const clipPathPoints = buildOrganicBlobPoints(
      candidate.center,
      radiusX,
      radiusY,
      candidate.angle,
      innerRect,
      rng,
    );
    const bounds = getBoundsForPoints(clipPathPoints);

    return {
      ...bounds,
      shape,
      clipPathPoints,
      rotation: candidate.angle * 0.18,
    };
  });
}

function createSphereAnchors(
  count: number,
  distributionCurve: number,
): ThreeDAnchor[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const phase = distributionCurve * Math.PI * 2;
  const anchors: ThreeDAnchor[] = [];

  for (let index = 0; index < count; index += 1) {
    const offset = count === 1 ? 0 : index / (count - 1);
    const y = lerp(0.96, -0.96, offset);
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * index + phase;
    const position = {
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    };
    const tangent = normalizePoint3D({
      x: -Math.sin(theta),
      y: 0,
      z: Math.cos(theta),
    });
    const normal = normalizePoint3D(position);

    anchors.push({
      position,
      tangent,
      normal,
    });
  }

  return anchors;
}

function createTorusAnchors(
  count: number,
  distributionCurve: number,
): ThreeDAnchor[] {
  const majorCount = Math.max(4, Math.round(Math.sqrt(count * 1.75)));
  const minorCount = Math.max(3, Math.ceil(count / majorCount));
  const majorRadius = 1;
  const minorRadius = 0.38;
  const uOffset = distributionCurve * Math.PI * 2;
  const vOffset = distributionCurve * Math.PI * 4;
  const anchors: ThreeDAnchor[] = [];

  for (let index = 0; index < count; index += 1) {
    const majorIndex = index % majorCount;
    const minorIndex = Math.floor(index / majorCount) % minorCount;
    const u = (Math.PI * 2 * majorIndex) / majorCount + uOffset;
    const v = (Math.PI * 2 * minorIndex) / minorCount + vOffset;
    const ringRadius = majorRadius + minorRadius * Math.cos(v);
    const position = {
      x: Math.cos(u) * ringRadius,
      y: Math.sin(v) * minorRadius,
      z: Math.sin(u) * ringRadius,
    };
    const tangent = normalizePoint3D({
      x: -Math.sin(u) * ringRadius,
      y: 0,
      z: Math.cos(u) * ringRadius,
    });
    const normal = normalizePoint3D({
      x: Math.cos(u) * Math.cos(v),
      y: Math.sin(v),
      z: Math.sin(u) * Math.cos(v),
    });

    anchors.push({
      position,
      tangent,
      normal,
    });
  }

  return anchors;
}

function createAttractorAnchors(
  count: number,
  distributionCurve: number,
): ThreeDAnchor[] {
  const sigma = lerp(9, 18, distributionCurve);
  const rho = lerp(24, 36, distributionCurve);
  const beta = lerp(2.2, 3.1, distributionCurve);
  const dt = 0.009;
  const totalSteps = Math.max(2_400, count * 48);
  const burnIn = 640;
  let x = 0.12 + distributionCurve * 0.08;
  let y = 0.08;
  let z = 0.14 + distributionCurve * 0.06;
  const points: Point3D[] = [];

  for (let step = 0; step < totalSteps + burnIn; step += 1) {
    const dx = sigma * (y - x);
    const dy = x * (rho - z) - y;
    const dz = x * y - beta * z;
    x += dx * dt;
    y += dy * dt;
    z += dz * dt;

    if (step >= burnIn) {
      points.push({ x, y, z });
    }
  }

  const maxExtent = Math.max(
    ...points.flatMap((point) => [Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)]),
    1,
  );
  const normalizedPoints = points.map((point) => ({
    x: point.x / maxExtent,
    y: point.y / maxExtent,
    z: point.z / maxExtent,
  }));
  const anchors: ThreeDAnchor[] = [];

  for (let index = 0; index < count; index += 1) {
    const pointIndex = Math.min(
      normalizedPoints.length - 2,
      Math.floor((index / count) * (normalizedPoints.length - 1)),
    );
    const position = normalizedPoints[pointIndex]!;
    const previous = normalizedPoints[Math.max(0, pointIndex - 1)]!;
    const next = normalizedPoints[Math.min(normalizedPoints.length - 1, pointIndex + 1)]!;
    const tangent = normalizePoint3D(subtractPoint3D(next, previous));
    const normal = normalizePoint3D(
      crossPoint3D(tangent, normalizePoint3D(addPoint3D(position, { x: 0.12, y: 0.24, z: 0.48 }))),
    );

    anchors.push({
      position,
      tangent,
      normal: getPoint3DLength(normal) < 0.0001 ? { x: 0, y: 1, z: 0 } : normal,
    });
  }

  return anchors;
}

function buildThreeDAnchors(
  structure: ThreeDStructureMode,
  count: number,
  distributionCurve: number,
) {
  if (structure === "torus") {
    return createTorusAnchors(count, distributionCurve);
  }

  if (structure === "attractor") {
    return createAttractorAnchors(count, distributionCurve);
  }

  return createSphereAnchors(count, distributionCurve);
}

function projectThreeDPoint(
  point: Point3D,
  innerRect: RenderRect,
  focalLength: number,
  cameraDistance: number,
  pan: Point,
) {
  const depth = cameraDistance + point.z;
  const safeDepth = Math.max(depth, focalLength * 0.12);
  const scale = focalLength / safeDepth;

  return {
    point: {
      x: innerRect.x + innerRect.width / 2 + pan.x + point.x * scale,
      y: innerRect.y + innerRect.height / 2 + pan.y + point.y * scale,
    },
    depth: safeDepth,
    scale,
  };
}

function generateThreeD(context: GeneratorContext) {
  const {
    project: { canvas, layout, activeSeed },
  } = context;
  const rng = mulberry32(activeSeed + 2_173 + Math.round(layout.threeDDistribution) * 379);
  const innerRect = {
    x: canvas.inset,
    y: canvas.inset,
    width: canvas.width - canvas.inset * 2,
    height: canvas.height - canvas.inset * 2,
  };
  const minDimension = Math.min(innerRect.width, innerRect.height);
  const count = Math.max(12, Math.round(10 + layout.density * 24));
  const distributionCurve = getThreeDDistributionCurve(layout.threeDDistribution);
  const worldRadius = minDimension * lerp(0.18, 0.56, layout.threeDDepth);
  const cameraDistance = worldRadius * lerp(2.2, 7.2, layout.threeDCameraDistance);
  const focalLength = minDimension * lerp(0.42, 1.45, layout.threeDPerspective);
  const pan = {
    x: innerRect.width * layout.threeDPanX * 0.42,
    y: innerRect.height * layout.threeDPanY * 0.42,
  };
  const anchors = buildThreeDAnchors(layout.threeDStructure, count, distributionCurve);
  const yawRadians = degToRad(layout.threeDYaw);
  const pitchRadians = degToRad(layout.threeDPitch);
  const jitterAmount = worldRadius * layout.threeDZJitter * 0.55;
  const baseCardSize = clamp(minDimension / Math.sqrt(count) * 0.68, 72, minDimension * 0.22);
  const billboard = clamp(layout.threeDBillboard, 0, 1);
  const billboardRight = { x: 1, y: 0, z: 0 };
  const billboardUp = { x: 0, y: 1, z: 0 };
  const cells: LayoutCell[] = [];

  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index]!;
    const jitteredPosition = {
      x: anchor.position.x * worldRadius,
      y: anchor.position.y * worldRadius,
      z: anchor.position.z * worldRadius + (rng.next() - 0.5) * jitterAmount,
    };
    const rotatedPosition = rotatePoint3D(jitteredPosition, yawRadians, pitchRadians);
    const rotatedTangent = normalizePoint3D(
      rotatePoint3D(anchor.tangent, yawRadians, pitchRadians),
    );
    const rotatedNormal = normalizePoint3D(
      rotatePoint3D(anchor.normal, yawRadians, pitchRadians),
    );
    const projected = projectThreeDPoint(
      rotatedPosition,
      innerRect,
      focalLength,
      cameraDistance,
      pan,
    );
    const tangentSample = projectThreeDPoint(
      addPoint3D(rotatedPosition, scalePoint3D(rotatedTangent, baseCardSize * 0.55)),
      innerRect,
      focalLength,
      cameraDistance,
      pan,
    );
    const depthValue = clamp(
      1 - (projected.depth - (cameraDistance - worldRadius)) / (worldRadius * 2.35),
      0,
      1,
    );
    const tangentAngle = Math.atan2(
      tangentSample.point.y - projected.point.y,
      tangentSample.point.x - projected.point.x,
    );
    const normalX = clamp(rotatedNormal.x, -1, 1);
    const normalY = clamp(rotatedNormal.y, -1, 1);
    const cardWidth = baseCardSize * projected.scale * (0.9 + rng.next() * 0.32);
    const cardHeight = baseCardSize * projected.scale * (0.78 + rng.next() * 0.24);
    const orientedUp = normalizePoint3D(crossPoint3D(rotatedNormal, rotatedTangent));
    const cardRight = normalizePoint3D({
      x: lerp(rotatedTangent.x, billboardRight.x, billboard),
      y: lerp(rotatedTangent.y, billboardRight.y, billboard),
      z: lerp(rotatedTangent.z, billboardRight.z, billboard),
    });
    const cardUp = normalizePoint3D({
      x: lerp(orientedUp.x, billboardUp.x, billboard),
      y: lerp(orientedUp.y, billboardUp.y, billboard),
      z: lerp(orientedUp.z, billboardUp.z, billboard),
    });
    const halfWidthWorld = baseCardSize * (0.9 + rng.next() * 0.32) / 2;
    const halfHeightWorld = baseCardSize * (0.78 + rng.next() * 0.24) / 2;
    const projectedCorners = [
      addPoint3D(
        addPoint3D(rotatedPosition, scalePoint3D(cardRight, -halfWidthWorld)),
        scalePoint3D(cardUp, -halfHeightWorld),
      ),
      addPoint3D(
        addPoint3D(rotatedPosition, scalePoint3D(cardRight, halfWidthWorld)),
        scalePoint3D(cardUp, -halfHeightWorld),
      ),
      addPoint3D(
        addPoint3D(rotatedPosition, scalePoint3D(cardRight, halfWidthWorld)),
        scalePoint3D(cardUp, halfHeightWorld),
      ),
      addPoint3D(
        addPoint3D(rotatedPosition, scalePoint3D(cardRight, -halfWidthWorld)),
        scalePoint3D(cardUp, halfHeightWorld),
      ),
    ].map((corner) =>
      projectThreeDPoint(corner, innerRect, focalLength, cameraDistance, pan).point,
    );
    const rect = getBoundsForPoints(projectedCorners);
    const shape = assignShape(index, layout.shapeMode, layout.family);

    cells.push({
      ...rect,
      shape,
      quadPoints: projectedCorners,
      rotation: 0,
      rotationX: 0,
      rotationY: 0,
      depthValue,
    });
  }

  return cells.sort(
    (a, b) =>
      (a.depthValue ?? 0) - (b.depthValue ?? 0),
  );
}

const layoutRegistry: Record<LayoutFamily, (context: GeneratorContext) => LayoutCell[]> = {
  grid: generateGrid,
  strips: generateStrips,
  blocks: generateBlocks,
  radial: generateRadial,
  organic: generateOrganic,
  "3d": generateThreeD,
};

function assetByStrategy(
  strategy: SourceAssignmentStrategy,
  assets: SourceAsset[],
  index: number,
  rng: ReturnType<typeof mulberry32>,
  project: ProjectDocument,
) {
  if (assets.length === 0) {
    throw new Error("No source assets available.");
  }

  if (strategy === "sequential") {
    return assets[index % assets.length]!;
  }

  if (strategy === "luminance") {
    const ordered = [...assets].sort((a, b) =>
      project.sourceMapping.luminanceSort === "ascending"
        ? a.luminance - b.luminance
        : b.luminance - a.luminance,
    );
    return ordered[index % ordered.length]!;
  }

  if (strategy === "palette") {
    const weighted = [...assets].sort(
      (a, b) =>
        b.palette.length * project.sourceMapping.paletteEmphasis - a.palette.length * project.sourceMapping.paletteEmphasis,
    );
    return weighted[index % weighted.length]!;
  }

  if (strategy === "symmetry") {
    return assets[index % Math.max(1, Math.ceil(assets.length / 2))]!;
  }

  if (strategy === "weighted") {
    const weights = assets.map((asset, assetIndex) =>
      clamp(asset.palette.length * project.sourceMapping.sourceBias + (assetIndex + 1), 1, 100),
    );
    const sum = weights.reduce((total, weight) => total + weight, 0);
    let cursor = rng.next() * sum;
    for (let weightIndex = 0; weightIndex < weights.length; weightIndex += 1) {
      cursor -= weights[weightIndex]!;
      if (cursor <= 0) return assets[weightIndex]!;
    }
  }

  return rng.pick(assets);
}

function reflectSlices(slices: RenderSlice[], project: ProjectDocument) {
  const { symmetryMode, symmetryCopies } = project.layout;
  if (symmetryMode === "none") return slices;

  const clones = [...slices];
  const centerX = project.canvas.width / 2;
  const centerY = project.canvas.height / 2;
  const mirrorRect = (rect: RenderRect | null, axis: "x" | "y") => {
    if (!rect) return null;
    return axis === "x"
      ? {
          ...rect,
          x: centerX + (centerX - rect.x - rect.width),
        }
      : {
          ...rect,
          y: centerY + (centerY - rect.y - rect.height),
        };
  };

  for (const slice of slices) {
    if (symmetryMode === "mirror-x" || symmetryMode === "quad") {
      const mirroredRect = {
        ...slice.rect,
        x: centerX + (centerX - slice.rect.x - slice.rect.width),
      };
      const sliceCenter = getRectCenter(slice.rect);
      const mirroredCenter = getRectCenter(mirroredRect);
      clones.push({
        ...slice,
        id: `${slice.id}_mx`,
        rect: mirroredRect,
        clipRect: mirrorRect(slice.clipRect, "x"),
        clipPathPoints: slice.clipPathPoints
          ? translatePoints(
              slice.clipPathPoints,
              mirroredCenter.x - sliceCenter.x,
              mirroredCenter.y - sliceCenter.y,
            )
          : null,
        quadPoints: slice.quadPoints
          ? translatePoints(
              slice.quadPoints,
              mirroredCenter.x - sliceCenter.x,
              mirroredCenter.y - sliceCenter.y,
            )
          : null,
        rotationY: -slice.rotationY,
        mirrorAxis: "x",
      });
    }

    if (symmetryMode === "mirror-y" || symmetryMode === "quad") {
      const mirroredRect = {
        ...slice.rect,
        y: centerY + (centerY - slice.rect.y - slice.rect.height),
      };
      const sliceCenter = getRectCenter(slice.rect);
      const mirroredCenter = getRectCenter(mirroredRect);
      clones.push({
        ...slice,
        id: `${slice.id}_my`,
        rect: mirroredRect,
        clipRect: mirrorRect(slice.clipRect, "y"),
        clipPathPoints: slice.clipPathPoints
          ? translatePoints(
              slice.clipPathPoints,
              mirroredCenter.x - sliceCenter.x,
              mirroredCenter.y - sliceCenter.y,
            )
          : null,
        quadPoints: slice.quadPoints
          ? translatePoints(
              slice.quadPoints,
              mirroredCenter.x - sliceCenter.x,
              mirroredCenter.y - sliceCenter.y,
            )
          : null,
        rotationX: -slice.rotationX,
        mirrorAxis: "y",
      });
    }
  }

  if (symmetryMode === "radial") {
    const radialClones: RenderSlice[] = [];
    for (let copyIndex = 1; copyIndex < symmetryCopies; copyIndex += 1) {
      const angle = (Math.PI * 2 * copyIndex) / symmetryCopies;
      for (const slice of slices) {
        const x = slice.rect.x - centerX;
        const y = slice.rect.y - centerY;
        const clipCenter = slice.clipRect ? getRectCenter(slice.clipRect) : null;
        const clipPathPoints = slice.clipPathPoints
          ? rotatePoints(slice.clipPathPoints, angle, {
              x: centerX,
              y: centerY,
            })
          : null;
        const quadPoints = slice.quadPoints
          ? rotatePoints(slice.quadPoints, angle, {
              x: centerX,
              y: centerY,
            })
          : null;
        radialClones.push({
          ...slice,
          id: `${slice.id}_r${copyIndex}`,
          rect: quadPoints
            ? getBoundsForPoints(quadPoints)
            : clipPathPoints
            ? getBoundsForPoints(clipPathPoints)
            : {
                ...slice.rect,
                x: centerX + x * Math.cos(angle) - y * Math.sin(angle),
                y: centerY + x * Math.sin(angle) + y * Math.cos(angle),
              },
          clipRect: slice.clipRect && clipCenter
            ? {
                ...slice.clipRect,
                x:
                  centerX +
                  (clipCenter.x - centerX) * Math.cos(angle) -
                  (clipCenter.y - centerY) * Math.sin(angle) -
                  slice.clipRect.width / 2,
                y:
                  centerY +
                  (clipCenter.x - centerX) * Math.sin(angle) +
                  (clipCenter.y - centerY) * Math.cos(angle) -
                  slice.clipRect.height / 2,
              }
            : null,
          clipPathPoints,
          quadPoints,
          clipRotation: slice.clipRotation + angle,
          rotation: slice.rotation + angle,
          rotationX: slice.rotationX,
          rotationY: slice.rotationY,
        });
      }
    }
    clones.push(...radialClones);
  }

  return clones;
}

function fitCropToAspect(cell: NormalizedRect, aspectRatio: number) {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return cell;
  }

  const cellAspectRatio = cell.width / cell.height;
  if (cellAspectRatio > aspectRatio) {
    const width = cell.height * aspectRatio;
    return {
      x: cell.x + (cell.width - width) / 2,
      y: cell.y,
      width,
      height: cell.height,
    };
  }

  const height = cell.width / aspectRatio;
  return {
    x: cell.x,
    y: cell.y + (cell.height - height) / 2,
    width: cell.width,
    height,
  };
}

function applyCropZoom(crop: NormalizedRect, bounds: NormalizedRect, zoom: number) {
  const safeZoom = Math.max(1, zoom);
  const width = crop.width / safeZoom;
  const height = crop.height / safeZoom;

  return {
    x: clamp(crop.x + (crop.width - width) / 2, bounds.x, bounds.x + bounds.width - width),
    y: clamp(crop.y + (crop.height - height) / 2, bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  };
}

function getAtlasDimensions(
  project: ProjectDocument,
  asset: SourceAsset,
  sliceCount: number,
) {
  const totalGridCells = project.layout.columns * project.layout.rows;
  if (project.layout.family === "grid" && sliceCount === totalGridCells) {
    return {
      columns: project.layout.columns,
      rows: project.layout.rows,
    };
  }

  const columns = Math.max(1, Math.ceil(Math.sqrt(sliceCount * (asset.width / asset.height))));
  return {
    columns,
    rows: Math.max(1, Math.ceil(sliceCount / columns)),
  };
}

function getSliceCenterProjection(slice: RenderSlice, angleRadians: number) {
  const bounds = slice.clipRect ?? slice.rect;
  const center = getRectCenter(bounds);
  return center.x * Math.cos(angleRadians) - center.y * Math.sin(angleRadians);
}

function getStripThickness(slice: RenderSlice) {
  return slice.clipRect?.width ?? Math.min(slice.rect.width, slice.rect.height);
}

function expandStripClipRect(clipRect: RenderRect, amount: number) {
  if (amount <= 0) {
    return clipRect;
  }

  return {
    ...clipRect,
    x: clipRect.x - amount / 2,
    width: clipRect.width + amount,
  };
}

function assignDistributedCrops(
  slices: RenderSlice[],
  project: ProjectDocument,
  assets: SourceAsset[],
) {
  if (project.sourceMapping.cropDistribution !== "distributed") {
    return slices.map((slice) => ({ ...slice, sourceCrop: null }));
  }

  if (project.layout.family === "strips") {
    const angleRadians = (project.layout.stripAngle * Math.PI) / 180;
    const orderedSlices = [...slices].sort((a, b) =>
      getSliceCenterProjection(a, angleRadians) -
      getSliceCenterProjection(b, angleRadians),
    );
    const totalSpan = Math.max(
      orderedSlices.reduce((sum, slice) => sum + getStripThickness(slice), 0),
      1,
    );
    const cropBySliceId = new Map<string, NormalizedRect>();
    let cursor = 0;

    for (const slice of orderedSlices) {
      const span = getStripThickness(slice) / totalSpan;
      const atlasCell: NormalizedRect =
        Math.abs(Math.sin(angleRadians)) > Math.abs(Math.cos(angleRadians))
          ? { x: 0, y: cursor, width: 1, height: span }
          : { x: cursor, y: 0, width: span, height: 1 };
      const baseCrop = project.sourceMapping.preserveAspect
        ? fitCropToAspect(atlasCell, slice.rect.width / slice.rect.height)
        : atlasCell;

      cropBySliceId.set(
        slice.id,
        applyCropZoom(baseCrop, atlasCell, project.sourceMapping.cropZoom),
      );
      cursor += span;
    }

    return slices.map((slice) => ({
      ...slice,
      sourceCrop: cropBySliceId.get(slice.id) ?? null,
    }));
  }

  const slicesByAsset = new Map<string, RenderSlice[]>();
  for (const slice of slices) {
    const assetSlices = slicesByAsset.get(slice.assetId);
    if (assetSlices) {
      assetSlices.push(slice);
    } else {
      slicesByAsset.set(slice.assetId, [slice]);
    }
  }

  const cropBySliceId = new Map<string, NormalizedRect>();
  for (const asset of assets) {
    const assetSlices = slicesByAsset.get(asset.id);
    if (!assetSlices || assetSlices.length === 0) continue;

    const atlas = getAtlasDimensions(project, asset, assetSlices.length);
    for (let index = 0; index < assetSlices.length; index += 1) {
      const slice = assetSlices[index]!;
      const column = index % atlas.columns;
      const row = Math.floor(index / atlas.columns);
      const atlasCell: NormalizedRect = {
        x: column / atlas.columns,
        y: row / atlas.rows,
        width: 1 / atlas.columns,
        height: 1 / atlas.rows,
      };
      const baseCrop = project.sourceMapping.preserveAspect
        ? fitCropToAspect(atlasCell, slice.rect.width / slice.rect.height)
        : atlasCell;
      cropBySliceId.set(
        slice.id,
        applyCropZoom(baseCrop, atlasCell, project.sourceMapping.cropZoom),
      );
    }
  }

  return slices.map((slice) => ({
    ...slice,
    sourceCrop: cropBySliceId.get(slice.id) ?? null,
  }));
}

function alignDistributedStripSlicesToCanvas(
  slices: RenderSlice[],
  project: ProjectDocument,
) {
  if (
    project.layout.family !== "strips" ||
    project.sourceMapping.cropDistribution !== "distributed"
  ) {
    return slices;
  }

  const imageRect: RenderRect = {
    x: project.canvas.inset,
    y: project.canvas.inset,
    width: project.canvas.width - project.canvas.inset * 2,
    height: project.canvas.height - project.canvas.inset * 2,
  };

  return slices.map((slice) => ({
    ...slice,
    sourceCrop: null,
    imageRect,
  }));
}

function hideRandomSlices(slices: RenderSlice[], project: ProjectDocument) {
  const hideCount = Math.round(
    slices.length * clamp(project.layout.hidePercentage, 0, 1),
  );

  if (hideCount <= 0) return slices;
  if (hideCount >= slices.length) return [];

  const rng = mulberry32(project.activeSeed + 9_941);
  const hiddenSliceIds = new Set(
    [...slices]
      .map((slice) => ({
        id: slice.id,
        weight: rng.next(),
      }))
      .sort((a, b) => a.weight - b.weight)
      .slice(0, hideCount)
      .map((slice) => slice.id),
  );

  return slices.filter((slice) => !hiddenSliceIds.has(slice.id));
}

function applyLetterbox(slices: RenderSlice[], project: ProjectDocument) {
  const amount = clamp(project.layout.letterbox, 0, 1);
  if (amount <= 0) return slices;

  const scale = lerp(1, 0.02, amount);
  const canvasCenterX = project.canvas.width / 2;
  const canvasCenterY = project.canvas.height / 2;
  const scaleRectAroundCanvasCenter = (rect: RenderRect | null) => {
    if (!rect) return null;

    const rectCenterX = rect.x + rect.width / 2;
    const rectCenterY = rect.y + rect.height / 2;
    const nextWidth = rect.width * scale;
    const nextHeight = rect.height * scale;
    const nextCenterX = canvasCenterX + (rectCenterX - canvasCenterX) * scale;
    const nextCenterY = canvasCenterY + (rectCenterY - canvasCenterY) * scale;

    return {
      x: nextCenterX - nextWidth / 2,
      y: nextCenterY - nextHeight / 2,
      width: nextWidth,
      height: nextHeight,
    };
  };

  return slices.map((slice) => {
    const clipRect = scaleRectAroundCanvasCenter(slice.clipRect);
    const imageRect = scaleRectAroundCanvasCenter(slice.imageRect);
    const clipPathPoints = slice.clipPathPoints?.map((point) => ({
      x: canvasCenterX + (point.x - canvasCenterX) * scale,
      y: canvasCenterY + (point.y - canvasCenterY) * scale,
    })) ?? null;
    const quadPoints = slice.quadPoints?.map((point) => ({
      x: canvasCenterX + (point.x - canvasCenterX) * scale,
      y: canvasCenterY + (point.y - canvasCenterY) * scale,
    })) ?? null;
    const rect =
      quadPoints
        ? getBoundsForPoints(quadPoints)
        : clipPathPoints
        ? getBoundsForPoints(clipPathPoints)
        : clipRect
        ? getRotatedBounds(clipRect, slice.clipRotation)
        : scaleRectAroundCanvasCenter(slice.rect) ?? slice.rect;

    return {
      ...slice,
      rect,
      clipRect,
      clipPathPoints,
      quadPoints,
      imageRect,
    };
  });
}

function getWedgeSweepRadians(
  shape: ConcreteGeometryShape,
  project: ProjectDocument,
  rng: ReturnType<typeof mulberry32>,
) {
  if (shape !== "wedge") return null;

  const sweepDegrees = clamp(
    project.layout.wedgeAngle + rng.next() * project.layout.wedgeJitter,
    MIN_WEDGE_SWEEP_DEGREES,
    360,
  );

  return (sweepDegrees * Math.PI) / 180;
}

export function buildRenderSlices(project: ProjectDocument, assets: SourceAsset[]) {
  if (assets.length === 0) {
    return [];
  }

  const layoutCells = layoutRegistry[project.layout.family]({ project, assets });
  const rng = mulberry32(project.activeSeed);
  const overlapSize = Math.min(project.canvas.width, project.canvas.height) * project.compositing.overlap * 0.08;

  const slices = layoutCells.map<RenderSlice>((cell, index) => {
    const asset = assetByStrategy(
      project.sourceMapping.strategy,
      assets,
      index,
      rng,
      project,
    );
    const baseClipRect = cell.clipRect ?? null;
    const clipPathPoints =
      cell.clipPathPoints && cell.clipPathPoints.length > 2
        ? scalePointsFromCenter(
            cell.clipPathPoints,
            {
              x: cell.x + cell.width / 2,
              y: cell.y + cell.height / 2,
            },
            1 + overlapSize / Math.max(cell.width, cell.height, 1),
          )
        : null;
    const quadPoints =
      cell.quadPoints && cell.quadPoints.length === 4
        ? scalePointsFromCenter(
            cell.quadPoints,
            {
              x: cell.x + cell.width / 2,
              y: cell.y + cell.height / 2,
            },
            1 + overlapSize / Math.max(cell.width, cell.height, 1),
          )
        : null;
    const clipRect =
      project.layout.family === "strips" && baseClipRect
        ? expandStripClipRect(baseClipRect, overlapSize)
        : baseClipRect;
    const rect =
      quadPoints
        ? getBoundsForPoints(quadPoints)
        : clipPathPoints
        ? getBoundsForPoints(clipPathPoints)
        : clipRect && project.layout.family === "strips"
        ? getRotatedBounds(clipRect, cell.clipRotation ?? 0)
        : {
            x: cell.x - overlapSize * rng.next(),
            y: cell.y - overlapSize * rng.next(),
            width: cell.width + overlapSize,
            height: cell.height + overlapSize,
          };
    const rotationNoise = (rng.next() - 0.5) * project.effects.rotationJitter;
    const scaleNoise = 1 + (rng.next() - 0.5) * project.effects.scaleJitter;
    const displacement = project.effects.displacement * (rng.next() - 0.5);
    const fogAmount =
      project.layout.family === "3d" && cell.depthValue !== undefined
        ? lerp(0, 0.22, (1 - cell.depthValue) ** 1.35)
        : 0;

    return {
      id: `slice_${index}`,
      shape: cell.shape,
      assetId: asset.id,
      rect,
      clipRect,
      clipPathPoints,
      quadPoints,
      clipRotation: cell.clipRotation ?? 0,
      imageRect: null,
      rotation: (cell.rotation ?? 0) + (rotationNoise * Math.PI) / 180,
      rotationX: cell.rotationX ?? 0,
      rotationY: cell.rotationY ?? 0,
      scale: scaleNoise,
      opacity:
        project.layout.family === "3d" && cell.depthValue !== undefined
          ? project.compositing.opacity *
            lerp(0.72, 1, cell.depthValue)
          : project.compositing.opacity,
      blendMode: project.compositing.blendMode,
      clipInset: project.compositing.feather,
      displacementOffset: { x: displacement, y: displacement * (rng.next() - 0.5) },
      distortion: project.effects.distortion * rng.next(),
      sourceCrop: null,
      wedgeSweepRadians: getWedgeSweepRadians(cell.shape, project, rng),
      mirrorAxis: "none",
      depth: cell.depthValue ?? rng.next(),
      fogAmount,
    };
  });

  return hideRandomSlices(
    applyLetterbox(
      alignDistributedStripSlicesToCanvas(
        assignDistributedCrops(reflectSlices(slices, project), project, assets),
        project,
      ).sort(
        (a, b) => a.depth - b.depth,
      ),
      project,
    ),
    project,
  );
}
