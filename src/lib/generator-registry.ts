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

interface LayoutCell extends RenderRect {
  shape: Exclude<GeometryShape, "mixed">;
}

const MIN_WEDGE_SWEEP_DEGREES = 0.5;

function assignShape(index: number, shapeMode: GeometryShape) {
  if (shapeMode !== "mixed") return shapeMode;
  const cycle: Exclude<GeometryShape, "mixed">[] = ["rect", "triangle", "ring", "wedge"];
  return cycle[index % cycle.length]!;
}

function insetRect(rect: RenderRect, amount: number): RenderRect {
  return {
    x: rect.x + amount,
    y: rect.y + amount,
    width: Math.max(1, rect.width - amount * 2),
    height: Math.max(1, rect.height - amount * 2),
  };
}

function generateGrid(context: GeneratorContext) {
  const {
    project: { canvas, layout, compositing },
  } = context;
  const cells: LayoutCell[] = [];
  const innerWidth = canvas.width - canvas.inset * 2;
  const innerHeight = canvas.height - canvas.inset * 2;
  const columnWidth = innerWidth / layout.columns;
  const rowHeight = innerHeight / layout.rows;

  for (let row = 0; row < layout.rows; row += 1) {
    for (let column = 0; column < layout.columns; column += 1) {
      const rect = {
        x: canvas.inset + column * columnWidth,
        y: canvas.inset + row * rowHeight,
        width: columnWidth,
        height: rowHeight,
      };
      cells.push({
        ...insetRect(rect, layout.gutter * (1 - compositing.overlap)),
        shape: assignShape(row * layout.columns + column, layout.shapeMode),
      });
    }
  }

  return cells;
}

function generateStrips(context: GeneratorContext) {
  const {
    project: { canvas, layout, compositing },
  } = context;
  const rng = mulberry32(context.project.activeSeed + 17);
  const count = Math.max(4, Math.round(4 + layout.density * 16));
  const isHorizontal =
    layout.stripOrientation === "mixed"
      ? rng.next() > 0.5
      : layout.stripOrientation === "horizontal";
  const cells: LayoutCell[] = [];

  let cursor = canvas.inset;
  const length = isHorizontal ? canvas.height - canvas.inset * 2 : canvas.width - canvas.inset * 2;

  for (let index = 0; index < count; index += 1) {
    const remaining = count - index;
    const size = remaining === 1 ? length - cursor + canvas.inset : length / count + rng.next() * layout.randomness * 40;
    const rect = isHorizontal
      ? { x: canvas.inset, y: cursor, width: canvas.width - canvas.inset * 2, height: size }
      : { x: cursor, y: canvas.inset, width: size, height: canvas.height - canvas.inset * 2 };
    cells.push({
      ...insetRect(rect, layout.gutter * (1 - compositing.overlap)),
      shape: assignShape(index, layout.shapeMode),
    });
    cursor += size;
  }

  return cells;
}

function subdivide(rect: RenderRect, depth: number, rng: ReturnType<typeof mulberry32>, cells: LayoutCell[], shapeMode: GeometryShape, overlap: number) {
  if (depth === 0 || rect.width < 140 || rect.height < 140) {
    cells.push({
      ...insetRect(rect, 6 * (1 - overlap)),
      shape: assignShape(cells.length, shapeMode),
    });
    return;
  }

  const splitVertical = rect.width > rect.height ? true : rng.next() > 0.5;
  const split = lerp(0.32, 0.68, rng.next());

  if (splitVertical) {
    const widthA = rect.width * split;
    subdivide({ x: rect.x, y: rect.y, width: widthA, height: rect.height }, depth - 1, rng, cells, shapeMode, overlap);
    subdivide(
      { x: rect.x + widthA, y: rect.y, width: rect.width - widthA, height: rect.height },
      depth - 1,
      rng,
      cells,
      shapeMode,
      overlap,
    );
  } else {
    const heightA = rect.height * split;
    subdivide({ x: rect.x, y: rect.y, width: rect.width, height: heightA }, depth - 1, rng, cells, shapeMode, overlap);
    subdivide(
      { x: rect.x, y: rect.y + heightA, width: rect.width, height: rect.height - heightA },
      depth - 1,
      rng,
      cells,
      shapeMode,
      overlap,
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
  );
  return cells;
}

function generateRadial(context: GeneratorContext) {
  const {
    project: { canvas, layout },
  } = context;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(canvas.width, canvas.height) / 2 - canvas.inset;
  const cells: LayoutCell[] = [];

  for (let ring = 0; ring < layout.radialRings; ring += 1) {
    const ringOuter = radius * ((ring + 1) / layout.radialRings);
    const ringInner = radius * (ring / layout.radialRings);
    for (let segment = 0; segment < layout.radialSegments; segment += 1) {
      const angle = (Math.PI * 2 * segment) / layout.radialSegments;
      const nextAngle = (Math.PI * 2 * (segment + 1)) / layout.radialSegments;
      const x = centerX + Math.cos(angle) * ringInner;
      const y = centerY + Math.sin(angle) * ringInner;
      const x2 = centerX + Math.cos(nextAngle) * ringOuter;
      const y2 = centerY + Math.sin(nextAngle) * ringOuter;
      cells.push({
        x: Math.min(x, x2),
        y: Math.min(y, y2),
        width: Math.max(64, Math.abs(x2 - x)),
        height: Math.max(64, Math.abs(y2 - y)),
        shape: assignShape(segment + ring, layout.shapeMode === "mixed" ? "wedge" : layout.shapeMode),
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

  for (const slice of slices) {
    if (symmetryMode === "mirror-x" || symmetryMode === "quad") {
      clones.push({
        ...slice,
        id: `${slice.id}_mx`,
        rect: {
          ...slice.rect,
          x: centerX + (centerX - slice.rect.x - slice.rect.width),
        },
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
        radialClones.push({
          ...slice,
          id: `${slice.id}_r${copyIndex}`,
          rect: {
            ...slice.rect,
            x: centerX + x * Math.cos(angle) - y * Math.sin(angle),
            y: centerY + x * Math.sin(angle) + y * Math.cos(angle),
          },
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

function assignDistributedCrops(
  slices: RenderSlice[],
  project: ProjectDocument,
  assets: SourceAsset[],
) {
  if (project.sourceMapping.cropDistribution !== "distributed") {
    return slices.map((slice) => ({ ...slice, sourceCrop: null }));
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

  return slices.map((slice) => {
    const sliceCenterX = slice.rect.x + slice.rect.width / 2;
    const sliceCenterY = slice.rect.y + slice.rect.height / 2;
    const nextWidth = slice.rect.width * scale;
    const nextHeight = slice.rect.height * scale;
    const nextCenterX = canvasCenterX + (sliceCenterX - canvasCenterX) * scale;
    const nextCenterY = canvasCenterY + (sliceCenterY - canvasCenterY) * scale;

    return {
      ...slice,
      rect: {
        x: nextCenterX - nextWidth / 2,
        y: nextCenterY - nextHeight / 2,
        width: nextWidth,
        height: nextHeight,
      },
    };
  });
}

function getWedgeSweepRadians(
  shape: Exclude<GeometryShape, "mixed">,
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
    const rotationNoise = (rng.next() - 0.5) * project.effects.rotationJitter;
    const scaleNoise = 1 + (rng.next() - 0.5) * project.effects.scaleJitter;
    const displacement = project.effects.displacement * (rng.next() - 0.5);

    return {
      id: `slice_${index}`,
      shape: cell.shape,
      assetId: asset.id,
      rect: {
        x: cell.x - overlapSize * rng.next(),
        y: cell.y - overlapSize * rng.next(),
        width: cell.width + overlapSize,
        height: cell.height + overlapSize,
      },
      rotation: (rotationNoise * Math.PI) / 180,
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
      assignDistributedCrops(reflectSlices(slices, project), project, assets).sort(
        (a, b) => a.depth - b.depth,
      ),
      project,
    ),
    project,
  );
}
