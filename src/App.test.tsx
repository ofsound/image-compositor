import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectDocument } from "@/lib/project-defaults";
import App from "@/App";
import { useAppStore } from "@/state/use-app-store";

vi.mock("sonner", () => ({
  Toaster: () => null,
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

function createStoreState(overrides?: {
  family?: "grid" | "strips" | "blocks" | "radial";
  shapeMode?: "rect" | "triangle" | "ring" | "wedge" | "mixed";
  symmetryMode?: "none" | "mirror-x" | "mirror-y" | "quad" | "radial";
  strategy?:
    | "random"
    | "weighted"
    | "sequential"
    | "luminance"
    | "palette"
    | "symmetry";
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

  if (overrides?.strategy) {
    project.sourceMapping.strategy = overrides.strategy;
  }

  return {
    ready: true,
    busy: false,
    status: "Ready.",
    projects: [project],
    assets: [],
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
    updateProject: vi.fn(async () => undefined),
    importFiles: vi.fn(async () => undefined),
    addSolidSource: vi.fn(async () => undefined),
    addGradientSource: vi.fn(async () => undefined),
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

function expectSliderDisabled(label: string) {
  const slider = screen.getByLabelText(label);
  expect(slider).toHaveAttribute("data-disabled");
}

function expectSliderEnabled(label: string) {
  const slider = screen.getByLabelText(label);
  expect(slider).not.toHaveAttribute("data-disabled");
}

describe("App conditional sliders", () => {
  beforeEach(() => {
    mockedUseAppStore.mockReset();
  });

  it("disables layout sliders outside their supported families", () => {
    renderApp({
      family: "grid",
      shapeMode: "rect",
      symmetryMode: "none",
      strategy: "random",
    });

    expectSliderEnabled("Corner Radius");
    expectSliderDisabled("Density");
    expectSliderEnabled("Columns");
    expectSliderEnabled("Rows");
    expectSliderEnabled("Gutter");
    expectSliderDisabled("Radial Copies");
    expectSliderEnabled("Hide Percentage");
    expectSliderDisabled("Source Bias");
    expectSliderDisabled("Palette Emphasis");
  });

  it("enables strips-only density and gutter for strips layouts", () => {
    renderApp({
      family: "strips",
      shapeMode: "rect",
      symmetryMode: "mirror-x",
      strategy: "random",
    });

    expectSliderEnabled("Corner Radius");
    expectSliderEnabled("Density");
    expectSliderDisabled("Columns");
    expectSliderDisabled("Rows");
    expectSliderEnabled("Gutter");
    expectSliderDisabled("Radial Copies");
    expectSliderEnabled("Hide Percentage");
  });

  it("disables gutter for blocks layouts and enables weighted and radial controls when active", () => {
    renderApp({
      family: "blocks",
      shapeMode: "rect",
      symmetryMode: "radial",
      strategy: "weighted",
    });

    expectSliderEnabled("Corner Radius");
    expectSliderDisabled("Density");
    expectSliderDisabled("Columns");
    expectSliderDisabled("Rows");
    expectSliderDisabled("Gutter");
    expectSliderEnabled("Radial Copies");
    expectSliderEnabled("Hide Percentage");
    expectSliderEnabled("Source Bias");
    expectSliderDisabled("Palette Emphasis");
  });

  it("enables palette emphasis only for palette assignment", () => {
    renderApp({
      family: "radial",
      shapeMode: "rect",
      symmetryMode: "quad",
      strategy: "palette",
    });

    expectSliderEnabled("Corner Radius");
    expectSliderDisabled("Density");
    expectSliderDisabled("Columns");
    expectSliderDisabled("Rows");
    expectSliderDisabled("Gutter");
    expectSliderDisabled("Radial Copies");
    expectSliderEnabled("Hide Percentage");
    expectSliderDisabled("Source Bias");
    expectSliderEnabled("Palette Emphasis");
  });

  it("enables the corner radius slider only for rect shape mode", () => {
    renderApp({ shapeMode: "rect" });
    expectSliderEnabled("Corner Radius");

    mockedUseAppStore.mockReturnValue(
      createStoreState({ shapeMode: "triangle" }),
    );
    render(<App />);

    expect(screen.getAllByLabelText("Corner Radius")).toHaveLength(2);
    expect(screen.getAllByLabelText("Corner Radius")[1]).toHaveAttribute(
      "data-disabled",
    );
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
