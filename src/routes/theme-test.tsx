import { createFileRoute } from "@tanstack/react-router";
import { THEMES, type ThemeName } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/theme-test")({
  component: ThemeTestPage,
  head: () => ({
    meta: [
      { title: "בדיקת ערכות נושא · הכיתה שלי" },
      { name: "description", content: "תצוגת בדיקה מהירה של כל ערכות הנושא במערכת." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ThemeTestPage() {
  return (
    <div className="min-h-screen bg-background p-6 text-foreground" dir="rtl" lang="he">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            חזרה
          </Link>
          <h1 className="font-display text-2xl font-bold">בדיקת ערכות נושא</h1>
        </div>
        <p className="text-muted-foreground">
          כל כרטיסייה מציגה את ערכת הנושא בתוך קונטיינר משלה, כך שאפשר לוודא שכל צבע, ריווח וגופן נטענים נכון.
        </p>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {THEMES.map((theme) => (
            <ThemePreviewCard key={theme.id} theme={theme.id} label={theme.label} description={theme.description} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ThemePreviewCard({ theme, label, description }: { theme: ThemeName; label: string; description: string }) {
  return (
    <div data-theme={theme} className="rounded-3xl border bg-background p-4 shadow-sm transition-colors">
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-lg">{label}</CardTitle>
            <Badge variant="secondary" className="font-mono text-xs">{theme}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="space-y-2">
            <Label className="text-sm">דוגמת שדה</Label>
            <Input placeholder="הקלד כאן…" defaultValue="שלום כיתה" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm"><Sparkles className="ms-1 h-4 w-4" />ראשי</Button>
            <Button size="sm" variant="secondary">משני</Button>
            <Button size="sm" variant="outline">מתאר</Button>
            <Button size="sm" variant="ghost">רפוי</Button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="h-4 w-4 rounded-full bg-primary" />
            <span className="text-muted-foreground">primary</span>
            <span className="h-4 w-4 rounded-full bg-accent" />
            <span className="text-muted-foreground">accent</span>
            <span className="h-4 w-4 rounded-full bg-amber" />
            <span className="text-muted-foreground">amber</span>
            <span className="h-4 w-4 rounded-full bg-turquoise" />
            <span className="text-turquoise">turquoise</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-turquoise px-2 py-1 text-xs font-medium text-primary-foreground">
              רקע טורקיז
            </span>
            <span className="text-sm text-turquoise">טקסט טורקיז</span>
          </div>
        </CardContent>
      </Card>
      <div className="mt-3 text-center text-xs text-muted-foreground">
        משתמש ב-<code className="rounded bg-muted px-1 py-0.5">[data-theme="{theme}"]</code>
      </div>
    </div>
  );
}
