import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  Eye,
  EyeOff,
  FolderOpen,
  GripVertical,
  ImagePlus,
  Layers,
  Maximize2,
  Minimize2,
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

import { LeftSidebar } from "@/features/editor/left-sidebar";
import { CenterCanvas } from "@/features/editor/center-canvas";
import { RightSidebar } from "@/features/editor/right-sidebar";

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
  type GeneratedSourceInput,
  getDefaultGradientInput,
  getDefaultGradientDirection,
  getDefaultCellularInput,
  getDefaultPerlinInput,
  getDefaultReactionInput,
  getDefaultWaveInput,
  getSourceContentSignature,
  normalizeCellularInput,
  normalizeGradientInput,
  normalizePerlinInput,
  normalizeReactionInput,
  normalizeSolidInput,
  normalizeWaveInput,
  renderGeneratedSourceToCanvas,
} from "@/lib/assets";
import { normalizeHexColor } from "@/lib/color";
import {
  createProjectEditorView,
  updateProjectFromEditorView,
} from "@/lib/project-editor-view";
import { lockExportDimensionsToCanvas } from "@/lib/export-sizing";
import { readBlob } from "@/lib/opfs";
import { toggleSourceId } from "@/lib/source-selection";
import { getSourceWeight, setSourceWeight } from "@/lib/source-weights";
import { cn } from "@/lib/utils";
import {
  useWorkspaceActions,
  useWorkspaceState,
} from "@/state/app-store-hooks";
import type {
  BlendMode,
  BundleImportInspection,
  CellularSourceAsset,
  CropDistribution,
  GradientDirection,
  GradientMode,
  GradientSourceAsset,
  GeometryShape,
  KaleidoscopeMirrorMode,
  LayoutFamily,
  PerlinSourceAsset,
  ProjectDocument,
  RadialChildRotationMode,
  ReactionSourceAsset,
  SolidSourceAsset,
  SourceAsset,
  SourceAssignmentStrategy,
  SourceKind,
  ThreeDStructureMode,
  WaveSourceAsset,
} from "@/types/project";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHistoryShortcuts } from "@/components/app/use-history-shortcuts";
import { useLayerThumbnailUrls } from "@/components/app/use-layer-thumbnail-urls";

function useObjectUrl(path: string | null, versionKey?: string) {
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
  }, [path, versionKey]);

  return url;
}

function SourceThumbnail({
  previewPath,
  label,
  versionKey,
  compact = false,
}: {
  previewPath: string;
  label: string;
  versionKey: string;
  compact?: boolean;
}) {
  const previewUrl = useObjectUrl(previewPath, versionKey);

  return previewUrl ? (
    <img
      src={previewUrl}
      alt={label}
      className={
        compact
          ? "h-24 w-full rounded-md object-cover"
          : "h-20 w-full rounded-md object-cover"
      }
    />
  ) : (
    <div
      className={
        compact
          ? "flex h-24 items-center justify-center rounded-md bg-surface-muted font-mono text-[10px] uppercase tracking-[0.1em] text-text-faint"
          : "flex h-20 items-center justify-center rounded-md bg-surface-muted font-mono text-[10px] uppercase tracking-[0.1em] text-text-faint"
      }
    >
      Loading
    </div>
  );
}

function SortableLayerRow({
  layer,
  isSelected,
  thumbnailUrl,
  canDelete,
  onSelect,
  onToggleVisibility,
  onDelete,
}: {
  layer: ProjectDocument["layers"][number];
  isSelected: boolean;
  thumbnailUrl: string | null;
  canDelete: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const sourceCountLabel = `${layer.sourceIds.length} source${
    layer.sourceIds.length === 1 ? "" : "s"
  }`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border p-3 ${
        isSelected
          ? "border-border-strong bg-surface-sunken"
          : "border-border bg-surface-muted/50"
      } ${isDragging ? "z-10 shadow-lg ring-1 ring-border-strong" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block w-full text-left"
            onClick={onSelect}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-text">
              <Layers className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              <span className="truncate">{layer.name}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.08em] text-text-muted">
              {isSelected ? (
                <span className="rounded-full border border-border-subtle bg-surface px-2 py-1 text-text">
                  Editing
                </span>
              ) : null}
              <span className="rounded-full border border-border-subtle px-2 py-1">
                {layer.visible ? "Visible" : "Hidden"}
              </span>
              <span>{sourceCountLabel}</span>
            </div>
          </button>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="touch-none h-8 w-8 shrink-0 px-0 text-text-faint hover:text-text active:cursor-grabbing"
          aria-label={`Reorder ${layer.name}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 cursor-grab" />
        </Button>
      </div>
      <button
        type="button"
        className="mt-3 block w-full text-left"
        onClick={onSelect}
      >
        <LayerRowThumbnail
          layerId={layer.id}
          layerName={layer.name}
          thumbnailUrl={thumbnailUrl}
        />
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center justify-center gap-2 rounded-md border px-3 text-xs font-medium transition-all",
            layer.visible
              ? "border-control-secondary-border bg-control-secondary text-control-secondary-text hover:bg-control-secondary-hover"
              : "border-border bg-transparent text-text-secondary hover:border-border-strong hover:bg-control-ghost-hover hover:text-text",
          )}
          onClick={onToggleVisibility}
          aria-label={
            layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`
          }
        >
          {layer.visible ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {layer.visible ? "Hide" : "Show"}
        </button>
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-center"
          onClick={onDelete}
          disabled={!canDelete}
          aria-label={`Delete ${layer.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}

function LayerRowThumbnail({
  layerId,
  layerName,
  thumbnailUrl,
}: {
  layerId: string;
  layerName: string;
  thumbnailUrl: string | null;
}) {
  return thumbnailUrl ? (
    <img
      src={thumbnailUrl}
      alt={`${layerName} preview`}
      data-testid={`layer-thumbnail-${layerId}`}
      className="h-32 w-full rounded-md border border-border-subtle bg-preview-canvas object-contain"
    />
  ) : (
    <div
      data-testid={`layer-thumbnail-placeholder-${layerId}`}
      className="flex h-32 w-full items-center justify-center rounded-md border border-border-subtle bg-preview-canvas font-mono text-[9px] uppercase tracking-[0.08em] text-text-faint"
    >
      Loading
    </div>
  );
}

const SOURCE_DIALOG_MODES: SourceKind[] = [
  "image",
  "solid",
  "gradient",
  "perlin",
  "cellular",
  "reaction",
  "waves",
];
const PROCEDURAL_SOURCE_KINDS: SourceKind[] = [
  "perlin",
  "cellular",
  "reaction",
  "waves",
];
const LAYER_ROW_THUMBNAIL_WIDTH = 224;
const LAYER_ROW_THUMBNAIL_HEIGHT = 140;
const GRADIENT_MODES: GradientMode[] = ["linear", "radial", "conic"];
const GRADIENT_DIRECTIONS: GradientDirection[] = [
  "horizontal",
  "vertical",
  "diagonal-down",
  "diagonal-up",
];
const GENERATED_SOURCE_PREVIEW_MAX_DIMENSION = 640;
const ORGANIC_DISTRIBUTION_MAX = 4_096;
const THREE_D_DISTRIBUTION_MAX = 4_096;

function formatSourceModeLabel(mode: SourceKind) {
  if (mode === "solid") return "Solid";
  if (mode === "gradient") return "Gradient";
  if (mode === "perlin") return "Perlin";
  if (mode === "cellular") return "Cellular";
  if (mode === "reaction") return "Reaction";
  if (mode === "waves") return "Waves";
  return "Image";
}

function formatGradientDirectionLabel(direction: GradientDirection) {
  if (direction === "diagonal-down") return "Diagonal down";
  if (direction === "diagonal-up") return "Diagonal up";
  return direction[0]!.toUpperCase() + direction.slice(1);
}

function formatGradientModeLabel(mode: GradientMode) {
  return mode[0]!.toUpperCase() + mode.slice(1);
}

function formatPercentValue(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDegreeValue(value: number) {
  return `${Math.round(value)}°`;
}

function formatSourceWeightValue(value: number) {
  const rounded = Math.round(value * 100) / 100;
  const displayValue = Number.isInteger(rounded)
    ? rounded.toFixed(0)
    : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${displayValue}x`;
}

function createNoiseSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}

export function getGeometryOptions(family: LayoutFamily): GeometryShape[] {
  return family === "grid"
    ? ["mixed", "rect", "triangle", "interlock", "ring", "arc", "wedge"]
    : family === "organic"
      ? ["blob", "rect", "mixed", "ring", "arc", "wedge"]
      : ["mixed", "rect", "triangle", "ring", "arc", "wedge"];
}

export function coerceShapeModeForFamily(
  family: LayoutFamily,
  shapeMode: GeometryShape,
): GeometryShape {
  if (getGeometryOptions(family).includes(shapeMode)) {
    return shapeMode;
  }

  if (family === "organic") {
    return "blob";
  }

  if (shapeMode === "interlock") {
    return "triangle";
  }

  return "rect";
}

function SourceColorField({
  id,
  label,
  value,
  onChange,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
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

function GeneratedSourcePreview({
  source,
  canvasSize,
}: {
  source: GeneratedSourceInput;
  canvasSize: Pick<ProjectDocument["canvas"], "width" | "height">;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = Math.min(
    1,
    GENERATED_SOURCE_PREVIEW_MAX_DIMENSION /
      Math.max(canvasSize.width, canvasSize.height),
  );
  const previewWidth = Math.max(1, Math.round(canvasSize.width * scale));
  const previewHeight = Math.max(1, Math.round(canvasSize.height * scale));
  const previewSignature = JSON.stringify(source);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = previewWidth;
    canvas.height = previewHeight;
    renderGeneratedSourceToCanvas(canvas, source);
  }, [previewHeight, previewSignature, previewWidth]);

  return (
    <div
      data-testid="source-editor-preview"
      className="rounded-lg border border-border-subtle bg-surface-sunken/60 p-4"
    >
      <div className="space-y-1">
        <div className="text-sm font-medium text-text">Preview</div>
        <div className="text-xs text-text-muted">
          Live source preview using the current canvas aspect ratio.
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-md bg-preview-bg p-3">
        <div className="flex min-h-[18rem] items-center justify-center">
          <canvas
            ref={canvasRef}
            data-testid="source-editor-preview-canvas"
            aria-label="Generated source preview"
            className="h-auto w-full rounded-md bg-preview-canvas object-contain"
            style={{
              aspectRatio: `${canvasSize.width} / ${canvasSize.height}`,
            }}
            width={previewWidth}
            height={previewHeight}
          />
        </div>
      </div>
    </div>
  );
}

function ControlBlock({
  label,
  value,
  children,
  className,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
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

function InspectorGroup({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border-subtle bg-surface-sunken/40 p-3",
        className,
      )}
    >
      <div className="border-b border-border-subtle pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted">
        {title}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function InspectorFieldGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-3", className)}>{children}</div>;
}

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

function PanelShell({
  title,
  description,
  actions,
  sectionLabel,
  className,
  cardClassName,
  contentClassName,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  sectionLabel?: string;
  className?: string;
  cardClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={sectionLabel ?? title}
      className={cn("flex min-h-0 flex-col", className)}
    >
      <Card
        className={cn(
          "flex h-full min-h-0 flex-col overflow-hidden",
          cardClassName,
        )}
      >
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b border-border-subtle/60 pb-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-1">{description}</CardDescription>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </CardHeader>
        <CardContent className={cn("min-h-0 flex-1", contentClassName)}>
          {children}
        </CardContent>
      </Card>
    </section>
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
  className,
  formatter = (next) => next.toFixed(2),
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
  formatter?: (value: number) => string;
}) {
  const [draftValue, setDraftValue] = useState<number | null>(null);
  const lastEmittedValueRef = useRef<number | null>(null);

  useEffect(() => {
    setDraftValue(null);
    lastEmittedValueRef.current = value;
  }, [value]);

  const displayValue = draftValue ?? value;

  return (
    <ControlBlock
      label={label}
      value={formatter(displayValue)}
      className={className}
    >
      <Slider
        aria-label={label}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        value={[displayValue]}
        onValueChange={(next) => {
          const nextValue = next[0] ?? value;
          setDraftValue(nextValue);
          if (lastEmittedValueRef.current === nextValue) {
            return;
          }
          lastEmittedValueRef.current = nextValue;
          onChange(nextValue);
        }}
        onValueCommit={() => {
          setDraftValue(null);
        }}
      />
    </ControlBlock>
  );
}

interface ProceduralTextureField {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function ProceduralTextureTab({
  tabValue,
  name,
  setName,
  namePlaceholder,
  color,
  setColor,
  regenerateSeed,
  fields,
  previewSource,
  canvasSize,
  editingSource,
  submitGeneratedSource,
  closeDialog,
}: {
  tabValue: SourceKind;
  name: string;
  setName: (value: string) => void;
  namePlaceholder: string;
  color: string;
  setColor: (value: string) => void;
  regenerateSeed: () => void;
  fields: ProceduralTextureField[];
  previewSource: GeneratedSourceInput;
  canvasSize: Pick<ProjectDocument["canvas"], "width" | "height">;
  editingSource: SourceAsset | null;
  submitGeneratedSource: () => Promise<void>;
  closeDialog: () => void;
}) {
  return (
    <TabsContent value={tabValue}>
      <div
        data-testid="source-editor-preview-layout"
        className="grid gap-6 md:grid-cols-2 md:items-start"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${tabValue}-source-name`}>Name</Label>
            <Input
              id={`${tabValue}-source-name`}
              placeholder={namePlaceholder}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <SourceColorField
            id={`${tabValue}-source-color`}
            label="Base color"
            value={color}
            onChange={setColor}
          />
          <div className="rounded-md border border-border-subtle bg-surface-sunken/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Variation</Label>
                <div className="text-xs text-text-muted">
                  Regenerate the hidden seed while keeping the sliders
                  unchanged.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={regenerateSeed}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
            </div>
          </div>
          {fields.map((field) => (
            <SliderField
              key={`${tabValue}-${field.label}`}
              label={field.label}
              min={0}
              max={1}
              step={0.01}
              value={field.value}
              formatter={formatPercentValue}
              onChange={field.onChange}
            />
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={() => void submitGeneratedSource()}>
              {editingSource ? "Save source" : "Add source"}
            </Button>
          </div>
        </div>
        <GeneratedSourcePreview
          source={previewSource}
          canvasSize={canvasSize}
        />
      </div>
    </TabsContent>
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
  const [previewExpanded, setPreviewExpanded] = useState(false);
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
  const [gradientSourceMode, setGradientSourceMode] =
    useState<GradientMode>("linear");
  const [gradientSourceDirection, setGradientSourceDirection] =
    useState<GradientDirection>(getDefaultGradientDirection());
  const [gradientSourceViaEnabled, setGradientSourceViaEnabled] =
    useState(false);
  const [gradientSourceViaColor, setGradientSourceViaColor] =
    useState("#94a3b8");
  const [gradientSourceViaPosition, setGradientSourceViaPosition] =
    useState(0.5);
  const [gradientSourceCenterX, setGradientSourceCenterX] = useState(0.5);
  const [gradientSourceCenterY, setGradientSourceCenterY] = useState(0.5);
  const [gradientSourceRadialRadius, setGradientSourceRadialRadius] =
    useState(1);
  const [gradientSourceRadialInnerRadius, setGradientSourceRadialInnerRadius] =
    useState(0);
  const [gradientSourceConicAngle, setGradientSourceConicAngle] = useState(0);
  const [gradientSourceConicSpan, setGradientSourceConicSpan] = useState(360);
  const [gradientSourceConicRepeat, setGradientSourceConicRepeat] =
    useState(false);
  const [perlinSourceName, setPerlinSourceName] = useState("");
  const [perlinSourceColor, setPerlinSourceColor] = useState("#0f766e");
  const [perlinSourceScale, setPerlinSourceScale] = useState(0.55);
  const [perlinSourceDetail, setPerlinSourceDetail] = useState(0.55);
  const [perlinSourceContrast, setPerlinSourceContrast] = useState(0.45);
  const [perlinSourceDistortion, setPerlinSourceDistortion] = useState(0.25);
  const [perlinSourceSeed, setPerlinSourceSeed] = useState(() =>
    createNoiseSeed(),
  );
  const [cellularSourceName, setCellularSourceName] = useState("");
  const [cellularSourceColor, setCellularSourceColor] = useState("#8b5cf6");
  const [cellularSourceScale, setCellularSourceScale] = useState(0.55);
  const [cellularSourceJitter, setCellularSourceJitter] = useState(0.6);
  const [cellularSourceEdge, setCellularSourceEdge] = useState(0.55);
  const [cellularSourceContrast, setCellularSourceContrast] = useState(0.45);
  const [cellularSourceSeed, setCellularSourceSeed] = useState(() =>
    createNoiseSeed(),
  );
  const [reactionSourceName, setReactionSourceName] = useState("");
  const [reactionSourceColor, setReactionSourceColor] = useState("#ef4444");
  const [reactionSourceScale, setReactionSourceScale] = useState(0.55);
  const [reactionSourceDiffusion, setReactionSourceDiffusion] = useState(0.55);
  const [reactionSourceBalance, setReactionSourceBalance] = useState(0.5);
  const [reactionSourceDistortion, setReactionSourceDistortion] = useState(0.2);
  const [reactionSourceSeed, setReactionSourceSeed] = useState(() =>
    createNoiseSeed(),
  );
  const [waveSourceName, setWaveSourceName] = useState("");
  const [waveSourceColor, setWaveSourceColor] = useState("#0ea5e9");
  const [waveSourceScale, setWaveSourceScale] = useState(0.55);
  const [waveSourceInterference, setWaveSourceInterference] = useState(0.65);
  const [waveSourceDirectionality, setWaveSourceDirectionality] = useState(0.6);
  const [waveSourceDistortion, setWaveSourceDistortion] = useState(0.2);
  const [waveSourceSeed, setWaveSourceSeed] = useState(() => createNoiseSeed());
  const [pendingImportInspection, setPendingImportInspection] =
    useState<BundleImportInspection | null>(null);

  const {
    ready,
    busy,
    status,
    sourceImportProgress,
    projects,
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
    trashProject,
    restoreProject,
    purgeProject,
    setActiveProject,
    selectLayer,
    addLayer,
    deleteLayer,
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
      activationConstraint: {
        distance: 6,
      },
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
    if (!previewExpanded) {
      return;
    }

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

  const activeProjects = projects.filter(
    (project) => project.deletedAt === null,
  );
  const trashedProjects = projects.filter(
    (project) => project.deletedAt !== null,
  );
  const activeProject =
    activeProjects.find((project) => project.id === activeProjectId) ?? null;
  const deferredProject = useDeferredValue(activeProject);
  const previewProject = deferredProject ?? activeProject;
  const deferredProjectAssets = previewProject
    ? assets.filter((asset) => asset.projectId === previewProject.id)
    : [];
  const previewAssets = previewProject
    ? Array.from(
        new Set(
          previewProject.layers
            .filter((layer) => layer.visible)
            .flatMap((layer) => layer.sourceIds),
        ),
      )
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

  useEffect(() => {
    setPreviewExpanded(false);
  }, [activeProject?.id]);

  const activeProjectView = activeProject
    ? createProjectEditorView(activeProject)
    : null;
  const projectAssets = activeProject
    ? assets.filter((asset) => asset.projectId === activeProject.id)
    : [];
  const editingSource = editingSourceId
    ? (projectAssets.find((asset) => asset.id === editingSourceId) ?? null)
    : null;
  const selectedLayer = activeProject
    ? (activeProject.layers.find(
        (layer) => layer.id === activeProject.selectedLayerId,
      ) ??
      activeProject.layers.at(-1) ??
      null)
    : null;
  const displayLayers = activeProject
    ? [...activeProject.layers].reverse()
    : [];
  const activeVersions = activeProject
    ? versions.filter((version) => version.projectId === activeProject.id)
    : [];
  const previewAssetSignature = previewAssets
    .map((asset) => asset.id)
    .join("|");
  const purgeDialogProject =
    projects.find((project) => project.id === purgeDialogProjectId) ?? null;
  const isLinearGradientMode = gradientSourceMode === "linear";
  const isRadialGradientMode = gradientSourceMode === "radial";
  const isConicGradientMode = gradientSourceMode === "conic";
  const showGeneratedSourcePreview =
    sourceDialogMode === "gradient" ||
    PROCEDURAL_SOURCE_KINDS.includes(sourceDialogMode);

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
    if (!over) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) {
      return;
    }

    const displayLayerIds = displayLayers.map((layer) => layer.id);
    const activeIndex = displayLayerIds.indexOf(activeId);
    const overIndex = displayLayerIds.indexOf(overId);

    if (activeIndex < 0 || overIndex < 0) {
      return;
    }

    const nextDisplayLayerIds = arrayMove(
      displayLayerIds,
      activeIndex,
      overIndex,
    );
    void reorderLayers([...nextDisplayLayerIds].reverse());
  };

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

  const patchProject = (
    updater: (
      project: NonNullable<typeof activeProjectView>,
    ) => NonNullable<typeof activeProjectView>,
  ) => {
    startTransition(() => {
      void updateProject((project) =>
        updateProjectFromEditorView(project, updater),
      );
    });
  };
  const isStripsFamily = activeProjectView.layout.family === "strips";
  const isGridFamily = activeProjectView.layout.family === "grid";
  const isBlocksFamily = activeProjectView.layout.family === "blocks";
  const isRadialFamily = activeProjectView.layout.family === "radial";
  const isOrganicFamily = activeProjectView.layout.family === "organic";
  const isFlowFamily = activeProjectView.layout.family === "flow";
  const isThreeDFamily = activeProjectView.layout.family === "3d";
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
  const geometryValue = geometryOptions.includes(
    activeProjectView.layout.shapeMode,
  )
    ? activeProjectView.layout.shapeMode
    : coerceShapeModeForFamily(
        activeProjectView.layout.family,
        activeProjectView.layout.shapeMode,
      );
  const inspectorLayerName = selectedLayer?.name ?? "Selected Layer";

  const captureThumbnail = () =>
    new Promise<Blob | null>((resolve) => {
      canvasRef.current?.toBlob((blob) => resolve(blob), "image/webp", 0.88);
    });

  const gradientPreviewSource: GeneratedSourceInput = {
    kind: "gradient",
    name: gradientSourceName,
    recipe: normalizeGradientInput({
      name: gradientSourceName,
      mode: gradientSourceMode,
      from: gradientSourceFrom,
      to: gradientSourceTo,
      direction: gradientSourceDirection,
      viaColor: gradientSourceViaEnabled ? gradientSourceViaColor : null,
      viaPosition: gradientSourceViaPosition,
      centerX: gradientSourceCenterX,
      centerY: gradientSourceCenterY,
      radialRadius: gradientSourceRadialRadius,
      radialInnerRadius: gradientSourceRadialInnerRadius,
      conicAngle: gradientSourceConicAngle,
      conicSpan: gradientSourceConicSpan,
      conicRepeat: gradientSourceConicRepeat,
    }),
  };
  const perlinPreviewSource: GeneratedSourceInput = {
    kind: "perlin",
    name: perlinSourceName,
    recipe: normalizePerlinInput({
      name: perlinSourceName,
      color: perlinSourceColor,
      scale: perlinSourceScale,
      detail: perlinSourceDetail,
      contrast: perlinSourceContrast,
      distortion: perlinSourceDistortion,
      seed: perlinSourceSeed,
    }),
  };
  const cellularPreviewSource: GeneratedSourceInput = {
    kind: "cellular",
    name: cellularSourceName,
    recipe: normalizeCellularInput({
      name: cellularSourceName,
      color: cellularSourceColor,
      scale: cellularSourceScale,
      jitter: cellularSourceJitter,
      edge: cellularSourceEdge,
      contrast: cellularSourceContrast,
      seed: cellularSourceSeed,
    }),
  };
  const reactionPreviewSource: GeneratedSourceInput = {
    kind: "reaction",
    name: reactionSourceName,
    recipe: normalizeReactionInput({
      name: reactionSourceName,
      color: reactionSourceColor,
      scale: reactionSourceScale,
      diffusion: reactionSourceDiffusion,
      balance: reactionSourceBalance,
      distortion: reactionSourceDistortion,
      seed: reactionSourceSeed,
    }),
  };
  const wavePreviewSource: GeneratedSourceInput = {
    kind: "waves",
    name: waveSourceName,
    recipe: normalizeWaveInput({
      name: waveSourceName,
      color: waveSourceColor,
      scale: waveSourceScale,
      interference: waveSourceInterference,
      directionality: waveSourceDirectionality,
      distortion: waveSourceDistortion,
      seed: waveSourceSeed,
    }),
  };
  const previewPanel = (
    <PanelShell
      title="Preview"
      sectionLabel="Preview"
      className="min-w-0 flex-1"
      actions={
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={previewExpanded ? "Restore layout" : "Expand preview"}
          aria-pressed={previewExpanded}
          title={previewExpanded ? "Restore layout" : "Expand preview"}
          onClick={() => setPreviewExpanded((current) => !current)}
        >
          {previewExpanded ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      }
      cardClassName="rounded-none border-0 bg-transparent shadow-none backdrop-blur-none"
      contentClassName="flex min-h-0 items-center justify-center p-0"
    >
      <PreviewStage
        canvasRef={canvasRef}
        project={previewProject ?? activeProject}
        assets={previewAssets}
        onRenderState={setRenderState}
      />
    </PanelShell>
  );
  const projectSettingsPanel = (
    <PanelShell
      title="Project Settings"
      sectionLabel="Project Settings"
      className="shrink-0"
      cardClassName="bg-surface-raised shadow-none"
      contentClassName="max-h-[38vh] overflow-y-auto space-y-4"
    >
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <section aria-label="Canvas settings" className="min-w-0 space-y-4">
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
            label="Canvas Background"
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
                  {Math.round(activeProject.canvas.backgroundAlpha * 100)}%
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
        </section>

        <section aria-label="Export settings" className="min-w-0 space-y-4">
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
        </section>
      </div>
    </PanelShell>
  );

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
    const defaultGradient = getDefaultGradientInput();
    const defaultPerlin = getDefaultPerlinInput();
    const defaultCellular = getDefaultCellularInput();
    const defaultReaction = getDefaultReactionInput();
    const defaultWave = getDefaultWaveInput();
    setSolidSourceName("");
    setSolidSourceColor("#0f172a");
    setGradientSourceName(defaultGradient.name ?? "");
    setGradientSourceFrom(defaultGradient.from);
    setGradientSourceTo(defaultGradient.to);
    setGradientSourceMode(defaultGradient.mode);
    setGradientSourceDirection(defaultGradient.direction);
    setGradientSourceViaEnabled(defaultGradient.viaColor !== null);
    setGradientSourceViaColor(defaultGradient.viaColor ?? "#94a3b8");
    setGradientSourceViaPosition(defaultGradient.viaPosition);
    setGradientSourceCenterX(defaultGradient.centerX);
    setGradientSourceCenterY(defaultGradient.centerY);
    setGradientSourceRadialRadius(defaultGradient.radialRadius);
    setGradientSourceRadialInnerRadius(defaultGradient.radialInnerRadius);
    setGradientSourceConicAngle(defaultGradient.conicAngle);
    setGradientSourceConicSpan(defaultGradient.conicSpan);
    setGradientSourceConicRepeat(defaultGradient.conicRepeat);
    setPerlinSourceName(defaultPerlin.name ?? "");
    setPerlinSourceColor(defaultPerlin.color);
    setPerlinSourceScale(defaultPerlin.scale);
    setPerlinSourceDetail(defaultPerlin.detail);
    setPerlinSourceContrast(defaultPerlin.contrast);
    setPerlinSourceDistortion(defaultPerlin.distortion);
    setPerlinSourceSeed(createNoiseSeed());
    setCellularSourceName(defaultCellular.name ?? "");
    setCellularSourceColor(defaultCellular.color);
    setCellularSourceScale(defaultCellular.scale);
    setCellularSourceJitter(defaultCellular.jitter);
    setCellularSourceEdge(defaultCellular.edge);
    setCellularSourceContrast(defaultCellular.contrast);
    setCellularSourceSeed(createNoiseSeed());
    setReactionSourceName(defaultReaction.name ?? "");
    setReactionSourceColor(defaultReaction.color);
    setReactionSourceScale(defaultReaction.scale);
    setReactionSourceDiffusion(defaultReaction.diffusion);
    setReactionSourceBalance(defaultReaction.balance);
    setReactionSourceDistortion(defaultReaction.distortion);
    setReactionSourceSeed(createNoiseSeed());
    setWaveSourceName(defaultWave.name ?? "");
    setWaveSourceColor(defaultWave.color);
    setWaveSourceScale(defaultWave.scale);
    setWaveSourceInterference(defaultWave.interference);
    setWaveSourceDirectionality(defaultWave.directionality);
    setWaveSourceDistortion(defaultWave.distortion);
    setWaveSourceSeed(createNoiseSeed());
  };

  const openAddSourceDialog = (mode: SourceKind = "image") => {
    setEditingSourceId(null);
    setSourceDialogMode(mode);
    resetGeneratedSourceForms();
    setSourceDialogOpen(true);
  };

  const openEditSourceDialog = (assetId: string) => {
    const asset = projectAssets.find(
      (
        entry,
      ): entry is
        | SolidSourceAsset
        | GradientSourceAsset
        | PerlinSourceAsset
        | CellularSourceAsset
        | ReactionSourceAsset
        | WaveSourceAsset => entry.id === assetId && entry.kind !== "image",
    );
    if (!asset) return;

    setEditingSourceId(asset.id);
    setSourceDialogMode(asset.kind);
    if (asset.kind === "solid") {
      setSolidSourceName(asset.name);
      setSolidSourceColor(asset.recipe.color);
    } else if (asset.kind === "gradient") {
      setGradientSourceName(asset.name);
      setGradientSourceFrom(asset.recipe.from);
      setGradientSourceTo(asset.recipe.to);
      setGradientSourceMode(asset.recipe.mode);
      setGradientSourceDirection(asset.recipe.direction);
      setGradientSourceViaEnabled(asset.recipe.viaColor !== null);
      setGradientSourceViaColor(asset.recipe.viaColor ?? "#94a3b8");
      setGradientSourceViaPosition(asset.recipe.viaPosition);
      setGradientSourceCenterX(asset.recipe.centerX);
      setGradientSourceCenterY(asset.recipe.centerY);
      setGradientSourceRadialRadius(asset.recipe.radialRadius);
      setGradientSourceRadialInnerRadius(asset.recipe.radialInnerRadius);
      setGradientSourceConicAngle(asset.recipe.conicAngle);
      setGradientSourceConicSpan(asset.recipe.conicSpan);
      setGradientSourceConicRepeat(asset.recipe.conicRepeat);
    } else if (asset.kind === "perlin") {
      setPerlinSourceName(asset.name);
      setPerlinSourceColor(asset.recipe.color);
      setPerlinSourceScale(asset.recipe.scale);
      setPerlinSourceDetail(asset.recipe.detail);
      setPerlinSourceContrast(asset.recipe.contrast);
      setPerlinSourceDistortion(asset.recipe.distortion);
      setPerlinSourceSeed(asset.recipe.seed);
    } else if (asset.kind === "cellular") {
      setCellularSourceName(asset.name);
      setCellularSourceColor(asset.recipe.color);
      setCellularSourceScale(asset.recipe.scale);
      setCellularSourceJitter(asset.recipe.jitter);
      setCellularSourceEdge(asset.recipe.edge);
      setCellularSourceContrast(asset.recipe.contrast);
      setCellularSourceSeed(asset.recipe.seed);
    } else if (asset.kind === "reaction") {
      setReactionSourceName(asset.name);
      setReactionSourceColor(asset.recipe.color);
      setReactionSourceScale(asset.recipe.scale);
      setReactionSourceDiffusion(asset.recipe.diffusion);
      setReactionSourceBalance(asset.recipe.balance);
      setReactionSourceDistortion(asset.recipe.distortion);
      setReactionSourceSeed(asset.recipe.seed);
    } else {
      setWaveSourceName(asset.name);
      setWaveSourceColor(asset.recipe.color);
      setWaveSourceScale(asset.recipe.scale);
      setWaveSourceInterference(asset.recipe.interference);
      setWaveSourceDirectionality(asset.recipe.directionality);
      setWaveSourceDistortion(asset.recipe.distortion);
      setWaveSourceSeed(asset.recipe.seed);
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

    if (sourceDialogMode === "gradient") {
      const input = normalizeGradientInput({
        name: gradientSourceName,
        mode: gradientSourceMode,
        from: gradientSourceFrom,
        to: gradientSourceTo,
        direction: gradientSourceDirection,
        viaColor: gradientSourceViaEnabled ? gradientSourceViaColor : null,
        viaPosition: gradientSourceViaPosition,
        centerX: gradientSourceCenterX,
        centerY: gradientSourceCenterY,
        radialRadius: gradientSourceRadialRadius,
        radialInnerRadius: gradientSourceRadialInnerRadius,
        conicAngle: gradientSourceConicAngle,
        conicSpan: gradientSourceConicSpan,
        conicRepeat: gradientSourceConicRepeat,
      });
      if (editingSource?.kind === "gradient") {
        await updateGeneratedSource(editingSource.id, input);
      } else {
        await addGradientSource(input);
      }
      setSourceDialogOpen(false);
      return;
    }

    if (sourceDialogMode === "perlin") {
      const input = normalizePerlinInput({
        name: perlinSourceName,
        color: perlinSourceColor,
        scale: perlinSourceScale,
        detail: perlinSourceDetail,
        contrast: perlinSourceContrast,
        distortion: perlinSourceDistortion,
        seed: perlinSourceSeed,
      });
      if (editingSource?.kind === "perlin") {
        await updateGeneratedSource(editingSource.id, input);
      } else {
        await addPerlinSource(input);
      }
      setSourceDialogOpen(false);
      return;
    }

    if (sourceDialogMode === "cellular") {
      const input = normalizeCellularInput({
        name: cellularSourceName,
        color: cellularSourceColor,
        scale: cellularSourceScale,
        jitter: cellularSourceJitter,
        edge: cellularSourceEdge,
        contrast: cellularSourceContrast,
        seed: cellularSourceSeed,
      });
      if (editingSource?.kind === "cellular") {
        await updateGeneratedSource(editingSource.id, input);
      } else {
        await addCellularSource(input);
      }
      setSourceDialogOpen(false);
      return;
    }

    if (sourceDialogMode === "reaction") {
      const input = normalizeReactionInput({
        name: reactionSourceName,
        color: reactionSourceColor,
        scale: reactionSourceScale,
        diffusion: reactionSourceDiffusion,
        balance: reactionSourceBalance,
        distortion: reactionSourceDistortion,
        seed: reactionSourceSeed,
      });
      if (editingSource?.kind === "reaction") {
        await updateGeneratedSource(editingSource.id, input);
      } else {
        await addReactionSource(input);
      }
      setSourceDialogOpen(false);
      return;
    }

    const input = normalizeWaveInput({
      name: waveSourceName,
      color: waveSourceColor,
      scale: waveSourceScale,
      interference: waveSourceInterference,
      directionality: waveSourceDirectionality,
      distortion: waveSourceDistortion,
      seed: waveSourceSeed,
    });
    if (editingSource?.kind === "waves") {
      await updateGeneratedSource(editingSource.id, input);
    } else {
      await addWaveSource(input);
    }
    setSourceDialogOpen(false);
  };

  return (
    <div className="h-dvh overflow-hidden bg-app text-text">
      <Toaster richColors position="top-right" />
      <div className="flex h-full flex-col overflow-hidden">
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
                previewAssets.length === 0 ||
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
              patchProject={patchProject}
            />
            <RightSidebar
              previewExpanded={previewExpanded}
              activeProjectView={activeProjectView}
              patchProject={patchProject}
              inspectorLayerName={inspectorLayerName}
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
              isSymmetryActive={isSymmetryActive}
              isRadialSymmetry={isRadialSymmetry}
              isWeightedAssignment={isWeightedAssignment}
              isPaletteAssignment={isPaletteAssignment}
              isKaleidoscopeActive={isKaleidoscopeActive}
              geometryOptions={geometryOptions}
              geometryValue={geometryValue}
            />
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
        <DialogContent
          className={
            showGeneratedSourcePreview ? "w-[min(92vw,64rem)]" : undefined
          }
        >
          <DialogHeader>
            <DialogTitle>
              {editingSource ? "Edit source" : "Add source"}
            </DialogTitle>
            <DialogDescription>
              Build the source pool from imported images, solid fills, and
              generated gradients and procedural textures.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={sourceDialogMode}
            onValueChange={(value) => setSourceDialogMode(value as SourceKind)}
          >
            <TabsList className="grid w-full grid-cols-7">
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
            <TabsContent value="gradient">
              <div
                data-testid="source-editor-preview-layout"
                className="grid gap-6 md:grid-cols-2 md:items-start"
              >
                <div className="space-y-4">
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
                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <Select
                      value={gradientSourceMode}
                      onValueChange={(value) =>
                        setGradientSourceMode(value as GradientMode)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADIENT_MODES.map((mode) => (
                          <SelectItem key={mode} value={mode}>
                            {formatGradientModeLabel(mode)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <div className="rounded-md border border-border-subtle bg-surface-sunken/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label htmlFor="gradient-source-via-enabled">
                          Midpoint color
                        </Label>
                        <div className="text-xs text-text-muted">
                          Insert an optional third stop into the blend.
                        </div>
                      </div>
                      <Switch
                        id="gradient-source-via-enabled"
                        checked={gradientSourceViaEnabled}
                        onCheckedChange={setGradientSourceViaEnabled}
                        aria-label="Enable midpoint color"
                      />
                    </div>
                  </div>
                  {gradientSourceViaEnabled ? (
                    <>
                      <SourceColorField
                        id="gradient-source-via-color"
                        label="Midpoint color"
                        value={gradientSourceViaColor}
                        onChange={setGradientSourceViaColor}
                      />
                      <SliderField
                        label="Midpoint Position"
                        min={0}
                        max={1}
                        step={0.01}
                        value={gradientSourceViaPosition}
                        formatter={formatPercentValue}
                        onChange={setGradientSourceViaPosition}
                      />
                    </>
                  ) : null}
                  {isLinearGradientMode ? (
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
                  ) : null}
                  {isRadialGradientMode || isConicGradientMode ? (
                    <>
                      <SliderField
                        label="Center X"
                        min={0}
                        max={1}
                        step={0.01}
                        value={gradientSourceCenterX}
                        formatter={formatPercentValue}
                        onChange={setGradientSourceCenterX}
                      />
                      <SliderField
                        label="Center Y"
                        min={0}
                        max={1}
                        step={0.01}
                        value={gradientSourceCenterY}
                        formatter={formatPercentValue}
                        onChange={setGradientSourceCenterY}
                      />
                    </>
                  ) : null}
                  {isRadialGradientMode ? (
                    <>
                      <SliderField
                        label="Outer Radius"
                        min={0}
                        max={1}
                        step={0.01}
                        value={gradientSourceRadialRadius}
                        formatter={formatPercentValue}
                        onChange={setGradientSourceRadialRadius}
                      />
                      <SliderField
                        label="Inner Radius"
                        min={0}
                        max={0.95}
                        step={0.01}
                        value={gradientSourceRadialInnerRadius}
                        formatter={formatPercentValue}
                        onChange={setGradientSourceRadialInnerRadius}
                      />
                    </>
                  ) : null}
                  {isConicGradientMode ? (
                    <>
                      <SliderField
                        label="Angle"
                        min={0}
                        max={360}
                        step={1}
                        value={gradientSourceConicAngle}
                        formatter={formatDegreeValue}
                        onChange={setGradientSourceConicAngle}
                      />
                      <SliderField
                        label="Span"
                        min={1}
                        max={360}
                        step={1}
                        value={gradientSourceConicSpan}
                        formatter={formatDegreeValue}
                        onChange={setGradientSourceConicSpan}
                      />
                      <div className="rounded-md border border-border-subtle bg-surface-sunken/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <Label htmlFor="gradient-source-conic-repeat">
                              Repeat span
                            </Label>
                            <div className="text-xs text-text-muted">
                              Tile the span pattern around the full circle.
                            </div>
                          </div>
                          <Switch
                            id="gradient-source-conic-repeat"
                            checked={gradientSourceConicRepeat}
                            onCheckedChange={setGradientSourceConicRepeat}
                            aria-label="Repeat span"
                          />
                        </div>
                      </div>
                    </>
                  ) : null}
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
                </div>
                <GeneratedSourcePreview
                  source={gradientPreviewSource}
                  canvasSize={activeProject.canvas}
                />
              </div>
            </TabsContent>
            <ProceduralTextureTab
              tabValue="perlin"
              name={perlinSourceName}
              setName={setPerlinSourceName}
              namePlaceholder="Perlin #RRGGBB"
              color={perlinSourceColor}
              setColor={setPerlinSourceColor}
              regenerateSeed={() => setPerlinSourceSeed(createNoiseSeed())}
              fields={[
                {
                  label: "Scale",
                  value: perlinSourceScale,
                  onChange: setPerlinSourceScale,
                },
                {
                  label: "Detail",
                  value: perlinSourceDetail,
                  onChange: setPerlinSourceDetail,
                },
                {
                  label: "Contrast",
                  value: perlinSourceContrast,
                  onChange: setPerlinSourceContrast,
                },
                {
                  label: "Distortion",
                  value: perlinSourceDistortion,
                  onChange: setPerlinSourceDistortion,
                },
              ]}
              previewSource={perlinPreviewSource}
              canvasSize={activeProject.canvas}
              editingSource={editingSource}
              submitGeneratedSource={submitGeneratedSource}
              closeDialog={() => setSourceDialogOpen(false)}
            />
            <ProceduralTextureTab
              tabValue="cellular"
              name={cellularSourceName}
              setName={setCellularSourceName}
              namePlaceholder="Cellular #RRGGBB"
              color={cellularSourceColor}
              setColor={setCellularSourceColor}
              regenerateSeed={() => setCellularSourceSeed(createNoiseSeed())}
              fields={[
                {
                  label: "Scale",
                  value: cellularSourceScale,
                  onChange: setCellularSourceScale,
                },
                {
                  label: "Jitter",
                  value: cellularSourceJitter,
                  onChange: setCellularSourceJitter,
                },
                {
                  label: "Edge",
                  value: cellularSourceEdge,
                  onChange: setCellularSourceEdge,
                },
                {
                  label: "Contrast",
                  value: cellularSourceContrast,
                  onChange: setCellularSourceContrast,
                },
              ]}
              previewSource={cellularPreviewSource}
              canvasSize={activeProject.canvas}
              editingSource={editingSource}
              submitGeneratedSource={submitGeneratedSource}
              closeDialog={() => setSourceDialogOpen(false)}
            />
            <ProceduralTextureTab
              tabValue="reaction"
              name={reactionSourceName}
              setName={setReactionSourceName}
              namePlaceholder="Reaction #RRGGBB"
              color={reactionSourceColor}
              setColor={setReactionSourceColor}
              regenerateSeed={() => setReactionSourceSeed(createNoiseSeed())}
              fields={[
                {
                  label: "Scale",
                  value: reactionSourceScale,
                  onChange: setReactionSourceScale,
                },
                {
                  label: "Diffusion",
                  value: reactionSourceDiffusion,
                  onChange: setReactionSourceDiffusion,
                },
                {
                  label: "Balance",
                  value: reactionSourceBalance,
                  onChange: setReactionSourceBalance,
                },
                {
                  label: "Distortion",
                  value: reactionSourceDistortion,
                  onChange: setReactionSourceDistortion,
                },
              ]}
              previewSource={reactionPreviewSource}
              canvasSize={activeProject.canvas}
              editingSource={editingSource}
              submitGeneratedSource={submitGeneratedSource}
              closeDialog={() => setSourceDialogOpen(false)}
            />
            <ProceduralTextureTab
              tabValue="waves"
              name={waveSourceName}
              setName={setWaveSourceName}
              namePlaceholder="Waves #RRGGBB"
              color={waveSourceColor}
              setColor={setWaveSourceColor}
              regenerateSeed={() => setWaveSourceSeed(createNoiseSeed())}
              fields={[
                {
                  label: "Scale",
                  value: waveSourceScale,
                  onChange: setWaveSourceScale,
                },
                {
                  label: "Interference",
                  value: waveSourceInterference,
                  onChange: setWaveSourceInterference,
                },
                {
                  label: "Directionality",
                  value: waveSourceDirectionality,
                  onChange: setWaveSourceDirectionality,
                },
                {
                  label: "Distortion",
                  value: waveSourceDistortion,
                  onChange: setWaveSourceDistortion,
                },
              ]}
              previewSource={wavePreviewSource}
              canvasSize={activeProject.canvas}
              editingSource={editingSource}
              submitGeneratedSource={submitGeneratedSource}
              closeDialog={() => setSourceDialogOpen(false)}
            />
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
