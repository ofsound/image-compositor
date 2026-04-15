import {
  getSelectedLayer,
  normalizeCompositorLayer,
  normalizeProjectDocument,
} from "@/lib/project-defaults";
import type {
  CanvasSettings,
  CompositingSettings,
  CompositorLayer,
  DrawSettings,
  EffectSettings,
  FinishSettings,
  GeneratorPreset,
  LayoutSettings,
  ProjectDocument,
  RenderPass,
  SourceMappingSettings,
  WordsSettings,
} from "@/types/project";

type SelectedLayerEditorFields = {
  sourceIds: string[];
  layout: LayoutSettings;
  sourceMapping: SourceMappingSettings;
  effects: EffectSettings;
  compositing: CompositingSettings;
  finish: FinishSettings;
  draw: DrawSettings;
  words: WordsSettings;
  activeSeed: number;
  presets: GeneratorPreset[];
  passes: RenderPass[];
};

export type ProjectEditorView = Omit<ProjectDocument, keyof SelectedLayerEditorFields> &
  SelectedLayerEditorFields & {
    canvas: CanvasSettings;
  };

function createEditorLayer(layer: CompositorLayer) {
  return {
    sourceIds: structuredClone(layer.sourceIds),
    layout: structuredClone(layer.layout),
    sourceMapping: structuredClone(layer.sourceMapping),
    effects: structuredClone(layer.effects),
    compositing: structuredClone(layer.compositing),
    finish: structuredClone(layer.finish),
    draw: structuredClone(layer.draw),
    words: structuredClone(layer.words),
    activeSeed: layer.activeSeed,
    presets: structuredClone(layer.presets),
    passes: structuredClone(layer.passes),
  } satisfies SelectedLayerEditorFields;
}

export function createProjectEditorView(project: ProjectDocument): ProjectEditorView {
  const selectedLayer = getSelectedLayer(project);

  if (!selectedLayer) {
    return project as ProjectEditorView;
  }

  return {
    ...project,
    canvas: {
      ...structuredClone(project.canvas),
      inset: selectedLayer.inset,
    },
    ...createEditorLayer(selectedLayer),
  };
}

function applyEditorFieldsToLayer(
  layer: CompositorLayer,
  view: Pick<ProjectEditorView, keyof SelectedLayerEditorFields | "canvas">,
) {
  return normalizeCompositorLayer(
    {
      ...layer,
      inset: view.canvas.inset,
      sourceIds: structuredClone(view.sourceIds),
      layout: structuredClone(view.layout),
      sourceMapping: structuredClone(view.sourceMapping),
      effects: structuredClone(view.effects),
      compositing: structuredClone(view.compositing),
      finish: structuredClone(view.finish),
      draw: structuredClone(view.draw),
      words: structuredClone(view.words),
      activeSeed: view.activeSeed,
      presets: structuredClone(view.presets),
      passes: structuredClone(view.passes),
    },
    layer.sourceMapping.cropDistribution,
    layer.name,
  );
}

export function applyProjectEditorView(
  project: ProjectDocument,
  view: ProjectEditorView,
): ProjectDocument {
  const baseProject = normalizeProjectDocument({
    ...project,
    canvas: {
      ...structuredClone(view.canvas),
      inset: project.canvas.inset,
    },
    export: structuredClone(view.export),
    layers: structuredClone(view.layers),
    selectedLayerId: view.selectedLayerId,
  });
  const selectedLayer = getSelectedLayer(baseProject);

  if (!selectedLayer) {
    return baseProject;
  }

  return normalizeProjectDocument({
    ...baseProject,
    selectedLayerId: selectedLayer.id,
    layers: baseProject.layers.map((layer) =>
      layer.id === selectedLayer.id
        ? applyEditorFieldsToLayer(layer, view)
        : layer,
    ),
  });
}

export function updateProjectFromEditorView(
  project: ProjectDocument,
  updater: (project: ProjectEditorView) => ProjectEditorView,
): ProjectDocument {
  return applyProjectEditorView(project, updater(createProjectEditorView(project)));
}
