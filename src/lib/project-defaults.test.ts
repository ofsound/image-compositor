import { describe, expect, it } from "vitest";

import {
  createProjectDocument,
  normalizeProjectDocument,
  serializeProjectDocument,
  normalizeProjectVersion,
  getSelectedLayer,
} from "@/lib/project-defaults";
import { createProjectEditorView } from "@/lib/project-editor-view";
import type { ProjectDocument, ProjectVersion } from "@/types/project";

function createProjectView(title: string) {
  return createProjectEditorView(createProjectDocument(title));
}

function normalizeProjectView(project: Parameters<typeof normalizeProjectDocument>[0]) {
  return createProjectEditorView(normalizeProjectDocument(project));
}

function getSnapshotLayer(snapshot: ProjectVersion["snapshot"]) {
  const layer = getSelectedLayer(snapshot);
  if (!layer) {
    throw new Error("Expected a selected layer.");
  }
  return layer;
}

describe("createProjectDocument", () => {
  it("creates a fully-populated local-first project document", () => {
    const project = createProjectView("Study");

    expect(project.title).toBe("Study");
    expect(project.id.startsWith("project_")).toBe(true);
    expect(project.deletedAt).toBeNull();
    expect(project.canvas.inset).toBe(0);
    expect(project.sourceIds).toEqual([]);
    expect(project.sourceMapping.cropDistribution).toBe("distributed");
    expect(project.sourceMapping.sourceWeights).toEqual({});
    expect(project.layout.gridAngle).toBe(0);
    expect(project.layout.blockDepth).toBe(3);
    expect(project.layout.blockSplitRandomness).toBe(0.5);
    expect(project.layout.blockMinSize).toBe(140);
    expect(project.layout.blockSplitBias).toBe(0.5);
    expect(project.layout.gutterHorizontal).toBe(14);
    expect(project.layout.gutterVertical).toBe(14);
    expect(project.layout.radialAngleOffset).toBe(0);
    expect(project.layout.radialRingPhaseStep).toBe(0);
    expect(project.layout.radialInnerRadius).toBe(0);
    expect(project.layout.radialChildRotationMode).toBe("tangent");
    expect(project.layout.symmetryCenterX).toBe(0.5);
    expect(project.layout.symmetryCenterY).toBe(0.5);
    expect(project.layout.symmetryAngleOffset).toBe(0);
    expect(project.layout.symmetryJitter).toBe(0);
    expect(project.layout.organicVariation).toBe(0);
    expect(project.layout.hollowRatio).toBe(0.48);
    expect(project.layout.flowCurvature).toBe(0.44);
    expect(project.layout.flowCoherence).toBe(0.72);
    expect(project.layout.flowBranchRate).toBe(0.2);
    expect(project.layout.flowTaper).toBe(0.34);
    expect(project.layout.threeDStructure).toBe("sphere");
    expect(project.layout.threeDDistribution).toBe(0);
    expect(project.layout.threeDDepth).toBe(0.6);
    expect(project.layout.threeDCameraDistance).toBe(0.62);
    expect(project.layout.threeDPanX).toBe(0);
    expect(project.layout.threeDPanY).toBe(0);
    expect(project.layout.threeDYaw).toBe(28);
    expect(project.layout.threeDPitch).toBe(-18);
    expect(project.layout.threeDPerspective).toBe(0.68);
    expect(project.layout.threeDBillboard).toBe(0.78);
    expect(project.layout.threeDZJitter).toBe(0.18);
    expect(project.layout.fractalVariant).toBe("sierpinski-triangle");
    expect(project.layout.fractalIterations).toBe(4);
    expect(project.layout.fractalSpacing).toBe(0.04);
    expect(project.layout.fractalTrianglePull).toBe(1);
    expect(project.layout.fractalTriangleRotation).toBe(0);
    expect(project.layout.fractalCarpetHoleScale).toBe(0.33);
    expect(project.layout.fractalCarpetOffset).toBe(0);
    expect(project.layout.fractalVicsekArmScale).toBe(0.33);
    expect(project.layout.fractalVicsekCenterScale).toBe(0.33);
    expect(project.layout.fractalHTreeRatio).toBe(0.5);
    expect(project.layout.fractalHTreeThickness).toBe(0.18);
    expect(project.layout.fractalRosettePetals).toBe(6);
    expect(project.layout.fractalRosetteTwist).toBe(18);
    expect(project.layout.fractalRosetteInnerRadius).toBe(0.22);
    expect(project.layout.fractalBinaryAngle).toBe(32);
    expect(project.layout.fractalBinaryDecay).toBe(0.72);
    expect(project.layout.fractalBinaryThickness).toBe(0.16);
    expect(project.layout.fractalPythagorasAngle).toBe(42);
    expect(project.layout.fractalPythagorasScale).toBe(0.7);
    expect(project.layout.fractalPythagorasLean).toBe(0);
    expect(project.layout.curveVariant).toBe("lissajous");
    expect(project.layout.curveSamples).toBe(240);
    expect(project.layout.curveCellSize).toBe(0.045);
    expect(project.layout.curveScaleX).toBe(0.92);
    expect(project.layout.curveScaleY).toBe(0.92);
    expect(project.layout.curveRotation).toBe(0);
    expect(project.layout.curveAlignToTangent).toBe(true);
    expect(project.layout.curveFrequencyX).toBe(3);
    expect(project.layout.curveFrequencyY).toBe(2);
    expect(project.layout.curvePhase).toBe(90);
    expect(project.layout.curveLoops).toBe(1);
    expect(project.layout.curveGearRatio).toBe(0.35);
    expect(project.layout.curvePenOffset).toBe(1);
    expect(project.layout.curveDamping).toBe(0.08);
    expect(project.layout.curveSuperformulaM).toBe(6);
    expect(project.layout.curveSuperformulaN1).toBe(0.35);
    expect(project.layout.curveSuperformulaN2).toBe(1.7);
    expect(project.layout.curveSuperformulaN3).toBe(1.7);
    expect(project.layout.curvePhyllotaxisAngle).toBe(137.5);
    expect(project.layout.curvePhyllotaxisGrowth).toBe(0.9);
    expect(project.layout.curveAttractorType).toBe("lorenz");
    expect(project.layout.curveAttractorStep).toBe(0.006);
    expect(project.layout.curveAttractorScale).toBe(0.72);
    expect(project.layout.curveAttractorYaw).toBe(32);
    expect(project.layout.curveAttractorPitch).toBe(-18);
    expect(project.layout.curveAttractorCameraDistance).toBe(2.8);
    expect(project.effects.kaleidoscopeCenterX).toBe(0.5);
    expect(project.effects.kaleidoscopeCenterY).toBe(0.5);
    expect(project.effects.kaleidoscopeAngleOffset).toBe(0);
    expect(project.effects.kaleidoscopeMirrorMode).toBe("alternate");
    expect(project.effects.kaleidoscopeRotationDrift).toBe(0);
    expect(project.effects.kaleidoscopeScaleFalloff).toBe(0);
    expect(project.effects.kaleidoscopeOpacity).toBe(0.2);
    expect(Object.keys(project.effects.elementModulations)).toEqual([
      "rotation",
      "scale",
      "displacementX",
      "displacementY",
      "opacity",
      "distortion",
      "wedgeSweep",
      "threeDZ",
      "threeDTwist",
      "symmetryDrift",
    ]);
    expect(project.effects.elementModulations.rotation).toEqual({
      enabled: false,
      pattern: "sine",
      amount: 0,
      frequency: 1,
      phase: 0,
      originX: 0.5,
      originY: 0.5,
      axisAngle: 0,
    });
    expect(project.finish.shadowOffsetX).toBe(0);
    expect(project.finish.shadowOffsetY).toBe(0);
    expect(project.finish.shadowBlur).toBe(0);
    expect(project.finish.shadowOpacity).toBe(0);
    expect(project.finish.shadowColor).toBe("#180f08");
    expect(project.finish.layer3DEnabled).toBe(false);
    expect(project.finish.layer3DRotateX).toBe(0);
    expect(project.finish.layer3DRotateY).toBe(0);
    expect(project.finish.layer3DRotateZ).toBe(0);
    expect(project.finish.layer3DPanX).toBe(0);
    expect(project.finish.layer3DPanY).toBe(0);
    expect(project.finish.layer3DScale).toBe(1);
    expect(project.finish.layer3DPivotX).toBe(0.5);
    expect(project.finish.layer3DPivotY).toBe(0.5);
    expect(project.finish.layer3DPerspective).toBe(0.68);
    expect(project.finish.layer3DCameraDistance).toBe(0.62);
    expect(project.finish.layer3DDepth).toBe(0);
    expect(project.finish.brightness).toBe(1);
    expect(project.finish.contrast).toBe(1);
    expect(project.finish.saturate).toBe(1);
    expect(project.finish.hueRotate).toBe(0);
    expect(project.finish.grayscale).toBe(0);
    expect(project.finish.invert).toBe(0);
    expect(project.finish.noise).toBe(0);
    expect(project.finish.noiseMonochrome).toBe(0);
    expect(project.draw.brushSize).toBe(160);
    expect(project.draw.strokes).toEqual([]);
    expect(project.words.mode).toBe("image-fill");
    expect(project.words.fontFamily).toBe("dm-sans");
    expect(project.words.text).toBe("TYPE\nHERE");
    expect(project.words.textColor).toBe("#180f08");
    expect(project.svgGeometry.markup).toBeNull();
    expect(project.svgGeometry.fileName).toBeNull();
    expect(project.svgGeometry.fit).toBe("contain");
    expect(project.svgGeometry.padding).toBe(0);
    expect(project.svgGeometry.threshold).toBe(0.05);
    expect(project.svgGeometry.invert).toBe(false);
    expect(project.svgGeometry.morphology).toBe(0);
    expect(project.svgGeometry.repeatEnabled).toBe(false);
    expect(project.svgGeometry.repeatScale).toBe(0.45);
    expect(project.svgGeometry.repeatGap).toBe(0.08);
    expect(project.svgGeometry.randomRotation).toBe(0);
    expect(project.svgGeometry.mirrorMode).toBe("none");
    expect(project.passes.map((pass) => pass.type)).toEqual([
      "layout",
      "assignment",
      "transform",
      "compose",
      "export",
    ]);
  });

  it("normalizes legacy projects without crop distribution to centered mode", () => {
    const project = createProjectView("Legacy");
    const legacyProject = {
      ...project,
      sourceMapping: {
        strategy: project.sourceMapping.strategy,
        preserveAspect: project.sourceMapping.preserveAspect,
        cropZoom: project.sourceMapping.cropZoom,
        luminanceSort: project.sourceMapping.luminanceSort,
        paletteEmphasis: project.sourceMapping.paletteEmphasis,
      },
    } as unknown as ProjectDocument;

    expect(normalizeProjectView(legacyProject).sourceMapping.cropDistribution).toBe("center");
  });

  it("maps legacy assignment strategies to the consolidated set", () => {
    const project = createProjectView("Legacy Strategies");
    const legacyStrategies = {
      weighted: "random",
      sequential: "round-robin",
      luminance: "tone-map",
      palette: "contrast",
      symmetry: "anti-repeat",
    } as const;

    for (const [legacyStrategy, nextStrategy] of Object.entries(legacyStrategies)) {
      const legacyProject = {
        ...project,
        sourceMapping: {
          ...project.sourceMapping,
          strategy: legacyStrategy,
          sourceBias: 0.5,
        },
      } as unknown as ProjectDocument;

      expect(normalizeProjectView(legacyProject).sourceMapping.strategy).toBe(nextStrategy);
    }
  });

  it("normalizes draw settings and filters invalid stroke points", () => {
    const project = createProjectDocument("Draw Layer");
    const layer = project.layers[0]!;
    const drawProject = {
      ...serializeProjectDocument(project),
      layers: [
        {
          ...layer,
          layout: {
            ...layer.layout,
            family: "draw",
          },
          draw: {
            brushSize: 0,
            strokes: [
              {
                id: "",
                points: [
                  { x: -24, y: 48 },
                  { x: Number.NaN, y: 12 },
                ],
              },
            ],
          },
        },
      ],
      selectedLayerId: layer.id,
    } as ProjectDocument;

    const normalized = normalizeProjectDocument(drawProject);
    const normalizedLayer = normalized.layers[0]!;

    expect(normalizedLayer.layout.family).toBe("draw");
    expect(normalizedLayer.draw.brushSize).toBe(8);
    expect(normalizedLayer.draw.strokes).toHaveLength(1);
    expect(normalizedLayer.draw.strokes[0]?.id.startsWith("stroke_")).toBe(true);
    expect(normalizedLayer.draw.strokes[0]?.points).toEqual([{ x: -24, y: 48 }]);
  });

  it("normalizes missing words settings to defaults", () => {
    const project = createProjectDocument("Words Defaults");
    const layer = project.layers[0]!;
    const legacyProject = {
      ...serializeProjectDocument(project),
      layers: [
        {
          ...layer,
          words: undefined,
        },
      ],
      selectedLayerId: layer.id,
    } as unknown as ProjectDocument;

    const normalized = normalizeProjectDocument(legacyProject);
    const normalizedLayer = normalized.layers[0]!;

    expect(normalizedLayer.words.mode).toBe("image-fill");
    expect(normalizedLayer.words.fontFamily).toBe("dm-sans");
    expect(normalizedLayer.words.text).toBe("TYPE\nHERE");
    expect(normalizedLayer.words.textColor).toBe("#180f08");
  });

  it("normalizes missing svg geometry settings to defaults", () => {
    const project = createProjectDocument("SVG Geometry Defaults");
    const layer = project.layers[0]!;
    const legacyProject = {
      ...serializeProjectDocument(project),
      layers: [
        {
          ...layer,
          svgGeometry: undefined,
        },
      ],
      selectedLayerId: layer.id,
    } as unknown as ProjectDocument;

    const normalized = normalizeProjectDocument(legacyProject);
    const normalizedLayer = normalized.layers[0]!;

    expect(normalizedLayer.svgGeometry.markup).toBeNull();
    expect(normalizedLayer.svgGeometry.fit).toBe("contain");
    expect(normalizedLayer.svgGeometry.repeatEnabled).toBe(false);
  });

  it("moves legacy root settings into the selected layer and serializes canonically", () => {
    const project = createProjectView("Legacy Canonical");
    const legacyProject = {
      ...project,
      sourceIds: ["asset_legacy"],
      layout: {
        ...project.layout,
        columns: 3,
      },
    } as unknown as ProjectDocument;

    const normalized = normalizeProjectView(legacyProject);
    const serialized = serializeProjectDocument(normalized);

    expect(normalized.layers[0]?.sourceIds).toEqual(["asset_legacy"]);
    expect(normalized.layers[0]?.layout.columns).toBe(3);
    expect("sourceIds" in serialized).toBe(false);
    expect("layout" in serialized).toBe(false);
    expect(serialized.layers[0]?.sourceIds).toEqual(["asset_legacy"]);
    expect(serialized.layers[0]?.layout.columns).toBe(3);
  });

  it("migrates legacy compositing shadow values into the new finish shadow settings", () => {
    const project = createProjectView("Legacy Shadow");
    const legacyProject = {
      ...project,
      finish: undefined,
      compositing: {
        blendMode: project.compositing.blendMode,
        opacity: project.compositing.opacity,
        overlap: project.compositing.overlap,
        feather: project.compositing.feather,
        shadow: 0.12,
      },
    } as unknown as ProjectDocument;

    const normalized = normalizeProjectView(legacyProject);

    expect(normalized.finish.shadowOffsetX).toBe(0);
    expect(normalized.finish.shadowOffsetY).toBe(24);
    expect(normalized.finish.shadowBlur).toBe(36);
    expect(normalized.finish.shadowOpacity).toBeCloseTo(0.27);
    expect(normalized.finish.shadowColor).toBe("#180f08");
  });

  it("normalizes legacy projects without background alpha to transparent", () => {
    const project = createProjectView("Legacy Background");
    const legacyProject = {
      ...project,
      canvas: {
        width: project.canvas.width,
        height: project.canvas.height,
        background: project.canvas.background,
        inset: project.canvas.inset,
      },
    } as unknown as ProjectDocument;

    expect(normalizeProjectDocument(legacyProject).canvas.backgroundAlpha).toBe(0);
  });

  it("normalizes legacy inset values to zero", () => {
    const project = createProjectDocument("Legacy Inset");
    const legacyProject = {
      ...project,
      canvas: {
        ...project.canvas,
        inset: 48,
      },
      layers: project.layers.map((layer) => ({
        ...layer,
        inset: 48,
      })),
    } as ProjectDocument;

    const normalized = normalizeProjectDocument(legacyProject);
    expect(normalized.canvas.inset).toBe(0);
    expect(normalized.layers.every((layer) => layer.inset === 0)).toBe(true);
  });

  it("normalizes legacy projects without letterbox to zero", () => {
    const project = createProjectView("Legacy Letterbox");
    const legacyProject = {
      ...project,
      layout: {
        family: project.layout.family,
        shapeMode: project.layout.shapeMode,
        rectCornerRadius: project.layout.rectCornerRadius,
        density: project.layout.density,
        stripAngle: project.layout.stripAngle,
        columns: project.layout.columns,
        rows: project.layout.rows,
        gutter: project.layout.gutter,
        blockDepth: project.layout.blockDepth,
        blockSplitRandomness: project.layout.blockSplitRandomness,
        blockMinSize: project.layout.blockMinSize,
        blockSplitBias: project.layout.blockSplitBias,
        stripOrientation: project.layout.stripOrientation,
        radialSegments: project.layout.radialSegments,
        radialRings: project.layout.radialRings,
        symmetryMode: project.layout.symmetryMode,
        symmetryCopies: project.layout.symmetryCopies,
        hidePercentage: project.layout.hidePercentage,
        randomness: project.layout.randomness,
      },
    } as unknown as ProjectDocument;

    expect(normalizeProjectView(legacyProject).layout.letterbox).toBe(0);
  });

  it("normalizes legacy projects without organic variation to zero", () => {
    const project = createProjectView("Legacy Organic Variation");
    const legacyProject = {
      ...project,
      layout: {
        family: project.layout.family,
        shapeMode: project.layout.shapeMode,
        rectCornerRadius: project.layout.rectCornerRadius,
        density: project.layout.density,
        stripAngle: project.layout.stripAngle,
        columns: project.layout.columns,
        rows: project.layout.rows,
        gutter: project.layout.gutter,
        blockDepth: project.layout.blockDepth,
        blockSplitRandomness: project.layout.blockSplitRandomness,
        blockMinSize: project.layout.blockMinSize,
        blockSplitBias: project.layout.blockSplitBias,
        stripOrientation: project.layout.stripOrientation,
        radialSegments: project.layout.radialSegments,
        radialRings: project.layout.radialRings,
        symmetryMode: project.layout.symmetryMode,
        symmetryCopies: project.layout.symmetryCopies,
        hidePercentage: project.layout.hidePercentage,
        letterbox: project.layout.letterbox,
        wedgeAngle: project.layout.wedgeAngle,
        wedgeJitter: project.layout.wedgeJitter,
        randomness: project.layout.randomness,
      },
    } as unknown as ProjectDocument;

    expect(normalizeProjectView(legacyProject).layout.organicVariation).toBe(0);
  });

  it("normalizes legacy projects without fractal fields to the new defaults", () => {
    const project = createProjectView("Legacy Fractal");
    const legacyProject = {
      ...project,
      layout: {
        family: "fractal",
        shapeMode: "rect",
        rectCornerRadius: project.layout.rectCornerRadius,
        density: project.layout.density,
        stripAngle: project.layout.stripAngle,
        columns: project.layout.columns,
        rows: project.layout.rows,
        gutter: project.layout.gutter,
        gutterHorizontal: project.layout.gutterHorizontal,
        gutterVertical: project.layout.gutterVertical,
        blockDepth: project.layout.blockDepth,
        blockSplitRandomness: project.layout.blockSplitRandomness,
        blockMinSize: project.layout.blockMinSize,
        blockSplitBias: project.layout.blockSplitBias,
        stripOrientation: project.layout.stripOrientation,
        radialSegments: project.layout.radialSegments,
        radialRings: project.layout.radialRings,
        radialAngleOffset: project.layout.radialAngleOffset,
        radialRingPhaseStep: project.layout.radialRingPhaseStep,
        radialInnerRadius: project.layout.radialInnerRadius,
        radialChildRotationMode: project.layout.radialChildRotationMode,
        symmetryMode: project.layout.symmetryMode,
        symmetryCopies: project.layout.symmetryCopies,
        symmetryCenterX: project.layout.symmetryCenterX,
        symmetryCenterY: project.layout.symmetryCenterY,
        symmetryAngleOffset: project.layout.symmetryAngleOffset,
        symmetryJitter: project.layout.symmetryJitter,
        hidePercentage: project.layout.hidePercentage,
        letterbox: project.layout.letterbox,
        offsetX: project.layout.offsetX,
        offsetY: project.layout.offsetY,
        contentRotation: project.layout.contentRotation,
        wedgeAngle: project.layout.wedgeAngle,
        wedgeJitter: project.layout.wedgeJitter,
        hollowRatio: project.layout.hollowRatio,
        randomness: project.layout.randomness,
        organicVariation: project.layout.organicVariation,
        flowCurvature: project.layout.flowCurvature,
        flowCoherence: project.layout.flowCoherence,
        flowBranchRate: project.layout.flowBranchRate,
        flowTaper: project.layout.flowTaper,
        threeDStructure: project.layout.threeDStructure,
        threeDDistribution: project.layout.threeDDistribution,
        threeDDepth: project.layout.threeDDepth,
        threeDCameraDistance: project.layout.threeDCameraDistance,
        threeDPanX: project.layout.threeDPanX,
        threeDPanY: project.layout.threeDPanY,
        threeDYaw: project.layout.threeDYaw,
        threeDPitch: project.layout.threeDPitch,
        threeDPerspective: project.layout.threeDPerspective,
        threeDBillboard: project.layout.threeDBillboard,
        threeDZJitter: project.layout.threeDZJitter,
      },
    } as unknown as ProjectDocument;

    const normalized = normalizeProjectView(legacyProject);

    expect(normalized.layout.fractalVariant).toBe("sierpinski-triangle");
    expect(normalized.layout.fractalIterations).toBe(4);
    expect(normalized.layout.fractalSpacing).toBe(0.04);
  });

  it("serializes and reloads fractal layout settings canonically", () => {
    const project = createProjectDocument("Fractal Round Trip");
    const layer = project.layers[0]!;
    layer.layout.family = "fractal";
    layer.layout.fractalVariant = "rosette";
    layer.layout.fractalIterations = 3;
    layer.layout.fractalSpacing = 0.12;
    layer.layout.fractalRosettePetals = 9;
    layer.layout.fractalRosetteTwist = -24;
    layer.layout.fractalRosetteInnerRadius = 0.3;

    const serialized = serializeProjectDocument(normalizeProjectDocument(project));
    const normalized = normalizeProjectDocument(serialized);
    const selectedLayer = getSelectedLayer(normalized);

    expect(selectedLayer?.layout.family).toBe("fractal");
    expect(selectedLayer?.layout.fractalVariant).toBe("rosette");
    expect(selectedLayer?.layout.fractalIterations).toBe(3);
    expect(selectedLayer?.layout.fractalSpacing).toBe(0.12);
    expect(selectedLayer?.layout.fractalRosettePetals).toBe(9);
    expect(selectedLayer?.layout.fractalRosetteTwist).toBe(-24);
    expect(selectedLayer?.layout.fractalRosetteInnerRadius).toBe(0.3);
    expect("layout" in serialized).toBe(false);
  });

  it("serializes and reloads curve layout settings canonically", () => {
    const project = createProjectDocument("Curves Round Trip");
    const layer = project.layers[0]!;
    layer.layout.family = "curves";
    layer.layout.curveVariant = "strange-attractor";
    layer.layout.curveSamples = 512;
    layer.layout.curveCellSize = 0.03;
    layer.layout.curveScaleX = 0.8;
    layer.layout.curveScaleY = 1.1;
    layer.layout.curveRotation = 24;
    layer.layout.curveAlignToTangent = false;
    layer.layout.curveFrequencyX = 5;
    layer.layout.curveFrequencyY = 4;
    layer.layout.curvePhase = -45;
    layer.layout.curveLoops = 3;
    layer.layout.curveGearRatio = 0.42;
    layer.layout.curvePenOffset = 1.4;
    layer.layout.curveDamping = 0.12;
    layer.layout.curveSuperformulaM = 7;
    layer.layout.curveSuperformulaN1 = 0.9;
    layer.layout.curveSuperformulaN2 = 2.2;
    layer.layout.curveSuperformulaN3 = 3.1;
    layer.layout.curvePhyllotaxisAngle = 99;
    layer.layout.curvePhyllotaxisGrowth = 1.2;
    layer.layout.curveAttractorType = "thomas";
    layer.layout.curveAttractorStep = 0.01;
    layer.layout.curveAttractorScale = 1.2;
    layer.layout.curveAttractorYaw = -12;
    layer.layout.curveAttractorPitch = 18;
    layer.layout.curveAttractorCameraDistance = 4.4;

    const serialized = serializeProjectDocument(normalizeProjectDocument(project));
    const normalized = normalizeProjectDocument(serialized);
    const selectedLayer = getSelectedLayer(normalized);

    expect(selectedLayer?.layout.family).toBe("curves");
    expect(selectedLayer?.layout.curveVariant).toBe("strange-attractor");
    expect(selectedLayer?.layout.curveSamples).toBe(512);
    expect(selectedLayer?.layout.curveCellSize).toBe(0.03);
    expect(selectedLayer?.layout.curveScaleX).toBe(0.8);
    expect(selectedLayer?.layout.curveScaleY).toBe(1.1);
    expect(selectedLayer?.layout.curveRotation).toBe(24);
    expect(selectedLayer?.layout.curveAlignToTangent).toBe(false);
    expect(selectedLayer?.layout.curveAttractorType).toBe("thomas");
    expect(selectedLayer?.layout.curveAttractorCameraDistance).toBe(4.4);
    expect("layout" in serialized).toBe(false);
  });

  it("normalizes legacy projects without flow and hollow controls to defaults", () => {
    const project = createProjectView("Legacy Flow");
    const legacyProject = {
      ...project,
      layout: {
        family: project.layout.family,
        shapeMode: project.layout.shapeMode,
        rectCornerRadius: project.layout.rectCornerRadius,
        density: project.layout.density,
        stripAngle: project.layout.stripAngle,
        columns: project.layout.columns,
        rows: project.layout.rows,
        gutter: project.layout.gutter,
        gutterHorizontal: project.layout.gutterHorizontal,
        gutterVertical: project.layout.gutterVertical,
        blockDepth: project.layout.blockDepth,
        blockSplitRandomness: project.layout.blockSplitRandomness,
        blockMinSize: project.layout.blockMinSize,
        blockSplitBias: project.layout.blockSplitBias,
        stripOrientation: project.layout.stripOrientation,
        radialSegments: project.layout.radialSegments,
        radialRings: project.layout.radialRings,
        radialAngleOffset: project.layout.radialAngleOffset,
        radialRingPhaseStep: project.layout.radialRingPhaseStep,
        radialInnerRadius: project.layout.radialInnerRadius,
        radialChildRotationMode: project.layout.radialChildRotationMode,
        symmetryMode: project.layout.symmetryMode,
        symmetryCopies: project.layout.symmetryCopies,
        hidePercentage: project.layout.hidePercentage,
        letterbox: project.layout.letterbox,
        wedgeAngle: project.layout.wedgeAngle,
        wedgeJitter: project.layout.wedgeJitter,
        randomness: project.layout.randomness,
        organicVariation: project.layout.organicVariation,
        threeDStructure: project.layout.threeDStructure,
        threeDDistribution: project.layout.threeDDistribution,
        threeDDepth: project.layout.threeDDepth,
        threeDCameraDistance: project.layout.threeDCameraDistance,
        threeDPanX: project.layout.threeDPanX,
        threeDPanY: project.layout.threeDPanY,
        threeDYaw: project.layout.threeDYaw,
        threeDPitch: project.layout.threeDPitch,
        threeDPerspective: project.layout.threeDPerspective,
        threeDBillboard: project.layout.threeDBillboard,
        threeDZJitter: project.layout.threeDZJitter,
      },
    } as unknown as ProjectDocument;

    const normalized = normalizeProjectView(legacyProject).layout;
    expect(normalized.hollowRatio).toBe(0.48);
    expect(normalized.flowCurvature).toBe(0.44);
    expect(normalized.flowCoherence).toBe(0.72);
    expect(normalized.flowBranchRate).toBe(0.2);
    expect(normalized.flowTaper).toBe(0.34);
  });

  it("normalizes legacy projects without 3d controls to defaults", () => {
    const project = createProjectView("Legacy 3D");
    const legacyProject = {
      ...project,
      layout: {
        family: project.layout.family,
        shapeMode: project.layout.shapeMode,
        rectCornerRadius: project.layout.rectCornerRadius,
        density: project.layout.density,
        stripAngle: project.layout.stripAngle,
        columns: project.layout.columns,
        rows: project.layout.rows,
        gutter: project.layout.gutter,
        blockDepth: project.layout.blockDepth,
        blockSplitRandomness: project.layout.blockSplitRandomness,
        blockMinSize: project.layout.blockMinSize,
        blockSplitBias: project.layout.blockSplitBias,
        stripOrientation: project.layout.stripOrientation,
        radialSegments: project.layout.radialSegments,
        radialRings: project.layout.radialRings,
        radialAngleOffset: project.layout.radialAngleOffset,
        radialRingPhaseStep: project.layout.radialRingPhaseStep,
        radialInnerRadius: project.layout.radialInnerRadius,
        radialChildRotationMode: project.layout.radialChildRotationMode,
        symmetryMode: project.layout.symmetryMode,
        symmetryCopies: project.layout.symmetryCopies,
        hidePercentage: project.layout.hidePercentage,
        letterbox: project.layout.letterbox,
        wedgeAngle: project.layout.wedgeAngle,
        wedgeJitter: project.layout.wedgeJitter,
        randomness: project.layout.randomness,
        organicVariation: project.layout.organicVariation,
      },
    } as unknown as ProjectDocument;

    const normalized = normalizeProjectView(legacyProject).layout;
    expect(normalized.threeDStructure).toBe("sphere");
    expect(normalized.threeDDistribution).toBe(0);
    expect(normalized.threeDDepth).toBe(0.6);
    expect(normalized.threeDCameraDistance).toBe(0.62);
    expect(normalized.threeDPanX).toBe(0);
    expect(normalized.threeDPanY).toBe(0);
    expect(normalized.threeDYaw).toBe(28);
    expect(normalized.threeDPitch).toBe(-18);
    expect(normalized.threeDPerspective).toBe(0.68);
    expect(normalized.threeDBillboard).toBe(0.78);
    expect(normalized.threeDZJitter).toBe(0.18);
  });

  it("normalizes legacy projects without grid gutter axes from the single gutter", () => {
    const project = createProjectView("Legacy Grid Gutter");
    const legacyProject = {
      ...project,
      layout: {
        family: project.layout.family,
        shapeMode: project.layout.shapeMode,
        rectCornerRadius: project.layout.rectCornerRadius,
        density: project.layout.density,
        stripAngle: project.layout.stripAngle,
        columns: project.layout.columns,
        rows: project.layout.rows,
        gutter: 22,
        blockDepth: project.layout.blockDepth,
        blockSplitRandomness: project.layout.blockSplitRandomness,
        blockMinSize: project.layout.blockMinSize,
        blockSplitBias: project.layout.blockSplitBias,
        stripOrientation: project.layout.stripOrientation,
        radialSegments: project.layout.radialSegments,
        radialRings: project.layout.radialRings,
        radialAngleOffset: project.layout.radialAngleOffset,
        radialRingPhaseStep: project.layout.radialRingPhaseStep,
        radialInnerRadius: project.layout.radialInnerRadius,
        radialChildRotationMode: project.layout.radialChildRotationMode,
        symmetryMode: project.layout.symmetryMode,
        symmetryCopies: project.layout.symmetryCopies,
        hidePercentage: project.layout.hidePercentage,
        letterbox: project.layout.letterbox,
        wedgeAngle: project.layout.wedgeAngle,
        wedgeJitter: project.layout.wedgeJitter,
        randomness: project.layout.randomness,
      },
    } as unknown as ProjectDocument;

    const normalized = normalizeProjectView(legacyProject).layout;
    expect(normalized.gutterHorizontal).toBe(22);
    expect(normalized.gutterVertical).toBe(22);
  });

  it("normalizes legacy projects without strip angle to zero degrees", () => {
    const project = createProjectView("Legacy Strips Angle");
    const legacyProject = {
      ...project,
      layout: {
        family: project.layout.family,
        shapeMode: project.layout.shapeMode,
        rectCornerRadius: project.layout.rectCornerRadius,
        density: project.layout.density,
        columns: project.layout.columns,
        rows: project.layout.rows,
        gutter: project.layout.gutter,
        blockDepth: project.layout.blockDepth,
        blockSplitRandomness: project.layout.blockSplitRandomness,
        blockMinSize: project.layout.blockMinSize,
        blockSplitBias: project.layout.blockSplitBias,
        stripOrientation: project.layout.stripOrientation,
        radialSegments: project.layout.radialSegments,
        radialRings: project.layout.radialRings,
        symmetryMode: project.layout.symmetryMode,
        symmetryCopies: project.layout.symmetryCopies,
        hidePercentage: project.layout.hidePercentage,
        letterbox: project.layout.letterbox,
        wedgeAngle: project.layout.wedgeAngle,
        wedgeJitter: project.layout.wedgeJitter,
        randomness: project.layout.randomness,
      },
    } as unknown as ProjectDocument;

    expect(normalizeProjectView(legacyProject).layout.stripAngle).toBe(0);
  });

  it("normalizes legacy projects without strip bend controls to straight defaults", () => {
    const project = createProjectView("Legacy Strip Bend");
    const legacyProject = {
      ...project,
      layout: {
        ...project.layout,
        stripBendWaveform: undefined,
        stripBendAmount: undefined,
        stripBendFrequency: undefined,
        stripBendPhase: undefined,
        stripBendPhaseOffset: undefined,
        stripBendDuty: undefined,
        stripBendSkew: undefined,
        stripBendResolution: undefined,
      },
    } as unknown as ProjectDocument;

    expect(normalizeProjectView(legacyProject).layout).toMatchObject({
      stripBendWaveform: "none",
      stripBendAmount: 0,
      stripBendFrequency: 1,
      stripBendPhase: 0,
      stripBendPhaseOffset: 0,
      stripBendDuty: 0.5,
      stripBendSkew: 0,
      stripBendResolution: 24,
    });
  });

  it("normalizes legacy projects without grid angle to zero degrees", () => {
    const project = createProjectView("Legacy Grid Angle");
    const legacyProject = {
      ...project,
      layout: {
        family: project.layout.family,
        shapeMode: project.layout.shapeMode,
        rectCornerRadius: project.layout.rectCornerRadius,
        density: project.layout.density,
        stripAngle: project.layout.stripAngle,
        columns: project.layout.columns,
        rows: project.layout.rows,
        gutter: project.layout.gutter,
        gutterHorizontal: project.layout.gutterHorizontal,
        gutterVertical: project.layout.gutterVertical,
        blockDepth: project.layout.blockDepth,
        blockSplitRandomness: project.layout.blockSplitRandomness,
        blockMinSize: project.layout.blockMinSize,
        blockSplitBias: project.layout.blockSplitBias,
        stripOrientation: project.layout.stripOrientation,
        radialSegments: project.layout.radialSegments,
        radialRings: project.layout.radialRings,
        symmetryMode: project.layout.symmetryMode,
        symmetryCopies: project.layout.symmetryCopies,
        hidePercentage: project.layout.hidePercentage,
        letterbox: project.layout.letterbox,
        wedgeAngle: project.layout.wedgeAngle,
        wedgeJitter: project.layout.wedgeJitter,
        randomness: project.layout.randomness,
      },
    } as unknown as ProjectDocument;

    expect(normalizeProjectView(legacyProject).layout.gridAngle).toBe(0);
  });

  it("normalizes legacy projects without wedge controls to defaults", () => {
    const project = createProjectView("Legacy Wedge");
    const legacyProject = {
      ...project,
      layout: {
        family: project.layout.family,
        shapeMode: project.layout.shapeMode,
        rectCornerRadius: project.layout.rectCornerRadius,
        density: project.layout.density,
        stripAngle: project.layout.stripAngle,
        columns: project.layout.columns,
        rows: project.layout.rows,
        gutter: project.layout.gutter,
        blockDepth: project.layout.blockDepth,
        blockSplitRandomness: project.layout.blockSplitRandomness,
        blockMinSize: project.layout.blockMinSize,
        blockSplitBias: project.layout.blockSplitBias,
        stripOrientation: project.layout.stripOrientation,
        radialSegments: project.layout.radialSegments,
        radialRings: project.layout.radialRings,
        symmetryMode: project.layout.symmetryMode,
        symmetryCopies: project.layout.symmetryCopies,
        hidePercentage: project.layout.hidePercentage,
        letterbox: project.layout.letterbox,
        randomness: project.layout.randomness,
      },
    } as unknown as ProjectDocument;

    expect(normalizeProjectView(legacyProject).layout.wedgeAngle).toBe(120);
    expect(normalizeProjectView(legacyProject).layout.wedgeJitter).toBe(0);
  });

  it("normalizes legacy projects without radial controls to defaults", () => {
    const project = createProjectView("Legacy Radial");
    const legacyProject = {
      ...project,
      layout: {
        family: project.layout.family,
        shapeMode: project.layout.shapeMode,
        rectCornerRadius: project.layout.rectCornerRadius,
        density: project.layout.density,
        stripAngle: project.layout.stripAngle,
        columns: project.layout.columns,
        rows: project.layout.rows,
        gutter: project.layout.gutter,
        blockDepth: project.layout.blockDepth,
        blockSplitRandomness: project.layout.blockSplitRandomness,
        blockMinSize: project.layout.blockMinSize,
        blockSplitBias: project.layout.blockSplitBias,
        stripOrientation: project.layout.stripOrientation,
        radialSegments: project.layout.radialSegments,
        radialRings: project.layout.radialRings,
        symmetryMode: project.layout.symmetryMode,
        symmetryCopies: project.layout.symmetryCopies,
        hidePercentage: project.layout.hidePercentage,
        letterbox: project.layout.letterbox,
        wedgeAngle: project.layout.wedgeAngle,
        wedgeJitter: project.layout.wedgeJitter,
        randomness: project.layout.randomness,
      },
    } as unknown as ProjectDocument;

    const normalized = normalizeProjectView(legacyProject).layout;
    expect(normalized.radialAngleOffset).toBe(0);
    expect(normalized.radialRingPhaseStep).toBe(0);
    expect(normalized.radialInnerRadius).toBe(0);
    expect(normalized.radialChildRotationMode).toBe("tangent");
  });

  it("normalizes legacy projects without kaleidoscope controls to defaults", () => {
    const project = createProjectView("Legacy Kaleidoscope");
    const legacyProject = {
      ...project,
      effects: {
        blur: project.effects.blur,
        sharpen: project.effects.sharpen,
        mirror: true,
        kaleidoscopeSegments: project.effects.kaleidoscopeSegments,
        rotationJitter: project.effects.rotationJitter,
        scaleJitter: project.effects.scaleJitter,
        displacement: project.effects.displacement,
        distortion: project.effects.distortion,
      },
    } as unknown as ProjectDocument;

    const normalized = normalizeProjectView(legacyProject).effects;
    expect(normalized.kaleidoscopeCenterX).toBe(0.5);
    expect(normalized.kaleidoscopeCenterY).toBe(0.5);
    expect(normalized.kaleidoscopeAngleOffset).toBe(0);
    expect(normalized.kaleidoscopeMirrorMode).toBe("alternate");
    expect(normalized.kaleidoscopeRotationDrift).toBe(0);
    expect(normalized.kaleidoscopeScaleFalloff).toBe(0);
    expect(normalized.kaleidoscopeOpacity).toBe(0.2);
    expect(normalized.elementModulations.rotation.enabled).toBe(false);
    expect(normalized.elementModulations.rotation.pattern).toBe("sine");
  });

  it("normalizes legacy projects without block controls to defaults", () => {
    const project = createProjectView("Legacy Blocks");
    const legacyProject = {
      ...project,
      layout: {
        family: project.layout.family,
        shapeMode: project.layout.shapeMode,
        rectCornerRadius: project.layout.rectCornerRadius,
        density: project.layout.density,
        stripAngle: project.layout.stripAngle,
        columns: project.layout.columns,
        rows: project.layout.rows,
        gutter: project.layout.gutter,
        blockDepth: project.layout.blockDepth,
        stripOrientation: project.layout.stripOrientation,
        radialSegments: project.layout.radialSegments,
        radialRings: project.layout.radialRings,
        symmetryMode: project.layout.symmetryMode,
        symmetryCopies: project.layout.symmetryCopies,
        hidePercentage: project.layout.hidePercentage,
        letterbox: project.layout.letterbox,
        wedgeAngle: project.layout.wedgeAngle,
        wedgeJitter: project.layout.wedgeJitter,
        randomness: project.layout.randomness,
      },
    } as unknown as ProjectDocument;

    expect(normalizeProjectView(legacyProject).layout.blockSplitRandomness).toBe(0.5);
    expect(normalizeProjectView(legacyProject).layout.blockMinSize).toBe(140);
    expect(normalizeProjectView(legacyProject).layout.blockSplitBias).toBe(0.5);
  });

  it("normalizes legacy version snapshots without crop distribution to centered mode", () => {
    const project = createProjectView("Legacy Version");
    const legacyVersion = {
      id: "version_legacy",
      projectId: project.id,
      label: "Legacy Snapshot",
      createdAt: new Date().toISOString(),
      thumbnailPath: null,
      snapshot: {
        sourceIds: project.sourceIds,
        canvas: structuredClone(project.canvas),
        layout: structuredClone(project.layout),
        sourceMapping: {
          strategy: project.sourceMapping.strategy,
          preserveAspect: project.sourceMapping.preserveAspect,
          cropZoom: project.sourceMapping.cropZoom,
          luminanceSort: project.sourceMapping.luminanceSort,
          paletteEmphasis: project.sourceMapping.paletteEmphasis,
        },
        effects: structuredClone(project.effects),
        compositing: structuredClone(project.compositing),
        export: structuredClone(project.export),
        activeSeed: project.activeSeed,
        presets: structuredClone(project.presets),
        passes: structuredClone(project.passes),
      },
    } as unknown as ProjectVersion;

    expect(getSnapshotLayer(normalizeProjectVersion(legacyVersion).snapshot).sourceMapping.cropDistribution).toBe(
      "center",
    );
  });

  it("normalizes legacy version snapshots without wedge controls to defaults", () => {
    const project = createProjectView("Legacy Wedge Version");
    const legacyVersion = {
      id: "version_legacy_wedge",
      projectId: project.id,
      label: "Legacy Wedge Snapshot",
      createdAt: new Date().toISOString(),
      thumbnailPath: null,
      snapshot: {
        sourceIds: project.sourceIds,
        canvas: structuredClone(project.canvas),
        layout: {
          family: project.layout.family,
          shapeMode: project.layout.shapeMode,
          rectCornerRadius: project.layout.rectCornerRadius,
          density: project.layout.density,
          stripAngle: project.layout.stripAngle,
          columns: project.layout.columns,
          rows: project.layout.rows,
          gutter: project.layout.gutter,
          blockDepth: project.layout.blockDepth,
          blockSplitRandomness: project.layout.blockSplitRandomness,
          blockMinSize: project.layout.blockMinSize,
          blockSplitBias: project.layout.blockSplitBias,
          stripOrientation: project.layout.stripOrientation,
          radialSegments: project.layout.radialSegments,
          radialRings: project.layout.radialRings,
          symmetryMode: project.layout.symmetryMode,
          symmetryCopies: project.layout.symmetryCopies,
          hidePercentage: project.layout.hidePercentage,
          letterbox: project.layout.letterbox,
          randomness: project.layout.randomness,
        },
        sourceMapping: structuredClone(project.sourceMapping),
        effects: structuredClone(project.effects),
        compositing: structuredClone(project.compositing),
        export: structuredClone(project.export),
        activeSeed: project.activeSeed,
        presets: structuredClone(project.presets),
        passes: structuredClone(project.passes),
      },
    } as unknown as ProjectVersion;

    expect(getSnapshotLayer(normalizeProjectVersion(legacyVersion).snapshot).layout.wedgeAngle).toBe(120);
    expect(getSnapshotLayer(normalizeProjectVersion(legacyVersion).snapshot).layout.wedgeJitter).toBe(0);
  });

  it("normalizes legacy version snapshots without grid gutter axes from the single gutter", () => {
    const project = createProjectView("Legacy Grid Gutter Version");
    const legacyVersion = {
      id: "version_legacy_grid_gutter",
      projectId: project.id,
      label: "Legacy Grid Gutter Snapshot",
      createdAt: new Date().toISOString(),
      thumbnailPath: null,
      snapshot: {
        sourceIds: project.sourceIds,
        canvas: structuredClone(project.canvas),
        layout: {
          family: project.layout.family,
          shapeMode: project.layout.shapeMode,
          rectCornerRadius: project.layout.rectCornerRadius,
          density: project.layout.density,
          stripAngle: project.layout.stripAngle,
          columns: project.layout.columns,
          rows: project.layout.rows,
          gutter: 18,
          blockDepth: project.layout.blockDepth,
          blockSplitRandomness: project.layout.blockSplitRandomness,
          blockMinSize: project.layout.blockMinSize,
          blockSplitBias: project.layout.blockSplitBias,
          stripOrientation: project.layout.stripOrientation,
          radialSegments: project.layout.radialSegments,
          radialRings: project.layout.radialRings,
          radialAngleOffset: project.layout.radialAngleOffset,
          radialRingPhaseStep: project.layout.radialRingPhaseStep,
          radialInnerRadius: project.layout.radialInnerRadius,
          radialChildRotationMode: project.layout.radialChildRotationMode,
          symmetryMode: project.layout.symmetryMode,
          symmetryCopies: project.layout.symmetryCopies,
          hidePercentage: project.layout.hidePercentage,
          letterbox: project.layout.letterbox,
          wedgeAngle: project.layout.wedgeAngle,
          wedgeJitter: project.layout.wedgeJitter,
          randomness: project.layout.randomness,
        },
        sourceMapping: structuredClone(project.sourceMapping),
        effects: structuredClone(project.effects),
        compositing: structuredClone(project.compositing),
        export: structuredClone(project.export),
        activeSeed: project.activeSeed,
        presets: structuredClone(project.presets),
        passes: structuredClone(project.passes),
      },
    } as unknown as ProjectVersion;

    const normalized = getSnapshotLayer(normalizeProjectVersion(legacyVersion).snapshot).layout;
    expect(normalized.gutterHorizontal).toBe(18);
    expect(normalized.gutterVertical).toBe(18);
  });

  it("normalizes legacy version snapshots without radial controls to defaults", () => {
    const project = createProjectView("Legacy Radial Version");
    const legacyVersion = {
      id: "version_legacy_radial",
      projectId: project.id,
      label: "Legacy Radial Snapshot",
      createdAt: new Date().toISOString(),
      thumbnailPath: null,
      snapshot: {
        sourceIds: project.sourceIds,
        canvas: structuredClone(project.canvas),
        layout: {
          family: project.layout.family,
          shapeMode: project.layout.shapeMode,
          rectCornerRadius: project.layout.rectCornerRadius,
          density: project.layout.density,
          stripAngle: project.layout.stripAngle,
          columns: project.layout.columns,
          rows: project.layout.rows,
          gutter: project.layout.gutter,
          blockDepth: project.layout.blockDepth,
          blockSplitRandomness: project.layout.blockSplitRandomness,
          blockMinSize: project.layout.blockMinSize,
          blockSplitBias: project.layout.blockSplitBias,
          stripOrientation: project.layout.stripOrientation,
          radialSegments: project.layout.radialSegments,
          radialRings: project.layout.radialRings,
          symmetryMode: project.layout.symmetryMode,
          symmetryCopies: project.layout.symmetryCopies,
          hidePercentage: project.layout.hidePercentage,
          letterbox: project.layout.letterbox,
          wedgeAngle: project.layout.wedgeAngle,
          wedgeJitter: project.layout.wedgeJitter,
          randomness: project.layout.randomness,
        },
        sourceMapping: structuredClone(project.sourceMapping),
        effects: structuredClone(project.effects),
        compositing: structuredClone(project.compositing),
        export: structuredClone(project.export),
        activeSeed: project.activeSeed,
        presets: structuredClone(project.presets),
        passes: structuredClone(project.passes),
      },
    } as unknown as ProjectVersion;

    const normalized = getSnapshotLayer(normalizeProjectVersion(legacyVersion).snapshot).layout;
    expect(normalized.radialAngleOffset).toBe(0);
    expect(normalized.radialRingPhaseStep).toBe(0);
    expect(normalized.radialInnerRadius).toBe(0);
    expect(normalized.radialChildRotationMode).toBe("tangent");
  });

  it("normalizes legacy version snapshots without kaleidoscope controls to defaults", () => {
    const project = createProjectView("Legacy Kaleidoscope Version");
    const legacyVersion = {
      id: "version_legacy_kaleidoscope",
      projectId: project.id,
      label: "Legacy Kaleidoscope Snapshot",
      createdAt: new Date().toISOString(),
      thumbnailPath: null,
      snapshot: {
        sourceIds: project.sourceIds,
        canvas: structuredClone(project.canvas),
        layout: structuredClone(project.layout),
        sourceMapping: structuredClone(project.sourceMapping),
        effects: {
          blur: project.effects.blur,
          sharpen: project.effects.sharpen,
          mirror: true,
          kaleidoscopeSegments: project.effects.kaleidoscopeSegments,
          rotationJitter: project.effects.rotationJitter,
          scaleJitter: project.effects.scaleJitter,
          displacement: project.effects.displacement,
          distortion: project.effects.distortion,
        },
        compositing: structuredClone(project.compositing),
        export: structuredClone(project.export),
        activeSeed: project.activeSeed,
        presets: structuredClone(project.presets),
        passes: structuredClone(project.passes),
      },
    } as unknown as ProjectVersion;

    const normalized = getSnapshotLayer(normalizeProjectVersion(legacyVersion).snapshot).effects;
    expect(normalized.kaleidoscopeCenterX).toBe(0.5);
    expect(normalized.kaleidoscopeCenterY).toBe(0.5);
    expect(normalized.kaleidoscopeAngleOffset).toBe(0);
    expect(normalized.kaleidoscopeMirrorMode).toBe("alternate");
    expect(normalized.kaleidoscopeRotationDrift).toBe(0);
    expect(normalized.kaleidoscopeScaleFalloff).toBe(0);
    expect(normalized.kaleidoscopeOpacity).toBe(0.2);
  });

  it("normalizes legacy version snapshots without strip angle to zero degrees", () => {
    const project = createProjectView("Legacy Strips Angle Version");
    const legacyVersion = {
      id: "version_legacy_strip_angle",
      projectId: project.id,
      label: "Legacy Strip Angle Snapshot",
      createdAt: new Date().toISOString(),
      thumbnailPath: null,
      snapshot: {
        sourceIds: project.sourceIds,
        canvas: structuredClone(project.canvas),
        layout: {
          family: project.layout.family,
          shapeMode: project.layout.shapeMode,
          rectCornerRadius: project.layout.rectCornerRadius,
          density: project.layout.density,
          columns: project.layout.columns,
          rows: project.layout.rows,
          gutter: project.layout.gutter,
          blockDepth: project.layout.blockDepth,
          blockSplitRandomness: project.layout.blockSplitRandomness,
          blockMinSize: project.layout.blockMinSize,
          blockSplitBias: project.layout.blockSplitBias,
          stripOrientation: project.layout.stripOrientation,
          radialSegments: project.layout.radialSegments,
          radialRings: project.layout.radialRings,
          symmetryMode: project.layout.symmetryMode,
          symmetryCopies: project.layout.symmetryCopies,
          hidePercentage: project.layout.hidePercentage,
          letterbox: project.layout.letterbox,
          wedgeAngle: project.layout.wedgeAngle,
          wedgeJitter: project.layout.wedgeJitter,
          randomness: project.layout.randomness,
        },
        sourceMapping: structuredClone(project.sourceMapping),
        effects: structuredClone(project.effects),
        compositing: structuredClone(project.compositing),
        export: structuredClone(project.export),
        activeSeed: project.activeSeed,
        presets: structuredClone(project.presets),
        passes: structuredClone(project.passes),
      },
    } as unknown as ProjectVersion;

    expect(getSnapshotLayer(normalizeProjectVersion(legacyVersion).snapshot).layout.stripAngle).toBe(0);
  });

  it("normalizes legacy version snapshots without grid angle to zero degrees", () => {
    const project = createProjectView("Legacy Grid Angle Version");
    const legacyVersion = {
      id: "version_legacy_grid_angle",
      projectId: project.id,
      label: "Legacy Grid Angle Snapshot",
      createdAt: new Date().toISOString(),
      thumbnailPath: null,
      snapshot: {
        sourceIds: project.sourceIds,
        canvas: structuredClone(project.canvas),
        layout: {
          family: project.layout.family,
          shapeMode: project.layout.shapeMode,
          rectCornerRadius: project.layout.rectCornerRadius,
          density: project.layout.density,
          stripAngle: project.layout.stripAngle,
          columns: project.layout.columns,
          rows: project.layout.rows,
          gutter: project.layout.gutter,
          gutterHorizontal: project.layout.gutterHorizontal,
          gutterVertical: project.layout.gutterVertical,
          blockDepth: project.layout.blockDepth,
          blockSplitRandomness: project.layout.blockSplitRandomness,
          blockMinSize: project.layout.blockMinSize,
          blockSplitBias: project.layout.blockSplitBias,
          stripOrientation: project.layout.stripOrientation,
          radialSegments: project.layout.radialSegments,
          radialRings: project.layout.radialRings,
          symmetryMode: project.layout.symmetryMode,
          symmetryCopies: project.layout.symmetryCopies,
          hidePercentage: project.layout.hidePercentage,
          letterbox: project.layout.letterbox,
          wedgeAngle: project.layout.wedgeAngle,
          wedgeJitter: project.layout.wedgeJitter,
          randomness: project.layout.randomness,
        },
        sourceMapping: structuredClone(project.sourceMapping),
        effects: structuredClone(project.effects),
        compositing: structuredClone(project.compositing),
        export: structuredClone(project.export),
        activeSeed: project.activeSeed,
        presets: structuredClone(project.presets),
        passes: structuredClone(project.passes),
      },
    } as unknown as ProjectVersion;

    expect(getSnapshotLayer(normalizeProjectVersion(legacyVersion).snapshot).layout.gridAngle).toBe(0);
  });

  it("normalizes legacy version snapshots without block controls to defaults", () => {
    const project = createProjectView("Legacy Block Version");
    const legacyVersion = {
      id: "version_legacy_blocks",
      projectId: project.id,
      label: "Legacy Block Snapshot",
      createdAt: new Date().toISOString(),
      thumbnailPath: null,
      snapshot: {
        sourceIds: project.sourceIds,
        canvas: structuredClone(project.canvas),
        layout: {
          family: project.layout.family,
          shapeMode: project.layout.shapeMode,
          rectCornerRadius: project.layout.rectCornerRadius,
          density: project.layout.density,
          stripAngle: project.layout.stripAngle,
          columns: project.layout.columns,
          rows: project.layout.rows,
          gutter: project.layout.gutter,
          blockDepth: project.layout.blockDepth,
          stripOrientation: project.layout.stripOrientation,
          radialSegments: project.layout.radialSegments,
          radialRings: project.layout.radialRings,
          symmetryMode: project.layout.symmetryMode,
          symmetryCopies: project.layout.symmetryCopies,
          hidePercentage: project.layout.hidePercentage,
          letterbox: project.layout.letterbox,
          wedgeAngle: project.layout.wedgeAngle,
          wedgeJitter: project.layout.wedgeJitter,
          randomness: project.layout.randomness,
        },
        sourceMapping: structuredClone(project.sourceMapping),
        effects: structuredClone(project.effects),
        compositing: structuredClone(project.compositing),
        export: structuredClone(project.export),
        activeSeed: project.activeSeed,
        presets: structuredClone(project.presets),
        passes: structuredClone(project.passes),
      },
    } as unknown as ProjectVersion;

    expect(getSnapshotLayer(normalizeProjectVersion(legacyVersion).snapshot).layout.blockSplitRandomness).toBe(
      0.5,
    );
    expect(getSnapshotLayer(normalizeProjectVersion(legacyVersion).snapshot).layout.blockMinSize).toBe(140);
    expect(getSnapshotLayer(normalizeProjectVersion(legacyVersion).snapshot).layout.blockSplitBias).toBe(0.5);
  });
});
