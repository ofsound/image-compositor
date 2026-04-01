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
});
