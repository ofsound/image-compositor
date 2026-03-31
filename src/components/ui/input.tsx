import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-input-border bg-input px-3 py-2 text-sm text-text outline-none transition-colors focus:border-border-focus placeholder:text-input-placeholder",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
