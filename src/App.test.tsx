import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
type AppStoreState = ReturnType<typeof useAppStore.getState>;
type UpdateProject = AppStoreState["updateProject"];

function createStoreState(overrides?: {
  family?: "grid" | "strips" | "blocks" | "radial";
  shapeMode?: "rect" | "triangle" | "interlock" | "ring" | "wedge" | "mixed";
  symmetryMode?: "none" | "mirror-x" | "mirror-y" | "quad" | "radial";
  density?: number;
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
    project.sourceIds = assets.map((asset) => asset.id);
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

function createImageAsset(projectId: string): SourceAsset {
  return {
    id: "asset_a",
    kind: "image",
    projectId,
    name: "Asset A",
    originalFileName: "asset-a.jpg",
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    orientation: 1,
    originalPath: "assets/original/asset-a.jpg",
    normalizedPath: "assets/normalized/asset-a.png",
    previewPath: "assets/previews/asset-a.webp",
    averageColor: "#112233",
    palette: ["#112233"],
    luminance: 0.25,
    createdAt: "2026-04-06T00:00:00.000Z",
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
    expect(getGeometryOptions("strips")).not.toContain("interlock");
    expect(getGeometryOptions("blocks")).not.toContain("interlock");
    expect(getGeometryOptions("radial")).not.toContain("interlock");
  });

  it("coerces interlock back to triangle when leaving grid", () => {
    expect(coerceShapeModeForFamily("grid", "interlock")).toBe("interlock");
    expect(coerceShapeModeForFamily("blocks", "interlock")).toBe("triangle");
    expect(coerceShapeModeForFamily("strips", "triangle")).toBe("triangle");
  });
});

describe("App source import progress badge", () => {
  beforeEach(() => {
    mockedUseAppStore.mockReset();
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
