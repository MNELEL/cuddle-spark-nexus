import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { HebrewRangeFilter, type DateRange } from "@/components/hebrew-range-filter";
import { useHebrewAnchor } from "@/components/hebrew-anchor";
import { hebrewRangePresets, hebrewDayInfo, isoOf } from "@/lib/hebrew-calendar";
import { getDailyReport, type DailyReportDay } from "@/lib/daily-report.functions";

export const Route = createFileRoute("/_authenticated/daily-report/$classId")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: DailyLogReportPage,
});

/** כל הימים בטווח (כולל ימים ללא נתונים), מהחדש לישן. */
function daysInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(isoOf(d));
  return out.reverse();
}

const emptyDay = (date: string): DailyReportDay => ({
  date,
  notes: null,
  attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
  grades: { count: 0, avgPct: null },
  insights: { total: 0, high: 0, medium: 0, low: 0 },
});

function DailyLogReportPage() {
  const { classId } = Route.useParams();
  const { date: anchorDate } = useHebrewAnchor();
  const [range, setRange] = useState<DateRange>(() => {
    const presets = hebrewRangePresets(anchorDate);
    const p = presets.find((x) => x.id === "month") ?? presets[0]!;
    return { from: p.from, to: p.to };
  });
  const [onlyWithData, setOnlyWithData] = useState(false);
  const fetchReport = useServerFn(getDailyReport);

  const { data, isLoading } = useQuery({
    queryKey: ["daily-log-report", classId, range.from, range.to],
    queryFn: () => fetchReport({ data: { classId, from: range.from, to: range.to } }),
  });

  const rows = useMemo(() => {
    const map = new Map((data?.days ?? []).map((d) => [d.date, d]));
    const all = daysInRange(range.from, range.to).map((iso) => map.get(iso) ?? emptyDay(iso));
    return onlyWithData
      ? all.filter(
          (d) => d.notes || d.attendance.total > 0 || d.grades.count > 0 || d.insights.total > 0,
        )
      : all;
  }, [data, range, onlyWithData]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, d) => {
          acc.present += d.attendance.present;
          acc.absent += d.attendance.absent;
          acc.late += d.attendance.late;
          acc.logs += d.notes ? 1 : 0;
          acc.insights += d.insights.total;
          if (d.grades.avgPct !== null) {
            acc.gradeSum += d.grades.avgPct * d.grades.count;
            acc.gradeCount += d.grades.count;
          }
          return acc;
        },
        { present: 0, absent: 0, late: 0, logs: 0, insights: 0, gradeSum: 0, gradeCount: 0 },
      ),
    [rows],
  );

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 font-display text-xl">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
          דוח תיעוד יומי{data ? ` — ${data.class.name}` : ""}
        </h1>
        <Button asChild variant="ghost" size="sm">
          <Link to="/classes/$classId" params={{ classId }}>
            <ArrowRight className="ms-1 h-4 w-4" aria-hidden />
            חזרה לכיתה
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">טווח לוח עברי</CardTitle>
          <CardDescription>
            כל ימי הלוח העברי בטווח מוצגים — גם ימים בלי תיעוד, כדי לזהות פערים.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <HebrewRangeFilter value={range} onChange={setRange} />
          <div className="flex items-center gap-2">
            <Checkbox
              id="only-with-data"
              checked={onlyWithData}
              onCheckedChange={(v) => setOnlyWithData(v === true)}
            />
            <Label htmlFor="only-with-data" className="text-sm font-normal">
              הצג רק ימים עם נתונים
            </Label>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">ימי תיעוד: {totals.logs}</Badge>
            <Badge variant="outline">נוכחים: {totals.present}</Badge>
            <Badge variant="outline">נעדרים: {totals.absent}</Badge>
            <Badge variant="outline">איחורים: {totals.late}</Badge>
            <Badge variant="outline">
              ממוצע ציונים:{" "}
              {totals.gradeCount ? `${Math.round(totals.gradeSum / totals.gradeCount)}%` : "—"}
            </Badge>
            <Badge variant="outline">תובנות: {totals.insights}</Badge>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">טוען דוח…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">אין ימים בטווח שנבחר.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((d) => {
            const info = hebrewDayInfo(new Date(`${d.date}T00:00:00`));
            const empty =
              !d.notes && d.attendance.total === 0 && d.grades.count === 0 && d.insights.total === 0;
            return (
              <li
                key={d.date}
                className={`rounded-lg border p-3 ${empty ? "bg-muted/30" : "bg-card"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{info.full}</span>
                    <span className="text-xs text-muted-foreground">{d.date}</span>
                    {info.holidays?.map((h) => (
                      <Badge key={h} variant="secondary">
                        {h}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 text-[11px]">
                    {d.attendance.total > 0 && (
                      <Badge variant="outline">
                        נוכחות: {d.attendance.present}/{d.attendance.total}
                        {d.attendance.late > 0 ? ` · ${d.attendance.late} איחורים` : ""}
                      </Badge>
                    )}
                    {d.grades.count > 0 && (
                      <Badge variant="outline">
                        ציונים: {d.grades.count} · ממוצע {Math.round(d.grades.avgPct ?? 0)}%
                      </Badge>
                    )}
                    {d.insights.total > 0 && (
                      <Badge variant={d.insights.high > 0 ? "destructive" : "secondary"}>
                        תובנות: {d.insights.total}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {d.notes || "אין תיעוד ליום זה."}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
