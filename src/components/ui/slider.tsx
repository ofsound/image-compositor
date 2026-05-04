import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

const FINE_ADJUSTMENT_SCALE = 10;

type SliderProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

interface DragSession {
  initialValue: number;
  lastValue: number;
  anchorValue: number;
  anchorPointerValue: number;
  pointerId: number;
  fineAdjustmentActive: boolean;
}

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(
  (
    {
      className,
      defaultValue,
      dir,
      disabled,
      inverted = false,
      max = 100,
      min = 0,
      onDoubleClick,
      onPointerCancel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onValueChange,
      onValueCommit,
      orientation = "horizontal",
      step = 1,
      value,
      ...props
    },
    ref,
  ) => {
    const isControlled = value !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = React.useState<number[]>(
      defaultValue ?? [min],
    );
    const rootRef = React.useRef<React.ElementRef<typeof SliderPrimitive.Root> | null>(
      null,
    );
    const dragSessionRef = React.useRef<DragSession | null>(null);
    const resolvedValue = isControlled ? value : uncontrolledValue;

    const setRootRef = React.useCallback(
      (node: React.ElementRef<typeof SliderPrimitive.Root> | null) => {
        rootRef.current = node;
        if (typeof ref === "function") {
          ref(node);
          return;
        }
        if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    const emitValueChange = React.useCallback(
      (nextValue: number) => {
        const nextValues = [nextValue];
        if (!isControlled) {
          setUncontrolledValue(nextValues);
        }
        onValueChange?.(nextValues);
      },
      [isControlled, onValueChange],
    );

    const focusThumb = React.useCallback(() => {
      const thumb = rootRef.current?.querySelector<HTMLElement>('[role="slider"]');
      thumb?.focus();
    }, []);

    const getValueFromPointer = React.useCallback(
      (event: PointerEvent | React.PointerEvent) => {
        const root = rootRef.current;
        if (!root) {
          return min;
        }

        const rect = root.getBoundingClientRect();
        const documentDirection =
          dir || root.ownerDocument?.documentElement.dir || "ltr";

        if (orientation === "vertical") {
          const height = rect.height || 1;
          const offset = clamp((event.clientY - rect.top) / height, 0, 1);
          const outputStart = inverted ? min : max;
          const outputEnd = inverted ? max : min;

          return outputStart + (outputEnd - outputStart) * offset;
        }

        const width = rect.width || 1;
        const offset = clamp((event.clientX - rect.left) / width, 0, 1);
        const isSlidingFromLeft =
          (documentDirection === "ltr" && !inverted) ||
          (documentDirection === "rtl" && inverted);
        const outputStart = isSlidingFromLeft ? min : max;
        const outputEnd = isSlidingFromLeft ? max : min;

        return outputStart + (outputEnd - outputStart) * offset;
      },
      [dir, inverted, max, min, orientation],
    );

    const updateDragValue = React.useCallback(
      (event: PointerEvent | React.PointerEvent) => {
        const session = dragSessionRef.current;
        if (!session || event.pointerId !== session.pointerId) {
          return;
        }

        const pointerValue = getValueFromPointer(event);
        if (event.shiftKey !== session.fineAdjustmentActive) {
          session.fineAdjustmentActive = event.shiftKey;
          session.anchorPointerValue = pointerValue;
          session.anchorValue = session.lastValue;
          return;
        }

        const pointerDelta = pointerValue - session.anchorPointerValue;
        const scaledDelta = session.fineAdjustmentActive
          ? pointerDelta / FINE_ADJUSTMENT_SCALE
          : pointerDelta;
        const nextValue = normalizeSliderValue({
          value: session.anchorValue + scaledDelta,
          min,
          max,
          step,
        });

        if (nextValue === session.lastValue) {
          return;
        }

        session.lastValue = nextValue;
        emitValueChange(nextValue);
      },
      [emitValueChange, getValueFromPointer, max, min, step],
    );

    const finishDrag = React.useCallback(
      (event: React.PointerEvent) => {
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== event.pointerId) {
          return;
        }

        event.currentTarget.releasePointerCapture?.(event.pointerId);
        dragSessionRef.current = null;

        if (session.lastValue !== session.initialValue) {
          onValueCommit?.([session.lastValue]);
        }
      },
      [onValueCommit],
    );

    const handlePointerDown: NonNullable<SliderProps["onPointerDown"]> =
      React.useCallback((event) => {
        onPointerDown?.(event);
        if (event.defaultPrevented || disabled || event.button !== 0) {
          return;
        }

        event.preventDefault();

        const currentValue = resolvedValue?.[0] ?? min;
        const pointerValue = getValueFromPointer(event);
        const startedOnThumb = Boolean(
          (event.target as HTMLElement).closest('[role="slider"]'),
        );

        let nextValue = currentValue;
        if (!startedOnThumb) {
          nextValue = normalizeSliderValue({
            value: pointerValue,
            min,
            max,
            step,
          });

          if (nextValue !== currentValue) {
            emitValueChange(nextValue);
          }
        }

        focusThumb();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        dragSessionRef.current = {
          initialValue: currentValue,
          lastValue: nextValue,
          anchorValue: nextValue,
          anchorPointerValue: pointerValue,
          pointerId: event.pointerId,
          fineAdjustmentActive: event.shiftKey,
        };
      }, [
        disabled,
        emitValueChange,
        focusThumb,
        getValueFromPointer,
        max,
        min,
        onPointerDown,
        resolvedValue,
        step,
      ]);

    const handlePointerMove: NonNullable<SliderProps["onPointerMove"]> =
      React.useCallback((event) => {
        onPointerMove?.(event);
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== event.pointerId) {
          return;
        }

        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();
        updateDragValue(event);
      }, [onPointerMove, updateDragValue]);

    const handlePointerUp: NonNullable<SliderProps["onPointerUp"]> =
      React.useCallback((event) => {
        onPointerUp?.(event);
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== event.pointerId) {
          return;
        }

        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();
        finishDrag(event);
      }, [finishDrag, onPointerUp]);

    const handlePointerCancel: NonNullable<SliderProps["onPointerCancel"]> =
      React.useCallback((event) => {
        onPointerCancel?.(event);
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== event.pointerId) {
          return;
        }

        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();
        finishDrag(event);
      }, [finishDrag, onPointerCancel]);

    const handleValueChange = React.useCallback(
      (nextValues: number[]) => {
        if (dragSessionRef.current) {
          return;
        }

        if (!isControlled) {
          setUncontrolledValue(nextValues);
        }
        onValueChange?.(nextValues);
      },
      [isControlled, onValueChange],
    );

    const handleDoubleClick: NonNullable<SliderProps["onDoubleClick"]> =
      React.useCallback((event) => {
        onDoubleClick?.(event);
        if (event.defaultPrevented || disabled) {
          return;
        }

        const resetValue = defaultValue?.[0];
        if (resetValue === undefined) {
          return;
        }

        const currentValue = resolvedValue?.[0] ?? min;
        const nextValue = normalizeSliderValue({
          value: resetValue,
          min,
          max,
          step,
        });

        if (nextValue === currentValue) {
          return;
        }

        dragSessionRef.current = null;
        emitValueChange(nextValue);
        onValueCommit?.([nextValue]);
        focusThumb();
      }, [
        defaultValue,
        disabled,
        emitValueChange,
        focusThumb,
        max,
        min,
        onDoubleClick,
        onValueCommit,
        resolvedValue,
        step,
      ]);

    return (
      <SliderPrimitive.Root
        ref={setRootRef}
        disabled={disabled}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          disabled && "cursor-not-allowed opacity-55",
          className,
        )}
        dir={dir}
        inverted={inverted}
        max={max}
        min={min}
        onDoubleClick={handleDoubleClick}
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onValueChange={handleValueChange}
        onValueCommit={onValueCommit}
        orientation={orientation}
        step={step}
        value={resolvedValue}
        {...props}
      >
        <SliderPrimitive.Track
          className={cn(
            "relative h-1 w-full overflow-hidden rounded-full bg-slider-track",
            disabled && "bg-surface-muted",
          )}
        >
          <SliderPrimitive.Range
            className={cn(
              "absolute h-full bg-slider-range",
              disabled && "bg-text-faint",
            )}
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "block h-3.5 w-3.5 rounded-full border border-slider-thumb-border bg-slider-thumb shadow-control transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-focus",
            disabled
              ? "border-text-faint bg-surface-muted"
              : "hover:opacity-90",
          )}
        />
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = SliderPrimitive.Root.displayName;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeSliderValue({
  value,
  min,
  max,
  step,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
}) {
  const decimalCount = getDecimalCount(step);
  const snappedValue =
    Math.round((value - min) / step) * step + min;

  return clamp(roundValue(snappedValue, decimalCount), min, max);
}

function getDecimalCount(value: number) {
  return (String(value).split(".")[1] || "").length;
}

function roundValue(value: number, decimalCount: number) {
  const rounder = Math.pow(10, decimalCount);
  return Math.round(value * rounder) / rounder;
}
