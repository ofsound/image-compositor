import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, disabled, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    disabled={disabled}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      disabled && "cursor-not-allowed opacity-55",
      className,
    )}
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
));
Slider.displayName = SliderPrimitive.Root.displayName;
