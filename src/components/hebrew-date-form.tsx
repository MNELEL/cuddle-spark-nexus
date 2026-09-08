import { useMemo, useRef, useState } from "react";
import { CalendarCheck, FileSpreadsheet, HelpCircle, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useHebrewAnchor } from "@/components/hebrew-anchor";
import {
  elapsedSince,
  hebrewDayInfo,
  isoOf,
  parseHebrewDateInput,
} from "@/lib/hebrew-calendar";
import { readCalendarRowsFromWorkbook, type CalendarFileRow } from "@/lib/calendar-file-import";

/**
 * טופס נוח לניהול הלוח העברי בעצמך:
 * שדה אחד לתאריך היום (מה שכל המערכת מציגה), שדה שני לתאריך-החלוף
 * (מאיזה יום למדוד — ידנית או מתוך קובץ Excel של הכיתה),
 * והסבר קצר על אופן עבודת הלוח העברי.
 */
export function HebrewDateForm({ className }: { className?: string }) {
  const { date: active, now, isCustom, info, setDate, reset } = useHebrewAnchor();
  const [todayInput, setTodayInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [error, setError] = useState("");
  const [fileRows, setFileRows] = useState<CalendarFileRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadFile = async (file: File) => {
    setFileError("");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const rows = readCalendarRowsFromWorkbook(wb);
      if (rows.length === 0) {
        setFileRows([]);
        setFileError("לא נמצאו שורות עם שם ותאריך בקובץ.");
        return;
      }
      setFileRows(rows);
      setFileName(file.name);
    } catch {
      setFileRows([]);
      setFileError("קריאת הקובץ נכשלה. ודא שזה קובץ Excel תקין.");
    }
  };

  const resolve = (raw: string): { date: Date } | { error: string } => {
    const t = raw.trim();
    if (!t) return { error: "הזן תאריך" };
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) return { date: new Date(`${t}T00:00:00`) };
    const parsed = parseHebrewDateInput(t);
    return parsed.ok ? { date: parsed.date } : { error: parsed.error };
  };

  const applyToday = () => {
    const res = resolve(todayInput);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setError("");
    setTodayInput("");
    setDate(res.date);
  };

  const fromResult = useMemo(() => {
    const t = fromInput.trim();
    if (!t) return null;
    const res = resolve(t);
    if ("error" in res) return { error: res.error };
    const span = elapsedSince(res.date, active);
    const fromInfo = hebrewDayInfo(res.date);
    return {
      fromInfo,
      text:
        `${Math.abs(span.days)} ימים · ${span.weeks} שבועות ו-${span.restDays} ימים · ` +
        `${span.hebrewMonths} חודשים עבריים`,
      label: span.label,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromInput, active]);

  return (
    <Card dir="rtl" className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-base">
          <CalendarCheck className="h-5 w-5 text-primary" aria-hidden />
          ניהול הלוח העברי
          {isCustom ? <Badge>תאריך ידני</Badge> : <Badge variant="secondary">לוח אמיתי</Badge>}
        </CardTitle>
        <CardDescription>
          כאן קובעים איזה יום עברי המערכת מציגה, ומאיזה יום למדוד את תאריך-החלוף.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="form-today">תאריך היום</Label>
            <div className="flex gap-2">
              <Input
                id="form-today"
                value={todayInput}
                placeholder={info.full}
                onChange={(e) => {
                  setTodayInput(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyToday();
                }}
              />
              <Button type="button" onClick={applyToday} disabled={!todayInput.trim()}>
                קבע
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              כרגע: {info.full} ({info.iso}) · {info.weekday}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="form-elapsed">תאריך-החלוף (מאיזה יום למדוד)</Label>
            <Input
              id="form-elapsed"
              value={fromInput}
              placeholder="למשל: א׳ תשרי תשפ״ו"
              onChange={(e) => setFromInput(e.target.value)}
            />
            {fromResult && "error" in fromResult && (
              <p className="text-xs text-destructive">{fromResult.error}</p>
            )}
            {fromResult && !("error" in fromResult) && (
              <p className="text-xs text-muted-foreground">
                מ־{fromResult.fromInfo.full} עד {info.full}: {fromResult.text} ({fromResult.label})
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="בחירת תאריך לועזי ליום הפעיל"
            className="w-auto"
            value={info.iso}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              setError("");
              setDate(new Date(`${v}T00:00:00`));
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              setTodayInput("");
              setError("");
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            חזרה ליום האמיתי ({isoOf(now)})
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
            <HelpCircle className="h-4 w-4 text-primary" aria-hidden />
            בקצרה על הלוח העברי
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>היום העברי מתחלף בשקיעה; במערכת נספר יום שלם לפי התאריך הלועזי המקביל.</li>
            <li>השבוע מתחיל ביום ראשון ומסתיים בשבת, ולכן שישי ושבת מסומנים אוטומטית.</li>
            <li>בשנה 12 חודשים, ובשנה מעוברת 13 — אדר א׳ ואדר ב׳. החישוב נעשה לבד.</li>
            <li>אורך חודש הוא 29 או 30 יום, ולכן ראש חודש מזוהה אוטומטית לפי הלוח.</li>
            <li>
              תאריך-החלוף הוא כמה ימים, שבועות וחודשים עבריים חלפו בין שני תאריכים — שימושי
              לחישוב זמן שעבר מתחילת הזמן או מאירוע.
            </li>
            <li>אם לא נקבע דבר, המערכת מציגה תמיד את היום העברי האמיתי ומתקדמת מעצמה.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
