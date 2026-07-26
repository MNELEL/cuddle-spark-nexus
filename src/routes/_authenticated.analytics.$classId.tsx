import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { listGrades } from "@/lib/tracking.functions";
import { listStudents } from "@/lib/students.functions";
import { getClass } from "@/lib/classes.functions";

export const Route = createFileRoute("/_authenticated/analytics/$classId")({
  component: AnalyticsPage,
  head: () => ({
    meta: [
      { title: "אנליטיקת ציונים · ClassAlign Studio" },
      { name: "description", content: "דשבורד מגמות ציונים לפי מקצוע ותלמיד — קו, עמודות ורדאר." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type GradeRow = { id: string; student_id: string; subject: string | null; value: number; max_value: number; date: string };

const priorityKey = (cid: string) => `ca_subject_priority_${cid}`;

function AnalyticsPage() {
  const { classId } = Route.useParams();
  const getCls = useServerFn(getClass);
  const gradesFn = useServerFn(listGrades);
  const studentsFn = useServerFn(listStudents);

  const { data: cls } = useQuery({ queryKey: ["class", classId], queryFn: () => getCls({ data: { id: classId } }) });
  const { data: grades = [] } = useQuery<GradeRow[]>({ queryKey: ["grades", classId], queryFn: () => gradesFn({ data: { classId } }) as unknown as Promise<GradeRow[]> });
  const { data: students = [] } = useQuery({ queryKey: ["students", classId], queryFn: () => studentsFn({ data: { classId } }) });

  const [studentId, setStudentId] = useState<string>("all");
  const [chart, setChart] = useState<"line" | "bar" | "radar">("line");
  const [priority, setPriority] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(priorityKey(classId));
      if (raw) setPriority(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [classId]);

  const savePriority = (next: string[]) => {
    setPriority(next);
    try { localStorage.setItem(priorityKey(classId), JSON.stringify(next)); } catch { /* ignore */ }
  };

  const subjects = useMemo(() => {
    const set = new Set<string>();
    grades.forEach((g) => { if (g.subject) set.add(g.subject); });
    const arr = Array.from(set);
    // apply priority order
    return arr.sort((a, b) => {
      const ia = priority.indexOf(a); const ib = priority.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, "he");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [grades, priority]);

  const filtered = useMemo(() => {
    return studentId === "all" ? grades : grades.filter((g) => g.student_id === studentId);
  }, [grades, studentId]);

  // Line chart: percent over time, one series per subject (top 5 by priority)
  const lineData = useMemo(() => {
    const byDate = new Map<string, Record<string, number[]>>();
    filtered.forEach((g) => {
      const pct = g.max_value > 0 ? (g.value / g.max_value) * 100 : 0;
      const key = g.date;
      const bucket = byDate.get(key) ?? {};
      const subj = g.subject || "אחר";
      bucket[subj] = (bucket[subj] ?? []).concat(pct);
      byDate.set(key, bucket);
    });
    const rows = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, bucket]) => {
        const row: Record<string, string | number> = { date };
        Object.entries(bucket).forEach(([subj, arr]) => {
          row[subj] = Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 10) / 10;
        });
        return row;
      });
    return rows;
  }, [filtered]);

  // Bar: subject averages
  const barData = useMemo(() => {
    return subjects.map((s) => {
      const rows = filtered.filter((g) => (g.subject || "אחר") === s);
      const pcts = rows.map((g) => g.max_value > 0 ? (g.value / g.max_value) * 100 : 0);
      const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
      return { subject: s, average: Math.round(avg * 10) / 10, count: pcts.length };
    });
  }, [subjects, filtered]);

  const radarData = barData.map((d) => ({ subject: d.subject, value: d.average }));
  const topSeries = subjects.slice(0, 5);
  const palette = ["hsl(var(--primary))", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444"];

  const move = (subj: string, dir: -1 | 1) => {
    const arr = subjects.slice();
    const i = arr.indexOf(subj);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    savePriority(arr);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה {cls?.name ?? ""}
        </Link>
      </div>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><TrendingUp className="h-6 w-6 text-primary" /> אנליטיקת ציונים</h1>
        <p className="text-sm text-muted-foreground">מגמות לפי מקצוע ותלמיד — סדר העדיפות של המקצועות נשמר לכיתה זו.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="min-w-[12rem]">
            <label className="mb-1 block text-xs text-muted-foreground">תלמיד</label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הכיתה</SelectItem>
                {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1">
            {(["line", "bar", "radar"] as const).map((k) => (
              <Button key={k} size="sm" variant={chart === k ? "default" : "outline"} onClick={() => setChart(k)}>
                {k === "line" ? "קו" : k === "bar" ? "עמודות" : "רדאר"}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">
          {chart === "line" ? "מגמות לאורך זמן" : chart === "bar" ? "ממוצע לפי מקצוע" : "פרופיל מקצועות"}
        </CardTitle></CardHeader>
        <CardContent style={{ height: 380 }}>
          {filtered.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">אין ציונים להצגה עדיין.</div>
          ) : chart === "line" ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                {topSeries.map((s, i) => (
                  <Line key={s} type="monotone" dataKey={s} stroke={palette[i % palette.length]} strokeWidth={2} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : chart === "bar" ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="average" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">סדר עדיפות למקצועות</CardTitle></CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין מקצועות עם נתונים.</p>
          ) : (
            <ul className="space-y-1">
              {subjects.map((s, i) => (
                <li key={s} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                  <span><span className="text-muted-foreground">{i + 1}.</span> {s}</span>
                  <span className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => move(s, -1)} aria-label="הזז למעלה"><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => move(s, 1)} aria-label="הזז למטה"><ArrowDown className="h-4 w-4" /></Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">הסדר נשמר בדפדפן ומשפיע על הצגת הגרפים.</p>
        </CardContent>
      </Card>
    </div>
  );
}