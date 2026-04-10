import { cn } from "@/lib/utils";

export function InspectorGroup({
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

export function InspectorFieldGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-3", className)}>{children}</div>;
}
