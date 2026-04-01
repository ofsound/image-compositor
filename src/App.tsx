import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import {
  CopyPlus,
  Download,
  FolderOpen,
  ImagePlus,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Toaster } from "sonner";

import { PreviewStage } from "@/components/app/preview-stage";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/assets";
import { readBlob } from "@/lib/opfs";
import { useAppStore } from "@/state/use-app-store";
import type {
  BlendMode,
  BundleImportInspection,
  CropDistribution,
  GeometryShape,
  LayoutFamily,
  ProjectDocument,
  SourceAsset,
  SourceAssignmentStrategy,
} from "@/types/project";

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

function SourceThumbnail({ previewPath, label }: { previewPath: string; label: string }) {
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
    <div className="space-y-2.5 rounded-lg border border-border-subtle bg-surface-sunken p-3">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {value ? <span className="font-mono text-[10px] text-text-muted">{value}</span> : null}
      </div>
      {children}
    </div>
  );
}

function SliderField({
  label,
  min,
  max,
  step,
  value,
  onChange,
  formatter = (next) => next.toFixed(2),
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  formatter?: (value: number) => string;
}) {
  return (
    <ControlBlock label={label} value={formatter(value)}>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => onChange(next[0] ?? value)}
      />
    </ControlBlock>
  );
}

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
          <div className="truncate text-sm font-medium text-text">{project.title}</div>
          <div className="font-mono text-[10px] text-text-faint">
            updated {new Date(project.updatedAt).toLocaleString()}
          </div>
          {current ? (
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
              current
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
      </div>
    </div>
  );
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const bundleInputRef = useRef<HTMLInputElement>(null);
  const [renderState, setRenderState] = useState({ ready: false, count: 0 });
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [manageProjectsOpen, setManageProjectsOpen] = useState(false);
  const [trashDialogOpen, setTrashDialogOpen] = useState(false);
  const [purgeDialogProjectId, setPurgeDialogProjectId] = useState<string | null>(null);
  const [importConflictOpen, setImportConflictOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [duplicateValue, setDuplicateValue] = useState("");
  const [pendingImportInspection, setPendingImportInspection] = useState<BundleImportInspection | null>(null);

  const {
    ready,
    busy,
    status,
    projects,
    assets,
    versions,
    activeProjectId,
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
    randomizeSeed,
    saveVersion,
    restoreVersion,
    exportCurrentImage,
    exportCurrentBundle,
    inspectBundleImport,
    resolveBundleImport,
  } = useAppStore();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const activeProjects = projects.filter((project) => project.deletedAt === null);
  const trashedProjects = projects.filter((project) => project.deletedAt !== null);
  const activeProject =
    activeProjects.find((project) => project.id === activeProjectId) ?? null;
  const deferredProject = useDeferredValue(activeProject);

  useEffect(() => {
    if (!activeProject) return;
    setRenameValue(activeProject.title);
    setDuplicateValue(`${activeProject.title} Copy`);
  }, [activeProject]);

  const activeAssets = activeProject
    ? activeProject.sourceIds
        .map((sourceId) => assets.find((asset) => asset.id === sourceId && asset.projectId === activeProject.id))
        .filter((asset): asset is SourceAsset => Boolean(asset))
    : [];
  const activeVersions = activeProject
    ? versions.filter((version) => version.projectId === activeProject.id)
    : [];
  const purgeDialogProject =
    projects.find((project) => project.id === purgeDialogProjectId) ?? null;

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

  const captureThumbnail = () =>
    new Promise<Blob | null>((resolve) => {
      canvasRef.current?.toBlob((blob) => resolve(blob), "image/webp", 0.88);
    });

  const openSaveVersion = async () => {
    const label = window.prompt("Version label", `Snapshot ${new Date().toLocaleTimeString()}`);
    if (!label) return;
    const thumbnail = await captureThumbnail();
    await saveVersion(label, thumbnail);
  };

  const bitmapLookup = (asset: SourceAsset) => readBlob(asset.normalizedPath);

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

  return (
    <div className="min-h-screen bg-app text-text">
      <Toaster richColors position="top-right" />
      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-raised px-4 py-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                Image Grid
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="text-xs text-text-secondary">compositor</div>
            </div>

            <div className="h-6 w-px bg-border" />

            <div className="min-w-[220px]">
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
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => void createProject()}>
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRenameDialogOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDuplicateDialogOpen(true)}>
              <CopyPlus className="h-3.5 w-3.5" />
              Save as
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setManageProjectsOpen(true)}>
              <Layers className="h-3.5 w-3.5" />
              Projects
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setTrashDialogOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Trash
            </Button>
            <Button variant="ghost" size="sm" onClick={() => uploadInputRef.current?.click()}>
              <ImagePlus className="h-3.5 w-3.5" />
              Sources
            </Button>
            <Button variant="ghost" size="sm" onClick={() => bundleInputRef.current?.click()}>
              <FolderOpen className="h-3.5 w-3.5" />
              Import
            </Button>
            <div className="h-4 w-px bg-border" />
            <Button variant="secondary" size="sm" onClick={() => void randomizeSeed()}>
              <Sparkles className="h-3.5 w-3.5" />
              Randomize
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void openSaveVersion()}>
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
            <Button
              size="sm"
              onClick={() => void exportCurrentImage(bitmapLookup)}
              disabled={busy || activeAssets.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <div className="h-4 w-px bg-border" />
            <ThemeToggle />
          </div>
        </div>

        <div className="grid flex-1 grid-cols-[280px_minmax(0,1fr)_320px] gap-3">
          <Card className="flex min-h-[720px] flex-col">
            <CardHeader>
              <CardTitle>Sources</CardTitle>
              <CardDescription>
                Immutable originals. Local previews & metadata.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <div className="rounded-md border border-dashed border-border-subtle bg-surface-sunken p-3">
                <div className="font-mono text-[10px] leading-relaxed text-text-faint">
                  JPG · PNG · WebP · GIF · BMP · TIFF · AVIF · HEIC
                </div>
                <Button
                  className="mt-3 w-full"
                  variant="outline"
                  size="sm"
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Add to pool
                </Button>
              </div>

              <div className="space-y-2 overflow-y-auto pr-1">
                {activeAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="rounded-md border border-border-subtle bg-surface-sunken p-2"
                  >
                    <SourceThumbnail previewPath={asset.previewPath} label={asset.name} />
                    <div className="mt-2 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium text-text">{asset.name}</div>
                        <div className="font-mono text-[10px] text-text-faint">
                          {asset.width} × {asset.height}
                        </div>
                      </div>
                      <div
                        className="h-5 w-5 rounded-full border border-border"
                        style={{ background: asset.averageColor }}
                      />
                    </div>
                  </div>
                ))}
                {activeAssets.length === 0 ? (
                  <div className="rounded-md bg-surface-sunken p-4 text-xs leading-relaxed text-text-faint">
                    Upload images to begin. Assets are preserved as immutable originals.
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="flex min-h-[720px] flex-col gap-3">
            <Card className="flex-1 overflow-hidden">
              <CardHeader className="flex-row items-end justify-between gap-4">
                <div>
                  <CardTitle>{activeProject.title}</CardTitle>
                  <CardDescription>
                    <span className="font-mono">seed {activeProject.activeSeed}</span> · {renderState.count} assets
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-faint">
                  <span>{renderState.ready ? "synced" : "updating"}</span>
                  <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md bg-surface-muted px-3 py-2.5">
                    <Label>Layout</Label>
                    <div className="mt-1 font-mono text-xs capitalize text-text">{activeProject.layout.family}</div>
                  </div>
                  <div className="rounded-md bg-surface-muted px-3 py-2.5">
                    <Label>Assignment</Label>
                    <div className="mt-1 font-mono text-xs capitalize text-text">
                      {activeProject.sourceMapping.strategy}
                    </div>
                  </div>
                  <div className="rounded-md bg-surface-muted px-3 py-2.5">
                    <Label>Blend</Label>
                    <div className="mt-1 font-mono text-xs capitalize text-text">
                      {activeProject.compositing.blendMode}
                    </div>
                  </div>
                </div>

                <PreviewStage
                  canvasRef={canvasRef}
                  project={deferredProject}
                  assets={activeAssets}
                  onRenderState={setRenderState}
                />

                <div className="flex items-center justify-between rounded-lg border border-status-bar-border bg-status-bar px-4 py-3">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-faint">
                      Local-first engine
                    </div>
                    <div className="text-xs text-text-muted">{status}</div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void exportCurrentBundle()}
                    disabled={busy}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Bundle
                  </Button>
                </div>
              </CardContent>
            </Card>

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
                        <div className="text-sm font-medium text-text">{version.label}</div>
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
          </div>

          <Card className="min-h-[720px]">
            <CardHeader>
              <CardTitle>Inspector</CardTitle>
              <CardDescription>
                Deterministic project parameters.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              <Tabs defaultValue="layout">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="layout">Layout</TabsTrigger>
                  <TabsTrigger value="mapping">Mapping</TabsTrigger>
                  <TabsTrigger value="effects">Effects</TabsTrigger>
                </TabsList>
                <TabsContent value="layout" className="space-y-2.5">
                  <ControlBlock label="Family">
                    <Select
                      value={activeProject.layout.family}
                      onValueChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: { ...project.layout, family: value as LayoutFamily },
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["blocks", "grid", "strips", "radial"].map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["mixed", "rect", "triangle", "ring", "wedge"].map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ControlBlock>
                  <SliderField
                    label="Density"
                    min={0.1}
                    max={1}
                    step={0.01}
                    value={activeProject.layout.density}
                    onChange={(value) =>
                      patchProject((project) => ({
                        ...project,
                        layout: { ...project.layout, density: value },
                      }))
                    }
                  />
                  <SliderField
                    label="Columns"
                    min={2}
                    max={16}
                    step={1}
                    value={activeProject.layout.columns}
                    formatter={(value) => `${Math.round(value)}`}
                    onChange={(value) =>
                      patchProject((project) => ({
                        ...project,
                        layout: { ...project.layout, columns: Math.round(value) },
                      }))
                    }
                  />
                  <SliderField
                    label="Rows"
                    min={2}
                    max={12}
                    step={1}
                    value={activeProject.layout.rows}
                    formatter={(value) => `${Math.round(value)}`}
                    onChange={(value) =>
                      patchProject((project) => ({
                        ...project,
                        layout: { ...project.layout, rows: Math.round(value) },
                      }))
                    }
                  />
                  <SliderField
                    label="Gutter"
                    min={0}
                    max={32}
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
                  <ControlBlock label="Symmetry">
                    <Select
                      value={activeProject.layout.symmetryMode}
                      onValueChange={(value) =>
                        patchProject((project) => ({
                          ...project,
                          layout: {
                            ...project.layout,
                            symmetryMode: value as typeof project.layout.symmetryMode,
                          },
                        }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["none", "mirror-x", "mirror-y", "quad", "radial"].map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ControlBlock>
                  <SliderField
                    label="Radial Copies"
                    min={2}
                    max={12}
                    step={1}
                    value={activeProject.layout.symmetryCopies}
                    formatter={(value) => `${Math.round(value)}`}
                    onChange={(value) =>
                      patchProject((project) => ({
                        ...project,
                        layout: { ...project.layout, symmetryCopies: Math.round(value) },
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
                      patchProject((project) => ({
                        ...project,
                        canvas: { ...project.canvas, width: Math.round(value) },
                      }))
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
                      patchProject((project) => ({
                        ...project,
                        canvas: { ...project.canvas, height: Math.round(value) },
                      }))
                    }
                  />
                </TabsContent>

                <TabsContent value="mapping" className="space-y-2.5">
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["random", "weighted", "sequential", "luminance", "palette", "symmetry"].map((option) => (
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="center">Centered</SelectItem>
                        <SelectItem value="distributed">Distributed</SelectItem>
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
                        sourceMapping: { ...project.sourceMapping, cropZoom: value },
                      }))
                    }
                  />
                  <SliderField
                    label="Source Bias"
                    min={0}
                    max={1}
                    step={0.01}
                    value={activeProject.sourceMapping.sourceBias}
                    onChange={(value) =>
                      patchProject((project) => ({
                        ...project,
                        sourceMapping: { ...project.sourceMapping, sourceBias: value },
                      }))
                    }
                  />
                  <SliderField
                    label="Palette Emphasis"
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
                      <span className="text-xs text-text-muted">Center crop, no stretch</span>
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                        compositing: { ...project.compositing, opacity: value },
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
                        compositing: { ...project.compositing, overlap: value },
                      }))
                    }
                  />
                </TabsContent>

                <TabsContent value="effects" className="space-y-2.5">
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
                        effects: { ...project.effects, rotationJitter: value },
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
                      <span className="text-xs text-text-muted">Mirror passes on base</span>
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image/png">PNG</SelectItem>
                        <SelectItem value="image/jpeg">JPEG</SelectItem>
                        <SelectItem value="image/png-transparent">Transparent PNG</SelectItem>
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
                        export: { ...project.export, width: Math.round(value) },
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
                        export: { ...project.export, height: Math.round(value) },
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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              Update the project name used in the selector, preview header, and export filenames.
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
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitRename()} disabled={!renameValue.trim()}>
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
              Create a new project from the current draft with copied source assets.
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
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitDuplicate()} disabled={!duplicateValue.trim()}>
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
              Browse active projects, restore trashed work, and permanently remove discarded projects.
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
            <Button variant="outline" onClick={() => setPurgeDialogProjectId(null)}>
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
            Replace will overwrite the existing local project with the bundle contents. Import as copy will preserve the existing project and create a new project with remapped IDs.
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
            <Button variant="outline" onClick={() => void resolveImportConflict("copy")}>
              Import as copy
            </Button>
            <Button variant="secondary" onClick={() => void resolveImportConflict("replace")}>
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
