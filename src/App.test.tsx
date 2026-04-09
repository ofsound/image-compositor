import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as assetLib from "@/lib/assets";
import { createProjectDocument } from "@/lib/project-defaults";
import { createProjectEditorView } from "@/lib/project-editor-view";
import { renderLayerThumbnailUrls } from "@/lib/render-service";
import App, {
  coerceShapeModeForFamily,
  getGeometryOptions,
} from "@/App";
import type { SourceAsset } from "@/types/project";
import { useAppStore } from "@/state/use-app-store";

vi.mock("sonner", () => ({
  Toaster: () => null,
}));

vi.mock("@/lib/opfs", () => ({
  readBlob: vi.fn(async () => null),
}));

vi.mock("@/lib/assets", async () => {
  const actual =
    await vi.importActual("@/lib/assets") as typeof import("@/lib/assets");

  return {
    ...actual,
    renderGeneratedSourceToCanvas: vi.fn(),
  };
});

vi.mock("@/lib/render", () => ({
  buildBitmapMap: vi.fn(async () => new Map()),
  renderProjectLayerToCanvas: vi.fn(async () => undefined),
}));

vi.mock("@/lib/render-service", () => ({
  loadNormalizedAssetBitmapMap: vi.fn(async () => new Map()),
  renderProjectPreview: vi.fn(async () => undefined),
  renderLayerThumbnailUrls: vi.fn(async (project: { layers: { id: string }[] }) =>
    Object.fromEntries(
      project.layers.map((layer, index) => [layer.id, `blob:layer-thumb-${index + 1}`]),
    ),
  ),
}));

vi.mock("@/components/app/preview-stage", () => ({
  PreviewStage: () => <div data-testid="preview-stage" />,
}));

vi.mock("@/components/app/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock("@/state/use-app-store", () => ({
  useAppStore: vi.fn(),
}));

const mockedUseAppStore = vi.mocked(useAppStore);
const mockedRenderLayerThumbnailUrls = vi.mocked(renderLayerThumbnailUrls);
const renderGeneratedSourceToCanvasSpy = vi.mocked(
  assetLib.renderGeneratedSourceToCanvas,
);
type AppStoreState = ReturnType<typeof useAppStore.getState>;
type UpdateProject = AppStoreState["updateProject"];

function createStoreState(overrides?: {
  family?: "grid" | "strips" | "blocks" | "radial" | "organic" | "flow" | "3d";
  shapeMode?:
    | "rect"
    | "triangle"
    | "interlock"
    | "blob"
    | "ring"
    | "arc"
    | "wedge"
    | "mixed";
  symmetryMode?: "none" | "mirror-x" | "mirror-y" | "quad" | "radial";
  density?: number;
  organicVariation?: number;
  kaleidoscopeSegments?: number;
  sourceImportProgress?: { processed: number; total: number } | null;
  strategy?:
    | "random"
    | "weighted"
    | "sequential"
    | "luminance"
    | "palette"
    | "symmetry";
  assets?: SourceAsset[];
  enabledSourceIds?: string[];
  sourceWeights?: Record<string, number>;
}) {
  const project = createProjectEditorView(createProjectDocument("Slider Spec"));

  if (overrides?.family) {
    project.layout.family = overrides.family;
  }

  if (overrides?.shapeMode) {
    project.layout.shapeMode = overrides.shapeMode;
  }

  if (overrides?.symmetryMode) {
    project.layout.symmetryMode = overrides.symmetryMode;
  }

  if (overrides?.density !== undefined) {
    project.layout.density = overrides.density;
  }

  if (overrides?.organicVariation !== undefined) {
    project.layout.organicVariation = overrides.organicVariation;
  }

  if (overrides?.kaleidoscopeSegments !== undefined) {
    project.effects.kaleidoscopeSegments = overrides.kaleidoscopeSegments;
  }

  if (overrides?.strategy) {
    project.sourceMapping.strategy = overrides.strategy;
  }

  const assets =
    overrides?.assets?.map((asset) => ({ ...asset, projectId: project.id })) ??
    [];
  if (assets.length > 0) {
    project.sourceIds =
      overrides?.enabledSourceIds ?? assets.map((asset) => asset.id);
  }

  if (overrides?.sourceWeights) {
    project.sourceMapping.sourceWeights = overrides.sourceWeights;
  }

  const updateProject = vi.fn<UpdateProject>(async () => undefined);

  return {
    ready: true,
    busy: false,
    status: "Ready.",
    sourceImportProgress: overrides?.sourceImportProgress ?? null,
    projects: [project],
    assets,
    versions: [],
    activeProjectId: project.id,
    historyByProject: {},
    canUndo: false,
    canRedo: false,
    bootstrap: vi.fn(async () => undefined),
    createProject: vi.fn(async () => undefined),
    renameProject: vi.fn(async () => undefined),
    duplicateProject: vi.fn(async () => undefined),
    trashProject: vi.fn(async () => undefined),
    restoreProject: vi.fn(async () => undefined),
    purgeProject: vi.fn(async () => undefined),
    setActiveProject: vi.fn(async () => undefined),
    selectLayer: vi.fn(async () => undefined),
    addLayer: vi.fn(async () => undefined),
    deleteLayer: vi.fn(async () => undefined),
    toggleLayerVisibility: vi.fn(async () => undefined),
    reorderLayers: vi.fn(async () => undefined),
    updateProject,
    importFiles: vi.fn(async () => undefined),
    addSolidSource: vi.fn(async () => undefined),
    addGradientSource: vi.fn(async () => undefined),
    addPerlinSource: vi.fn(async () => undefined),
    addCellularSource: vi.fn(async () => undefined),
    addReactionSource: vi.fn(async () => undefined),
    addWaveSource: vi.fn(async () => undefined),
    removeSource: vi.fn(async () => undefined),
    updateGeneratedSource: vi.fn(async () => undefined),
    randomizeSeed: vi.fn(async () => undefined),
    saveVersion: vi.fn(async () => undefined),
    restoreVersion: vi.fn(async () => undefined),
    exportCurrentImage: vi.fn(async () => undefined),
    exportCurrentBundle: vi.fn(async () => undefined),
    inspectBundleImport: vi.fn(async () => {
      throw new Error("not used");
    }),
    resolveBundleImport: vi.fn(async () => undefined),
    undo: vi.fn(async () => undefined),
    redo: vi.fn(async () => undefined),
  };
}

function renderApp(overrides?: Parameters<typeof createStoreState>[0]) {
  mockedUseAppStore.mockReturnValue(createStoreState(overrides));
  render(<App />);
}

function createImageAsset(
  projectId: string,
  overrides?: {
    id?: string;
    name?: string;
    palette?: string[];
    luminance?: number;
  },
): SourceAsset {
  return {
    id: overrides?.id ?? "asset_a",
    kind: "image",
    projectId,
    name: overrides?.name ?? "Asset A",
    originalFileName: "asset-a.jpg",
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    orientation: 1,
    originalPath: "assets/original/asset-a.jpg",
    normalizedPath: "assets/normalized/asset-a.png",
    previewPath: "assets/previews/asset-a.webp",
    averageColor: "#112233",
    palette: overrides?.palette ?? ["#112233"],
    luminance: overrides?.luminance ?? 0.25,
    createdAt: "2026-04-06T00:00:00.000Z",
  };
}

function createGradientAsset(
  projectId: string,
  overrides?: {
    id?: string;
    name?: string;
    mode?: "linear" | "radial" | "conic";
  },
): SourceAsset {
  return {
    ...createImageAsset(projectId),
    id: overrides?.id ?? "asset_gradient",
    kind: "gradient",
    name: overrides?.name ?? "Gradient Source",
    originalFileName: `${overrides?.id ?? "asset_gradient"}.png`,
    mimeType: "image/png",
    recipe: {
      mode: overrides?.mode ?? "linear",
      from: "#112233",
      to: "#f97316",
      direction: "diagonal-down",
      viaColor: overrides?.mode === "linear" ? null : "#778899",
      viaPosition: 0.35,
      centerX: 0.25,
      centerY: 0.75,
      radialRadius: 0.6,
      radialInnerRadius: 0.2,
      conicAngle: 120,
      conicSpan: 180,
      conicRepeat: true,
    },
  };
}

function createPerlinAsset(
  projectId: string,
  overrides?: {
    id?: string;
    name?: string;
  },
): SourceAsset {
  return {
    ...createImageAsset(projectId),
    id: overrides?.id ?? "asset_perlin",
    kind: "perlin",
    name: overrides?.name ?? "Perlin Source",
    originalFileName: `${overrides?.id ?? "asset_perlin"}.png`,
    mimeType: "image/png",
    recipe: {
      color: "#0f766e",
      scale: 0.55,
      detail: 0.62,
      contrast: 0.47,
      distortion: 0.28,
      seed: 12345,
    },
  };
}

function createCellularAsset(projectId: string, name = "Cellular Source"): SourceAsset {
  return {
    ...createImageAsset(projectId),
    id: "asset_cellular",
    kind: "cellular",
    name,
    originalFileName: "asset_cellular.png",
    mimeType: "image/png",
    recipe: {
      color: "#8b5cf6",
      scale: 0.55,
      jitter: 0.6,
      edge: 0.55,
      contrast: 0.45,
      seed: 54321,
    },
  };
}

function createReactionAsset(projectId: string, name = "Reaction Source"): SourceAsset {
  return {
    ...createImageAsset(projectId),
    id: "asset_reaction",
    kind: "reaction",
    name,
    originalFileName: "asset_reaction.png",
    mimeType: "image/png",
    recipe: {
      color: "#ef4444",
      scale: 0.55,
      diffusion: 0.55,
      balance: 0.5,
      distortion: 0.2,
      seed: 24680,
    },
  };
}

function createWaveAsset(projectId: string, name = "Wave Source"): SourceAsset {
  return {
    ...createImageAsset(projectId),
    id: "asset_waves",
    kind: "waves",
    name,
    originalFileName: "asset_waves.png",
    mimeType: "image/png",
    recipe: {
      color: "#0ea5e9",
      scale: 0.55,
      interference: 0.65,
      directionality: 0.6,
      distortion: 0.2,
      seed: 112233,
    },
  };
}

function expectSliderEnabled(label: string) {
  const slider = screen.getByLabelText(label);
  expect(slider).not.toHaveAttribute("data-disabled");
}

function expectSliderHidden(label: string) {
  expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
}

describe("App layer thumbnails", () => {
  const revokeObjectUrlSpy = vi.fn();

  beforeEach(() => {
    mockedUseAppStore.mockReset();
    mockedRenderLayerThumbnailUrls.mockReset();
    mockedRenderLayerThumbnailUrls.mockImplementation(
      async (project) =>
        Object.fromEntries(
          project.layers.map((layer, index) => [layer.id, `blob:layer-thumb-${index + 1}`]),
        ),
    );
    revokeObjectUrlSpy.mockClear();
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlSpy,
    });
  });

  it("renders layer thumbnail placeholders before thumbnails resolve", () => {
    mockedRenderLayerThumbnailUrls.mockImplementationOnce(
      () => new Promise<Record<string, string>>(() => undefined),
    );
    const state = createStoreState({
      assets: [createImageAsset("project_placeholder")],
    });
    state.projects[0]!.layers[0]!.sourceIds = [state.assets[0]!.id];

    mockedUseAppStore.mockReturnValue(state);
    render(<App />);

    expect(
      screen.getByTestId(`layer-thumbnail-placeholder-${state.projects[0]!.layers[0]!.id}`),
    ).toBeInTheDocument();
  });

  it("renders live layer thumbnail images inside the layer rows", async () => {
    const state = createStoreState({
      assets: [createImageAsset("project_thumbs")],
    });
    const firstLayer = state.projects[0]!.layers[0]!;
    firstLayer.sourceIds = [state.assets[0]!.id];
    state.projects[0]!.layers.push({
      ...structuredClone(firstLayer),
      id: "layer_two",
      name: "Layer 2",
    });

    mockedUseAppStore.mockReturnValue(state);
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId(`layer-thumbnail-${firstLayer.id}`)).toBeInTheDocument();
      expect(screen.getByTestId("layer-thumbnail-layer_two")).toBeInTheDocument();
    });

    expect(mockedRenderLayerThumbnailUrls).toHaveBeenCalled();
  });

  it("refreshes thumbnails and revokes replaced object urls when the project changes", async () => {
    const initialState = createStoreState({
      assets: [createImageAsset("project_refresh")],
    });
    initialState.projects[0]!.layers[0]!.sourceIds = [initialState.assets[0]!.id];

    mockedUseAppStore.mockReturnValue(initialState);
    const { rerender } = render(<App />);

    await waitFor(() =>
      expect(
        screen.getByTestId(`layer-thumbnail-${initialState.projects[0]!.layers[0]!.id}`),
      ).toBeInTheDocument(),
    );

    const refreshedState = createStoreState({
      assets: [createImageAsset("project_refresh")],
    });
    refreshedState.projects[0]!.id = initialState.projects[0]!.id;
    refreshedState.activeProjectId = initialState.activeProjectId;
    refreshedState.projects[0]!.updatedAt = "2026-04-09T12:00:00.000Z";
    refreshedState.projects[0]!.layers[0]!.id = initialState.projects[0]!.layers[0]!.id;
    refreshedState.projects[0]!.layers[0]!.name = "Updated Layer";
    refreshedState.projects[0]!.layers[0]!.sourceIds = [refreshedState.assets[0]!.id];

    mockedRenderLayerThumbnailUrls
      .mockResolvedValueOnce({
        [initialState.projects[0]!.layers[0]!.id]: "blob:layer-thumb-1",
      })
      .mockResolvedValueOnce({
        [refreshedState.projects[0]!.layers[0]!.id]: "blob:layer-thumb-2",
      });
    mockedUseAppStore.mockReturnValue(refreshedState);
    rerender(<App />);

    await waitFor(() =>
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:layer-thumb-1"),
    );
  });

  it("revokes layer thumbnail object urls on unmount", async () => {
    const state = createStoreState({
      assets: [createImageAsset("project_unmount")],
    });
    state.projects[0]!.layers[0]!.sourceIds = [state.assets[0]!.id];

    mockedUseAppStore.mockReturnValue(state);
    const { unmount } = render(<App />);

    await waitFor(() =>
      expect(mockedRenderLayerThumbnailUrls).toHaveBeenCalled(),
    );

    unmount();

    expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:layer-thumb-1");
  });
});

describe("App conditional sliders", () => {
  beforeEach(() => {
    mockedUseAppStore.mockReset();
    renderGeneratedSourceToCanvasSpy.mockImplementation(() => undefined);
    renderGeneratedSourceToCanvasSpy.mockClear();
  });

  it("hides layout sliders outside their supported families", () => {
    renderApp({
      family: "grid",
      shapeMode: "rect",
      symmetryMode: "none",
      strategy: "random",
    });

    expectSliderEnabled("Corner Radius");
    expectSliderHidden("Strips Angle");
    expectSliderHidden("Wedge Angle");
    expectSliderHidden("Wedge Jitter");
    expectSliderHidden("Density");
    expectSliderEnabled("Columns");
    expectSliderEnabled("Rows");
    expectSliderHidden("Radial Segments");
    expectSliderHidden("Radial Rings");
    expectSliderHidden("Angle Offset");
    expectSliderHidden("Ring Phase");
    expectSliderHidden("Inner Radius");
    expect(screen.queryByLabelText("Child Rotation")).not.toBeInTheDocument();
    expectSliderHidden("Gutter");
    expectSliderEnabled("Gutter Horizontal");
    expectSliderEnabled("Gutter Vertical");
    expectSliderHidden("Block Depth");
    expectSliderHidden("Split Randomness");
    expectSliderHidden("Min Block Size");
    expectSliderHidden("Split Bias");
    expectSliderHidden("Radial Copies");
    expectSliderHidden("Symmetry Center X");
    expectSliderHidden("Symmetry Center Y");
    expectSliderHidden("Symmetry Angle Offset");
    expectSliderHidden("Clone Drift");
    expectSliderEnabled("Hide Percentage");
    expectSliderEnabled("Letterbox");
    expectSliderHidden("Source Bias");
    expectSliderHidden("Palette Emphasis");
    expectSliderHidden("Distribution");
    expect(screen.queryByLabelText("Structure")).not.toBeInTheDocument();
    expectSliderHidden("Depth");
    expectSliderHidden("Camera Distance");
    expectSliderHidden("Yaw");
    expectSliderHidden("Pitch");
    expectSliderHidden("Perspective");
    expectSliderHidden("Billboard");
    expectSliderHidden("Z Jitter");
    expectSliderHidden("Pan X");
    expectSliderHidden("Pan Y");
  });

  it("enables strips-only density and gutter for strips layouts", () => {
    renderApp({
      family: "strips",
      shapeMode: "rect",
      symmetryMode: "mirror-x",
      strategy: "random",
    });

    expectSliderEnabled("Corner Radius");
    expectSliderEnabled("Strips Angle");
    expectSliderHidden("Wedge Angle");
    expectSliderHidden("Wedge Jitter");
    expectSliderEnabled("Density");
    expectSliderHidden("Columns");
    expectSliderHidden("Rows");
    expectSliderHidden("Radial Segments");
    expectSliderHidden("Radial Rings");
    expectSliderHidden("Angle Offset");
    expectSliderHidden("Ring Phase");
    expectSliderHidden("Inner Radius");
    expect(screen.queryByLabelText("Child Rotation")).not.toBeInTheDocument();
    expectSliderEnabled("Gutter");
    expectSliderHidden("Gutter Horizontal");
    expectSliderHidden("Gutter Vertical");
    expectSliderHidden("Radial Copies");
    expectSliderEnabled("Symmetry Center X");
    expectSliderEnabled("Symmetry Center Y");
    expectSliderHidden("Symmetry Angle Offset");
    expectSliderEnabled("Clone Drift");
    expectSliderEnabled("Hide Percentage");
    expectSliderEnabled("Letterbox");
    expectSliderHidden("Distribution");
    expect(screen.queryByLabelText("Structure")).not.toBeInTheDocument();
  });

  it("shows density on the new UI scale and stores quadruple the committed value", () => {
    const state = createStoreState({
      family: "strips",
      shapeMode: "rect",
      symmetryMode: "none",
      strategy: "random",
      density: 2,
    });
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    expect(screen.getByText("0.50")).toBeInTheDocument();

    const slider = screen.getByLabelText("Density");
    fireEvent.keyDown(slider, { key: "End" });
    fireEvent.keyUp(slider, { key: "End" });

    expect(state.updateProject).toHaveBeenCalledTimes(1);

    const [[update]] = state.updateProject.mock.calls;
    expect(update).toBeTypeOf("function");

    const nextProject = createProjectEditorView(update(structuredClone(state.projects[0]!)));
    expect(nextProject.layout.density).toBe(4);
  });

  it("updates slider-backed settings continuously while dragging", () => {
    const state = createStoreState({
      family: "organic",
      shapeMode: "blob",
      symmetryMode: "none",
      strategy: "random",
      organicVariation: 0,
    });
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    const slider = screen.getByLabelText("Distribution");
    fireEvent.keyDown(slider, { key: "ArrowRight" });

    expect(state.updateProject).toHaveBeenCalledTimes(1);

    const [[update]] = state.updateProject.mock.calls;
    const nextProject = createProjectEditorView(update(structuredClone(state.projects[0]!)));
    expect(nextProject.layout.organicVariation).toBe(1);
  });

  it("hides unrelated layout sliders for blocks layouts and shows weighted and radial controls when active", () => {
    renderApp({
      family: "blocks",
      shapeMode: "rect",
      symmetryMode: "radial",
      strategy: "weighted",
    });

    expectSliderEnabled("Corner Radius");
    expectSliderHidden("Strips Angle");
    expectSliderHidden("Wedge Angle");
    expectSliderHidden("Wedge Jitter");
    expectSliderHidden("Density");
    expectSliderHidden("Columns");
    expectSliderHidden("Rows");
    expectSliderHidden("Radial Segments");
    expectSliderHidden("Radial Rings");
    expectSliderHidden("Angle Offset");
    expectSliderHidden("Ring Phase");
    expectSliderHidden("Inner Radius");
    expect(screen.queryByLabelText("Child Rotation")).not.toBeInTheDocument();
    expectSliderHidden("Gutter");
    expectSliderHidden("Gutter Horizontal");
    expectSliderHidden("Gutter Vertical");
    expectSliderEnabled("Block Depth");
    expectSliderEnabled("Split Randomness");
    expectSliderEnabled("Min Block Size");
    expectSliderEnabled("Split Bias");
    expectSliderEnabled("Radial Copies");
    expectSliderEnabled("Symmetry Center X");
    expectSliderEnabled("Symmetry Center Y");
    expectSliderEnabled("Symmetry Angle Offset");
    expectSliderEnabled("Clone Drift");
    expectSliderEnabled("Hide Percentage");
    expectSliderEnabled("Letterbox");
    expectSliderEnabled("Source Bias");
    expectSliderHidden("Palette Emphasis");
    expectSliderHidden("Distribution");
    expect(screen.queryByLabelText("Structure")).not.toBeInTheDocument();
  });

  it("enables palette emphasis only for palette assignment", () => {
    renderApp({
      family: "radial",
      shapeMode: "rect",
      symmetryMode: "quad",
      strategy: "palette",
    });

    expectSliderEnabled("Corner Radius");
    expectSliderHidden("Strips Angle");
    expectSliderHidden("Wedge Angle");
    expectSliderHidden("Wedge Jitter");
    expectSliderHidden("Density");
    expectSliderHidden("Columns");
    expectSliderHidden("Rows");
    expectSliderEnabled("Radial Segments");
    expectSliderEnabled("Radial Rings");
    expectSliderEnabled("Angle Offset");
    expectSliderEnabled("Ring Phase");
    expectSliderEnabled("Inner Radius");
    expect(screen.getByLabelText("Child Rotation")).toBeInTheDocument();
    expectSliderHidden("Gutter");
    expectSliderHidden("Gutter Horizontal");
    expectSliderHidden("Gutter Vertical");
    expectSliderHidden("Radial Copies");
    expectSliderEnabled("Symmetry Center X");
    expectSliderEnabled("Symmetry Center Y");
    expectSliderHidden("Symmetry Angle Offset");
    expectSliderEnabled("Clone Drift");
    expectSliderEnabled("Hide Percentage");
    expectSliderEnabled("Letterbox");
    expectSliderHidden("Source Bias");
    expectSliderEnabled("Palette Emphasis");
    expectSliderHidden("Distribution");
    expect(screen.queryByLabelText("Structure")).not.toBeInTheDocument();
  });

  it("shows the corner radius slider only for rect shape mode", () => {
    mockedUseAppStore.mockReturnValue(createStoreState({ shapeMode: "rect" }));
    const { rerender } = render(<App />);
    expectSliderEnabled("Corner Radius");
    expectSliderHidden("Wedge Angle");

    mockedUseAppStore.mockReturnValue(createStoreState({ shapeMode: "triangle" }));
    rerender(<App />);

    expectSliderHidden("Corner Radius");
  });

  it("shows wedge sliders for wedge and mixed geometry only", () => {
    mockedUseAppStore.mockReturnValue(createStoreState({ shapeMode: "wedge" }));
    const { rerender } = render(<App />);
    expectSliderEnabled("Wedge Angle");
    expectSliderEnabled("Wedge Jitter");

    mockedUseAppStore.mockReturnValue(createStoreState({ shapeMode: "mixed" }));
    rerender(<App />);

    expectSliderEnabled("Wedge Angle");
    expectSliderEnabled("Wedge Jitter");
  });

  it("includes interlock in geometry options only for grid layouts", () => {
    expect(getGeometryOptions("grid")).toContain("interlock");
    expect(getGeometryOptions("grid")).toContain("arc");
    expect(getGeometryOptions("strips")).not.toContain("interlock");
    expect(getGeometryOptions("blocks")).not.toContain("interlock");
    expect(getGeometryOptions("radial")).not.toContain("interlock");
    expect(getGeometryOptions("organic")).toContain("blob");
    expect(getGeometryOptions("organic")).toContain("arc");
    expect(getGeometryOptions("organic")).toContain("rect");
    expect(getGeometryOptions("flow")).toContain("arc");
    expect(getGeometryOptions("3d")).not.toContain("interlock");
  });

  it("coerces interlock back to triangle when leaving grid", () => {
    expect(coerceShapeModeForFamily("grid", "interlock")).toBe("interlock");
    expect(coerceShapeModeForFamily("blocks", "interlock")).toBe("triangle");
    expect(coerceShapeModeForFamily("strips", "triangle")).toBe("triangle");
    expect(coerceShapeModeForFamily("organic", "rect")).toBe("rect");
    expect(coerceShapeModeForFamily("grid", "blob")).toBe("rect");
    expect(coerceShapeModeForFamily("3d", "blob")).toBe("rect");
    expect(coerceShapeModeForFamily("flow", "arc")).toBe("arc");
  });

  it("shows the flow controls only for the flow family", () => {
    mockedUseAppStore.mockReturnValue(createStoreState({ family: "flow" }));
    const { rerender } = render(<App />);

    expectSliderEnabled("Density");
    expectSliderEnabled("Flow Curvature");
    expectSliderEnabled("Flow Coherence");
    expectSliderEnabled("Flow Branch Rate");
    expectSliderEnabled("Flow Taper");

    mockedUseAppStore.mockReturnValue(createStoreState({ family: "grid" }));
    rerender(<App />);

    expectSliderHidden("Flow Curvature");
    expectSliderHidden("Flow Coherence");
    expectSliderHidden("Flow Branch Rate");
    expectSliderHidden("Flow Taper");
  });

  it("shows the hollow ratio control for ring, arc, and mixed geometry", () => {
    mockedUseAppStore.mockReturnValue(createStoreState({ shapeMode: "ring" }));
    const { rerender } = render(<App />);
    expectSliderEnabled("Hollow Ratio");

    mockedUseAppStore.mockReturnValue(createStoreState({ shapeMode: "arc" }));
    rerender(<App />);
    expectSliderEnabled("Hollow Ratio");
    expectSliderEnabled("Wedge Angle");

    mockedUseAppStore.mockReturnValue(createStoreState({ shapeMode: "triangle" }));
    rerender(<App />);
    expectSliderHidden("Hollow Ratio");
  });

  it("shows density for organic layouts while hiding unrelated family controls", () => {
    renderApp({
      family: "organic",
      shapeMode: "blob",
      symmetryMode: "none",
      strategy: "random",
    });

    expectSliderHidden("Corner Radius");
    expectSliderHidden("Strips Angle");
    expectSliderHidden("Columns");
    expectSliderHidden("Rows");
    expectSliderHidden("Radial Segments");
    expectSliderHidden("Radial Rings");
    expectSliderHidden("Angle Offset");
    expectSliderHidden("Ring Phase");
    expectSliderHidden("Inner Radius");
    expectSliderHidden("Gutter");
    expectSliderHidden("Gutter Horizontal");
    expectSliderHidden("Gutter Vertical");
    expectSliderHidden("Block Depth");
    expectSliderHidden("Split Randomness");
    expectSliderHidden("Min Block Size");
    expectSliderHidden("Split Bias");
    expectSliderEnabled("Density");
    expectSliderEnabled("Distribution");
    expectSliderEnabled("Hide Percentage");
    expectSliderEnabled("Letterbox");
  });

  it("allows rect geometry inside organic layouts", () => {
    renderApp({
      family: "organic",
      shapeMode: "rect",
      symmetryMode: "none",
      strategy: "random",
    });

    expectSliderEnabled("Corner Radius");
    expectSliderEnabled("Density");
    expectSliderEnabled("Distribution");
  });

  it("shows 3d-only controls for 3d layouts", () => {
    renderApp({
      family: "3d",
      shapeMode: "rect",
      symmetryMode: "none",
      strategy: "random",
    });

    expectSliderEnabled("Corner Radius");
    expectSliderEnabled("Density");
    expect(screen.getByLabelText("Structure")).toBeInTheDocument();
    expectSliderEnabled("Distribution");
    expectSliderEnabled("Depth");
    expectSliderEnabled("Camera Distance");
    expectSliderEnabled("Pan X");
    expectSliderEnabled("Pan Y");
    expectSliderEnabled("Yaw");
    expectSliderEnabled("Pitch");
    expectSliderEnabled("Perspective");
    expectSliderEnabled("Billboard");
    expectSliderEnabled("Z Jitter");
    expectSliderEnabled("Rotation Jitter");
    expectSliderEnabled("Scale Jitter");
    expectSliderEnabled("Distortion");
    expectSliderHidden("Columns");
    expectSliderHidden("Rows");
    expectSliderHidden("Radial Segments");
    expectSliderHidden("Radial Rings");
    expectSliderHidden("Gutter");
    expectSliderHidden("Block Depth");
  });

  it("stores the organic distribution slider as an integer variation seed", () => {
    const state = createStoreState({
      family: "organic",
      shapeMode: "blob",
      symmetryMode: "none",
      strategy: "random",
      organicVariation: 0,
    });
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    const slider = screen.getByLabelText("Distribution");
    fireEvent.keyDown(slider, { key: "End" });
    fireEvent.keyUp(slider, { key: "End" });

    expect(state.updateProject).toHaveBeenCalledTimes(1);

    const [[update]] = state.updateProject.mock.calls;
    const nextProject = createProjectEditorView(update(structuredClone(state.projects[0]!)));
    expect(nextProject.layout.organicVariation).toBe(4096);
  });

  it("shows a side-by-side source mix area for enabled sources only", () => {
    renderApp({
      assets: [
        createImageAsset("project_unused", { id: "asset_a", name: "Asset A" }),
        createImageAsset("project_unused", { id: "asset_b", name: "Asset B" }),
      ],
      enabledSourceIds: ["asset_a"],
      sourceWeights: {
        asset_a: 2.5,
        asset_b: 0.5,
      },
    });

    expect(screen.getByLabelText("Asset A mix weight")).toBeInTheDocument();
    expect(screen.queryByLabelText("Asset B mix weight")).not.toBeInTheDocument();
    expect(screen.getByText("2.5x")).toBeInTheDocument();
  });

  it("stores source mix slider changes in source mapping weights", () => {
    const state = createStoreState({
      assets: [
        createImageAsset("project_unused", { id: "asset_a", name: "Asset A" }),
        createImageAsset("project_unused", { id: "asset_b", name: "Asset B" }),
      ],
    });
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    fireEvent.keyDown(screen.getByLabelText("Asset A mix weight"), {
      key: "End",
    });

    expect(state.updateProject).toHaveBeenCalledTimes(1);

    const [[update]] = state.updateProject.mock.calls;
    const nextProject = createProjectEditorView(update(structuredClone(state.projects[0]!)));
    expect(nextProject.sourceMapping.sourceWeights).toEqual({
      asset_a: 4,
    });
  });
});

describe("App inspector grouping", () => {
  beforeEach(() => {
    mockedUseAppStore.mockReset();
    renderGeneratedSourceToCanvasSpy.mockImplementation(() => undefined);
    renderGeneratedSourceToCanvasSpy.mockClear();
  });

  it("separates layer controls from project settings", () => {
    renderApp();

    expect(screen.getByRole("region", { name: "Layers" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Preview" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Sources" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Inspector" })).toBeInTheDocument();

    const layerControls = screen.getByRole("region", {
      name: "Layer Controls",
    });
    const projectSettings = screen.getByRole("region", {
      name: "Project Settings",
    });

    expect(within(layerControls).getByText("Editing Layer 1")).toBeInTheDocument();
    expect(within(layerControls).getByText("Layout")).toBeInTheDocument();
    expect(within(layerControls).getByText("Mapping")).toBeInTheDocument();
    expect(within(layerControls).getByText("Effects + Finish")).toBeInTheDocument();
    expect(
      within(layerControls).queryByText("Canvas Background"),
    ).not.toBeInTheDocument();

    expect(
      within(projectSettings).getByText(
        "Canvas and export controls apply to the full composition.",
      ),
    ).toBeInTheDocument();
    expect(within(projectSettings).getByText("Canvas")).toBeInTheDocument();
    expect(within(projectSettings).getByText("Export")).toBeInTheDocument();
    expect(within(projectSettings).getByLabelText("Canvas W")).toBeInTheDocument();
    expect(within(projectSettings).getByText("Canvas Background")).toBeInTheDocument();
    expect(within(projectSettings).getByLabelText("Export W")).toBeInTheDocument();
    expect(within(projectSettings).queryByText("Layout")).not.toBeInTheDocument();
  });

  it("renders sources, layers, and preview in main-grid order", () => {
    renderApp();

    const sources = screen.getByRole("region", { name: "Sources" });
    const layers = screen.getByRole("region", { name: "Layers" });
    const preview = screen.getByRole("region", { name: "Preview" });

    expect(
      sources.compareDocumentPosition(layers) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      layers.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("keeps sources in a persistent rail layout", () => {
    renderApp({
      assets: [
        createImageAsset("project_unused", { id: "asset_a", name: "Asset A" }),
        createImageAsset("project_unused", { id: "asset_b", name: "Asset B" }),
      ],
    });

    const sources = screen.getByRole("region", { name: "Sources" });
    expect(within(sources).getByTestId("sources-rail")).toBeInTheDocument();
    expect(
      within(sources).getByText("Asset A").closest("[data-layout]"),
    ).toHaveAttribute("data-layout", "rail");
  });

  it("replaces layer move buttons with drag handles", () => {
    renderApp();

    expect(screen.getByLabelText("Reorder Layer 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Up" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Down" })).not.toBeInTheDocument();
  });

  it("keeps moved canvas controls wired to project updates", () => {
    const state = createStoreState();
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    const projectSettings = screen.getByRole("region", {
      name: "Project Settings",
    });
    const slider = within(projectSettings).getByLabelText("Canvas W");

    fireEvent.keyDown(slider, { key: "End" });
    fireEvent.keyUp(slider, { key: "End" });

    expect(state.updateProject).toHaveBeenCalledTimes(1);

    const [[update]] = state.updateProject.mock.calls;
    const nextProject = update(structuredClone(state.projects[0]!));
    expect(nextProject.canvas.width).toBe(3840);
  });
});

describe("App gradient sources", () => {
  beforeEach(() => {
    mockedUseAppStore.mockReset();
    renderGeneratedSourceToCanvasSpy.mockImplementation(() => undefined);
    renderGeneratedSourceToCanvasSpy.mockClear();
  });

  it("opens the gradient dialog with linear defaults", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getAllByText("Add Source")[0]!);
    await user.click(screen.getByRole("tab", { name: "Gradient" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText("Mode")).toBeInTheDocument();
    expect(within(dialog).getByText("Linear")).toBeInTheDocument();
    expect(within(dialog).getByText("Direction")).toBeInTheDocument();
    expect(within(dialog).getByTestId("source-editor-preview-layout")).toBeInTheDocument();
    expect(within(dialog).getByTestId("source-editor-preview")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Center X")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Angle")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(renderGeneratedSourceToCanvasSpy).toHaveBeenCalled(),
    );
  });

  it("shows radial controls and repopulates them when editing a radial gradient", async () => {
    const user = userEvent.setup();
    const state = createStoreState({
      assets: [createGradientAsset("project_unused", { mode: "radial", name: "Radial Burst" })],
    });
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    await user.click(screen.getByLabelText("Edit Radial Burst"));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByText("Radial")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Center X")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Center Y")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Outer Radius")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Inner Radius")).toBeInTheDocument();
    expect(within(dialog).queryByText("Direction")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Angle")).not.toBeInTheDocument();
    expect(
      within(dialog).getByLabelText("Enable midpoint color"),
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId("source-editor-preview")).toBeInTheDocument();
    expect(within(dialog).getAllByDisplayValue("#778899")).toHaveLength(2);
    expect(within(dialog).getByText("25%")).toBeInTheDocument();
    expect(within(dialog).getByText("75%")).toBeInTheDocument();
  });

  it("shows conic controls when switching the gradient mode", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getAllByText("Add Source")[0]!);
    await user.click(screen.getByRole("tab", { name: "Gradient" }));
    const dialog = screen.getByRole("dialog");
    const [modeTrigger] = within(dialog).getAllByRole("combobox");
    await user.click(modeTrigger!);
    await user.click(await screen.findByRole("option", { name: "Conic" }));

    expect(within(dialog).getByLabelText("Center X")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Center Y")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Angle")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Span")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Repeat span")).toBeInTheDocument();
    expect(within(dialog).getByTestId("source-editor-preview")).toBeInTheDocument();
    expect(within(dialog).queryByText("Direction")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Outer Radius")).not.toBeInTheDocument();
  });

  it("sends normalized gradient preview recipes to the preview renderer", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getAllByText("Add Source")[0]!);
    await user.click(screen.getByRole("tab", { name: "Gradient" }));
    const dialog = screen.getByRole("dialog");

    renderGeneratedSourceToCanvasSpy.mockClear();

    const [modeTrigger] = within(dialog).getAllByRole("combobox");
    await user.click(modeTrigger!);
    await user.click(await screen.findByRole("option", { name: "Conic" }));
    await user.click(within(dialog).getByLabelText("Enable midpoint color"));
    fireEvent.change(within(dialog).getByLabelText("Start color"), {
      target: { value: "#010203" },
    });
    fireEvent.change(within(dialog).getByLabelText("End color"), {
      target: { value: "#aabbcc" },
    });
    fireEvent.change(within(dialog).getAllByDisplayValue("#94a3b8")[0]!, {
      target: { value: "#445566" },
    });
    fireEvent.keyDown(within(dialog).getByLabelText("Center X"), { key: "Home" });
    fireEvent.keyDown(within(dialog).getByLabelText("Center Y"), { key: "End" });

    await waitFor(() =>
      expect(renderGeneratedSourceToCanvasSpy.mock.calls.at(-1)?.[1]).toEqual(
        expect.objectContaining({
          kind: "gradient",
          recipe: expect.objectContaining({
            from: "#010203",
            to: "#aabbcc",
            viaColor: "#445566",
            centerX: 0,
            centerY: 1,
          }),
        }),
      ),
    );
  });

  it("submits normalized conic gradient recipes", async () => {
    const user = userEvent.setup();
    const state = createStoreState();
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    await user.click(screen.getAllByText("Add Source")[0]!);
    await user.click(screen.getByRole("tab", { name: "Gradient" }));
    const dialog = screen.getByRole("dialog");

    const [modeTrigger] = within(dialog).getAllByRole("combobox");
    await user.click(modeTrigger!);
    await user.click(await screen.findByRole("option", { name: "Conic" }));

    await user.click(within(dialog).getByLabelText("Enable midpoint color"));
    fireEvent.change(within(dialog).getByLabelText("Start color"), {
      target: { value: "#010203" },
    });
    fireEvent.change(within(dialog).getByLabelText("End color"), {
      target: { value: "#aabbcc" },
    });
    fireEvent.change(within(dialog).getAllByDisplayValue("#94a3b8")[0]!, {
      target: { value: "#445566" },
    });
    fireEvent.keyDown(within(dialog).getByLabelText("Center X"), { key: "Home" });
    fireEvent.keyDown(within(dialog).getByLabelText("Center Y"), { key: "End" });
    fireEvent.keyDown(within(dialog).getByLabelText("Angle"), { key: "ArrowRight" });
    await user.click(within(dialog).getByLabelText("Repeat span"));
    await user.click(within(dialog).getByRole("button", { name: "Add source" }));

    expect(state.addGradientSource).toHaveBeenCalledTimes(1);
    expect(state.addGradientSource).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "conic",
        from: "#010203",
        to: "#aabbcc",
        viaColor: "#445566",
        centerX: expect.any(Number),
        centerY: expect.any(Number),
        conicAngle: expect.any(Number),
        conicSpan: 360,
        conicRepeat: true,
      }),
    );
  });

  it("shows a perlin tab and submits normalized perlin recipes", async () => {
    const user = userEvent.setup();
    const state = createStoreState();
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    await user.click(screen.getAllByText("Add Source")[0]!);
    await user.click(screen.getByRole("tab", { name: "Perlin" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByTestId("source-editor-preview-layout")).toBeInTheDocument();
    expect(within(dialog).getByTestId("source-editor-preview")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Base color"), {
      target: { value: "#224466" },
    });
    fireEvent.keyDown(within(dialog).getByLabelText("Scale"), { key: "End" });
    fireEvent.keyDown(within(dialog).getByLabelText("Detail"), { key: "Home" });
    fireEvent.keyDown(within(dialog).getByLabelText("Contrast"), { key: "ArrowRight" });
    fireEvent.keyDown(within(dialog).getByLabelText("Distortion"), { key: "ArrowRight" });
    await user.click(within(dialog).getByRole("button", { name: "Add source" }));

    expect(state.addPerlinSource).toHaveBeenCalledTimes(1);
    expect(state.addPerlinSource).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "#224466",
        scale: 1,
        detail: 0,
        contrast: expect.any(Number),
        distortion: expect.any(Number),
        seed: expect.any(Number),
      }),
    );
  });

  it("submits normalized cellular recipes", async () => {
    const user = userEvent.setup();
    const state = createStoreState();
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    await user.click(screen.getAllByText("Add Source")[0]!);
    await user.click(screen.getByRole("tab", { name: "Cellular" }));
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Base color"), {
      target: { value: "#6655cc" },
    });
    fireEvent.keyDown(within(dialog).getByLabelText("Scale"), { key: "End" });
    fireEvent.keyDown(within(dialog).getByLabelText("Jitter"), { key: "Home" });
    fireEvent.keyDown(within(dialog).getByLabelText("Edge"), { key: "ArrowRight" });
    fireEvent.keyDown(within(dialog).getByLabelText("Contrast"), { key: "ArrowRight" });
    await user.click(within(dialog).getByRole("button", { name: "Add source" }));

    expect(state.addCellularSource).toHaveBeenCalledTimes(1);
    expect(state.addCellularSource).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "#6655cc",
        scale: 1,
        jitter: 0,
        edge: expect.any(Number),
        contrast: expect.any(Number),
        seed: expect.any(Number),
      }),
    );
  });

  it("submits normalized reaction recipes", async () => {
    const user = userEvent.setup();
    const state = createStoreState();
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    await user.click(screen.getAllByText("Add Source")[0]!);
    await user.click(screen.getByRole("tab", { name: "Reaction" }));
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Base color"), {
      target: { value: "#cc5533" },
    });
    fireEvent.keyDown(within(dialog).getByLabelText("Scale"), { key: "End" });
    fireEvent.keyDown(within(dialog).getByLabelText("Diffusion"), { key: "Home" });
    fireEvent.keyDown(within(dialog).getByLabelText("Balance"), { key: "ArrowRight" });
    fireEvent.keyDown(within(dialog).getByLabelText("Distortion"), { key: "ArrowRight" });
    await user.click(within(dialog).getByRole("button", { name: "Add source" }));

    expect(state.addReactionSource).toHaveBeenCalledTimes(1);
    expect(state.addReactionSource).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "#cc5533",
        scale: 1,
        diffusion: 0,
        balance: expect.any(Number),
        distortion: expect.any(Number),
        seed: expect.any(Number),
      }),
    );
  });

  it("submits normalized waves recipes", async () => {
    const user = userEvent.setup();
    const state = createStoreState();
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    await user.click(screen.getAllByText("Add Source")[0]!);
    await user.click(screen.getByRole("tab", { name: "Waves" }));
    const dialog = screen.getByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Base color"), {
      target: { value: "#2299bb" },
    });
    fireEvent.keyDown(within(dialog).getByLabelText("Scale"), { key: "End" });
    fireEvent.keyDown(within(dialog).getByLabelText("Interference"), { key: "Home" });
    fireEvent.keyDown(within(dialog).getByLabelText("Directionality"), { key: "ArrowRight" });
    fireEvent.keyDown(within(dialog).getByLabelText("Distortion"), { key: "ArrowRight" });
    await user.click(within(dialog).getByRole("button", { name: "Add source" }));

    expect(state.addWaveSource).toHaveBeenCalledTimes(1);
    expect(state.addWaveSource).toHaveBeenCalledWith(
      expect.objectContaining({
        color: "#2299bb",
        scale: 1,
        interference: 0,
        directionality: expect.any(Number),
        distortion: expect.any(Number),
        seed: expect.any(Number),
      }),
    );
  });

  it("keeps the preview hidden for image and solid tabs", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getAllByText("Add Source")[0]!);
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByTestId("source-editor-preview")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("tab", { name: "Solid" }));
    dialog = screen.getByRole("dialog");

    expect(within(dialog).queryByTestId("source-editor-preview")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByTestId("source-editor-preview-layout"),
    ).not.toBeInTheDocument();
  });

  it("repopulates the perlin editor for existing perlin assets", async () => {
    const user = userEvent.setup();
    const state = createStoreState({
      assets: [createPerlinAsset("project_unused", { name: "Sea Foam" })],
    });
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    await user.click(screen.getByLabelText("Edit Sea Foam"));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByRole("tab", { name: "Perlin" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(within(dialog).getByDisplayValue("Sea Foam")).toBeInTheDocument();
    expect(within(dialog).getAllByDisplayValue("#0f766e")).toHaveLength(2);
    expect(within(dialog).getByLabelText("Scale")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Detail")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Contrast")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Distortion")).toBeInTheDocument();
    expect(within(dialog).getByTestId("source-editor-preview")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /Regenerate/i }),
    ).toBeInTheDocument();
  });

  it("repopulates the cellular, reaction, and waves editors for existing assets", async () => {
    const user = userEvent.setup();
    const state = createStoreState({
      assets: [
        createCellularAsset("project_unused", "Cell Sample"),
        createReactionAsset("project_unused", "React Sample"),
        createWaveAsset("project_unused", "Wave Sample"),
      ],
    });
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    await user.click(screen.getByLabelText("Edit Cell Sample"));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: "Cellular" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(within(dialog).getByLabelText("Jitter")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Edge")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByLabelText("Edit React Sample"));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: "Reaction" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(within(dialog).getByLabelText("Diffusion")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Balance")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByLabelText("Edit Wave Sample"));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("tab", { name: "Waves" })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(within(dialog).getByLabelText("Interference")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Directionality")).toBeInTheDocument();
  });

  it("sends normalized perlin preview recipes to the preview renderer", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getAllByText("Add Source")[0]!);
    await user.click(screen.getByRole("tab", { name: "Perlin" }));
    const dialog = screen.getByRole("dialog");

    renderGeneratedSourceToCanvasSpy.mockClear();

    fireEvent.change(within(dialog).getByLabelText("Base color"), {
      target: { value: "#224466" },
    });
    fireEvent.keyDown(within(dialog).getByLabelText("Scale"), { key: "End" });
    fireEvent.keyDown(within(dialog).getByLabelText("Detail"), { key: "Home" });

    await waitFor(() =>
      expect(renderGeneratedSourceToCanvasSpy.mock.calls.at(-1)?.[1]).toEqual(
        expect.objectContaining({
          kind: "perlin",
          recipe: expect.objectContaining({
            color: "#224466",
            scale: 1,
            detail: 0,
          }),
        }),
      ),
    );
  });
});

describe("App source import progress badge", () => {
  beforeEach(() => {
    mockedUseAppStore.mockReset();
    renderGeneratedSourceToCanvasSpy.mockImplementation(() => undefined);
    renderGeneratedSourceToCanvasSpy.mockClear();
  });

  it("hides the source processing badge by default", () => {
    renderApp();

    expect(screen.queryByText("Processing Sources 0/3")).not.toBeInTheDocument();
  });

  it("shows the source processing badge when image imports are in progress", () => {
    renderApp({
      sourceImportProgress: { processed: 2, total: 8 },
    });

    expect(screen.getByText("Processing Sources 2/8")).toBeInTheDocument();
  });

  it("can show source processing alongside rendering", () => {
    mockedUseAppStore.mockReturnValue(
      createStoreState({
        sourceImportProgress: { processed: 1, total: 3 },
      }),
    );
    render(<App />);

    expect(screen.getByText("Rendering")).toBeInTheDocument();
    expect(screen.getByText("Processing Sources 1/3")).toBeInTheDocument();
  });
});

describe("App kaleidoscope controls", () => {
  beforeEach(() => {
    mockedUseAppStore.mockReset();
  });

  it("hides advanced kaleidoscope controls when the effect is inactive", () => {
    renderApp({ kaleidoscopeSegments: 1 });

    expectSliderEnabled("Kaleidoscope");
    expectSliderHidden("Center X");
    expectSliderHidden("Center Y");
    expectSliderHidden("Angle Offset");
    expectSliderHidden("Rotation Drift");
    expectSliderHidden("Scale Falloff");
    expectSliderHidden("Kaleidoscope Opacity");
    expect(screen.queryByLabelText("Mirror Mode")).not.toBeInTheDocument();
    expect(screen.queryByText("Mirror Overlay")).not.toBeInTheDocument();
  });

  it("shows advanced kaleidoscope controls when segments exceed one", () => {
    renderApp({ kaleidoscopeSegments: 3 });

    expectSliderEnabled("Kaleidoscope");
    expectSliderEnabled("Center X");
    expectSliderEnabled("Center Y");
    expectSliderEnabled("Angle Offset");
    expectSliderEnabled("Rotation Drift");
    expectSliderEnabled("Scale Falloff");
    expectSliderEnabled("Kaleidoscope Opacity");
    expect(screen.getByLabelText("Mirror Mode")).toBeInTheDocument();
    expect(screen.queryByText("Mirror Overlay")).not.toBeInTheDocument();
  });
});

describe("App undo and redo controls", () => {
  beforeEach(() => {
    mockedUseAppStore.mockReset();
  });

  it("renders undo and redo buttons with store availability", () => {
    mockedUseAppStore.mockReturnValue({
      ...createStoreState(),
      canUndo: true,
      canRedo: false,
    });

    render(<App />);

    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
  });

  it("invokes undo and redo from toolbar buttons and shortcuts", () => {
    const undo = vi.fn(async () => undefined);
    const redo = vi.fn(async () => undefined);

    mockedUseAppStore.mockReturnValue({
      ...createStoreState(),
      canUndo: true,
      canRedo: true,
      undo,
      redo,
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: "y", ctrlKey: true });

    expect(undo).toHaveBeenCalledTimes(2);
    expect(redo).toHaveBeenCalledTimes(3);
  });

  it("ignores undo shortcuts while typing in editable inputs", () => {
    const undo = vi.fn(async () => undefined);

    mockedUseAppStore.mockReturnValue({
      ...createStoreState(),
      canUndo: true,
      undo,
    });

    render(<App />);

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: "z", ctrlKey: true });

    expect(undo).not.toHaveBeenCalled();

    input.remove();
  });
});

describe("App source removal", () => {
  beforeEach(() => {
    mockedUseAppStore.mockReset();
    vi.restoreAllMocks();
  });

  it("confirms and removes a source from the tray", async () => {
    const asset = createImageAsset("project_test");
    const removeSource = vi.fn(async () => undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    mockedUseAppStore.mockReturnValue({
      ...createStoreState({ assets: [asset] }),
      removeSource,
    });

    render(<App />);

    fireEvent.click(screen.getByLabelText("Remove Asset A"));

    expect(window.confirm).toHaveBeenCalledWith(
      'Remove "Asset A" from this project?',
    );
    expect(removeSource).toHaveBeenCalledWith("asset_a");
  });

  it("does not remove a source when confirmation is cancelled", async () => {
    const asset = createImageAsset("project_test");
    const removeSource = vi.fn(async () => undefined);
    vi.spyOn(window, "confirm").mockReturnValue(false);

    mockedUseAppStore.mockReturnValue({
      ...createStoreState({ assets: [asset] }),
      removeSource,
    });

    render(<App />);

    fireEvent.click(screen.getByLabelText("Remove Asset A"));

    expect(removeSource).not.toHaveBeenCalled();
  });
});
