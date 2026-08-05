import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Sparkles, LineChart as LineChartIcon, Users, RefreshCw, Download } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import { buildPedagogicalReport } from "@/lib/ai-pedagogical.functions";
import { buildPedagogicalPdfBlob, pedagogicalPdfFilename } from "@/lib/pdf/pedagogical-pdf";
import { downloadPdfBlob } from "@/lib/pdf/pdf-builder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/pedagogical/$classId")({
  component: PedagogicalPage,
  head: () => ({
    meta: [
      { title: "דוח פדגוגי כיתתי · הכיתה שלי" },
      { name: "description", content: "ניתוח AI של הישגי הכיתה, אקלים הלימודים ומגמות התנהגות, עם המלצות מעשיות להרב." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function today() { return new Date().toISOString().slice(0, 10); }
function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function PedagogicalPage() {
  const { classId } = Route.useParams();
  const build = useServerFn(buildPedagogicalReport);
  const [from, setFrom] = useState(monthsAgo(3));
  const [to, setTo] = useState(today());

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["pedagogical", classId, from, to],
    queryFn: () => build({ data: { classId, from, to } }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
        <Link to="/reports/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline">
          לדוח המפורט של התלמידים
        </Link>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <LineChartIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-display text-3xl font-bold">דוח פדגוגי כיתתי</h1>
            <p className="text-sm text-muted-foreground">
              {data ? `כיתה ${data.className}` : "טוען…"} · ניתוח AI של אקלים, הישגים ומגמות התנהגות
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div><Label>מתאריך</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>עד תאריך</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="ms-auto flex items-center gap-2">
            {data && (
              <>
                <Badge variant="secondary" className="gap-1"><Users className="h-3.5 w-3.5" />{data.studentCount} תלמידים</Badge>
                {data.overallAvgPercent !== null && (
                  <Badge variant="secondary">ממוצע {data.overallAvgPercent}%</Badge>
                )}
                {data.weightedAvgPercent !== null && data.hasCustomWeights && (
                  <Badge variant="secondary">ממוצע משוקלל {data.weightedAvgPercent}%</Badge>
                )}
              </>
            )}
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`ms-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> רענן
            </Button>
            <Button
              onClick={async () => {
                if (!data) return;
                const blob = await buildPedagogicalPdfBlob(data);
                downloadPdfBlob(blob, pedagogicalPdfFilename(data));
              }}
              disabled={!data}
            >
              <Download className="ms-1 h-4 w-4" /> ייצוא PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">מנתח את הכיתה…</CardContent></Card>
      ) : !data ? null : (
        <>
          {/* AI summary */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                תקציר וניתוח פדגוגי
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AiAnalysisText text={data.aiAnalysis} />
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {data.strongSubjects.length > 0 && (
                  <Badge variant="default">חזקים: {data.strongSubjects.join(" · ")}</Badge>
                )}
                {data.weakSubjects.length > 0 && (
                  <Badge variant="destructive">לחיזוק: {data.weakSubjects.join(" · ")}</Badge>
                )}
                {data.highlightSubjects.length > 0 && (
                  <Badge variant="secondary">דגש: {data.highlightSubjects.join(" · ")}</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Subject averages */}
          <Card>
            <CardHeader><CardTitle className="text-base">ממוצע לפי מקצוע</CardTitle></CardHeader>
            <CardContent>
              {data.subjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">אין ציונים בטווח הזה.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.subjects} margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="avgPercent" name="ממוצע (%)" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Behavior + discipline */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">התנהגות לפי קטגוריה</CardTitle></CardHeader>
              <CardContent>
                {data.behaviorCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">אין נתוני התנהגות בטווח.</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.behaviorCategories}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="positive" name="חיובי" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="negative" name="שלילי" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">אירועי משמעת</CardTitle></CardHeader>
              <CardContent>
                {data.disciplineCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">אין אירועי משמעת בטווח.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr><th className="py-1 text-right">קטגוריה</th><th className="text-right">מספר</th><th className="text-right">חומרה ממוצעת</th></tr>
                    </thead>
                    <tbody>
                      {data.disciplineCategories.map((d) => (
                        <tr key={d.category} className="border-t border-border/40">
                          <td className="py-1">{d.category}</td>
                          <td className="font-mono-tabular">{d.count}</td>
                          <td className="font-mono-tabular">{d.avgSeverity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Weekly trend */}
          {data.trend.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-base">מגמה שבועית</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="weekStart" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="positive" name="חיובי" stroke="#10b981" strokeWidth={2} />
                      <Line type="monotone" dataKey="negative" name="שלילי" stroke="#ef4444" strokeWidth={2} />
                      <Line type="monotone" dataKey="discipline" name="משמעת" stroke="#f59e0b" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Attendance */}
          <Card>
            <CardHeader><CardTitle className="text-base">נוכחות בטווח</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="secondary">נוכח: {data.attendance.present}</Badge>
              <Badge variant="secondary">נעדר: {data.attendance.absent}</Badge>
              <Badge variant="secondary">איחורים: {data.attendance.late}</Badge>
              <Badge variant="secondary">מאושר: {data.attendance.excused}</Badge>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function AiAnalysisText({ text }: { text: string }) {
  // Light markdown-ish rendering: preserve line breaks, bold **, headings.
  const lines = text.split(/\n/);
  return (
    <div className="space-y-1 text-sm leading-relaxed whitespace-pre-wrap">
      {lines.map((ln, i) => {
        if (/^#{1,3}\s+/.test(ln)) {
          return <div key={i} className="font-bold text-base mt-2">{ln.replace(/^#{1,3}\s+/, "")}</div>;
        }
        return <div key={i}>{ln}</div>;
      })}
    </div>
  );
}