import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeHexColor } from "@/lib/color";
import { cn } from "@/lib/utils";

export function SourceColorField({
  id,
  label,
  value,
  onChange,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="color"
          value={value}
          className="h-9 w-14 cursor-pointer p-1"
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          value={value}
          className="font-mono uppercase"
          onChange={(event) =>
            onChange(normalizeHexColor(event.target.value, value))
          }
        />
      </div>
    </div>
  );
}
