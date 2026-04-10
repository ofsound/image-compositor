import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PanelShell({
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
