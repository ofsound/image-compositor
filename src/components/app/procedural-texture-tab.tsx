import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TabsContent } from "@/components/ui/tabs";
import { renderGeneratedSourceToCanvas, type GeneratedSourceInput } from "@/lib/assets";
import { cn } from "@/lib/utils";
import type { ProjectDocument, SourceAsset, SourceKind } from "@/types/project";
import { SourceColorField } from "./source-color-field";

const GENERATED_SOURCE_PREVIEW_MAX_DIMENSION = 640;

export function formatPercentValue(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function GeneratedSourcePreview({
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

export function ControlBlock({
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

export function SliderField({
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

export interface ProceduralTextureField {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

export function ProceduralTextureTab({
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
