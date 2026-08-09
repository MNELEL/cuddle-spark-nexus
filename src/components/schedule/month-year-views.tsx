import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer } from "lucide-react";
import { listScheduleTasks, type ScheduleTask } from "@/lib/schedule-planning.functions";
import { addDays, hebrewDayLabel, isoDate, parashaForWeek, weekStartOf } from "@/lib/parasha";
import { ALL_DAYS, KIND_LABEL, OVERRIDE_LABEL } from "@/components/schedule/schedule-context";
import type { useScheduleYear } from "@/components/schedule/use-schedule-year";
import { printHtmlTable } from "@/lib/print-schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Year = ReturnType<typeof useScheduleYear>;

const HE_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

function useTasks(classId: string, from: string, to: string) {
  const fn = useServerFn(listScheduleTasks);
  const { data = [] } = useQuery({
    queryKey: ["schedule-tasks", classId, from, to],
    queryFn: () => fn({ data: { classId, from, to } }),
  });
  return data as ScheduleTask[];
}

/** Month grid: teaching days, holidays, tasks/exams per date. */
export function MonthView({ classId, year, anchor }: { classId: string; year: Year; anchor: Date }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const tasks = useTasks(classId, isoDate(first), isoDate(last));

  const tasksByDate = useMemo(() => {
    const m = new Map<string, ScheduleTask[]>();
    for (const t of tasks) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return m;
  }, [tasks]);

  const cells = useMemo(() => {
    const start = weekStartOf(first);
    const out: Date[] = [];
    for (let d = start; d <= last || out.length % 7 !== 0; d = addDays(d, 1)) out.push(new Date(d));
    return out;
  }, [first, last]);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{HE_MONTHS[anchor.getMonth()]} {anchor.getFullYear()}</CardTitle>
        <Button
          variant="outline" size="sm"
          onClick={() =>
            printHtmlTable({
              title: `לוח חודשי — ${HE_MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`,
              head: ["תאריך", "יום", "מצב", "משימות ומבחנים"],
              rows: cells
                .filter((d) => d.getMonth() === anchor.getMonth())
                .map((d) => {
                  const iso = isoDate(d);
                  const off = !year.isTeachingDate(iso);
                  const hol = year.holidayByDate.get(iso)?.title;
                  const ovr = (year.overrideByDate.get(iso) ?? []).map((o) => OVERRIDE_LABEL[o.type] ?? o.type);
                  return [
                    `${d.getDate()}/${d.getMonth() + 1}`,
                    ALL_DAYS[d.getDay()]!.label,
                    { text: [hol, ...ovr].filter(Boolean).join(", ") || (off ? "אין לימודים" : "לימודים"), off },
                    (tasksByDate.get(iso) ?? []).map((t) => `${KIND_LABEL[t.kind]}: ${t.title}`).join("\n") || "—",
                  ];
                }),
            })
          }
        >
          <Printer className="ms-1 h-4 w-4" /> הדפסה
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted-foreground">
          {ALL_DAYS.map((d) => <div key={d.key} className="rounded-lg bg-muted py-1.5">{d.short}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const iso = isoDate(d);
            const inMonth = d.getMonth() === anchor.getMonth();
            const teaching = year.isTeachingDate(iso);
            const hol = year.holidayByDate.get(iso);
            const dayTasks = tasksByDate.get(iso) ?? [];
            return (
              <div
                key={iso}
                className={`min-h-[86px] rounded-xl border p-1.5 text-right text-[11px] ${
                  !inMonth ? "opacity-40" : teaching ? "bg-card" : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-muted-foreground">{hebrewDayLabel(d)}</span>
                  <span className="font-bold">{d.getDate()}</span>
                </div>
                {hol && <div className="mt-0.5 truncate text-[10px] text-destructive">{hol.title}</div>}
                {dayTasks.slice(0, 3).map((t) => (
                  <div key={t.id} className={`mt-0.5 truncate rounded px-1 ${t.done ? "line-through opacity-60" : ""} ${
                    t.kind === "exam" ? "bg-amber-100 text-amber-800" : "bg-accent/50"
                  }`}>
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 3 && <div className="mt-0.5 text-[10px] text-muted-foreground">+{dayTasks.length - 3}</div>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/** Year overview: one row per week with parasha, teaching days count and highlights. */
export function YearView({ classId, year }: { classId: string; year: Year }) {
  const from = isoDate(year.bounds.start);
  const to = isoDate(year.bounds.end);
  const tasks = useTasks(classId, from, to);

  const rows = useMemo(
    () =>
      year.weekStarts.map((ws) => {
        const start = new Date(`${ws}T00:00:00`);
        const dates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(start, i)));
        const teaching = dates.filter((d) => year.isTeachingDate(d));
        const holidays = dates.map((d) => year.holidayByDate.get(d)?.title).filter(Boolean) as string[];
        const weekTasks = tasks.filter((t) => dates.includes(t.date));
        const note = year.noteByWeek.get(ws);
        return {
          weekStart: ws,
          label: `${start.getDate()}/${start.getMonth() + 1}`,
          parasha: note?.parasha_override ?? parashaForWeek(start) ?? "—",
          teachingCount: teaching.length,
          holidays: Array.from(new Set(holidays)),
          exams: weekTasks.filter((t) => t.kind === "exam").length,
          tasks: weekTasks.length,
        };
      }),
    [year, tasks],
  );

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">מבט שנתי · {from} – {to}</CardTitle>
        <Button
          variant="outline" size="sm"
          onClick={() =>
            printHtmlTable({
              title: "מבט שנתי",
              subtitle: `${from} – ${to}`,
              head: ["שבוע", "פרשה", "ימי לימוד", "חגים וחופשות", "מבחנים", "משימות"],
              rows: rows.map((r) => [
                r.label, r.parasha, String(r.teachingCount),
                r.holidays.join(", ") || "—", String(r.exams), String(r.tasks),
              ]),
            })
          }
        >
          <Printer className="ms-1 h-4 w-4" /> הדפסה
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="p-2">שבוע</th><th className="p-2">פרשה</th><th className="p-2">ימי לימוד</th>
              <th className="p-2">חגים וחופשות</th><th className="p-2">מבחנים</th><th className="p-2">משימות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.weekStart} className="border-t">
                <td className="p-2 font-medium">{r.label}</td>
                <td className="p-2">{r.parasha}</td>
                <td className="p-2">
                  <Badge variant={r.teachingCount >= 5 ? "secondary" : "destructive"}>{r.teachingCount}</Badge>
                </td>
                <td className="p-2 text-xs text-muted-foreground">{r.holidays.join(", ") || "—"}</td>
                <td className="p-2">{r.exams || "—"}</td>
                <td className="p-2">{r.tasks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
