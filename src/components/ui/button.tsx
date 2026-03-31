import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-30 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-control-primary px-4 py-2 text-control-primary-text shadow-control hover:bg-control-primary-hover active:opacity-90",
        secondary:
          "bg-control-secondary px-4 py-2 text-control-secondary-text border border-control-secondary-border hover:bg-control-secondary-hover active:opacity-90",
        ghost: "px-3 py-2 text-text-muted hover:bg-control-ghost-hover hover:text-text",
        outline:
          "border border-border bg-transparent px-4 py-2 text-text-secondary hover:border-border-strong hover:text-text hover:bg-control-ghost-hover",
      },
      size: {
        default: "h-9",
        sm: "h-8 px-3 text-xs",
        icon: "h-9 w-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
