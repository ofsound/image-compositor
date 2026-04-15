import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { EditableSliderValue } from "@/components/app/editable-slider-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TabsContent } from "@/components/ui/tabs";
import { renderGeneratedSourceToCanvas, type GeneratedSourceInput } from "@/lib/assets";
import {
  formatPercentValue,
  normalizeSliderInputValue,
  parseFormattedSliderInputValue,
} from "@/lib/format-utils";
import { cn } from "@/lib/utils";
import type { ProjectDocument, SourceAsset, SourceKind } from "@/types/project";
import { SourceColorField } from "./source-color-field";

const GENERATED_SOURCE_PREVIEW_MAX_DIMENSION = 640;

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
  value?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {value ? value : null}
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
  parseInput,
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
  parseInput?: (value: string) => number | null;
}) {
  const [draftValue, setDraftValue] = useState<number | null>(null);
  const lastEmittedValueRef = useRef<number | null>(null);

  useEffect(() => {
    setDraftValue(null);
    lastEmittedValueRef.current = value;
  }, [value]);

  const displayValue = draftValue ?? value;
  const displayLabel = formatter(displayValue);
  const sliderInputParser = parseInput ?? parseFormattedSliderInputValue;
  const canEditValue = !disabled && sliderInputParser(displayLabel) !== null;

  const commitValueText = (nextText: string) => {
    const parsedValue = sliderInputParser(nextText);
    if (parsedValue === null) {
      return;
    }

    const normalizedValue = normalizeSliderInputValue({
      value: parsedValue,
      min,
      max,
      step,
    });

    setDraftValue(normalizedValue);
    if (lastEmittedValueRef.current === normalizedValue) {
      return;
    }

    lastEmittedValueRef.current = normalizedValue;
    onChange(normalizedValue);
  };

  return (
    <ControlBlock
      label={label}
      value={
        <EditableSliderValue
          value={displayLabel}
          inputLabel={`${label} value`}
          disabled={!canEditValue}
          onCommit={canEditValue ? commitValueText : undefined}
        />
      }
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
  submitDisabled = false,
  pendingMessage = null,
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
  submitDisabled?: boolean;
  pendingMessage?: string | null;
}) {
  return (
    <TabsContent value={tabValue}>
      <div
        data-testid="source-editor-preview-layout"
        className="grid gap-6 md:grid-cols-2 md:items-start"
      >
        <fieldset className="min-w-0 space-y-4 border-0 p-0" disabled={submitDisabled}>
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
                disabled={submitDisabled}
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
              disabled={submitDisabled}
              formatter={formatPercentValue}
              onChange={field.onChange}
            />
          ))}
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
            <Button variant="outline" onClick={closeDialog} disabled={submitDisabled}>
              Cancel
            </Button>
            <Button onClick={() => void submitGeneratedSource()} disabled={submitDisabled}>
              {editingSource ? "Save source" : "Add source"}
            </Button>
          </div>
        </fieldset>
        <GeneratedSourcePreview
          source={previewSource}
          canvasSize={canvasSize}
        />
      </div>
    </TabsContent>
  );
}
