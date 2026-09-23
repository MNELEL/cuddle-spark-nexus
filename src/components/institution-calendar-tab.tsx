/**
 * טאב "לוח שנה" בפאנל המוסד: כל האירועים במוסד — חופשות וסגירות, ימי הלימוד
 * המוגדרים, חגי הלוח העברי ותאריך-החלוף של התלמידים בכל כיתה. מנהל מערכת יכול
 * לקבוע חופשה מוסדית (תאריך–תאריך + תיאור) ולעדכן איתה את תאריך-החלוף.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Check, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { HebrewDateInput } from "@/components/hebrew-date-input";
import { hebrewDate } from "@/lib/hebrew-date";
import { holidaysInRange, isoDate } from "@/lib/parasha";
import { ALL_DAYS, OVERRIDE_LABEL } from "@/components/schedule/schedule-context";
import {
  getInstitutionCalendar,
  setInstitutionBreak,
  deleteInstitutionBreak,
  approveClassRemainder,
  type InstitutionCalendar,
} from "@/lib/institution-calendar.functions";

function todayIso() {
  return isoDate(new Date());
}

export function InstitutionCalendarTab() {
  const fetchCalendar = useServerFn(getInstitutionCalendar);
  const runSet = useServerFn(setInstitutionBreak);
  const runDelete = useServerFn(deleteInstitutionBreak);
  const qc = useQueryClient();

  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [label, setLabel] = useState("");
  const [rolloverDate, setRolloverDate] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const q = useQuery({
    queryKey: ["institution-calendar"],
    queryFn: () => fetchCalendar() as Promise<InstitutionCalendar>,
  });
  const cal = q.data;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["institution-calendar"] });
    void qc.invalidateQueries({ queryKey: ["calendar-overrides"] });
    void qc.invalidateQueries({ queryKey: ["daily-log-report"] });
  };

  const saveM = useMutation({
    mutationFn: () =>
      runSet({
        data: {
          startDate: from,
          endDate: to,
          label: label.trim(),
          type: "institution_break" as const,
          ...(picked.length ? { classIds: picked } : {}),
          ...(rolloverDate ? { rolloverDate } : {}),
        },
      }),
    onSuccess: (r) => {
      invalidate();
      setLabel("");
      toast.success(
        `החופשה נרשמה ל-${r.classes} כיתות` +
          (r.rolloverStudents ? ` · תאריך-החלוף עודכן ל-${r.rolloverStudents} תלמידים` : ""),
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שמירת החופשה נכשלה"),
  });

  const delM = useMutation({
    mutationFn: (id: string) => runDelete({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("החופשה נמחקה");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקת החופשה נכשלה"),
  });

  const holidays = useMemo(() => {
    const start = todayIso();
    const end = isoDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 120));
    return holidaysInRange(start, end);
  }, []);

  if (q.isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (q.isError)
    return <p className="py-8 text-center text-sm text-destructive">טעינת לוח המוסד נכשלה.</p>;
  if (!cal) return null;

  return (
    <div className="space-y-6" dir="rtl">
      {cal.canEdit && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
              חופשה מוסדית
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <HebrewDateInput label="מתאריך" value={from} onChange={setFrom} compact />
              <HebrewDateInput label="עד תאריך" value={to} onChange={setTo} compact />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="break-label">תיאור החופשה</Label>
              <Input
                id="break-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="למשל: בין הזמנים ניסן"
              />
            </div>
            <HebrewDateInput
              label="תאריך-החלוף לתלמידים שמעבירים שנה (אופציונלי)"
              value={rolloverDate}
              onChange={setRolloverDate}
              compact
              clearable
            />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                כיתות (ריק = כל הכיתות הפעילות במוסד)
              </p>
              <div className="flex flex-wrap gap-3">
                {cal.classes
                  .filter((c) => c.status === "active")
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={picked.includes(c.id)}
                        onCheckedChange={(v) =>
                          setPicked((p) => (v ? [...p, c.id] : p.filter((x) => x !== c.id)))
                        }
                        aria-label={`בחירת כיתה ${c.name}`}
                      />
                      {c.name}
                    </label>
                  ))}
              </div>
            </div>
            <Button
              className="rounded-xl"
              disabled={saveM.isPending || label.trim().length < 2}
              onClick={() => saveM.mutate()}
            >
              {saveM.isPending && (
                <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              רשום חופשה בלוח המוסד
            </Button>
            <p className="text-xs text-muted-foreground">
              החופשה נכנסת מיד ללוח השנה של הכיתות, למערכת השעות, לחישוב ההספק ולדוח התיעוד היומי.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">לוח השנה של המוסד</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {cal.classes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">אין כיתות במוסד.</p>
          ) : (
            <ul className="space-y-4">
              {cal.classes.map((c) => (
                <li key={c.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.name}</span>
                    {c.academicYear && <Badge variant="outline">{c.academicYear}</Badge>}
                    {c.carriedOver && <Badge variant="secondary">עברה שנה</Badge>}
                    {c.status !== "active" && <Badge variant="outline">בארכיון</Badge>}
                    <Badge variant="outline" className="font-mono-tabular">
                      {c.studentCount} תלמידים
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    ימי לימוד:{" "}
                    {ALL_DAYS.filter((d) => c.activeDays.includes(d.key))
                      .map((d) => d.label)
                      .join(", ") || "לא הוגדרו"}
                    {c.yearStart && c.yearEnd
                      ? ` · שנה: ${hebrewDate(c.yearStart)} – ${hebrewDate(c.yearEnd)}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    תאריך-החלוף:{" "}
                    {c.rolloverDates.length === 0
                      ? "לא הוגדר"
                      : c.rolloverDates
                          .map((r) => `${hebrewDate(r.date)} (${r.students})`)
                          .join(" · ")}
                  </p>
                  {c.breaks.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {c.breaks.map((b) => (
                        <li
                          key={b.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-2 py-1 text-xs"
                        >
                          <span>
                            <Badge variant="secondary" className="me-2">
                              {OVERRIDE_LABEL[b.type] ?? b.type}
                            </Badge>
                            {hebrewDate(b.startDate)}
                            {b.endDate !== b.startDate ? ` – ${hebrewDate(b.endDate)}` : ""}
                            {b.label ? ` · ${b.label}` : ""}
                          </span>
                          {cal.canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-lg"
                              aria-label="מחיקת חופשה"
                              disabled={delM.isPending}
                              onClick={() => delM.mutate(b.id)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">חגים וימי חופשה בלוח העברי (120 הימים הקרובים)</CardTitle>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין חגים בטווח.</p>
          ) : (
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {holidays.map((h) => (
                <li key={`${h.date}-${h.title}`} className="flex items-center gap-2">
                  <Badge variant={h.noSchool ? "secondary" : "outline"}>
                    {h.noSchool ? "ללא לימודים" : "יום לימודים"}
                  </Badge>
                  <span>
                    {hebrewDate(h.date)} · {h.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
