import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeName = "modern" | "conservative" | "minimal" | "kitsch" | "mono";

export const THEMES: { id: ThemeName; label: string; description: string }[] = [
  { id: "modern",       label: "מודרני",   description: "Midnight slate + amber — נקי ועדכני" },
  { id: "conservative", label: "מסורתי",   description: "פרגמנט וזהב — תחושת ת״ת" },
  { id: "minimal",      label: "מינימלי",  description: "שחור/לבן, פינות חדות, מקסימום בהירות" },
  { id: "kitsch",       label: "צבעוני",   description: "ורוד תוסס, פינות מעוגלות, אנרגיה" },
  { id: "mono",         label: "טרמינל",   description: "ירוק קיברנטי על שחור — מונוספייס" },
];

type Ctx = { theme: ThemeName; setTheme: (t: ThemeName) => void };
const ThemeContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "classpro-theme";

function apply(theme: ThemeName) {
  const root = document.documentElement;
  if (theme === "modern") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("modern");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) as ThemeName | null;
    if (saved && ["modern","conservative","minimal","kitsch","mono"].includes(saved)) {
      setThemeState(saved);
      apply(saved);
    }
  }, []);

  function setTheme(t: ThemeName) {
    setThemeState(t);
    apply(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}