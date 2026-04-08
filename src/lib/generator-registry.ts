import type {
  GeometryShape,
  LayoutFamily,
  NormalizedRect,
  ProjectDocument,
  RenderRect,
  RenderSlice,
  SourceAsset,
  SourceAssignmentStrategy,
} from "@/types/project";
import { mulberry32 } from "@/lib/rng";
import { clamp, lerp } from "@/lib/utils";

interface GeneratorContext {
  project: ProjectDocument;
  assets: SourceAsset[];
}

type ConcreteGeometryShape = Exclude<GeometryShape, "mixed">;
type MixedCycleShape = Exclude<GeometryShape, "mixed" | "interlock">;

interface LayoutCell extends RenderRect {
  shape: ConcreteGeometryShape;
  clipRect?: RenderRect;
  clipRotation?: number;
  rotation?: number;
}

interface Point {
  x: number;
  y: number;
}

const MIN_WEDGE_SWEEP_DEGREES = 0.5;
const MAX_BLOCK_SPLIT_OFFSET = 0.18;

function degToRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function assignShape(index: number, shapeMode: GeometryShape) {
  if (shapeMode === "interlock") return "triangle";
  if (shapeMode !== "mixed") return shapeMode;
  const cycle: MixedCycleShape[] = ["rect", "triangle", "ring", "wedge"];
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
        shape: assignShape(row * layout.columns + column, layout.shapeMode),
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
      shape: assignShape(index, layout.shapeMode),
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
      shape: assignShape(cells.length, shapeMode),
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
        shape: assignShape(segment + ring, layout.shapeMode),
        rotation,
      });
    }
  }

  return cells;
}

const layoutRegistry: Record<LayoutFamily, (context: GeneratorContext) => LayoutCell[]> = {
  grid: generateGrid,
  strips: generateStrips,
  blocks: generateBlocks,
  radial: generateRadial,
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
      clones.push({
        ...slice,
        id: `${slice.id}_mx`,
        rect: {
          ...slice.rect,
          x: centerX + (centerX - slice.rect.x - slice.rect.width),
        },
        clipRect: mirrorRect(slice.clipRect, "x"),
        mirrorAxis: "x",
      });
    }

    if (symmetryMode === "mirror-y" || symmetryMode === "quad") {
      clones.push({
        ...slice,
        id: `${slice.id}_my`,
        rect: {
          ...slice.rect,
          y: centerY + (centerY - slice.rect.y - slice.rect.height),
        },
        clipRect: mirrorRect(slice.clipRect, "y"),
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
        radialClones.push({
          ...slice,
          id: `${slice.id}_r${copyIndex}`,
          rect: {
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
          clipRotation: slice.clipRotation + angle,
          rotation: slice.rotation + angle,
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
    const rect =
      clipRect
        ? getRotatedBounds(clipRect, slice.clipRotation)
        : scaleRectAroundCanvasCenter(slice.rect) ?? slice.rect;

    return {
      ...slice,
      rect,
      clipRect,
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
    const clipRect =
      project.layout.family === "strips" && baseClipRect
        ? expandStripClipRect(baseClipRect, overlapSize)
        : baseClipRect;
    const rect =
      clipRect && project.layout.family === "strips"
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

    return {
      id: `slice_${index}`,
      shape: cell.shape,
      assetId: asset.id,
      rect,
      clipRect,
      clipRotation: cell.clipRotation ?? 0,
      imageRect: null,
      rotation: (cell.rotation ?? 0) + (rotationNoise * Math.PI) / 180,
      scale: scaleNoise,
      opacity: project.compositing.opacity,
      blendMode: project.compositing.blendMode,
      clipInset: project.compositing.feather,
      displacementOffset: { x: displacement, y: displacement * (rng.next() - 0.5) },
      distortion: project.effects.distortion * rng.next(),
      sourceCrop: null,
      wedgeSweepRadians: getWedgeSweepRadians(cell.shape, project, rng),
      mirrorAxis: "none",
      depth: rng.next(),
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
