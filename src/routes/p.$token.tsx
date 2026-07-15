import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getParentView } from "@/lib/parents.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, GraduationCap, Calendar, BookOpen, Sparkles } from "lucide-react";

export const Route = createFileRoute("/p/$token")({
  component: ParentPage,
  head: () => ({
    meta: [
      { title: "פורטל הורים · ClassAlign Studio" },
      { name: "description", content: "צפייה בהתקדמות התלמיד — ציונים, נוכחות והתנהגות — קישור אישי מהרב המלמד." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ParentPage() {
  const { token } = Route.useParams();
  const fn = useServerFn(getParentView);
  const { data, isLoading, error } = useQuery({
    queryKey: ["parent-view", token],
    queryFn: () => fn({ data: { token } }),
    retry: false,
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">טוען...</div>;
  if (error || !data) {
    return (
      <div className="mx-auto max-w-md p-8" dir="rtl">
        <Card><CardContent className="py-10 text-center">
          <p className="text-destructive font-medium">הקישור אינו פעיל</p>
          <p className="mt-2 text-sm text-muted-foreground">פנו אל הרב המלמד לקבלת קישור חדש.</p>
        </CardContent></Card>
      </div>
    );
  }

  const earnedSum = data.behavior.reduce((s, b) => s + (b.points ?? 0), 0);
  const gradesAvg = data.grades.length
    ? Math.round(data.grades.reduce((s, g) => s + (g.value / Math.max(1, g.max_value)) * 100, 0) / data.grades.length)
    : null;
  const presentCount = data.attendance.filter((a) => a.status === "present").length;
  const totalAtt = data.attendance.length;

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
        <div className="rounded-2xl border bg-card bg-mesh p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-amber" /> ClassAlign Studio · פורטל הורים
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            {data.studentName ? `התקדמות ${data.studentName}` : `כיתה ${data.className}`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.className} · 90 הימים האחרונים</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Stat icon={GraduationCap} label="ממוצע ציונים" value={gradesAvg !== null ? `${gradesAvg}%` : "—"} />
          <Stat icon={Trophy} label="נקודות התנהגות" value={String(earnedSum)} />
          <Stat icon={Calendar} label="נוכחות" value={totalAtt > 0 ? `${presentCount}/${totalAtt}` : "—"} />
        </div>

        {data.bulletins.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold flex items-center gap-2"><BookOpen className="h-5 w-5 text-amber" /> עלונים שבועיים</h2>
            {data.bulletins.slice(0, 3).map((b) => (
              <Card key={b.id}>
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{b.title}</h3>
                    <span className="text-xs text-muted-foreground font-mono-tabular">{b.start_date} → {b.end_date}</span>
                  </div>
                  {b.digest_summary && <p className="text-sm whitespace-pre-wrap leading-relaxed">{b.digest_summary}</p>}
                  {b.study_points.length > 0 && (
                    <ul className="list-disc ps-5 text-sm space-y-1">
                      {b.study_points.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  )}
                  {b.weekly_riddle && (
                    <div className="rounded-lg bg-amber/10 p-3 text-sm">
                      <div className="font-medium text-amber">חידת השבוע:</div>
                      <div className="mt-1">{b.weekly_riddle}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </section>
        )}

        {data.studentId && data.grades.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold">ציונים אחרונים</h2>
            <div className="grid gap-2">
              {data.grades.slice(0, 10).map((g, i) => {
                const pct = Math.round((g.value / Math.max(1, g.max_value)) * 100);
                return (
                  <Card key={i}><CardContent className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">{g.subject}</div>
                      <div className="text-xs text-muted-foreground font-mono-tabular">{g.date}</div>
                    </div>
                    <Badge className="bg-amber text-amber-foreground font-mono-tabular">{pct}%</Badge>
                  </CardContent></Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card><CardContent className="pt-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4 text-amber" /> {label}</div>
      <div className="mt-1 font-display text-3xl font-bold">{value}</div>
    </CardContent></Card>
  );
}