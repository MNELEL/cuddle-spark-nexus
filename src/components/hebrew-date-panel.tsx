import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { hebrewDayInfo } from "@/lib/hebrew-calendar";
import { toHebrewDateFull } from "@/lib/hebrew-date";

/**
 * פאנל הלוח העברי — תאריך היום, פרשת השבוע, מספר השבוע והחודש העברי.
 * מתעדכן מעצמו כל דקה, כך שכל שינוי בתאריך העברי מוצג מיד בכל מקום.
 */
export function HebrewDatePanel({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const info = useMemo(() => hebrewDayInfo(now), [now]);

  const rows: { label: string; value: string }[] = [
    { label: "תאריך עברי", value: info.full },
    { label: "יום בשבוע", value: info.weekday },
    { label: "חודש עברי", value: info.month },
    { label: "שבוע בחודש", value: `שבוע ${info.weekOfMonth}` },
    { label: "שבוע בשנה", value: `שבוע ${info.weekOfYear}` },
    {
      label: "טווח השבוע",
      value: `${toHebrewDateFull(info.weekRange.from) ?? ""} – ${toHebrewDateFull(info.weekRange.to) ?? ""}`,
    },
    {
      label: "טווח החודש",
      value: `${toHebrewDateFull(info.monthRange.from) ?? ""} – ${toHebrewDateFull(info.monthRange.to) ?? ""}`,
    },
    { label: "תאריך לועזי", value: info.iso },
  ];

  return (
    <Card dir="rtl" className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-base">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
          הלוח העברי
          {info.parasha && <Badge variant="secondary">{info.parasha}</Badge>}
          {info.isRoshChodesh && <Badge className="bg-accent text-accent-foreground">ראש חודש</Badge>}
          {info.isShabbat && <Badge variant="outline">שבת</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-2 border-b border-dashed py-1">
              <dt className="text-xs text-muted-foreground">{r.label}</dt>
              <dd className="text-sm font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
        {info.holidays.length > 0 && (
          <p className="mt-3 flex flex-wrap gap-1.5">
            {info.holidays.map((h) => (
              <Badge key={h} variant="outline">{h}</Badge>
            ))}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
