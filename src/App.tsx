import {
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CopyPlus,
  Download,
  FolderOpen,
  ImagePlus,
  Layers,
  Pencil,
  Plus,
  Redo2,
  Save,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { Toaster } from "sonner";

import type { PreviewRenderState } from "@/components/app/preview-stage";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { useHistoryShortcuts } from "@/components/app/use-history-shortcuts";
import { useLayerThumbnailUrls } from "@/components/app/use-layer-thumbnail-urls";

import { LeftSidebar } from "@/features/editor/left-sidebar";
import { CenterCanvas } from "@/features/editor/center-canvas";
import { RightSidebar } from "@/features/editor/right-sidebar";
import {
  SourceEditorDialog,
  useSourceEditorControls,
} from "@/features/source-editor/source-editor-dialog";
import { RenameDialog } from "@/features/project-management/rename-dialog";
import { DuplicateDialog } from "@/features/project-management/duplicate-dialog";
import { TrashDialog } from "@/features/project-management/trash-dialog";
import { ManageProjectsDialog } from "@/features/project-management/manage-projects-dialog";
import { ImportConflictDialog } from "@/features/project-management/import-conflict-dialog";
import { OpenProjectConflictDialog } from "@/features/project-management/open-project-conflict-dialog";
import { VersionsDialog } from "@/features/project-management/versions-dialog";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/assets";
import {
  createProjectEditorView,
  type ProjectEditorView,
  updateProjectFromEditorView,
} from "@/lib/project-editor-view";
import {
  coerceShapeModeForFamily,
  getGeometryOptions,
  isPatternDrivenFamily,
} from "@/lib/layout-utils";
import { readBlob } from "@/lib/opfs";
import { toggleSourceId } from "@/lib/source-selection";
import { setSourceWeight } from "@/lib/source-weights";
import { cn } from "@/lib/utils";
import {
  useWorkspaceActions,
  useWorkspaceState,
} from "@/state/app-store-hooks";
import type {
  BundleImportInspection,
  SourceAsset,
} from "@/types/project";
import type { OpenProjectResult, ProjectSummary } from "../electron/contract";

const LAYER_ROW_THUMBNAIL_WIDTH = 224;
const LAYER_ROW_THUMBNAIL_HEIGHT = 140;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const bundleInputRef = useRef<HTMLInputElement>(null);
  const [renderState, setRenderState] = useState<PreviewRenderState>({
    ready: false,
    lastRenderedPreview: null,
  });
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Dialog open/close state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [manageProjectsOpen, setManageProjectsOpen] = useState(false);
  const [trashDialogOpen, setTrashDialogOpen] = useState(false);
  const [importConflictOpen, setImportConflictOpen] = useState(false);
  const [openProjectConflictOpen, setOpenProjectConflictOpen] = useState(false);

  // Dialog form values
  const [renameValue, setRenameValue] = useState("");
  const [duplicateValue, setDuplicateValue] = useState("");
  const [pendingImportInspection, setPendingImportInspection] =
    useState<BundleImportInspection | null>(null);
  const [pendingOpenConflict, setPendingOpenConflict] = useState<{
    projectId: string;
    projectTitle: string;
    target: "current" | "new";
  } | null>(null);

  // Source editor controls
  const {
    sourceDialogOpen,
    setSourceDialogOpen,
    sourceDialogMode,
    editingSourceId,
    setEditingSourceId,
    openAddSourceDialog,
    openEditSourceDialog,
  } = useSourceEditorControls();

  const {
    ready,
    busy,
    status,
    sourceImportProgress,
    projects,
    projectSummaries,
    assets,
    versions,
    activeProjectId,
    canUndo,
    canRedo,
  } = useWorkspaceState();
  const {
    bootstrap,
    createProject,
    renameProject,
    duplicateProject,
    duplicateProjectInNewWindow,
    openProjectInNewWindow,
    focusProjectWindow,
    trashProject,
    restoreProject,
    purgeProject,
    setActiveProject,
    selectLayer,
    addLayer,
    deleteLayer,
    appendDrawStroke,
    clearDrawLayer,
    toggleLayerVisibility,
    reorderLayers,
    updateProject,
    importFiles,
    addSolidSource,
    addGradientSource,
    addPerlinSource,
    addCellularSource,
    addReactionSource,
    addWaveSource,
    removeSource,
    updateGeneratedSource,
    randomizeSeed,
    saveVersion,
    restoreVersion,
    exportCurrentImage,
    exportCurrentBundle,
    inspectBundleImport,
    resolveBundleImport,
    undo,
    redo,
  } = useWorkspaceActions();

  const layerSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useHistoryShortcuts({ busy, canUndo, canRedo, undo, redo });

  useEffect(() => {
    if (!previewExpanded) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.key !== "Escape" ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      setPreviewExpanded(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewExpanded]);

  // Project derivations
  const activeProjects = useMemo(
    () => projectSummaries.filter((project) => project.deletedAt === null),
    [projectSummaries],
  );
  const trashedProjects = useMemo(
    () => projectSummaries.filter((project) => project.deletedAt !== null),
    [projectSummaries],
  );
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, projects],
  );
  const deferredProject = useDeferredValue(activeProject);
  const previewProject = deferredProject ?? activeProject;
  const deferredProjectAssets = useMemo(
    () =>
      previewProject
        ? assets.filter((asset) => asset.projectId === previewProject.id)
        : [],
    [assets, previewProject],
  );
  const previewAssets = useMemo(() => {
    if (!previewProject) {
      return [];
    }

    const assetLookup = new Map(
      deferredProjectAssets.map((asset) => [asset.id, asset]),
    );

    return Array.from(
      new Set(
        previewProject.layers
          .filter((layer) => layer.visible)
          .flatMap((layer) => layer.sourceIds),
      ),
    )
      .map((sourceId) => assetLookup.get(sourceId))
      .filter((asset): asset is SourceAsset => Boolean(asset));
  }, [deferredProjectAssets, previewProject]);

  useEffect(() => {
    if (!activeProject) return;
    setRenameValue(activeProject.title);
    setDuplicateValue(`${activeProject.title} Copy`);
  }, [activeProject]);

  useEffect(() => {
    setPreviewExpanded(false);
  }, [activeProject?.id]);

  const activeProjectView = useMemo(
    () => (activeProject ? createProjectEditorView(activeProject) : null),
    [activeProject],
  );
  const projectAssets = useMemo(
    () =>
      activeProject
        ? assets.filter((asset) => asset.projectId === activeProject.id)
        : [],
    [activeProject, assets],
  );
  const selectedLayer = useMemo(() => {
    if (!activeProject) {
      return null;
    }

    return (
      activeProject.layers.find(
        (layer) => layer.id === activeProject.selectedLayerId,
      ) ??
      activeProject.layers.at(-1) ??
      null
    );
  }, [activeProject]);
  const displayLayers = useMemo(
    () => (activeProject ? [...activeProject.layers].reverse() : []),
    [activeProject],
  );
  const activeVersions = useMemo(
    () =>
      activeProject
        ? versions.filter((version) => version.projectId === activeProject.id)
        : [],
    [activeProject, versions],
  );
  const previewAssetSignature = useMemo(
    () => previewAssets.map((asset) => asset.id).join("|"),
    [previewAssets],
  );

  useEffect(() => {
    setRenderState({
      ready: false,
      lastRenderedPreview: null,
    });
  }, [previewAssetSignature, activeProject?.id, activeProject?.updatedAt]);

  const layerThumbnailUrls = useLayerThumbnailUrls({
    project: previewProject,
    assets: deferredProjectAssets,
    width: LAYER_ROW_THUMBNAIL_WIDTH,
    height: LAYER_ROW_THUMBNAIL_HEIGHT,
  });

  const handleLayerDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const displayLayerIds = displayLayers.map((layer) => layer.id);
    const activeIndex = displayLayerIds.indexOf(activeId);
    const overIndex = displayLayerIds.indexOf(overId);
    if (activeIndex < 0 || overIndex < 0) return;
    const nextDisplayLayerIds = arrayMove(displayLayerIds, activeIndex, overIndex);
    void reorderLayers([...nextDisplayLayerIds].reverse());
  };

  // Loading state
  if (!ready || !activeProject || !activeProjectView) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <Card className="w-[min(32rem,92vw)]">
          <CardHeader>
            <CardTitle>Initializing workspace</CardTitle>
            <CardDescription>{status}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Project mutation helper
  const patchProject = (
    updater: (project: ProjectEditorView) => ProjectEditorView,
  ) => {
    startTransition(() => {
      void updateProject(
        (project) => updateProjectFromEditorView(project, updater),
        { queueKey: "ui-editor-update" },
      );
    });
  };

  // Derived layout state
  const isStripsFamily = activeProjectView.layout.family === "strips";
  const isGridFamily = activeProjectView.layout.family === "grid";
  const isBlocksFamily = activeProjectView.layout.family === "blocks";
  const isRadialFamily = activeProjectView.layout.family === "radial";
  const isOrganicFamily = activeProjectView.layout.family === "organic";
  const isFlowFamily = activeProjectView.layout.family === "flow";
  const isThreeDFamily = activeProjectView.layout.family === "3d";
  const isFractalFamily = activeProjectView.layout.family === "fractal";
  const isDrawFamily = activeProjectView.layout.family === "draw";
  const isRectShapeMode = activeProjectView.layout.shapeMode === "rect";
  const isWedgeShapeMode =
    activeProjectView.layout.shapeMode === "arc" ||
    activeProjectView.layout.shapeMode === "wedge" ||
    activeProjectView.layout.shapeMode === "mixed";
  const isHollowShapeMode =
    activeProjectView.layout.shapeMode === "ring" ||
    activeProjectView.layout.shapeMode === "arc" ||
    activeProjectView.layout.shapeMode === "mixed";
  const isSymmetryActive = activeProjectView.layout.symmetryMode !== "none";
  const isRadialSymmetry = activeProjectView.layout.symmetryMode === "radial";
  const isWeightedAssignment =
    activeProjectView.sourceMapping.strategy === "weighted";
  const isPaletteAssignment =
    activeProjectView.sourceMapping.strategy === "palette";
  const isKaleidoscopeActive =
    activeProjectView.effects.kaleidoscopeSegments > 1;
  const geometryOptions = getGeometryOptions(activeProjectView.layout.family);
  const showGeometryControls = !isPatternDrivenFamily(
    activeProjectView.layout.family,
  );
  const geometryValue = geometryOptions.includes(
    activeProjectView.layout.shapeMode,
  )
    ? activeProjectView.layout.shapeMode
    : coerceShapeModeForFamily(
        activeProjectView.layout.family,
        activeProjectView.layout.shapeMode,
      );
  const inspectorLayerName = selectedLayer?.name ?? "Selected Layer";

  // Action handlers
  const captureThumbnail = () =>
    new Promise<Blob | null>((resolve) => {
      canvasRef.current?.toBlob((blob) => resolve(blob), "image/webp", 0.88);
    });

  const bitmapLookup = (asset: SourceAsset) => readBlob(asset.normalizedPath);

  const toggleAssetEnabled = (assetId: string) => {
    patchProject((project) => ({
      ...project,
      sourceIds: toggleSourceId(project.sourceIds, assetId),
    }));
  };

  const updateSourceWeight = (assetId: string, value: number) => {
    patchProject((project) => ({
      ...project,
      sourceMapping: {
        ...project.sourceMapping,
        sourceWeights: setSourceWeight(
          project.sourceMapping.sourceWeights,
          assetId,
          value,
        ),
      },
    }));
  };

  const handleRemoveSource = async (assetId: string) => {
    const asset = projectAssets.find((entry) => entry.id === assetId);
    if (!asset) return;
    const confirmed = window.confirm(
      `Remove "${asset.name}" from this project?`,
    );
    if (!confirmed) return;
    await removeSource(assetId);
  };

  const handleExport = async () => {
    const renderedPreview = renderState.lastRenderedPreview;
    if (!renderedPreview) return;
    const renderedAssets = renderedPreview.assetIds
      .map((assetId) => projectAssets.find((asset) => asset.id === assetId))
      .filter((asset): asset is SourceAsset => Boolean(asset));
    if (renderedAssets.length === 0) return;
    await exportCurrentImage(
      renderedPreview.project,
      renderedAssets,
      bitmapLookup,
    );
  };

  const openSaveVersion = async () => {
    const label = window.prompt(
      "Version label",
      `Snapshot ${new Date().toLocaleTimeString()}`,
    );
    if (!label) return;
    const thumbnail = await captureThumbnail();
    await saveVersion(label, thumbnail);
  };

  const submitRename = async () => {
    await renameProject(activeProject.id, renameValue);
    setRenameDialogOpen(false);
  };

  const submitDuplicate = async () => {
    await duplicateProject(activeProject.id, duplicateValue);
    setDuplicateDialogOpen(false);
  };

  const submitTrash = async () => {
    await trashProject(activeProject.id);
    setTrashDialogOpen(false);
  };

  const handleProjectOpenResult = (
    result: OpenProjectResult | null,
    project: Pick<ProjectSummary, "id" | "title">,
    target: "current" | "new",
  ) => {
    if (!result || result.kind !== "already-open") {
      return;
    }

    setPendingOpenConflict({
      projectId: project.id,
      projectTitle: project.title,
      target,
    });
    setOpenProjectConflictOpen(true);
  };

  const handleSetActiveProject = async (projectId: string) => {
    const project = activeProjects.find((entry) => entry.id === projectId);
    const result = await setActiveProject(projectId);
    if (project) {
      handleProjectOpenResult(result, project, "current");
    }
  };

  const handleOpenProjectInNewWindow = async (projectId: string) => {
    const project = activeProjects.find((entry) => entry.id === projectId);
    const result = await openProjectInNewWindow(projectId);
    if (project) {
      handleProjectOpenResult(result, project, "new");
    }
  };

  const handleRevealExistingWindow = async () => {
    if (!pendingOpenConflict) {
      return;
    }

    await focusProjectWindow(pendingOpenConflict.projectId);
    setOpenProjectConflictOpen(false);
    setPendingOpenConflict(null);
  };

  const handleDuplicateConflictProject = async () => {
    if (!pendingOpenConflict) {
      return;
    }

    const duplicateTitle = `${pendingOpenConflict.projectTitle} Copy`;
    if (pendingOpenConflict.target === "new") {
      await duplicateProjectInNewWindow(pendingOpenConflict.projectId, duplicateTitle);
    } else {
      await duplicateProject(pendingOpenConflict.projectId, duplicateTitle);
    }
    setOpenProjectConflictOpen(false);
    setPendingOpenConflict(null);
  };

  const handleBundleImport = async (file: File) => {
    const inspection = await inspectBundleImport(file);
    if (inspection.conflictProject) {
      setPendingImportInspection(inspection);
      setImportConflictOpen(true);
      return;
    }
    await resolveBundleImport(inspection, "replace");
  };

  const resolveImportConflict = async (resolution: "replace" | "copy") => {
    if (!pendingImportInspection) return;
    await resolveBundleImport(pendingImportInspection, resolution);
    setPendingImportInspection(null);
    setImportConflictOpen(false);
  };

  return (
    <div className="h-dvh overflow-hidden bg-app text-text">
      <Toaster richColors position="top-right" />
      <div className="flex h-full flex-col overflow-hidden">
        {/* ── Toolbar ── */}
        <div className="flex w-full shrink-0 items-center justify-between gap-4 border-b border-border bg-surface-raised px-4 py-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="text-xs text-text-secondary">compositor</div>
            <div className="h-6 w-px bg-border" />
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-[220px] shrink-0">
                <Select
                  value={activeProject.id}
                  onValueChange={(value) => void handleSetActiveProject(value)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!renderState.ready ? (
                <div
                  className="shrink-0 rounded-md bg-red-600 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white"
                  role="status"
                  aria-live="polite"
                >
                  Rendering
                </div>
              ) : null}
              {sourceImportProgress ? (
                <div
                  className="shrink-0 rounded-md bg-sky-600 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white"
                  role="status"
                  aria-live="polite"
                >
                  Processing Sources {sourceImportProgress.processed}/
                  {sourceImportProgress.total}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => void undo()} disabled={!canUndo || busy}>
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void redo()} disabled={!canRedo || busy}>
              <Redo2 className="h-3.5 w-3.5" /> Redo
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void createProject()}>
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRenameDialogOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Rename
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDuplicateDialogOpen(true)}>
              <CopyPlus className="h-3.5 w-3.5" /> Save as
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setManageProjectsOpen(true)}>
              <Layers className="h-3.5 w-3.5" /> Projects
            </Button>
            <VersionsDialog
              versions={activeVersions}
              onRestoreVersion={restoreVersion}
              trigger={
                <Button variant="outline" size="sm">
                  <FolderOpen className="h-3.5 w-3.5" /> Versions
                </Button>
              }
            />
            <Button variant="ghost" size="sm" onClick={() => setTrashDialogOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Trash
            </Button>
            <Button variant="ghost" size="sm" onClick={() => openAddSourceDialog("image")}>
              <ImagePlus className="h-3.5 w-3.5" /> Add Source
            </Button>
            <Button variant="ghost" size="sm" onClick={() => bundleInputRef.current?.click()}>
              <FolderOpen className="h-3.5 w-3.5" /> Import
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void exportCurrentBundle()} disabled={busy}>
              <Layers className="h-3.5 w-3.5" /> Bundle
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button variant="secondary" size="sm" onClick={() => void randomizeSeed()}>
              <Sparkles className="h-3.5 w-3.5" /> Randomize
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void openSaveVersion()}>
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
            <Button
              size="sm"
              onClick={() => void handleExport()}
              disabled={busy || previewAssets.length === 0 || !renderState.ready || !renderState.lastRenderedPreview}
            >
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <div className="h-4 w-px bg-border" />
            <ThemeToggle />
          </div>
        </div>

        {/* ── Main Layout ── */}
        <div className="mx-auto flex min-h-0 w-full flex-1 overflow-hidden p-3">
          <div
            className={cn(
              "min-h-0 flex-1 gap-3 overflow-hidden",
              previewExpanded
                ? "flex"
                : "grid grid-cols-[288px_minmax(0,260px)_minmax(640px,1fr)_560px]",
            )}
          >
            <LeftSidebar
              previewExpanded={previewExpanded}
              projectAssets={projectAssets}
              activeProject={activeProject}
              activeProjectView={activeProjectView}
              displayLayers={displayLayers}
              selectedLayer={selectedLayer}
              layerThumbnailUrls={layerThumbnailUrls}
              layerSensors={layerSensors}
              handleLayerDragEnd={handleLayerDragEnd}
              openAddSourceDialog={openAddSourceDialog}
              openEditSourceDialog={openEditSourceDialog}
              handleRemoveSource={handleRemoveSource}
              updateSourceWeight={updateSourceWeight}
              toggleAssetEnabled={toggleAssetEnabled}
              addLayer={addLayer}
              selectLayer={selectLayer}
              toggleLayerVisibility={toggleLayerVisibility}
              deleteLayer={deleteLayer}
            />
            <CenterCanvas
              previewExpanded={previewExpanded}
              setPreviewExpanded={setPreviewExpanded}
              canvasRef={canvasRef}
              previewProject={previewProject}
              activeProject={activeProject}
              previewAssets={previewAssets}
              setRenderState={setRenderState}
              drawEnabled={isDrawFamily}
              drawBrushSize={activeProjectView.draw.brushSize}
              appendDrawStroke={appendDrawStroke}
              patchProject={patchProject}
            />
            <RightSidebar
              previewExpanded={previewExpanded}
              activeProjectView={activeProjectView}
              patchProject={patchProject}
              clearDrawLayer={clearDrawLayer}
              hasDrawStrokes={activeProjectView.draw.strokes.length > 0}
              inspectorLayerName={inspectorLayerName}
              isDrawFamily={isDrawFamily}
              isRectShapeMode={isRectShapeMode}
              isWedgeShapeMode={isWedgeShapeMode}
              isHollowShapeMode={isHollowShapeMode}
              isGridFamily={isGridFamily}
              isStripsFamily={isStripsFamily}
              isBlocksFamily={isBlocksFamily}
              isRadialFamily={isRadialFamily}
              isOrganicFamily={isOrganicFamily}
              isFlowFamily={isFlowFamily}
              isThreeDFamily={isThreeDFamily}
              isFractalFamily={isFractalFamily}
              isSymmetryActive={isSymmetryActive}
              isRadialSymmetry={isRadialSymmetry}
              isWeightedAssignment={isWeightedAssignment}
              isPaletteAssignment={isPaletteAssignment}
              isKaleidoscopeActive={isKaleidoscopeActive}
              showGeometryControls={showGeometryControls}
              geometryOptions={geometryOptions}
              geometryValue={geometryValue}
            />
          </div>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <SourceEditorDialog
        open={sourceDialogOpen}
        onOpenChange={(open) => {
          setSourceDialogOpen(open);
          if (!open) setEditingSourceId(null);
        }}
        projectAssets={projectAssets}
        canvasSize={activeProject.canvas}
        editingSourceId={editingSourceId}
        initialMode={sourceDialogMode}
        uploadInputRef={uploadInputRef}
        onSubmitSolid={addSolidSource}
        onSubmitGradient={addGradientSource}
        onSubmitPerlin={addPerlinSource}
        onSubmitCellular={addCellularSource}
        onSubmitReaction={addReactionSource}
        onSubmitWave={addWaveSource}
        onUpdateGenerated={updateGeneratedSource}
        busy={busy}
        status={status}
      />

      <RenameDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        value={renameValue}
        onChange={setRenameValue}
        onSubmit={submitRename}
      />

      <DuplicateDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        value={duplicateValue}
        onChange={setDuplicateValue}
        onSubmit={submitDuplicate}
      />

      <TrashDialog
        open={trashDialogOpen}
        onOpenChange={setTrashDialogOpen}
        projectTitle={activeProject.title}
        onSubmit={submitTrash}
      />

      <ManageProjectsDialog
        open={manageProjectsOpen}
        onOpenChange={setManageProjectsOpen}
        activeProjects={activeProjects}
        trashedProjects={trashedProjects}
        activeProjectId={activeProject.id}
        onSetActiveProject={handleSetActiveProject}
        onOpenProjectInNewWindow={handleOpenProjectInNewWindow}
        onTrashProject={trashProject}
        onRestoreProject={restoreProject}
        onPurgeProject={purgeProject}
      />

      <OpenProjectConflictDialog
        open={openProjectConflictOpen}
        onOpenChange={(open) => {
          setOpenProjectConflictOpen(open);
          if (!open) {
            setPendingOpenConflict(null);
          }
        }}
        projectTitle={pendingOpenConflict?.projectTitle ?? null}
        onReveal={() => void handleRevealExistingWindow()}
        onDuplicate={() => void handleDuplicateConflictProject()}
      />

      <ImportConflictDialog
        open={importConflictOpen}
        onOpenChange={(open) => {
          setImportConflictOpen(open);
          if (!open) setPendingImportInspection(null);
        }}
        inspection={pendingImportInspection}
        onResolve={resolveImportConflict}
      />

      {/* ── Hidden File Inputs ── */}
      <input
        ref={uploadInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="hidden"
        multiple
        onChange={(event) => {
          if (!event.target.files) return;
          void importFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={bundleInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void handleBundleImport(file);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

export default App;
