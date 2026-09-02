import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, ChevronLeft, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  elapsedSince,
  hebrewDayInfo,
  isoOf,
  parseHebrewDateInput,
  shiftHebrew,
} from "@/lib/hebrew-calendar";
import { toHebrewDateFull } from "@/lib/hebrew-date";

/**
 * פאנל הלוח העברי — תאריך היום, פרשת השבוע, מספר השבוע והחודש העברי.
 * מתעדכן מעצמו כל דקה, כך שכל שינוי בתאריך העברי מוצג מיד בכל מקום.
 * במצב `editable` אפשר להזין תאריך עברי ידנית (או לועזי) ולראות
 * את תאריך-החלוף — כמה ימים ושבועות חלפו בפועל מול היום.
 */
export function HebrewDatePanel({
  className,
  editable = false,
  onDateChange,
}: {
  className?: string;
  editable?: boolean;
  onDateChange?: (date: Date) => void;
}) {
  const { date: active, now, isCustom, info, setDate, reset } = useHebrewAnchor();
  const [hebrewInput, setHebrewInput] = useState("");
  const [error, setError] = useState("");

  const elapsed = useMemo(() => elapsedSince(active, now), [active, now]);

  const apply = (d: Date) => {
    setDate(d);
    setError("");
    setHebrewInput("");
    onDateChange?.(d);
  };


  const submitHebrew = () => {
    const res = parseHebrewDateInput(hebrewInput);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    apply(res.date);
  };

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
    { label: "תאריך-החלוף", value: elapsed.label },
    { label: "תאריך לועזי", value: info.iso },
  ];

  return (
    <Card dir="rtl" className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-base">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
          הלוח העברי
          {selected && <Badge variant="outline">תאריך נבחר</Badge>}
          {info.parasha && <Badge variant="secondary">{info.parasha}</Badge>}
          {info.isRoshChodesh && <Badge className="bg-accent text-accent-foreground">ראש חודש</Badge>}
          {info.isShabbat && <Badge variant="outline">שבת</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editable && (
          <div className="mb-4 space-y-3 rounded-lg border border-dashed p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <Label htmlFor="hebrew-date-input">הזנת תאריך עברי</Label>
                <Input
                  id="hebrew-date-input"
                  value={hebrewInput}
                  placeholder="למשל: כ״א אלול תשפ״ו"
                  onChange={(e) => {
                    setHebrewInput(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitHebrew();
                  }}
                />
              </div>
              <Button type="button" onClick={submitHebrew}>המר</Button>
              <div className="min-w-[160px]">
                <Label htmlFor="greg-date-input">תאריך לועזי</Label>
                <Input
                  id="greg-date-input"
                  type="date"
                  value={info.iso}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    apply(new Date(`${v}T00:00:00`));
                  }}
                />
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { unit: "day", amount: -1, label: "יום קודם", icon: ChevronRight },
                  { unit: "day", amount: 1, label: "יום הבא", icon: ChevronLeft },
                  { unit: "week", amount: -1, label: "שבוע קודם", icon: ChevronRight },
                  { unit: "week", amount: 1, label: "שבוע הבא", icon: ChevronLeft },
                  { unit: "month", amount: -1, label: "חודש קודם", icon: ChevronRight },
                  { unit: "month", amount: 1, label: "חודש הבא", icon: ChevronLeft },
                ] as const
              ).map((b) => (
                <Button
                  key={`${b.unit}${b.amount}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => apply(shiftHebrew(active, b.unit, b.amount))}
                >
                  <b.icon className="h-3.5 w-3.5" aria-hidden />
                  {b.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelected(null);
                  setHebrewInput("");
                  setError("");
                  onDateChange?.(new Date());
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                חזרה להיום ({isoOf(now)})
              </Button>
            </div>
          </div>
        )}

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
