import {
  startTransition,
  useDeferredValue,
  useEffect,
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
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { Toaster } from "sonner";

import { PreviewStage } from "@/components/app/preview-stage";
import type { PreviewRenderState } from "@/components/app/preview-stage";
import { SourceAssetCard } from "@/components/app/source-asset-card";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  ACCEPTED_IMAGE_TYPES,
  getDefaultGradientDirection,
  normalizeGradientInput,
  normalizeSolidInput,
} from "@/lib/assets";
import { normalizeHexColor } from "@/lib/color";
import { lockExportDimensionsToCanvas } from "@/lib/export-sizing";
import { readBlob } from "@/lib/opfs";
import { toggleSourceId } from "@/lib/source-selection";
import { useAppStore } from "@/state/use-app-store";
import type {
  BlendMode,
  BundleImportInspection,
  CropDistribution,
  GradientDirection,
  GradientSourceAsset,
  GeometryShape,
  LayoutFamily,
  ProjectDocument,
  SolidSourceAsset,
  SourceAsset,
  SourceAssignmentStrategy,
  SourceKind,
} from "@/types/project";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function useObjectUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    async function run() {
      if (!path) {
        setUrl(null);
        return;
      }

      const blob = await readBlob(path);
      if (!blob || !active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }

    void run();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return url;
}

function SourceThumbnail({
  previewPath,
  label,
}: {
  previewPath: string;
  label: string;
}) {
  const previewUrl = useObjectUrl(previewPath);

  return previewUrl ? (
    <img
      src={previewUrl}
      alt={label}
      className="h-20 w-full rounded-md object-cover"
    />
  ) : (
    <div className="flex h-20 items-center justify-center rounded-md bg-surface-muted font-mono text-[10px] uppercase tracking-[0.1em] text-text-faint">
      Loading
    </div>
  );
}

const SOURCE_DIALOG_MODES: SourceKind[] = ["image", "solid", "gradient"];
const GRADIENT_DIRECTIONS: GradientDirection[] = [
  "horizontal",
  "vertical",
  "diagonal-down",
  "diagonal-up",
];

function formatSourceModeLabel(mode: SourceKind) {
  if (mode === "solid") return "Solid";
  if (mode === "gradient") return "Gradient";
  return "Image";
}

function formatGradientDirectionLabel(direction: GradientDirection) {
  if (direction === "diagonal-down") return "Diagonal down";
  if (direction === "diagonal-up") return "Diagonal up";
  return direction[0]!.toUpperCase() + direction.slice(1);
}

function SourceColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="color"
          value={value}
          className="h-9 w-14 cursor-pointer p-1"
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          value={value}
          className="font-mono uppercase"
          onChange={(event) =>
            onChange(normalizeHexColor(event.target.value, value))
          }
        />
      </div>
    </div>
  );
}

function ControlBlock({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {value ? (
          <span className="font-mono text-[10px] text-text-muted">{value}</span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();

  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

function SliderField({
  label,
  min,
  max,
  step,
  value,
  disabled = false,
  onChange,
  formatter = (next) => next.toFixed(2),
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  formatter?: (value: number) => string;
}) {
  const [draftValue, setDraftValue] = useState<number | null>(null);

  useEffect(() => {
    setDraftValue(null);
  }, [value]);

  const displayValue = draftValue ?? value;

  return (
    <ControlBlock label={label} value={formatter(displayValue)}>
      <Slider
        aria-label={label}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={[displayValue]}
        onValueChange={(next) => setDraftValue(next[0] ?? value)}
        onValueCommit={(next) => {
          const committedValue = next[0] ?? draftValue ?? value;
          if (committedValue === value) {
            setDraftValue(null);
            return;
          }
          onChange(committedValue);
        }}
      />
    </ControlBlock>
  );
}

const DENSITY_UI_SCALE = 4;

function ProjectRow({
  project,
  current,
  actions,
}: {
  project: ProjectDocument;
  current: boolean;
  actions: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-sunken p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-text">
            {project.title}
          </div>
          <div className="font-mono text-[10px] text-text-faint">
            updated {new Date(project.updatedAt).toLocaleString()}
          </div>
          {current ? (
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
              current
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      </div>
    </div>
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
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [manageProjectsOpen, setManageProjectsOpen] = useState(false);
  const [trashDialogOpen, setTrashDialogOpen] = useState(false);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [sourceDialogMode, setSourceDialogMode] = useState<SourceKind>("image");
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [purgeDialogProjectId, setPurgeDialogProjectId] = useState<
    string | null
  >(null);
  const [importConflictOpen, setImportConflictOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [duplicateValue, setDuplicateValue] = useState("");
  const [solidSourceName, setSolidSourceName] = useState("");
  const [solidSourceColor, setSolidSourceColor] = useState("#0f172a");
  const [gradientSourceName, setGradientSourceName] = useState("");
  const [gradientSourceFrom, setGradientSourceFrom] = useState("#0f172a");
  const [gradientSourceTo, setGradientSourceTo] = useState("#f97316");
  const [gradientSourceDirection, setGradientSourceDirection] =
    useState<GradientDirection>(getDefaultGradientDirection());
  const [pendingImportInspection, setPendingImportInspection] =
    useState<BundleImportInspection | null>(null);

  const {
    ready,
    busy,
    status,
    projects,
    assets,
    versions,
    activeProjectId,
    canUndo,
    canRedo,
    bootstrap,
    createProject,
    renameProject,
    duplicateProject,
    trashProject,
    restoreProject,
    purgeProject,
    setActiveProject,
    updateProject,
    importFiles,
    addSolidSource,
    addGradientSource,
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
  } = useAppStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (!event.metaKey && !event.ctrlKey) ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const wantsUndo = key === "z" && !event.shiftKey;
      const wantsRedo = (key === "z" && event.shiftKey) || key === "y";

      if (wantsUndo && canUndo && !busy) {
        event.preventDefault();
        void undo();
        return;
      }

      if (wantsRedo && canRedo && !busy) {
        event.preventDefault();
        void redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, canRedo, canUndo, redo, undo]);

  const activeProjects = projects.filter(
    (project) => project.deletedAt === null,
  );
  const trashedProjects = projects.filter(
    (project) => project.deletedAt !== null,
  );
  const activeProject =
    activeProjects.find((project) => project.id === activeProjectId) ?? null;
  const deferredProject = useDeferredValue(activeProject);
  const deferredProjectAssets = deferredProject
    ? assets.filter((asset) => asset.projectId === deferredProject.id)
    : [];
  const previewAssets = deferredProject
    ? deferredProject.sourceIds
        .map((sourceId) =>
          deferredProjectAssets.find((asset) => asset.id === sourceId),
        )
        .filter((asset): asset is SourceAsset => Boolean(asset))
    : [];

  useEffect(() => {
    if (!activeProject) return;
    setRenameValue(activeProject.title);
    setDuplicateValue(`${activeProject.title} Copy`);
  }, [activeProject]);

  const projectAssets = activeProject
    ? assets.filter((asset) => asset.projectId === activeProject.id)
    : [];
  const editingSource = editingSourceId
    ? (projectAssets.find((asset) => asset.id === editingSourceId) ?? null)
    : null;
  const activeAssets = activeProject
    ? activeProject.sourceIds
        .map((sourceId) => projectAssets.find((asset) => asset.id === sourceId))
        .filter((asset): asset is SourceAsset => Boolean(asset))
    : [];
  const activeVersions = activeProject
    ? versions.filter((version) => version.projectId === activeProject.id)
    : [];
  const activeAssetSignature = activeAssets.map((asset) => asset.id).join("|");
  const purgeDialogProject =
    projects.find((project) => project.id === purgeDialogProjectId) ?? null;

  useEffect(() => {
    setRenderState({
      ready: false,
      lastRenderedPreview: null,
    });
  }, [activeAssetSignature, activeProject?.id, activeProject?.updatedAt]);

  if (!ready || !activeProject || !deferredProject) {
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

  const patchProject = (updater: Parameters<typeof updateProject>[0]) => {
    startTransition(() => {
      void updateProject(updater);
    });
  };
  const isStripsFamily = activeProject.layout.family === "strips";
  const isGridFamily = activeProject.layout.family === "grid";
  const isBlocksFamily = activeProject.layout.family === "blocks";
  const isRectShapeMode = activeProject.layout.shapeMode === "rect";
  const isWedgeShapeMode =
    activeProject.layout.shapeMode === "wedge" ||
    activeProject.layout.shapeMode === "mixed";
  const usesGutter = isGridFamily || isStripsFamily;
  const isRadialSymmetry = activeProject.layout.symmetryMode === "radial";
  const isWeightedAssignment =
    activeProject.sourceMapping.strategy === "weighted";
  const isPaletteAssignment =
    activeProject.sourceMapping.strategy === "palette";

  const captureThumbnail = () =>
    new Promise<Blob | null>((resolve) => {
      canvasRef.current?.toBlob((blob) => resolve(blob), "image/webp", 0.88);
    });

  const openSaveVersion = async () => {
    const label = window.prompt(
      "Version label",
      `Snapshot ${new Date().toLocaleTimeString()}`,
    );
    if (!label) return;
    const thumbnail = await captureThumbnail();
    await saveVersion(label, thumbnail);
  };

  const bitmapLookup = (asset: SourceAsset) => readBlob(asset.normalizedPath);
  const toggleAssetEnabled = (assetId: string) => {
    patchProject((project) => ({
      ...project,
      sourceIds: toggleSourceId(project.sourceIds, assetId),
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

  const resetGeneratedSourceForms = () => {
    setSolidSourceName("");
    setSolidSourceColor("#0f172a");
    setGradientSourceName("");
    setGradientSourceFrom("#0f172a");
    setGradientSourceTo("#f97316");
    setGradientSourceDirection(getDefaultGradientDirection());
  };

  const openAddSourceDialog = (mode: SourceKind = "image") => {
    setEditingSourceId(null);
    setSourceDialogMode(mode);
    resetGeneratedSourceForms();
    setSourceDialogOpen(true);
  };

  const openEditSourceDialog = (assetId: string) => {
    const asset = projectAssets.find(
      (entry): entry is SolidSourceAsset | GradientSourceAsset =>
        entry.id === assetId && entry.kind !== "image",
    );
    if (!asset) return;

    setEditingSourceId(asset.id);
    setSourceDialogMode(asset.kind);
    if (asset.kind === "solid") {
      setSolidSourceName(asset.name);
      setSolidSourceColor(asset.recipe.color);
    } else {
      setGradientSourceName(asset.name);
      setGradientSourceFrom(asset.recipe.from);
      setGradientSourceTo(asset.recipe.to);
      setGradientSourceDirection(asset.recipe.direction);
    }
    setSourceDialogOpen(true);
  };

  const openImagePicker = () => {
    setSourceDialogOpen(false);
    uploadInputRef.current?.click();
  };

  const submitGeneratedSource = async () => {
    if (sourceDialogMode === "image") {
      openImagePicker();
      return;
    }

    if (sourceDialogMode === "solid") {
      const input = normalizeSolidInput({
        name: solidSourceName,
        color: solidSourceColor,
      });
      if (editingSource?.kind === "solid") {
        await updateGeneratedSource(editingSource.id, input);
      } else {
        await addSolidSource(input);
      }
      setSourceDialogOpen(false);
      return;
    }

    const input = normalizeGradientInput({
      name: gradientSourceName,
      from: gradientSourceFrom,
      to: gradientSourceTo,
      direction: gradientSourceDirection,
    });
    if (editingSource?.kind === "gradient") {
      await updateGeneratedSource(editingSource.id, input);
    } else {
      await addGradientSource(input);
    }
    setSourceDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-app text-text">
      <Toaster richColors position="top-right" />
      <div className="flex min-h-screen flex-col">
        <div className="flex w-full shrink-0 items-center justify-between gap-4 border-b border-border bg-surface-raised px-4 py-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="text-xs text-text-secondary">compositor</div>

            <div className="h-6 w-px bg-border" />

            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-[220px] shrink-0">
                <Select
                  value={activeProject.id}
                  onValueChange={(value) => void setActiveProject(value)}
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
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void undo()}
              disabled={!canUndo || busy}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void redo()}
              disabled={!canRedo || busy}
            >
              <Redo2 className="h-3.5 w-3.5" />
              Redo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void createProject()}
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRenameDialogOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDuplicateDialogOpen(true)}
            >
              <CopyPlus className="h-3.5 w-3.5" />
              Save as
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setManageProjectsOpen(true)}
            >
              <Layers className="h-3.5 w-3.5" />
              Projects
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Versions
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Saved versions</DialogTitle>
                  <DialogDescription>
                    Named snapshots with exact seeds and parameters.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  {activeVersions.map((version) => (
                    <button
                      key={version.id}
                      className="flex w-full items-center justify-between rounded-md border border-border-subtle px-3 py-3 text-left transition-colors hover:bg-surface-muted"
                      onClick={() => void restoreVersion(version.id)}
                    >
                      <div>
                        <div className="text-sm font-medium text-text">
                          {version.label}
                        </div>
                        <div className="font-mono text-[10px] text-text-faint">
                          {new Date(version.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <RefreshCw className="h-3.5 w-3.5 text-text-faint" />
                    </button>
                  ))}
                  {activeVersions.length === 0 ? (
                    <div className="rounded-md bg-surface-sunken p-4 text-xs text-text-faint">
                      No saved versions yet.
                    </div>
                  ) : null}
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTrashDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Trash
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openAddSourceDialog("image")}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Add Source
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => bundleInputRef.current?.click()}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              Import
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void exportCurrentBundle()}
              disabled={busy}
            >
              <Layers className="h-3.5 w-3.5" />
              Bundle
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void randomizeSeed()}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Randomize
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void openSaveVersion()}
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
            <Button
              size="sm"
              onClick={() => void handleExport()}
              disabled={
                busy ||
                activeAssets.length === 0 ||
                !renderState.ready ||
                !renderState.lastRenderedPreview
              }
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <div className="h-4 w-px bg-border" />
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-3 p-3">
          <div className="grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,640px)] gap-3">
            <div className="flex min-h-[720px] flex-col gap-3">
              <Card className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-none border-0 bg-transparent shadow-none backdrop-blur-none">
                <CardContent className="space-y-3 p-0">
                  <PreviewStage
                    canvasRef={canvasRef}
                    project={deferredProject}
                    assets={previewAssets}
                    onRenderState={setRenderState}
                  />
                </CardContent>
              </Card>

              <Card className="shrink-0">
                <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
                  <CardTitle>Sources</CardTitle>
                  <Button
                    className="w-fit shrink-0"
                    variant="outline"
                    size="sm"
                    onClick={() => openAddSourceDialog("image")}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Add Source
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {projectAssets.length === 0 ? (
                    <div className="rounded-md bg-surface-sunken p-4 text-xs leading-relaxed text-text-faint">
                      Add image, solid, or gradient sources to begin. Imported
                      images stay immutable, while generated sources can be
                      edited later.
                    </div>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1">
                      {projectAssets.map((asset) => (
                        <SourceAssetCard
                          key={asset.id}
                          asset={asset}
                          enabled={activeProject.sourceIds.includes(asset.id)}
                          onToggle={toggleAssetEnabled}
                          onRemove={(assetId) =>
                            void handleRemoveSource(assetId)
                          }
                          onEdit={
                            asset.kind === "image"
                              ? undefined
                              : openEditSourceDialog
                          }
                          thumbnail={
                            <SourceThumbnail
                              previewPath={asset.previewPath}
                              label={asset.name}
                            />
                          }
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="min-h-[720px] max-w-[640px] ">
              <CardHeader>
                <CardTitle>Inspector</CardTitle>
              </CardHeader>
              <CardContent className="overflow-y-auto px-3 pb-2">
                <div className="grid grid-cols-3 gap-6">
                  <div className="min-w-0 space-y-6">
                    <div className="border-b border-border-subtle pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
                      Layout
                    </div>
                    <ControlBlock label="Family">
                      <Select
                        value={activeProject.layout.family}
                        onValueChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              family: value as LayoutFamily,
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["blocks", "grid", "strips", "radial"].map(
                            (option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </ControlBlock>
                    <ControlBlock label="Geometry">
                      <Select
                        value={activeProject.layout.shapeMode}
                        onValueChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              shapeMode: value as GeometryShape,
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["mixed", "rect", "triangle", "ring", "wedge"].map(
                            (option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </ControlBlock>
                    <SliderField
                      label="Corner Radius"
                      disabled={!isRectShapeMode}
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProject.layout.rectCornerRadius}
                      formatter={(value) => `${Math.round(value * 100)}%`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            rectCornerRadius: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Strips Angle"
                      disabled={!isStripsFamily}
                      min={0}
                      max={180}
                      step={1}
                      value={activeProject.layout.stripAngle}
                      formatter={(value) => `${Math.round(value)}°`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            stripAngle: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Wedge Angle"
                      disabled={!isWedgeShapeMode}
                      min={0}
                      max={360}
                      step={1}
                      value={activeProject.layout.wedgeAngle}
                      formatter={(value) => `${Math.round(value)}°`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            wedgeAngle: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Wedge Jitter"
                      disabled={!isWedgeShapeMode}
                      min={0}
                      max={360}
                      step={1}
                      value={activeProject.layout.wedgeJitter}
                      formatter={(value) => `${Math.round(value)}°`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            wedgeJitter: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Density"
                      disabled={!isStripsFamily}
                      min={0.05}
                      max={1}
                      step={0.01}
                      value={activeProject.layout.density / DENSITY_UI_SCALE}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            density: Number(
                              (value * DENSITY_UI_SCALE).toFixed(2),
                            ),
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Columns"
                      disabled={!isGridFamily}
                      min={2}
                      max={32}
                      step={1}
                      value={activeProject.layout.columns}
                      formatter={(value) => `${Math.round(value)}`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            columns: Math.round(value),
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Rows"
                      disabled={!isGridFamily}
                      min={2}
                      max={32}
                      step={1}
                      value={activeProject.layout.rows}
                      formatter={(value) => `${Math.round(value)}`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            rows: Math.round(value),
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Gutter"
                      disabled={!usesGutter}
                      min={0}
                      max={300}
                      step={1}
                      value={activeProject.layout.gutter}
                      formatter={(value) => `${Math.round(value)} px`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: { ...project.layout, gutter: value },
                        }))
                      }
                    />
                    <SliderField
                      label="Block Depth"
                      disabled={!isBlocksFamily}
                      min={0}
                      max={7}
                      step={1}
                      value={activeProject.layout.blockDepth}
                      formatter={(value) => `${Math.round(value)}`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            blockDepth: Math.round(value),
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Split Randomness"
                      disabled={!isBlocksFamily}
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProject.layout.blockSplitRandomness}
                      formatter={(value) => `${Math.round(value * 100)}%`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            blockSplitRandomness: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Min Block Size"
                      disabled={!isBlocksFamily}
                      min={32}
                      max={400}
                      step={1}
                      value={activeProject.layout.blockMinSize}
                      formatter={(value) => `${Math.round(value)} px`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            blockMinSize: Math.round(value),
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Split Bias"
                      disabled={!isBlocksFamily}
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProject.layout.blockSplitBias}
                      formatter={(value) => {
                        if (value < 0.45) return "horizontal";
                        if (value > 0.55) return "vertical";
                        return "balanced";
                      }}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            blockSplitBias: value,
                          },
                        }))
                      }
                    />
                    <ControlBlock label="Symmetry">
                      <Select
                        value={activeProject.layout.symmetryMode}
                        onValueChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            layout: {
                              ...project.layout,
                              symmetryMode:
                                value as typeof project.layout.symmetryMode,
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "none",
                            "mirror-x",
                            "mirror-y",
                            "quad",
                            "radial",
                          ].map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ControlBlock>
                    <SliderField
                      label="Radial Copies"
                      disabled={!isRadialSymmetry}
                      min={2}
                      max={12}
                      step={1}
                      value={activeProject.layout.symmetryCopies}
                      formatter={(value) => `${Math.round(value)}`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            symmetryCopies: Math.round(value),
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Hide Percentage"
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProject.layout.hidePercentage}
                      formatter={(value) => `${Math.round(value * 100)}%`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            hidePercentage: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Letterbox"
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProject.layout.letterbox}
                      formatter={(value) => `${Math.round(value * 100)}%`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            letterbox: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Canvas W"
                      min={1200}
                      max={3840}
                      step={10}
                      value={activeProject.canvas.width}
                      formatter={(value) => `${Math.round(value)} px`}
                      onChange={(value) =>
                        patchProject((project) => {
                          const canvas = {
                            ...project.canvas,
                            width: Math.round(value),
                          };
                          return {
                            ...project,
                            canvas,
                            export: {
                              ...project.export,
                              ...lockExportDimensionsToCanvas(
                                canvas,
                                project.export,
                                "width",
                              ),
                            },
                          };
                        })
                      }
                    />
                    <SliderField
                      label="Canvas H"
                      min={800}
                      max={3200}
                      step={10}
                      value={activeProject.canvas.height}
                      formatter={(value) => `${Math.round(value)} px`}
                      onChange={(value) =>
                        patchProject((project) => {
                          const canvas = {
                            ...project.canvas,
                            height: Math.round(value),
                          };
                          return {
                            ...project,
                            canvas,
                            export: {
                              ...project.export,
                              ...lockExportDimensionsToCanvas(
                                canvas,
                                project.export,
                                "width",
                              ),
                            },
                          };
                        })
                      }
                    />
                    <ControlBlock
                      label="Background Layer"
                      value={`${Math.round(activeProject.canvas.backgroundAlpha * 100)}%`}
                    >
                      <SourceColorField
                        id="canvas-background-color"
                        label="Color"
                        value={activeProject.canvas.background}
                        onChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            canvas: {
                              ...project.canvas,
                              background: value,
                            },
                          }))
                        }
                      />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-text-muted">
                          <span>Alpha</span>
                          <span className="font-mono text-[10px] text-text-faint">
                            {Math.round(
                              activeProject.canvas.backgroundAlpha * 100,
                            )}
                            %
                          </span>
                        </div>
                        <Slider
                          min={0}
                          max={1}
                          step={0.01}
                          value={[activeProject.canvas.backgroundAlpha]}
                          onValueChange={(next) =>
                            patchProject((project) => ({
                              ...project,
                              canvas: {
                                ...project.canvas,
                                backgroundAlpha:
                                  next[0] ?? project.canvas.backgroundAlpha,
                              },
                            }))
                          }
                        />
                      </div>
                    </ControlBlock>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <div className="border-b border-border-subtle pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
                      Mapping
                    </div>
                    <ControlBlock label="Source Assignment">
                      <Select
                        value={activeProject.sourceMapping.strategy}
                        onValueChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            sourceMapping: {
                              ...project.sourceMapping,
                              strategy: value as SourceAssignmentStrategy,
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "random",
                            "weighted",
                            "sequential",
                            "luminance",
                            "palette",
                            "symmetry",
                          ].map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ControlBlock>
                    <ControlBlock label="Crop Distribution">
                      <Select
                        value={activeProject.sourceMapping.cropDistribution}
                        onValueChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            sourceMapping: {
                              ...project.sourceMapping,
                              cropDistribution: value as CropDistribution,
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="center">Centered</SelectItem>
                          <SelectItem value="distributed">
                            Distributed
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </ControlBlock>
                    <SliderField
                      label="Crop Zoom"
                      min={1}
                      max={2.5}
                      step={0.01}
                      value={activeProject.sourceMapping.cropZoom}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          sourceMapping: {
                            ...project.sourceMapping,
                            cropZoom: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Source Bias"
                      disabled={!isWeightedAssignment}
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProject.sourceMapping.sourceBias}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          sourceMapping: {
                            ...project.sourceMapping,
                            sourceBias: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Palette Emphasis"
                      disabled={!isPaletteAssignment}
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProject.sourceMapping.paletteEmphasis}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          sourceMapping: {
                            ...project.sourceMapping,
                            paletteEmphasis: value,
                          },
                        }))
                      }
                    />
                    <ControlBlock label="Preserve Aspect">
                      <div className="flex items-center justify-between rounded-md bg-surface-muted px-3 py-2.5">
                        <span className="text-xs text-text-muted">
                          Center crop, no stretch
                        </span>
                        <Switch
                          checked={activeProject.sourceMapping.preserveAspect}
                          onCheckedChange={(checked) =>
                            patchProject((project) => ({
                              ...project,
                              sourceMapping: {
                                ...project.sourceMapping,
                                preserveAspect: checked,
                              },
                            }))
                          }
                        />
                      </div>
                    </ControlBlock>
                    <ControlBlock label="Blend Mode">
                      <Select
                        value={activeProject.compositing.blendMode}
                        onValueChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            compositing: {
                              ...project.compositing,
                              blendMode: value as BlendMode,
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "source-over",
                            "multiply",
                            "screen",
                            "overlay",
                            "soft-light",
                            "hard-light",
                            "difference",
                            "color-dodge",
                            "luminosity",
                          ].map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </ControlBlock>
                    <SliderField
                      label="Opacity"
                      min={0.2}
                      max={1}
                      step={0.01}
                      value={activeProject.compositing.opacity}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          compositing: {
                            ...project.compositing,
                            opacity: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Overlap"
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProject.compositing.overlap}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          compositing: {
                            ...project.compositing,
                            overlap: value,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="min-w-0 space-y-2">
                    <div className="border-b border-border-subtle pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
                      Effects
                    </div>
                    <SliderField
                      label="Blur"
                      min={0}
                      max={18}
                      step={0.1}
                      value={activeProject.effects.blur}
                      formatter={(value) => `${value.toFixed(1)} px`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: { ...project.effects, blur: value },
                        }))
                      }
                    />
                    <SliderField
                      label="Sharpen"
                      min={0}
                      max={1}
                      step={0.01}
                      value={activeProject.effects.sharpen}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: { ...project.effects, sharpen: value },
                        }))
                      }
                    />
                    <SliderField
                      label="Rotation Jitter"
                      min={0}
                      max={90}
                      step={1}
                      value={activeProject.effects.rotationJitter}
                      formatter={(value) => `${Math.round(value)}°`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: {
                            ...project.effects,
                            rotationJitter: value,
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Scale Jitter"
                      min={0}
                      max={0.8}
                      step={0.01}
                      value={activeProject.effects.scaleJitter}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: { ...project.effects, scaleJitter: value },
                        }))
                      }
                    />
                    <SliderField
                      label="Displacement"
                      min={0}
                      max={100}
                      step={1}
                      value={activeProject.effects.displacement}
                      formatter={(value) => `${Math.round(value)} px`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: { ...project.effects, displacement: value },
                        }))
                      }
                    />
                    <SliderField
                      label="Distortion"
                      min={0}
                      max={0.8}
                      step={0.01}
                      value={activeProject.effects.distortion}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: { ...project.effects, distortion: value },
                        }))
                      }
                    />
                    <SliderField
                      label="Kaleidoscope"
                      min={1}
                      max={12}
                      step={1}
                      value={activeProject.effects.kaleidoscopeSegments}
                      formatter={(value) => `${Math.round(value)} seg`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          effects: {
                            ...project.effects,
                            kaleidoscopeSegments: Math.round(value),
                          },
                        }))
                      }
                    />
                    <ControlBlock label="Mirror Overlay">
                      <div className="flex items-center justify-between rounded-md bg-surface-muted px-3 py-2.5">
                        <span className="text-xs text-text-muted">
                          Mirror passes on base
                        </span>
                        <Switch
                          checked={activeProject.effects.mirror}
                          onCheckedChange={(checked) =>
                            patchProject((project) => ({
                              ...project,
                              effects: { ...project.effects, mirror: checked },
                            }))
                          }
                        />
                      </div>
                    </ControlBlock>
                    <Separator />
                    <ControlBlock label="Export Format">
                      <Select
                        value={activeProject.export.format}
                        onValueChange={(value) =>
                          patchProject((project) => ({
                            ...project,
                            export: {
                              ...project.export,
                              format: value as typeof project.export.format,
                            },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image/png">PNG</SelectItem>
                          <SelectItem value="image/jpeg">JPEG</SelectItem>
                          <SelectItem value="image/png-transparent">
                            Transparent PNG
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </ControlBlock>
                    <SliderField
                      label="Export W"
                      min={1920}
                      max={7680}
                      step={16}
                      value={activeProject.export.width}
                      formatter={(value) => `${Math.round(value)} px`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          export: {
                            ...project.export,
                            ...lockExportDimensionsToCanvas(
                              project.canvas,
                              {
                                ...project.export,
                                width: Math.round(value),
                              },
                              "width",
                            ),
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Export H"
                      min={1080}
                      max={7680}
                      step={16}
                      value={activeProject.export.height}
                      formatter={(value) => `${Math.round(value)} px`}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          export: {
                            ...project.export,
                            ...lockExportDimensionsToCanvas(
                              project.canvas,
                              {
                                ...project.export,
                                height: Math.round(value),
                              },
                              "height",
                            ),
                          },
                        }))
                      }
                    />
                    <SliderField
                      label="Export Quality"
                      min={0.7}
                      max={1}
                      step={0.01}
                      value={activeProject.export.quality}
                      onChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          export: { ...project.export, quality: value },
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog
        open={sourceDialogOpen}
        onOpenChange={(open) => {
          setSourceDialogOpen(open);
          if (!open) {
            setEditingSourceId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSource ? "Edit source" : "Add source"}
            </DialogTitle>
            <DialogDescription>
              Build the source pool from imported images, solid fills, and
              two-color gradients.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={sourceDialogMode}
            onValueChange={(value) => setSourceDialogMode(value as SourceKind)}
          >
            <TabsList className="grid w-full grid-cols-3">
              {SOURCE_DIALOG_MODES.map((mode) => (
                <TabsTrigger
                  key={mode}
                  value={mode}
                  disabled={
                    Boolean(editingSource) && editingSource?.kind !== mode
                  }
                >
                  {formatSourceModeLabel(mode)}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="image" className="space-y-4">
              <div className="rounded-md bg-surface-sunken p-4 text-xs leading-relaxed text-text-muted">
                Import one or more images into the source pool. They will keep
                their current immutable workflow.
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSourceDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={openImagePicker}>
                  <ImagePlus className="h-3.5 w-3.5" />
                  Choose images
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="solid" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="solid-source-name">Name</Label>
                <Input
                  id="solid-source-name"
                  placeholder="Solid #RRGGBB"
                  value={solidSourceName}
                  onChange={(event) => setSolidSourceName(event.target.value)}
                />
              </div>
              <SourceColorField
                id="solid-source-color"
                label="Color"
                value={solidSourceColor}
                onChange={setSolidSourceColor}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSourceDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => void submitGeneratedSource()}>
                  {editingSource ? "Save source" : "Add source"}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="gradient" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gradient-source-name">Name</Label>
                <Input
                  id="gradient-source-name"
                  placeholder="Gradient #RRGGBB -> #RRGGBB"
                  value={gradientSourceName}
                  onChange={(event) =>
                    setGradientSourceName(event.target.value)
                  }
                />
              </div>
              <SourceColorField
                id="gradient-source-from"
                label="Start color"
                value={gradientSourceFrom}
                onChange={setGradientSourceFrom}
              />
              <SourceColorField
                id="gradient-source-to"
                label="End color"
                value={gradientSourceTo}
                onChange={setGradientSourceTo}
              />
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select
                  value={gradientSourceDirection}
                  onValueChange={(value) =>
                    setGradientSourceDirection(value as GradientDirection)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADIENT_DIRECTIONS.map((direction) => (
                      <SelectItem key={direction} value={direction}>
                        {formatGradientDirectionLabel(direction)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSourceDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => void submitGeneratedSource()}>
                  {editingSource ? "Save source" : "Add source"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              Update the project name used in the selector, preview header, and
              export filenames.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-project">Project name</Label>
            <Input
              id="rename-project"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitRename();
                }
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submitRename()}
              disabled={!renameValue.trim()}
            >
              Save name
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save project as</DialogTitle>
            <DialogDescription>
              Create a new project from the current draft with copied source
              assets.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="duplicate-project">New project name</Label>
            <Input
              id="duplicate-project"
              value={duplicateValue}
              onChange={(event) => setDuplicateValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void submitDuplicate();
                }
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDuplicateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submitDuplicate()}
              disabled={!duplicateValue.trim()}
            >
              Create copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={trashDialogOpen} onOpenChange={setTrashDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move project to trash</DialogTitle>
            <DialogDescription>
              {`"${activeProject.title}" will be removed from the active project list but can still be restored from the project manager.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTrashDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => void submitTrash()}>
              Move to trash
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manageProjectsOpen} onOpenChange={setManageProjectsOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage projects</DialogTitle>
            <DialogDescription>
              Browse active projects, restore trashed work, and permanently
              remove discarded projects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                Active projects
              </div>
              {activeProjects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  current={project.id === activeProject.id}
                  actions={
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={project.id === activeProject.id}
                        onClick={() => void setActiveProject(project.id)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void trashProject(project.id)}
                      >
                        Trash
                      </Button>
                    </>
                  }
                />
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                Trash
              </div>
              {trashedProjects.length === 0 ? (
                <div className="rounded-md bg-surface-sunken p-4 text-xs text-text-faint">
                  Trash is empty.
                </div>
              ) : (
                trashedProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    current={false}
                    actions={
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void restoreProject(project.id)}
                        >
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPurgeDialogProjectId(project.id)}
                        >
                          Delete permanently
                        </Button>
                      </>
                    }
                  />
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(purgeDialogProject) && manageProjectsOpen}
        onOpenChange={(open) => {
          if (!open) setPurgeDialogProjectId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project permanently</DialogTitle>
            <DialogDescription>
              {purgeDialogProject
                ? `This permanently removes "${purgeDialogProject.title}", its saved versions, and its copied source files.`
                : "This permanently removes the project and its files."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setPurgeDialogProjectId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (!purgeDialogProjectId) return;
                void purgeProject(purgeDialogProjectId);
                setPurgeDialogProjectId(null);
              }}
            >
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importConflictOpen}
        onOpenChange={(open) => {
          setImportConflictOpen(open);
          if (!open) setPendingImportInspection(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import conflict</DialogTitle>
            <DialogDescription>
              {pendingImportInspection?.conflictProject
                ? `The bundle "${pendingImportInspection.fileName}" matches the existing project "${pendingImportInspection.conflictProject.title}".`
                : "Choose how to import this project bundle."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-surface-sunken p-3 text-xs text-text-muted">
            Replace will overwrite the existing local project with the bundle
            contents. Import as copy will preserve the existing project and
            create a new project with remapped IDs.
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPendingImportInspection(null);
                setImportConflictOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => void resolveImportConflict("copy")}
            >
              Import as copy
            </Button>
            <Button
              variant="secondary"
              onClick={() => void resolveImportConflict("replace")}
            >
              Replace existing
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
