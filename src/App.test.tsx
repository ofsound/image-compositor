import { render, screen } from "@testing-library/react";
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
