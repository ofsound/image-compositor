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
