import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Sparkles, RefreshCw, ChevronDown, ChevronUp, BookOpen, FileText, Hash, Ruler, Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { toast } from "sonner";
import { getStyleProfile, recomputeStyleProfile } from "@/lib/teacher-style.functions";
import { RESOURCE_TYPE_LABELS, type ResourceType } from "@/lib/teaching-resources.functions";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
  head: () => ({
    meta: [
      { title: "תובנות מורה · ClassAlign Studio" },
      { name: "description", content: "דשבורד תובנות אישי — סגנון הכתיבה, המקצועות המועדפים וקצב יצירת התוכן שלך." },
      { property: "og:title", content: "תובנות מורה · ClassAlign Studio" },
      { property: "og:description", content: "תקציר AI, מקצועות מועדפים, סוגי חומר וקצב יצירת תוכן." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 200 80% 55%))",
  "hsl(var(--chart-3, 45 90% 60%))",
  "hsl(var(--chart-4, 340 75% 60%))",
  "hsl(var(--chart-5, 160 60% 50%))",
  "hsl(var(--chart-6, 280 60% 60%))",
  "hsl(var(--chart-7, 20 80% 60%))",
  "hsl(var(--chart-8, 90 55% 50%))",
];

function InsightsPage() {
  const fetchProfile = useServerFn(getStyleProfile);
  const runRecompute = useServerFn(recomputeStyleProfile);
  const qc = useQueryClient();
  const [sampleOpen, setSampleOpen] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["teacher-style-profile"],
    queryFn: () => fetchProfile(),
  });

  const recomputeMut = useMutation({
    mutationFn: () => runRecompute(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["teacher-style-profile"] });
      toast.success(res?.count ? `נותחו ${res.count} חומרים` : "הניתוח עודכן");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "שגיאה בעדכון"),
  });

  const subjectsData = useMemo(() => {
    if (!profile) return [];
    return Object.entries(profile.preferred_subjects ?? {})
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [profile]);

  const typesData = useMemo(() => {
    if (!profile) return [];
    return Object.entries(profile.preferred_resource_types ?? {})
      .map(([k, v]) => ({ name: RESOURCE_TYPE_LABELS[k as ResourceType] ?? k, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [profile]);

  const paceData = useMemo(() => {
    if (!profile) return [];
    return Object.entries(profile.weekly_pace ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-16)
      .map(([week, count]) => ({ week, count }));
  }, [profile]);

  const toneKeywords = profile?.tone_keywords ?? [];
  const maxTone = Math.max(1, toneKeywords.length);

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground">טוען תובנות…</div>;
  }

  if (!profile || profile.resource_count === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-10 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-6">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold">תובנות מורה</h1>
          <p className="mt-2 text-muted-foreground">
            הניתוח האישי נבנה אוטומטית ככל שתיצור יותר חומרי לימוד, דפי עבודה ומצגות.
            ברגע שיהיו לך מספיק חומרים במערכת — כאן יופיעו המקצועות המועדפים, סגנון הכתיבה, קצב היצירה ומילות המפתח שלך.
          </p>
        </div>
        <Button onClick={() => recomputeMut.mutate()} disabled={recomputeMut.isPending}>
          <RefreshCw className={`ms-2 h-4 w-4 ${recomputeMut.isPending ? "animate-spin" : ""}`} />
          רענן ניתוח עכשיו
        </Button>
      </div>
    );
  }

  const updatedAt = profile.last_updated_at ? new Date(profile.last_updated_at).toLocaleDateString("he-IL") : "";

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">תובנות מורה</h1>
          <p className="text-sm text-muted-foreground">
            ניתוח אישי של סגנון ההוראה, המקצועות והקצב שלך.
            {updatedAt && <> עודכן לאחרונה: {updatedAt}.</>}
          </p>
        </div>
        <Button variant="outline" onClick={() => recomputeMut.mutate()} disabled={recomputeMut.isPending}>
          <RefreshCw className={`ms-2 h-4 w-4 ${recomputeMut.isPending ? "animate-spin" : ""}`} />
          רענן ניתוח
        </Button>
      </div>

      {profile.last_ai_summary && (
        <Card className="border-primary/30 bg-gradient-to-bl from-primary/10 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" />
              תקציר AI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed">{profile.last_ai_summary}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={<Layers className="h-5 w-5" />} label="סה״כ חומרים" value={profile.resource_count} />
        <MetricCard
          icon={<Hash className="h-5 w-5" />}
          label="ממוצע שאלות בדף עבודה"
          value={profile.avg_questions_per_worksheet ? profile.avg_questions_per_worksheet.toFixed(1) : "—"}
        />
        <MetricCard
          icon={<Ruler className="h-5 w-5" />}
          label="אורך שאלה ממוצע (תווים)"
          value={profile.avg_question_length ? Math.round(profile.avg_question_length) : "—"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-primary" /> מקצועות מועדפים
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subjectsData.length === 0 ? (
              <EmptyMini text="אין עדיין חומרים משויכים למקצועות." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={subjectsData} dataKey="value" nameKey="name" outerRadius={80} label={(e) => e.name}>
                      {subjectsData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" /> סוגי חומר
            </CardTitle>
          </CardHeader>
          <CardContent>
            {typesData.length === 0 ? (
              <EmptyMini text="אין עדיין סוגי חומר." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typesData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">קצב יצירת תוכן</CardTitle>
          <p className="text-xs text-muted-foreground">מספר חומרים שיצרת בכל שבוע — עוקב אחרי הרצף שלך.</p>
        </CardHeader>
        <CardContent>
          {paceData.length === 0 ? (
            <EmptyMini text="אין עדיין היסטוריית יצירה." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={paceData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="week" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="count" name="חומרים" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {toneKeywords.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">מילות מפתח בסגנון הכתיבה שלך</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {toneKeywords.map((w, i) => {
                const size = 0.85 + (1 - i / maxTone) * 0.9;
                return (
                  <Badge
                    key={w}
                    variant="secondary"
                    style={{ fontSize: `${size.toFixed(2)}rem`, padding: "0.35rem 0.7rem" }}
                  >
                    {w}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {profile.writing_style_sample && (
        <Card>
          <CardHeader className="pb-2">
            <button
              type="button"
              onClick={() => setSampleOpen((v) => !v)}
              className="flex w-full items-center justify-between text-right"
            >
              <CardTitle className="text-sm">דוגמה מסגנון הכתיבה שלך</CardTitle>
              {sampleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CardHeader>
          {sampleOpen && (
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm leading-relaxed" style={{ fontFamily: "inherit" }}>
                {profile.writing_style_sample}
              </pre>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold leading-tight">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">{text}</div>;
}