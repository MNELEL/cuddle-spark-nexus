import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeName = "modern" | "conservative" | "minimal" | "kitsch" | "mono" | "classalign" | "hakita-sheli";
export const THEMES: { id: ThemeName; label: string; description: string }[] = [
  { id: "modern",       label: "מודרני",   description: "Midnight slate + amber — נקי ועדכני" },
  { id: "conservative", label: "מסורתי",   description: "פרגמנט וזהב — תחושת ת״ת" },
  { id: "minimal",      label: "מינימלי",  description: "שחור/לבן, פינות חדות, מקסימום בהירות" },
  { id: "kitsch",       label: "צבעוני",   description: "ורוד תוסס, פינות מעוגלות, אנרגיה" },
  { id: "mono",         label: "טרמינל",   description: "ירוק קיברנטי על שחור — מונוספייס" },
  { id: "classalign",   label: "מודרני מובייל", description: "טורקיז-כתום-צהוב — עיצוב אפליקציית מובייל" },
  { id: "hakita-sheli", label: "הכיתה שלי", description: "קלף, דיו כהה, פליז וטורקיז — קלאסי ורך" },
];

type Ctx = { theme: ThemeName; setTheme: (t: ThemeName) => void };
const ThemeContext = createContext<Ctx | null>(null);
export const THEME_STORAGE_KEY = "classpro-theme";
const STORAGE_KEY = THEME_STORAGE_KEY;
export const DEFAULT_THEME: ThemeName = "hakita-sheli";

function apply(theme: ThemeName) {
  const root = document.documentElement;
  if (theme === "modern") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) as ThemeName | null;
    if (saved && THEMES.some((t) => t.id === saved)) {
      setThemeState(saved);
      apply(saved);
    } else {
      apply(DEFAULT_THEME);
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
