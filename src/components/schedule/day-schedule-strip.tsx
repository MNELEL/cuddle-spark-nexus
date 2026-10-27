import { Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useScheduleRange } from "@/hooks/use-class-schedule";
import { closureFor, closureText, hhmm, lessonName } from "@/lib/schedule-view";

/** שורה קצרה: מה במערכת ביום הזה, או שאין לימודים. מאותו מקור כמו כל המסכים. */
export function DayScheduleStrip({ classId, date }: { classId: string; date: string }) {
  const { data, isLoading } = useScheduleRange(classId, date, date);
  if (isLoading || !data) return null;
  const closure = closureFor(date, data.closures);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm" role="status" aria-label="מערכת היום">
      <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
      {closure && (
        <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          אין לימודים: {closureText(closure)}
        </span>
      )}
      {data.lessons.length === 0 && !closure && (
        <span className="text-xs text-muted-foreground">
          אין שיעורים במערכת ליום הזה.{" "}
          <Link to="/weekly-schedule/$classId" params={{ classId }} className="underline">לעריכת המערכת</Link>
        </span>
      )}
      {data.lessons.map((l) => (
        <span key={l.id} className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs">
          <span className="font-mono text-muted-foreground">{hhmm(l.hour, l.minute)}</span> {lessonName(l)}
        </span>
      ))}
    </div>
  );
}
