import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/* ── Types ── */
type ThemeChoice = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** The user-chosen preference (persisted). */
  theme: ThemeChoice;
  /** The effective theme after resolving "system". */
  resolved: ResolvedTheme;
  /** Update the preference. */
  setTheme: (next: ThemeChoice) => void;
}

const STORAGE_KEY = "image-compositor-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* ── Helpers ── */

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  return choice === "system" ? getSystemTheme() : choice;
}

function applyToDOM(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
}

function readStored(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* storage unavailable */
  }
  return "dark"; // default
}

/* ── Provider ── */

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeRaw] = useState<ThemeChoice>(readStored);
  const resolved = resolve(theme);

  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeRaw(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* noop */
    }
  }, []);

  /* Apply class on mount + every change */
  useEffect(() => {
    applyToDOM(resolve(theme));
  }, [theme]);

  /* Listen for OS preference changes when in "system" mode */
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyToDOM(resolve("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/* ── Hook ── */

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
