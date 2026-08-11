import { SettingsTabs } from "@/components/settings-tabs";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2, Palette, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTheme, THEMES, DEFAULT_THEME, type ThemeName } from "@/hooks/use-theme";
import { getThemePreference, saveThemePreference } from "@/lib/theme-preference.functions";

export const Route = createFileRoute("/_authenticated/settings/theme")({
  component: ThemeSettingsPage,
  head: () => ({
    meta: [
      { title: "ערכות נושא · הכיתה שלי" },
      { name: "description", content: "בחירת ערכת נושא לאפליקציה עם תצוגה מקדימה ושמירה לחשבון — המראה נשמר ומוחל בכל מכשיר." },
      { property: "og:title", content: "ערכות נושא · הכיתה שלי" },
      { property: "og:description", content: "תצוגה מקדימה של ערכות הנושא ושמירת המראה לחשבון." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const SWATCHES: Record<ThemeName, string[]> = {
  modern: ["#1e293b", "#f59e0b", "#f8fafc"],
  conservative: ["#4a3a24", "#b8860b", "#fdf8ee"],
  minimal: ["#000000", "#666666", "#ffffff"],
  kitsch: ["#ec4899", "#fbcfe8", "#fff1f7"],
  mono: ["#04150c", "#22c55e", "#0a2415"],
  classalign: ["#14b8a6", "#f97316", "#ecfeff"],
  "hakita-sheli": ["#2b2118", "#b08d57", "#f6efe2"],
};

function ThemeSettingsPage() {
  const { theme, setTheme } = useTheme();
  const [draft, setDraft] = useState<ThemeName>(theme);
  const fetchPref = useServerFn(getThemePreference);
  const savePref = useServerFn(saveThemePreference);
  const queryClient = useQueryClient();

  const { data: saved } = useQuery({ queryKey: ["theme-preference"], queryFn: () => fetchPref() });

  useEffect(() => setDraft(theme), [theme]);

  const save = useMutation({
    mutationFn: (t: ThemeName) => savePref({ data: { theme: t } }),
    onSuccess: (_r, t) => {
      setTheme(t);
      queryClient.setQueryData(["theme-preference"], { theme: t });
      toast.success("ערכת הנושא נשמרה לחשבון ותחול בכל המכשירים");
    },
    onError: (e: Error) => toast.error(e.message || "שמירת ערכת הנושא נכשלה"),
  });

  const savedTheme = (saved?.theme ?? null) as ThemeName | null;
  const dirty = draft !== savedTheme;

  return (
    <div className="space-y-6">
      <SettingsTabs active="theme" />
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="px-0">
          <Link to="/settings"><ArrowRight className="ms-1 h-4 w-4" aria-hidden /> חזרה למרכז ההגדרות</Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Palette className="h-6 w-6 text-primary" aria-hidden /> ערכות נושא
        </h1>
        <p className="text-sm text-muted-foreground">
          בחירת המראה של האפליקציה. הבחירה מוצגת מיד בתצוגה המקדימה, ושמירה מחילה אותה על כל המסכים ובכל מכשיר שבו תתחברו.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">בחירת ערכה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {THEMES.map((t) => {
              const selected = draft === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDraft(t.id)}
                  aria-pressed={selected}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-start transition hover:bg-accent/50 ${
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
                      {selected && <Check className="h-4 w-4 text-primary" aria-hidden />}
                      {savedTheme === t.id && <Badge variant="secondary" className="text-[10px]">שמור</Badge>}
                      {savedTheme === null && t.id === DEFAULT_THEME && (
                        <Badge variant="outline" className="text-[10px]">ברירת מחדל</Badge>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">{t.description}</span>
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <ThemePreview theme={draft} />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !dirty}>
              {save.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden /> : <Save className="ms-1 h-4 w-4" aria-hidden />}
              שמירת ערכת הנושא
            </Button>
            <Button
              variant="outline"
              onClick={() => setDraft(savedTheme ?? DEFAULT_THEME)}
              disabled={!dirty}
            >
              <RotateCcw className="ms-1 h-4 w-4" aria-hidden /> ביטול השינויים
            </Button>
            <Button variant="ghost" onClick={() => setTheme(draft)} disabled={draft === theme}>
              החלה במכשיר הזה בלבד
            </Button>
            {dirty && <span className="text-xs text-muted-foreground">יש שינוי שלא נשמר</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Live sample of the app chrome, scoped to the candidate theme only. */
function ThemePreview({ theme }: { theme: ThemeName }) {
  const attr = theme === "modern" ? undefined : theme;
  return (
    <section
      {...(attr ? { "data-theme": attr } : {})}
      dir="rtl"
      className="overflow-hidden rounded-xl border bg-background text-foreground shadow-sm"
      aria-label="תצוגה מקדימה של ערכת הנושא"
    >
      <div className="flex items-center justify-between border-b bg-card px-4 py-3">
        <span className="font-bold">הכיתה שלי</span>
        <span className="flex gap-2">
          <span className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground">שמירה</span>
          <span className="rounded-md border px-3 py-1 text-xs">ביטול</span>
        </span>
      </div>
      <div className="space-y-3 bg-secondary/30 p-4">
        <h2 className="text-lg font-bold">כיתה א׳ — גמרא</h2>
        <p className="text-sm text-muted-foreground">כך ייראו הכותרות, הכרטיסים והכפתורים באפליקציה.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {["ממוצע כיתה", "נקודות השבוע"].map((label, i) => (
            <div key={label} className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-2xl font-bold text-primary">{i === 0 ? "92" : "148"}</div>
              <div className="mt-2 h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: i === 0 ? "78%" : "56%" }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">פרשת השבוע</span>
          <span className="rounded-full border px-3 py-1 text-xs">תורנויות</span>
          <span className="rounded-full bg-destructive px-3 py-1 text-xs text-destructive-foreground">חיסור</span>
        </div>
      </div>
    </section>
  );
}
