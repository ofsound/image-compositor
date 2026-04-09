import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as assetLib from "@/lib/assets";
import { createProjectDocument } from "@/lib/project-defaults";
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
  const actual = await vi.importActual<typeof import("@/lib/assets")>(
    "@/lib/assets",
  );

  return {
    ...actual,
    renderGeneratedSourceToCanvas: vi.fn(),
  };
});

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
  const project = createProjectDocument("Slider Spec");

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
    updateProject,
    importFiles: vi.fn(async () => undefined),
    addSolidSource: vi.fn(async () => undefined),
    addGradientSource: vi.fn(async () => undefined),
    addNoiseSource: vi.fn(async () => undefined),
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

function createNoiseAsset(
  projectId: string,
  overrides?: {
    id?: string;
    name?: string;
  },
): SourceAsset {
  return {
    ...createImageAsset(projectId),
    id: overrides?.id ?? "asset_noise",
    kind: "noise",
    name: overrides?.name ?? "Noise Source",
    originalFileName: `${overrides?.id ?? "asset_noise"}.png`,
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

function expectSliderEnabled(label: string) {
  const slider = screen.getByLabelText(label);
  expect(slider).not.toHaveAttribute("data-disabled");
}

function expectSliderHidden(label: string) {
  expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
}

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

    const nextProject = update(structuredClone(state.projects[0]!));
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
    const nextProject = update(structuredClone(state.projects[0]!));
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
    const nextProject = update(structuredClone(state.projects[0]!));
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

    expect(screen.getByText("Source Mix")).toBeInTheDocument();
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
    const nextProject = update(structuredClone(state.projects[0]!));
    expect(nextProject.sourceMapping.sourceWeights).toEqual({
      asset_a: 4,
    });
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

  it("shows a noise tab and submits normalized noise recipes", async () => {
    const user = userEvent.setup();
    const state = createStoreState();
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    await user.click(screen.getAllByText("Add Source")[0]!);
    await user.click(screen.getByRole("tab", { name: "Noise" }));
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

    expect(state.addNoiseSource).toHaveBeenCalledTimes(1);
    expect(state.addNoiseSource).toHaveBeenCalledWith(
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

  it("repopulates the noise editor for existing noise assets", async () => {
    const user = userEvent.setup();
    const state = createStoreState({
      assets: [createNoiseAsset("project_unused", { name: "Sea Foam" })],
    });
    mockedUseAppStore.mockReturnValue(state);

    render(<App />);

    await user.click(screen.getByLabelText("Edit Sea Foam"));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByRole("tab", { name: "Noise" })).toHaveAttribute(
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

  it("sends normalized noise preview recipes to the preview renderer", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getAllByText("Add Source")[0]!);
    await user.click(screen.getByRole("tab", { name: "Noise" }));
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
          kind: "noise",
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
