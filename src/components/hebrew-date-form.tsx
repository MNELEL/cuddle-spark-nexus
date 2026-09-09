import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarCheck, FileSpreadsheet, HelpCircle, Loader2, RotateCcw, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHebrewAnchor } from "@/components/hebrew-anchor";
import {
  elapsedSince,
  hebrewDayInfo,
  isoOf,
  parseHebrewDateInput,
} from "@/lib/hebrew-calendar";
import {
  readCalendarRows,
  readDailyLogRows,
  type CalendarFileRow,
  type DailyLogFileRow,
} from "@/lib/calendar-file-import";
import { listClasses } from "@/lib/classes.functions";
import { importDailyLogRows } from "@/lib/daily-log-import.functions";


/**
 * טופס נוח לניהול הלוח העברי בעצמך:
 * שדה אחד לתאריך היום (מה שכל המערכת מציגה), שדה שני לתאריך-החלוף
 * (מאיזה יום למדוד — ידנית או מתוך קובץ Excel של הכיתה),
 * והסבר קצר על אופן עבודת הלוח העברי.
 */
export function HebrewDateForm({ className }: { className?: string }) {
  const {
    date: active, now, isCustom, info, setDate, reset,
    elapsedFrom, elapsedFromInfo, isElapsedCustom, elapsed, setElapsedFrom, resetElapsedFrom,
  } = useHebrewAnchor();
  const [todayInput, setTodayInput] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [error, setError] = useState("");
  const [fileRows, setFileRows] = useState<CalendarFileRow[]>([]);
  const [logRows, setLogRows] = useState<DailyLogFileRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [importClassId, setImportClassId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();
  const listCls = useServerFn(listClasses);
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => listCls() });
  const importLogs = useServerFn(importDailyLogRows);
  const importMut = useMutation({
    mutationFn: () => importLogs({ data: { classId: importClassId, rows: logRows } }),
    onSuccess: (res) => {
      toast.success(
        `נוסף תיעוד ל-${res.imported} תלמידים · נוכחות ${res.attendance} · ציונים ${res.grades} · תיעוד ${res.notes}` +
          (res.unmatched.length ? ` · ${res.unmatched.length} שמות לא זוהו` : ""),
      );
      for (const key of ["daily-briefing", "manual-insights", "daily-log-report", "class-anchor-summary"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הייבוא נכשל"),
  });

  const loadFile = async (file: File) => {
    setFileError("");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheetName = wb.SheetNames[0];
      const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
      const raw = sheet
        ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
        : [];
      const rows = readCalendarRows(raw);
      // מאותו קובץ נקראות גם שורות תיעוד יומי (נוכחות, ציון והערה) לפי היום הפעיל.
      const logs = readDailyLogRows(raw, info.iso);
      setLogRows(logs);
      if (rows.length === 0 && logs.length === 0) {
        setFileRows([]);
        setFileError("לא נמצאו שורות עם שם ותאריך או תיעוד בקובץ.");
        return;
      }
      setFileRows(rows);
      setFileName(file.name);
    } catch {
      setFileRows([]);
      setLogRows([]);
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

  const applyElapsed = () => {
    const res = resolve(fromInput);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setError("");
    setElapsedFrom(res.date);
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
            <div className="flex gap-2">
              <Input
                id="form-elapsed"
                value={fromInput}
                placeholder={elapsedFromInfo.full}
                onChange={(e) => setFromInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyElapsed();
                }}
              />
              <Button type="button" variant="outline" onClick={applyElapsed} disabled={!fromInput.trim()}>
                קבע
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isElapsedCustom ? "הוזן ידנית" : "מתעדכן לבד מהלוח האמיתי (תחילת שנת הלימודים)"}: {elapsedFromInfo.full} —
              {" "}מאז עברו {elapsed.label}.
              {isElapsedCustom && (
                <Button type="button" variant="link" size="sm" className="h-auto p-0 ps-1 text-xs"
                  onClick={() => { setFromInput(""); resetElapsedFrom(); }}>
                  חזור ללוח האמיתי
                </Button>
              )}
            </p>
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

        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              טען תאריכים מקובץ Excel
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              aria-label="קובץ Excel עם תאריכי הכיתה"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFile(f);
                e.target.value = "";
              }}
            />
            {fileName && <Badge variant="secondary">{fileName}</Badge>}
            {fileRows.length > 0 && <Badge variant="outline">{fileRows.length} שורות</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            במקום להקליד — בחר שורה מהקובץ, והתאריך שבה ייכנס כתאריך-החלוף (או כתאריך היום).
            נקראות עמודות שם, תאריך תחילת לימוד ותאריך לידה, בעברית או בלועזי.
          </p>
          {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          {fileRows.length > 0 && (
            <ul className="max-h-52 space-y-1 overflow-auto text-xs">
              {fileRows.map((r, i) => {
                const iso = r.start_date ?? r.birth_date!;
                const label = hebrewDayInfo(new Date(`${iso}T00:00:00`)).full;
                return (
                  <li
                    key={`${r.name}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 border-t pt-1"
                  >
                    <span>
                      <span className="font-medium text-foreground">{r.name}</span> · {label} ({iso})
                      {r.start_date ? "" : " · תאריך לידה"}
                    </span>
                    <span className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setFromInput(iso)}>
                        כתאריך-החלוף
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setError("");
                          setDate(new Date(`${iso}T00:00:00`));
                        }}
                      >
                        כיום הפעיל
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {logRows.length > 0 && (
            <div className="space-y-2 rounded-md border border-dashed p-2">
              <p className="text-xs font-medium text-foreground">
                בקובץ יש גם תיעוד יומי — {logRows.length} שורות (נוכחות, ציון והערה).
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={importClassId} onValueChange={setImportClassId}>
                  <SelectTrigger className="h-8 w-44 text-xs" aria-label="כיתה לייבוא התיעוד">
                    <SelectValue placeholder="בחר כיתה" />
                  </SelectTrigger>
                  <SelectContent>
                    {(classes as { id: string; name: string }[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  disabled={!importClassId || importMut.isPending}
                  onClick={() => importMut.mutate()}
                >
                  {importMut.isPending ? (
                    <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Upload className="ms-1 h-4 w-4" aria-hidden />
                  )}
                  ייבא תיעוד יומי לכיתה
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ההתאמה לתלמידים לפי השם. שורה בלי תאריך תיעוד תיכנס ליום הפעיל ({info.iso}).
              </p>
              <ul className="max-h-40 space-y-1 overflow-auto text-xs">
                {logRows.slice(0, 12).map((r, i) => (
                  <li key={`${r.name}-log-${i}`} className="border-t pt-1">
                    <span className="font-medium text-foreground">{r.name}</span> ·{" "}
                    {hebrewDayInfo(new Date(`${r.date}T00:00:00`)).full}
                    {r.status ? ` · נוכחות: ${r.status}` : ""}
                    {r.grade !== null ? ` · ציון ${r.grade}` : ""}
                    {r.note ? ` · ${r.note.slice(0, 40)}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

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
