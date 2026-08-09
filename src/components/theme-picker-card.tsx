import { Link } from "@tanstack/react-router";
import { Check, Palette, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme, THEMES, type ThemeName } from "@/hooks/use-theme";

/** Swatch triplet per theme, so the choice is visible before applying it. */
const SWATCHES: Record<ThemeName, string[]> = {
  modern: ["#1e293b", "#f59e0b", "#f8fafc"],
  conservative: ["#4a3a24", "#b8860b", "#fdf8ee"],
  minimal: ["#000000", "#666666", "#ffffff"],
  kitsch: ["#ec4899", "#fbcfe8", "#fff1f7"],
  mono: ["#04150c", "#22c55e", "#0a2415"],
  classalign: ["#14b8a6", "#f97316", "#ecfeff"],
  "hakita-sheli": ["#2b2118", "#b08d57", "#f6efe2"],
};

export function ThemePickerCard() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-5 w-5" /> ערכת נושא
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          בחירת המראה של האפליקציה. הבחירה נשמרת במחשב או במכשיר הזה ומוחלת מיד על כל המסכים.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {THEMES.map((t) => {
            const selected = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                aria-pressed={selected}
                className={`flex items-center gap-3 rounded-lg border p-3 text-start transition hover:bg-accent/50 ${
                  selected ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                <span className="flex shrink-0 gap-1" aria-hidden="true">
                  {SWATCHES[t.id].map((c) => (
                    <span key={c} className="h-6 w-3 rounded-sm border" style={{ background: c }} />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {t.label}
                    {selected && <Check className="h-4 w-4 text-primary" />}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{t.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        <Button asChild variant="ghost" size="sm" className="justify-start">
          <Link to="/theme-test">
            <ExternalLink className="ms-1 h-4 w-4" /> השוואת כל ערכות הנושא במסך אחד
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
