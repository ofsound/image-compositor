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
    renderApp({ family: "grid", symmetryMode: "none", strategy: "random" });

    expectSliderDisabled("Density");
    expectSliderEnabled("Columns");
    expectSliderEnabled("Rows");
    expectSliderEnabled("Gutter");
    expectSliderDisabled("Radial Copies");
    expectSliderDisabled("Source Bias");
    expectSliderDisabled("Palette Emphasis");
  });

  it("enables strips-only density and gutter for strips layouts", () => {
    renderApp({ family: "strips", symmetryMode: "mirror-x", strategy: "random" });

    expectSliderEnabled("Density");
    expectSliderDisabled("Columns");
    expectSliderDisabled("Rows");
    expectSliderEnabled("Gutter");
    expectSliderDisabled("Radial Copies");
  });

  it("disables gutter for blocks layouts and enables weighted and radial controls when active", () => {
    renderApp({
      family: "blocks",
      symmetryMode: "radial",
      strategy: "weighted",
    });

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
      symmetryMode: "quad",
      strategy: "palette",
    });

    expectSliderDisabled("Density");
    expectSliderDisabled("Columns");
    expectSliderDisabled("Rows");
    expectSliderDisabled("Gutter");
    expectSliderDisabled("Radial Copies");
    expectSliderDisabled("Source Bias");
    expectSliderEnabled("Palette Emphasis");
  });
});
