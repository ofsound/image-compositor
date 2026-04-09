import { describe, expect, it } from "vitest";

import {
  createProjectDocument,
  normalizeProjectDocument,
  normalizeProjectVersion,
} from "@/lib/project-defaults";
import type { ProjectDocument, ProjectVersion } from "@/types/project";

describe("createProjectDocument", () => {
  it("creates a fully-populated local-first project document", () => {
    const project = createProjectDocument("Study");

    expect(project.title).toBe("Study");
    expect(project.id.startsWith("project_")).toBe(true);
    expect(project.deletedAt).toBeNull();
    expect(project.sourceIds).toEqual([]);
    expect(project.sourceMapping.cropDistribution).toBe("distributed");
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
    expect(project.effects.kaleidoscopeCenterX).toBe(0.5);
    expect(project.effects.kaleidoscopeCenterY).toBe(0.5);
    expect(project.effects.kaleidoscopeAngleOffset).toBe(0);
    expect(project.effects.kaleidoscopeMirrorMode).toBe("alternate");
    expect(project.effects.kaleidoscopeRotationDrift).toBe(0);
    expect(project.effects.kaleidoscopeScaleFalloff).toBe(0);
    expect(project.effects.kaleidoscopeOpacity).toBe(0.2);
    expect(project.passes.map((pass) => pass.type)).toEqual([
      "layout",
      "assignment",
      "transform",
      "compose",
      "export",
    ]);
  });

  it("normalizes legacy projects without crop distribution to centered mode", () => {
    const project = createProjectDocument("Legacy");
    const legacyProject = {
      ...project,
      sourceMapping: {
        strategy: project.sourceMapping.strategy,
        sourceBias: project.sourceMapping.sourceBias,
        preserveAspect: project.sourceMapping.preserveAspect,
        cropZoom: project.sourceMapping.cropZoom,
        luminanceSort: project.sourceMapping.luminanceSort,
        paletteEmphasis: project.sourceMapping.paletteEmphasis,
      },
    } as unknown as ProjectDocument;

    expect(normalizeProjectDocument(legacyProject).sourceMapping.cropDistribution).toBe("center");
  });

  it("normalizes legacy projects without background alpha to transparent", () => {
    const project = createProjectDocument("Legacy Background");
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

  it("normalizes legacy projects without letterbox to zero", () => {
    const project = createProjectDocument("Legacy Letterbox");
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

    expect(normalizeProjectDocument(legacyProject).layout.letterbox).toBe(0);
  });

  it("normalizes legacy projects without organic variation to zero", () => {
    const project = createProjectDocument("Legacy Organic Variation");
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

    expect(normalizeProjectDocument(legacyProject).layout.organicVariation).toBe(0);
  });

  it("normalizes legacy projects without flow and hollow controls to defaults", () => {
    const project = createProjectDocument("Legacy Flow");
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

    const normalized = normalizeProjectDocument(legacyProject).layout;
    expect(normalized.hollowRatio).toBe(0.48);
    expect(normalized.flowCurvature).toBe(0.44);
    expect(normalized.flowCoherence).toBe(0.72);
    expect(normalized.flowBranchRate).toBe(0.2);
    expect(normalized.flowTaper).toBe(0.34);
  });

  it("normalizes legacy projects without 3d controls to defaults", () => {
    const project = createProjectDocument("Legacy 3D");
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

    const normalized = normalizeProjectDocument(legacyProject).layout;
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
    const project = createProjectDocument("Legacy Grid Gutter");
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

    const normalized = normalizeProjectDocument(legacyProject).layout;
    expect(normalized.gutterHorizontal).toBe(22);
    expect(normalized.gutterVertical).toBe(22);
  });

  it("normalizes legacy projects without strip angle to zero degrees", () => {
    const project = createProjectDocument("Legacy Strips Angle");
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

    expect(normalizeProjectDocument(legacyProject).layout.stripAngle).toBe(0);
  });

  it("normalizes legacy projects without wedge controls to defaults", () => {
    const project = createProjectDocument("Legacy Wedge");
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

    expect(normalizeProjectDocument(legacyProject).layout.wedgeAngle).toBe(120);
    expect(normalizeProjectDocument(legacyProject).layout.wedgeJitter).toBe(0);
  });

  it("normalizes legacy projects without radial controls to defaults", () => {
    const project = createProjectDocument("Legacy Radial");
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

    const normalized = normalizeProjectDocument(legacyProject).layout;
    expect(normalized.radialAngleOffset).toBe(0);
    expect(normalized.radialRingPhaseStep).toBe(0);
    expect(normalized.radialInnerRadius).toBe(0);
    expect(normalized.radialChildRotationMode).toBe("tangent");
  });

  it("normalizes legacy projects without kaleidoscope controls to defaults", () => {
    const project = createProjectDocument("Legacy Kaleidoscope");
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

    const normalized = normalizeProjectDocument(legacyProject).effects;
    expect(normalized.kaleidoscopeCenterX).toBe(0.5);
    expect(normalized.kaleidoscopeCenterY).toBe(0.5);
    expect(normalized.kaleidoscopeAngleOffset).toBe(0);
    expect(normalized.kaleidoscopeMirrorMode).toBe("alternate");
    expect(normalized.kaleidoscopeRotationDrift).toBe(0);
    expect(normalized.kaleidoscopeScaleFalloff).toBe(0);
    expect(normalized.kaleidoscopeOpacity).toBe(0.2);
  });

  it("normalizes legacy projects without block controls to defaults", () => {
    const project = createProjectDocument("Legacy Blocks");
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

    expect(normalizeProjectDocument(legacyProject).layout.blockSplitRandomness).toBe(0.5);
    expect(normalizeProjectDocument(legacyProject).layout.blockMinSize).toBe(140);
    expect(normalizeProjectDocument(legacyProject).layout.blockSplitBias).toBe(0.5);
  });

  it("normalizes legacy version snapshots without crop distribution to centered mode", () => {
    const project = createProjectDocument("Legacy Version");
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
          sourceBias: project.sourceMapping.sourceBias,
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

    expect(normalizeProjectVersion(legacyVersion).snapshot.sourceMapping.cropDistribution).toBe(
      "center",
    );
  });

  it("normalizes legacy version snapshots without wedge controls to defaults", () => {
    const project = createProjectDocument("Legacy Wedge Version");
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

    expect(normalizeProjectVersion(legacyVersion).snapshot.layout.wedgeAngle).toBe(120);
    expect(normalizeProjectVersion(legacyVersion).snapshot.layout.wedgeJitter).toBe(0);
  });

  it("normalizes legacy version snapshots without grid gutter axes from the single gutter", () => {
    const project = createProjectDocument("Legacy Grid Gutter Version");
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

    const normalized = normalizeProjectVersion(legacyVersion).snapshot.layout;
    expect(normalized.gutterHorizontal).toBe(18);
    expect(normalized.gutterVertical).toBe(18);
  });

  it("normalizes legacy version snapshots without radial controls to defaults", () => {
    const project = createProjectDocument("Legacy Radial Version");
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

    const normalized = normalizeProjectVersion(legacyVersion).snapshot.layout;
    expect(normalized.radialAngleOffset).toBe(0);
    expect(normalized.radialRingPhaseStep).toBe(0);
    expect(normalized.radialInnerRadius).toBe(0);
    expect(normalized.radialChildRotationMode).toBe("tangent");
  });

  it("normalizes legacy version snapshots without kaleidoscope controls to defaults", () => {
    const project = createProjectDocument("Legacy Kaleidoscope Version");
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

    const normalized = normalizeProjectVersion(legacyVersion).snapshot.effects;
    expect(normalized.kaleidoscopeCenterX).toBe(0.5);
    expect(normalized.kaleidoscopeCenterY).toBe(0.5);
    expect(normalized.kaleidoscopeAngleOffset).toBe(0);
    expect(normalized.kaleidoscopeMirrorMode).toBe("alternate");
    expect(normalized.kaleidoscopeRotationDrift).toBe(0);
    expect(normalized.kaleidoscopeScaleFalloff).toBe(0);
    expect(normalized.kaleidoscopeOpacity).toBe(0.2);
  });

  it("normalizes legacy version snapshots without strip angle to zero degrees", () => {
    const project = createProjectDocument("Legacy Strips Angle Version");
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

    expect(normalizeProjectVersion(legacyVersion).snapshot.layout.stripAngle).toBe(0);
  });

  it("normalizes legacy version snapshots without block controls to defaults", () => {
    const project = createProjectDocument("Legacy Block Version");
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

    expect(normalizeProjectVersion(legacyVersion).snapshot.layout.blockSplitRandomness).toBe(
      0.5,
    );
    expect(normalizeProjectVersion(legacyVersion).snapshot.layout.blockMinSize).toBe(140);
    expect(normalizeProjectVersion(legacyVersion).snapshot.layout.blockSplitBias).toBe(0.5);
  });
});
