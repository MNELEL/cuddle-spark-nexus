import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScheduleRange } from "@/hooks/use-class-schedule";
import {
  addDaysIso, closureFor, closureText, DAY_KEYS, DAY_LABEL, hhmm, isoDate, lessonName, parseIso, weekStartIso,
} from "@/lib/schedule-view";

/** מערכת השעות של שבוע אחד, מאותו מקור כמו כל המסכים. מתעדכנת מיד כשמשנים את המערכת. */
export function WeekScheduleCard({ classId, weekOf, title = "מערכת השבוע" }: {
  classId: string; weekOf?: string | null; title?: string;
}) {
  // השבוע נקבע אחרי הטעינה, כדי שהשרת והדפדפן לא יחלקו על היום הנוכחי
  const [start, setStart] = useState<string | null>(null);
  useEffect(() => { setStart(weekStartIso(weekOf || isoDate(new Date()))); }, [weekOf]);
  const end = start ? addDaysIso(start, 6) : null;
  const { data, isLoading, error } = useScheduleRange(classId, start, end);

  const view = useMemo(() => {
    if (!start || !data) return null;
    const times = Array.from(new Set(data.lessons.map((l) => hhmm(l.hour, l.minute)))).sort();
    const cell = new Map<string, string[]>();
    for (const l of data.lessons) {
      const k = `${l.date}|${hhmm(l.hour, l.minute)}`;
      cell.set(k, [...(cell.get(k) ?? []), lessonName(l)]);
    }
    const days = DAY_KEYS.map((key, i) => ({ key, date: addDaysIso(start, i) })).filter((d, i) =>
      i < 5 || data.lessons.some((l) => l.date === d.date) || closureFor(d.date, data.closures),
    );
    return { times, cell, days };
  }, [start, data]);

  const fmt = (s: string) => `${parseIso(s).getDate()}.${parseIso(s).getMonth() + 1}`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle as="h2" className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" /> {title}
          {start && end && <span className="text-xs font-normal text-muted-foreground">{fmt(start)}–{fmt(end)}</span>}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="השבוע הקודם" disabled={!start} onClick={() => start && setStart(addDaysIso(start, -7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setStart(weekStartIso(isoDate(new Date())))}>השבוע</Button>
          <Button variant="ghost" size="icon" aria-label="השבוע הבא" disabled={!start} onClick={() => start && setStart(addDaysIso(start, 7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
        {error && <p className="text-sm text-destructive" role="alert">טעינת המערכת נכשלה.</p>}
        {view && view.times.length === 0 && !isLoading && (
          <p className="text-sm text-muted-foreground">
            אין שיעורים במערכת בשבוע הזה.{" "}
            <Link to="/weekly-schedule/$classId" params={{ classId }} className="underline">לעריכת המערכת</Link>
          </p>
        )}
        {view && view.times.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-separate border-spacing-0 text-sm">
              <caption className="sr-only">מערכת השעות של השבוע</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-14 border-b p-1 text-start text-xs font-medium text-muted-foreground">שעה</th>
                  {view.days.map((d) => {
                    const c = data ? closureFor(d.date, data.closures) : null;
                    return (
                      <th key={d.key} scope="col" className="border-b border-s p-1 text-center text-xs font-semibold">
                        <div>{DAY_LABEL[d.key]} <span className="font-normal text-muted-foreground">{fmt(d.date)}</span></div>
                        {c && <div className="text-[10px] font-normal text-amber-700 dark:text-amber-400">{closureText(c)}</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {view.times.map((t) => (
                  <tr key={t}>
                    <th scope="row" className="border-b p-1 text-start font-mono text-xs font-medium text-muted-foreground">{t}</th>
                    {view.days.map((d) => {
                      const c = data ? closureFor(d.date, data.closures) : null;
                      const names = view.cell.get(`${d.date}|${t}`) ?? [];
                      return (
                        <td key={d.key} className={`border-b border-s p-1 text-center text-xs ${c ? "bg-muted/60 text-muted-foreground" : ""}`}>
                          {names.join(" · ") || (c ? "" : "—")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 text-end">
          <Link to="/weekly-schedule/$classId" params={{ classId }} className="text-xs text-muted-foreground underline">עריכת המערכת</Link>
        </div>
      </CardContent>
    </Card>
  );
}
