import { useShallow } from "zustand/react/shallow";

import { useAppStore } from "@/state/use-app-store";

export function useWorkspaceState() {
  return useAppStore(
    useShallow((state) => ({
      ready: state.ready,
      busy: state.busy,
      status: state.status,
      sourceImportProgress: state.sourceImportProgress,
      projects: state.projects,
      projectSummaries: state.projectSummaries,
      assets: state.assets,
      versions: state.versions,
      activeProjectId: state.activeProjectId,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
    })),
  );
}

export function useWorkspaceActions() {
  return useAppStore(
    useShallow((state) => ({
      bootstrap: state.bootstrap,
      createProject: state.createProject,
      renameProject: state.renameProject,
      duplicateProject: state.duplicateProject,
      duplicateProjectInNewWindow: state.duplicateProjectInNewWindow,
      openProjectInNewWindow: state.openProjectInNewWindow,
      focusProjectWindow: state.focusProjectWindow,
      trashProject: state.trashProject,
      restoreProject: state.restoreProject,
      purgeProject: state.purgeProject,
      setActiveProject: state.setActiveProject,
      selectLayer: state.selectLayer,
      addLayer: state.addLayer,
      duplicateLayer: state.duplicateLayer,
      deleteLayer: state.deleteLayer,
      appendDrawStroke: state.appendDrawStroke,
      clearDrawLayer: state.clearDrawLayer,
      toggleLayerVisibility: state.toggleLayerVisibility,
      reorderLayers: state.reorderLayers,
      updateProject: state.updateProject,
      importFiles: state.importFiles,
      addSolidSource: state.addSolidSource,
      addGradientSource: state.addGradientSource,
      addPerlinSource: state.addPerlinSource,
      addCellularSource: state.addCellularSource,
      addReactionSource: state.addReactionSource,
      addWaveSource: state.addWaveSource,
      removeSource: state.removeSource,
      updateImageSourceFitMode: state.updateImageSourceFitMode,
      updateGeneratedSource: state.updateGeneratedSource,
      randomizeVariant: state.randomizeVariant,
      saveVersion: state.saveVersion,
      restoreVersion: state.restoreVersion,
      exportCurrentImage: state.exportCurrentImage,
      exportCurrentBundle: state.exportCurrentBundle,
      inspectBundleImport: state.inspectBundleImport,
      resolveBundleImport: state.resolveBundleImport,
      undo: state.undo,
      redo: state.redo,
    })),
  );
}
