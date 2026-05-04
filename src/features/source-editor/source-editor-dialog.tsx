import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";

import { SourceColorField } from "@/components/app/source-color-field";
import {
  GeneratedSourcePreview,
  ProceduralTextureTab,
  SliderField,
} from "@/components/app/procedural-texture-tab";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type GeneratedSourceInput,
  getDefaultGradientInput,
  getDefaultGradientDirection,
  getDefaultCellularInput,
  getDefaultPerlinInput,
  getDefaultReactionInput,
  getDefaultWaveInput,
  getSourceKindLabel,
  normalizeCellularInput,
  normalizeGradientInput,
  normalizePerlinInput,
  normalizeReactionInput,
  normalizeSolidInput,
  normalizeWaveInput,
} from "@/lib/assets";
import {
  createNoiseSeed,
  formatDegreeValue,
  formatGradientDirectionLabel,
  formatGradientModeLabel,
  formatPercentValue,
  formatSourceModeLabel,
} from "@/lib/format-utils";
import { waitForNextPaint } from "@/lib/utils";
import type {
  GradientDirection,
  GradientMode,
  ProjectDocument,
  SourceAsset,
  SourceKind,
} from "@/types/project";

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
const GRADIENT_MODES: GradientMode[] = ["linear", "radial", "conic"];
const GRADIENT_DIRECTIONS: GradientDirection[] = [
  "horizontal",
  "vertical",
  "diagonal-down",
  "diagonal-up",
];

function isSourceKind(value: string): value is SourceKind {
  return SOURCE_DIALOG_MODES.some((mode) => mode === value);
}

function isGradientMode(value: string): value is GradientMode {
  return GRADIENT_MODES.some((mode) => mode === value);
}

function isGradientDirection(value: string): value is GradientDirection {
  return GRADIENT_DIRECTIONS.some((direction) => direction === value);
}

interface SourceEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectAssets: SourceAsset[];
  canvasSize: Pick<ProjectDocument["canvas"], "width" | "height">;
  editingSourceId: string | null;
  initialMode: SourceKind;
  uploadInputRef: React.RefObject<HTMLInputElement | null>;
  onSubmitSolid: (input: ReturnType<typeof normalizeSolidInput>) => Promise<void>;
  onSubmitGradient: (input: ReturnType<typeof normalizeGradientInput>) => Promise<void>;
  onSubmitPerlin: (input: ReturnType<typeof normalizePerlinInput>) => Promise<void>;
  onSubmitCellular: (input: ReturnType<typeof normalizeCellularInput>) => Promise<void>;
  onSubmitReaction: (input: ReturnType<typeof normalizeReactionInput>) => Promise<void>;
  onSubmitWave: (input: ReturnType<typeof normalizeWaveInput>) => Promise<void>;
  onUpdateGenerated: (
    assetId: string,
    input:
      | ReturnType<typeof normalizeSolidInput>
      | ReturnType<typeof normalizeGradientInput>
      | ReturnType<typeof normalizePerlinInput>
      | ReturnType<typeof normalizeCellularInput>
      | ReturnType<typeof normalizeReactionInput>
      | ReturnType<typeof normalizeWaveInput>,
  ) => Promise<void>;
  busy: boolean;
  status: string;
}

export function SourceEditorDialog({
  open,
  onOpenChange,
  projectAssets,
  canvasSize,
  editingSourceId,
  initialMode,
  uploadInputRef,
  onSubmitSolid,
  onSubmitGradient,
  onSubmitPerlin,
  onSubmitCellular,
  onSubmitReaction,
  onSubmitWave,
  onUpdateGenerated,
  busy,
  status,
}: SourceEditorDialogProps) {
  const editingSource = editingSourceId
    ? (projectAssets.find((asset) => asset.id === editingSourceId) ?? null)
    : null;

  const [sourceDialogMode, setSourceDialogMode] = useState<SourceKind>(initialMode);

  // Solid state
  const [solidSourceName, setSolidSourceName] = useState("");
  const [solidSourceColor, setSolidSourceColor] = useState("#0f172a");

  // Gradient state
  const [gradientSourceName, setGradientSourceName] = useState("");
  const [gradientSourceFrom, setGradientSourceFrom] = useState("#0f172a");
  const [gradientSourceTo, setGradientSourceTo] = useState("#f97316");
  const [gradientSourceMode, setGradientSourceMode] = useState<GradientMode>("linear");
  const [gradientSourceDirection, setGradientSourceDirection] =
    useState<GradientDirection>(getDefaultGradientDirection());
  const [gradientSourceViaEnabled, setGradientSourceViaEnabled] = useState(false);
  const [gradientSourceViaColor, setGradientSourceViaColor] = useState("#94a3b8");
  const [gradientSourceViaPosition, setGradientSourceViaPosition] = useState(0.5);
  const [gradientSourceCenterX, setGradientSourceCenterX] = useState(0.5);
  const [gradientSourceCenterY, setGradientSourceCenterY] = useState(0.5);
  const [gradientSourceRadialRadius, setGradientSourceRadialRadius] = useState(1);
  const [gradientSourceRadialInnerRadius, setGradientSourceRadialInnerRadius] = useState(0);
  const [gradientSourceConicAngle, setGradientSourceConicAngle] = useState(0);
  const [gradientSourceConicSpan, setGradientSourceConicSpan] = useState(360);
  const [gradientSourceConicRepeat, setGradientSourceConicRepeat] = useState(false);

  // Perlin state
  const [perlinSourceName, setPerlinSourceName] = useState("");
  const [perlinSourceColor, setPerlinSourceColor] = useState("#0f766e");
  const [perlinSourceScale, setPerlinSourceScale] = useState(0.55);
  const [perlinSourceDetail, setPerlinSourceDetail] = useState(0.55);
  const [perlinSourceContrast, setPerlinSourceContrast] = useState(0.45);
  const [perlinSourceDistortion, setPerlinSourceDistortion] = useState(0.25);
  const [perlinSourceSeed, setPerlinSourceSeed] = useState(() => createNoiseSeed());

  // Cellular state
  const [cellularSourceName, setCellularSourceName] = useState("");
  const [cellularSourceColor, setCellularSourceColor] = useState("#8b5cf6");
  const [cellularSourceScale, setCellularSourceScale] = useState(0.55);
  const [cellularSourceJitter, setCellularSourceJitter] = useState(0.6);
  const [cellularSourceEdge, setCellularSourceEdge] = useState(0.55);
  const [cellularSourceContrast, setCellularSourceContrast] = useState(0.45);
  const [cellularSourceSeed, setCellularSourceSeed] = useState(() => createNoiseSeed());

  // Reaction state
  const [reactionSourceName, setReactionSourceName] = useState("");
  const [reactionSourceColor, setReactionSourceColor] = useState("#ef4444");
  const [reactionSourceScale, setReactionSourceScale] = useState(0.55);
  const [reactionSourceDiffusion, setReactionSourceDiffusion] = useState(0.55);
  const [reactionSourceBalance, setReactionSourceBalance] = useState(0.5);
  const [reactionSourceDistortion, setReactionSourceDistortion] = useState(0.2);
  const [reactionSourceSeed, setReactionSourceSeed] = useState(() => createNoiseSeed());

  // Wave state
  const [waveSourceName, setWaveSourceName] = useState("");
  const [waveSourceColor, setWaveSourceColor] = useState("#0ea5e9");
  const [waveSourceScale, setWaveSourceScale] = useState(0.55);
  const [waveSourceInterference, setWaveSourceInterference] = useState(0.65);
  const [waveSourceDirectionality, setWaveSourceDirectionality] = useState(0.6);
  const [waveSourceDistortion, setWaveSourceDistortion] = useState(0.2);
  const [waveSourceSeed, setWaveSourceSeed] = useState(() => createNoiseSeed());
  const [isSubmittingGenerated, setIsSubmittingGenerated] = useState(false);

  const isLinearGradientMode = gradientSourceMode === "linear";
  const isRadialGradientMode = gradientSourceMode === "radial";
  const isConicGradientMode = gradientSourceMode === "conic";
  const showGeneratedSourcePreview =
    sourceDialogMode === "gradient" ||
    PROCEDURAL_SOURCE_KINDS.includes(sourceDialogMode);
  const generatedSourceLabel = getSourceKindLabel(
    sourceDialogMode === "image" ? "gradient" : sourceDialogMode,
  ).toLowerCase();
  const pendingMessage = isSubmittingGenerated
    ? busy && status.trim().length > 0
      ? status
      : `${editingSource ? "Updating" : "Creating"} ${generatedSourceLabel} source…`
    : null;
  const defaultGradient = getDefaultGradientInput();
  const defaultPerlin = getDefaultPerlinInput();
  const defaultCellular = getDefaultCellularInput();
  const defaultReaction = getDefaultReactionInput();
  const defaultWave = getDefaultWaveInput();

  const resetForms = () => {
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
    setIsSubmittingGenerated(false);
  };

  const loadEditingSource = (asset: SourceAsset) => {
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
    } else if (asset.kind === "waves") {
      setWaveSourceName(asset.name);
      setWaveSourceColor(asset.recipe.color);
      setWaveSourceScale(asset.recipe.scale);
      setWaveSourceInterference(asset.recipe.interference);
      setWaveSourceDirectionality(asset.recipe.directionality);
      setWaveSourceDistortion(asset.recipe.distortion);
      setWaveSourceSeed(asset.recipe.seed);
    }
  };

  const openImagePicker = () => {
    onOpenChange(false);
    uploadInputRef.current?.click();
  };

  const submitWithPendingState = async (task: () => Promise<void>) => {
    if (isSubmittingGenerated) return;

    setIsSubmittingGenerated(true);
    await waitForNextPaint();

    try {
      await task();
      onOpenChange(false);
    } finally {
      setIsSubmittingGenerated(false);
    }
  };

  const submitGeneratedSource = async () => {
    if (isSubmittingGenerated) return;

    if (sourceDialogMode === "image") {
      openImagePicker();
      return;
    }

    if (sourceDialogMode === "solid") {
      const input = normalizeSolidInput({ name: solidSourceName, color: solidSourceColor });
      await submitWithPendingState(async () => {
        if (editingSource?.kind === "solid") {
          await onUpdateGenerated(editingSource.id, input);
        } else {
          await onSubmitSolid(input);
        }
      });
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
      await submitWithPendingState(async () => {
        if (editingSource?.kind === "gradient") {
          await onUpdateGenerated(editingSource.id, input);
        } else {
          await onSubmitGradient(input);
        }
      });
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
      await submitWithPendingState(async () => {
        if (editingSource?.kind === "perlin") {
          await onUpdateGenerated(editingSource.id, input);
        } else {
          await onSubmitPerlin(input);
        }
      });
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
      await submitWithPendingState(async () => {
        if (editingSource?.kind === "cellular") {
          await onUpdateGenerated(editingSource.id, input);
        } else {
          await onSubmitCellular(input);
        }
      });
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
      await submitWithPendingState(async () => {
        if (editingSource?.kind === "reaction") {
          await onUpdateGenerated(editingSource.id, input);
        } else {
          await onSubmitReaction(input);
        }
      });
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
    await submitWithPendingState(async () => {
      if (editingSource?.kind === "waves") {
        await onUpdateGenerated(editingSource.id, input);
      } else {
        await onSubmitWave(input);
      }
    });
  };

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

  const closeDialog = () => {
    if (isSubmittingGenerated) return;
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;
    if (editingSource) {
      loadEditingSource(editingSource);
      return;
    }
    setSourceDialogMode(initialMode);
    resetForms();
  }, [editingSource, initialMode, open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isSubmittingGenerated && !nextOpen) return;
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setIsSubmittingGenerated(false);
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
          onValueChange={(value) => {
            if (!isSourceKind(value)) return;
            setSourceDialogMode(value);
          }}
        >
          <TabsList className="grid w-full grid-cols-7">
            {SOURCE_DIALOG_MODES.map((mode) => (
              <TabsTrigger
                key={mode}
                value={mode}
                disabled={
                  isSubmittingGenerated ||
                  (Boolean(editingSource) && editingSource?.kind !== mode)
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
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button onClick={openImagePicker}>
                <ImagePlus className="h-3.5 w-3.5" />
                Choose images
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="solid" className="space-y-4">
            <fieldset className="min-w-0 space-y-4 border-0 p-0" disabled={isSubmittingGenerated}>
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
              {pendingMessage ? (
                <div
                  className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-100"
                  role="status"
                  aria-live="polite"
                  data-testid="source-editor-submit-pending"
                >
                  {pendingMessage} This can take a few seconds on larger canvases.
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeDialog} disabled={isSubmittingGenerated}>
                  Cancel
                </Button>
                <Button onClick={() => void submitGeneratedSource()} disabled={isSubmittingGenerated}>
                  {editingSource ? "Save source" : "Add source"}
                </Button>
              </div>
            </fieldset>
          </TabsContent>
          <TabsContent value="gradient">
            <div
              data-testid="source-editor-preview-layout"
              className="grid gap-6 md:grid-cols-2 md:items-start"
            >
              <fieldset className="min-w-0 space-y-4 border-0 p-0" disabled={isSubmittingGenerated}>
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
                    disabled={isSubmittingGenerated}
                    value={gradientSourceMode}
                    onValueChange={(value) => {
                      if (!isGradientMode(value)) return;
                      setGradientSourceMode(value);
                    }}
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
                      disabled={isSubmittingGenerated}
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
                      defaultValue={defaultGradient.viaPosition}
                      disabled={isSubmittingGenerated}
                      formatter={formatPercentValue}
                      onChange={setGradientSourceViaPosition}
                    />
                  </>
                ) : null}
                {isLinearGradientMode ? (
                  <div className="space-y-2">
                    <Label>Direction</Label>
                    <Select
                      disabled={isSubmittingGenerated}
                      value={gradientSourceDirection}
                      onValueChange={(value) => {
                        if (!isGradientDirection(value)) return;
                        setGradientSourceDirection(value);
                      }}
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
                      defaultValue={defaultGradient.centerX}
                      disabled={isSubmittingGenerated}
                      formatter={formatPercentValue}
                      onChange={setGradientSourceCenterX}
                    />
                    <SliderField
                      label="Center Y"
                      min={0}
                      max={1}
                      step={0.01}
                      value={gradientSourceCenterY}
                      defaultValue={defaultGradient.centerY}
                      disabled={isSubmittingGenerated}
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
                      defaultValue={defaultGradient.radialRadius}
                      disabled={isSubmittingGenerated}
                      formatter={formatPercentValue}
                      onChange={setGradientSourceRadialRadius}
                    />
                    <SliderField
                      label="Inner Radius"
                      min={0}
                      max={0.95}
                      step={0.01}
                      value={gradientSourceRadialInnerRadius}
                      defaultValue={defaultGradient.radialInnerRadius}
                      disabled={isSubmittingGenerated}
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
                      defaultValue={defaultGradient.conicAngle}
                      disabled={isSubmittingGenerated}
                      formatter={formatDegreeValue}
                      onChange={setGradientSourceConicAngle}
                    />
                    <SliderField
                      label="Span"
                      min={1}
                      max={360}
                      step={1}
                      value={gradientSourceConicSpan}
                      defaultValue={defaultGradient.conicSpan}
                      disabled={isSubmittingGenerated}
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
                          disabled={isSubmittingGenerated}
                          onCheckedChange={setGradientSourceConicRepeat}
                          aria-label="Repeat span"
                        />
                      </div>
                    </div>
                  </>
                ) : null}
                {pendingMessage ? (
                  <div
                    className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-100"
                    role="status"
                    aria-live="polite"
                    data-testid="source-editor-submit-pending"
                  >
                    {pendingMessage} This can take a few seconds on larger canvases.
                  </div>
                ) : null}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeDialog} disabled={isSubmittingGenerated}>
                    Cancel
                  </Button>
                  <Button onClick={() => void submitGeneratedSource()} disabled={isSubmittingGenerated}>
                    {editingSource ? "Save source" : "Add source"}
                  </Button>
                </div>
              </fieldset>
              <GeneratedSourcePreview
                source={gradientPreviewSource}
                canvasSize={canvasSize}
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
                defaultValue: defaultPerlin.scale,
                onChange: setPerlinSourceScale,
              },
              {
                label: "Detail",
                value: perlinSourceDetail,
                defaultValue: defaultPerlin.detail,
                onChange: setPerlinSourceDetail,
              },
              {
                label: "Contrast",
                value: perlinSourceContrast,
                defaultValue: defaultPerlin.contrast,
                onChange: setPerlinSourceContrast,
              },
              {
                label: "Distortion",
                value: perlinSourceDistortion,
                defaultValue: defaultPerlin.distortion,
                onChange: setPerlinSourceDistortion,
              },
            ]}
            previewSource={perlinPreviewSource}
            canvasSize={canvasSize}
            editingSource={editingSource}
            submitGeneratedSource={submitGeneratedSource}
            closeDialog={closeDialog}
            submitDisabled={isSubmittingGenerated}
            pendingMessage={sourceDialogMode === "perlin" ? pendingMessage : null}
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
                defaultValue: defaultCellular.scale,
                onChange: setCellularSourceScale,
              },
              {
                label: "Jitter",
                value: cellularSourceJitter,
                defaultValue: defaultCellular.jitter,
                onChange: setCellularSourceJitter,
              },
              {
                label: "Edge",
                value: cellularSourceEdge,
                defaultValue: defaultCellular.edge,
                onChange: setCellularSourceEdge,
              },
              {
                label: "Contrast",
                value: cellularSourceContrast,
                defaultValue: defaultCellular.contrast,
                onChange: setCellularSourceContrast,
              },
            ]}
            previewSource={cellularPreviewSource}
            canvasSize={canvasSize}
            editingSource={editingSource}
            submitGeneratedSource={submitGeneratedSource}
            closeDialog={closeDialog}
            submitDisabled={isSubmittingGenerated}
            pendingMessage={sourceDialogMode === "cellular" ? pendingMessage : null}
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
                defaultValue: defaultReaction.scale,
                onChange: setReactionSourceScale,
              },
              {
                label: "Diffusion",
                value: reactionSourceDiffusion,
                defaultValue: defaultReaction.diffusion,
                onChange: setReactionSourceDiffusion,
              },
              {
                label: "Balance",
                value: reactionSourceBalance,
                defaultValue: defaultReaction.balance,
                onChange: setReactionSourceBalance,
              },
              {
                label: "Distortion",
                value: reactionSourceDistortion,
                defaultValue: defaultReaction.distortion,
                onChange: setReactionSourceDistortion,
              },
            ]}
            previewSource={reactionPreviewSource}
            canvasSize={canvasSize}
            editingSource={editingSource}
            submitGeneratedSource={submitGeneratedSource}
            closeDialog={closeDialog}
            submitDisabled={isSubmittingGenerated}
            pendingMessage={sourceDialogMode === "reaction" ? pendingMessage : null}
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
                defaultValue: defaultWave.scale,
                onChange: setWaveSourceScale,
              },
              {
                label: "Interference",
                value: waveSourceInterference,
                defaultValue: defaultWave.interference,
                onChange: setWaveSourceInterference,
              },
              {
                label: "Directionality",
                value: waveSourceDirectionality,
                defaultValue: defaultWave.directionality,
                onChange: setWaveSourceDirectionality,
              },
              {
                label: "Distortion",
                value: waveSourceDistortion,
                defaultValue: defaultWave.distortion,
                onChange: setWaveSourceDistortion,
              },
            ]}
            previewSource={wavePreviewSource}
            canvasSize={canvasSize}
            editingSource={editingSource}
            submitGeneratedSource={submitGeneratedSource}
            closeDialog={closeDialog}
            submitDisabled={isSubmittingGenerated}
            pendingMessage={sourceDialogMode === "waves" ? pendingMessage : null}
          />
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/** Open the dialog in "add" mode, resetting forms. */
export function useSourceEditorControls() {
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [sourceDialogMode, setSourceDialogMode] = useState<SourceKind>("image");
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);

  const openAddSourceDialog = (mode: SourceKind = "image") => {
    setEditingSourceId(null);
    setSourceDialogMode(mode);
    setSourceDialogOpen(true);
  };

  const openEditSourceDialog = (assetId: string) => {
    setEditingSourceId(assetId);
    setSourceDialogOpen(true);
  };

  return {
    sourceDialogOpen,
    setSourceDialogOpen,
    sourceDialogMode,
    editingSourceId,
    setEditingSourceId,
    openAddSourceDialog,
    openEditSourceDialog,
  };
}
