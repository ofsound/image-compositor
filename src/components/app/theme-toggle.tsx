import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/components/app/theme-provider";

const OPTIONS = [
  { value: "light" as const, icon: Sun, label: "Light" },
  { value: "dark" as const, icon: Moon, label: "Dark" },
  { value: "system" as const, icon: Monitor, label: "System" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center rounded-md border border-border bg-surface-muted p-0.5">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`rounded-[5px] p-1.5 transition-all ${
            theme === value
              ? "bg-tab-active text-tab-active-text shadow-control"
              : "text-text-muted hover:text-text-secondary"
          }`}
          aria-label={`Switch to ${label} mode`}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
