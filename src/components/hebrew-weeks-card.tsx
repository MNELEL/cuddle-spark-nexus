import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { elapsedSince, hebrewDayInfo, hebrewMonthWeeks, isoOf } from "@/lib/hebrew-calendar";

/**
 * שבועות החודש העברי של התאריך הפעיל, עם פרשת השבוע ותאריך-החלוף לכל שבוע —
 * להערכת תאריכי חזרה לפני שמעדכנים את הלוח.
 */
export function HebrewWeeksCard({ date, className }: { date: Date; className?: string }) {
  const weeks = useMemo(() => hebrewMonthWeeks(date), [date]);
  const info = useMemo(() => hebrewDayInfo(date), [date]);
  const todayIso = isoOf(new Date());

  return (
    <Card dir="rtl" className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base">שבועות חודש {info.month}</CardTitle>
        <CardDescription>
          כל שבוע (ראשון–שבת) עם טווח התאריכים העבריים, פרשת השבוע ותאריך-החלוף.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {weeks.map((w) => {
          const isCurrent = todayIso >= w.from && todayIso <= w.to;
          return (
            <div
              key={w.from}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5 ${
                isCurrent ? "border-primary bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge variant={isCurrent ? "default" : "secondary"}>שבוע {w.index}</Badge>
                <span className="text-sm font-medium">{w.label}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {w.parasha && <Badge variant="outline">{w.parasha}</Badge>}
                <span>{elapsedSince(w.from).label}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
