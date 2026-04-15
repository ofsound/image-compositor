import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-24 w-full rounded-md border border-input-border bg-input px-3 py-2 text-sm text-text outline-none transition-colors focus:border-border-focus placeholder:text-input-placeholder",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
