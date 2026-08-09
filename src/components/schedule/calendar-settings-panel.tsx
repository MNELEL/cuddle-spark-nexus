import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarPlus, Printer, Save, Trash2, Wand2 } from "lucide-react";
import {
  applyTemplateToWeeks, deleteCalendarOverride, deleteTemplateSlot, listTemplateSlots,
  saveScheduleSettings, upsertCalendarOverrides, upsertTemplateSlot,
  type CalendarOverride, type TemplateSlot,
} from "@/lib/schedule-planning.functions";
import { ALL_DAYS, OVERRIDE_LABEL } from "@/components/schedule/schedule-context";
import type { useScheduleYear } from "@/components/schedule/use-schedule-year";
import { printHtmlTable } from "@/lib/print-schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WeeklyDayKey } from "@/lib/weekly-schedule.functions";

type Year = ReturnType<typeof useScheduleYear>;

export function CalendarSettingsPanel({ classId, year }: { classId: string; year: Year }) {
  const qc = useQueryClient();
  const saveSettingsFn = useServerFn(saveScheduleSettings);
  const upsertOverridesFn = useServerFn(upsertCalendarOverrides);
  const delOverrideFn = useServerFn(deleteCalendarOverride);
  const templateFn = useServerFn(listTemplateSlots);
  const upsertSlotFn = useServerFn(upsertTemplateSlot);
  const delSlotFn = useServerFn(deleteTemplateSlot);
  const applyFn = useServerFn(applyTemplateToWeeks);

  const { data: slots = [] } = useQuery({
    queryKey: ["template-slots", classId],
    queryFn: () => templateFn({ data: { classId } }),
  });

  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "שגיאה");
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["schedule-settings", classId] });
    qc.invalidateQueries({ queryKey: ["calendar-overrides", classId] });
    qc.invalidateQueries({ queryKey: ["template-slots", classId] });
    qc.invalidateQueries({ queryKey: ["weekly-lessons", classId] });
  };

  const settingsM = useMutation({ mutationFn: saveSettingsFn, onSuccess: () => { invalidateAll(); toast.success("ההגדרות נשמרו"); }, onError });
  const overridesM = useMutation({
    mutationFn: upsertOverridesFn,
    onSuccess: (r) => { invalidateAll(); setSelectedHolidays(new Set()); toast.success(`נוספו ${r.inserted} ימים ללוח`); },
    onError,
  });
  const delOverrideM = useMutation({ mutationFn: delOverrideFn, onSuccess: invalidateAll, onError });
  const slotM = useMutation({ mutationFn: upsertSlotFn, onSuccess: () => { invalidateAll(); setSlotTitle(""); toast.success("נוסף למערכת הקבועה"); }, onError });
  const delSlotM = useMutation({ mutationFn: delSlotFn, onSuccess: invalidateAll, onError });
  const applyM = useMutation({
    mutationFn: applyFn,
    onSuccess: (r) => { invalidateAll(); toast.success(`הוחלו ${r.inserted} שיעורים על השנה`); },
    onError,
  });

  // ---- settings form state
  const s = year.settings;
  const [startHour, setStartHour] = useState(String(s?.start_hour ?? 7));
  const [endHour, setEndHour] = useState(String(s?.end_hour ?? 16));
  const [days, setDays] = useState<Set<string>>(new Set(s?.active_days ?? ["sun", "mon", "tue", "wed", "thu", "fri"]));
  const [yearStart, setYearStart] = useState(s?.year_start_date ?? "");
  const [yearEnd, setYearEnd] = useState(s?.year_end_date ?? "");

  // ---- holiday multi-select
  const [selectedHolidays, setSelectedHolidays] = useState<Set<string>>(new Set());
  const holidayCandidates = useMemo(() => year.holidays.filter((h) => h.noSchool), [year.holidays]);

  // ---- template form
  const [slotDay, setSlotDay] = useState<WeeklyDayKey>("sun");
  const [slotHour, setSlotHour] = useState("8");
  const [slotTitle, setSlotTitle] = useState("");
  const [slotSubject, setSlotSubject] = useState("");

  // ---- manual break
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [breakType, setBreakType] = useState("institution_break");
  const [breakLabel, setBreakLabel] = useState("");

  const hourOptions = Array.from({ length: 17 }, (_, i) => 6 + i);
  const slotList = slots as TemplateSlot[];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">הגדרות לוח הכיתה</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label className="text-xs">שעת פתיחה</Label>
              <Input type="number" min={6} max={22} value={startHour} onChange={(e) => setStartHour(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">שעת סיום</Label>
              <Input type="number" min={7} max={23} value={endHour} onChange={(e) => setEndHour(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">תחילת שנה</Label>
              <Input type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">סוף שנה</Label>
              <Input type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">ימי לימוד</Label>
            <div className="mt-1.5 flex flex-wrap gap-3">
              {ALL_DAYS.map((d) => (
                <label key={d.key} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={days.has(d.key)}
                    onCheckedChange={(c) =>
                      setDays((prev) => {
                        const next = new Set(prev);
                        if (c) next.add(d.key); else next.delete(d.key);
                        return next;
                      })
                    }
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
          <Button
            onClick={() =>
              settingsM.mutate({
                data: {
                  classId,
                  startHour: Number(startHour) || 7,
                  endHour: Number(endHour) || 16,
                  activeDays: Array.from(days) as WeeklyDayKey[],
                  yearStartDate: yearStart || null,
                  yearEndDate: yearEnd || null,
                },
              })
            }
          >
            <Save className="ms-1 h-4 w-4" /> שמור הגדרות
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">חופשות וימים מיוחדים</CardTitle>
          <Button
            variant="outline" size="sm"
            onClick={() =>
              printHtmlTable({
                title: "לוח חופשות השנה",
                head: ["מתאריך", "עד תאריך", "סוג", "תיאור"],
                rows: year.overrides.map((o) => [o.start_date, o.end_date, OVERRIDE_LABEL[o.type] ?? o.type, o.label ?? "—"]),
              })
            }
          >
            <Printer className="ms-1 h-4 w-4" /> הדפסה
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              סנכרון מלוח השנה העברי — סמנו את החגים שבהם אין לימודים והוסיפו אותם ללוח בלחיצה אחת.
            </p>
            <div className="max-h-56 overflow-y-auto rounded-xl border p-2">
              <div className="grid gap-1 sm:grid-cols-2">
                {holidayCandidates.map((h) => (
                  <label key={h.date} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs hover:bg-accent/40">
                    <Checkbox
                      checked={selectedHolidays.has(h.date)}
                      onCheckedChange={(c) =>
                        setSelectedHolidays((prev) => {
                          const next = new Set(prev);
                          if (c) next.add(h.date); else next.delete(h.date);
                          return next;
                        })
                      }
                    />
                    <span className="font-medium">{h.title}</span>
                    <span className="text-muted-foreground">{h.date}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!selectedHolidays.size || overridesM.isPending}
                onClick={() =>
                  overridesM.mutate({
                    data: {
                      classId,
                      items: Array.from(selectedHolidays).map((d) => ({
                        startDate: d, endDate: d, type: "holiday" as const,
                        label: year.holidayByDate.get(d)?.title ?? null,
                      })),
                    },
                  })
                }
              >
                <CalendarPlus className="ms-1 h-4 w-4" /> הוסף {selectedHolidays.size || ""} ימים נבחרים
              </Button>
              <Button
                variant="secondary" size="sm"
                onClick={() => setSelectedHolidays(new Set(holidayCandidates.map((h) => h.date)))}
              >
                בחר את כל החגים
              </Button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_160px_1fr_auto]">
            <div>
              <Label className="text-xs">מתאריך</Label>
              <Input type="date" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">עד תאריך</Label>
              <Input type="date" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">סוג</Label>
              <Select value={breakType} onValueChange={setBreakType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(OVERRIDE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">תיאור</Label>
              <Input value={breakLabel} onChange={(e) => setBreakLabel(e.target.value)} placeholder="בין הזמנים" />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  if (!breakStart || !breakEnd) { toast.error("חובה לבחור תאריכים"); return; }
                  overridesM.mutate({
                    data: {
                      classId,
                      items: [{
                        startDate: breakStart,
                        endDate: breakEnd < breakStart ? breakStart : breakEnd,
                        type: breakType as CalendarOverride["type"] & "institution_break",
                        label: breakLabel || null,
                      }],
                    },
                  });
                }}
              >
                הוסף
              </Button>
            </div>
          </div>

          {year.overrides.length > 0 && (
            <ul className="divide-y rounded-xl border text-sm">
              {year.overrides.map((o) => (
                <li key={o.id} className="flex items-center gap-2 p-2">
                  <Badge variant="secondary">{OVERRIDE_LABEL[o.type] ?? o.type}</Badge>
                  <span className="text-xs text-muted-foreground">{o.start_date} → {o.end_date}</span>
                  <span className="min-w-0 flex-1 truncate">{o.label ?? ""}</span>
                  <Button variant="ghost" size="icon" aria-label="מחק" onClick={() => delOverrideM.mutate({ data: { id: o.id } })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">מערכת קבועה (תבנית שבועית)</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm" disabled={applyM.isPending || !slotList.length}
              onClick={() =>
                applyM.mutate({
                  data: {
                    classId,
                    weekStarts: year.weekStarts.slice(0, 60),
                    skipDates: year.holidays.filter((h) => h.noSchool).map((h) => h.date).slice(0, 400),
                    replace: false,
                  },
                })
              }
            >
              <Wand2 className="ms-1 h-4 w-4" /> החל על כל השנה
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() =>
                printHtmlTable({
                  title: "מערכת קבועה",
                  head: ["שעה", ...ALL_DAYS.map((d) => d.label)],
                  rows: Array.from(new Set(slotList.map((x) => x.hour))).sort((a, b) => a - b).map((h) => [
                    `${String(h).padStart(2, "0")}:00`,
                    ...ALL_DAYS.map((d) =>
                      slotList.filter((x) => x.day_key === d.key && x.hour === h).map((x) => x.title).join("\n") || "—",
                    ),
                  ]),
                })
              }
            >
              <Printer className="ms-1 h-4 w-4" /> הדפסה
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            הזינו את המערכת הקבועה פעם אחת — היא תוחל אוטומטית על כל שבועות השנה, בדילוג על חגים וחופשות,
            וניתן לשנות כל שבוע בנפרד בלוח.
          </p>
          <div className="grid gap-2 sm:grid-cols-[140px_120px_1fr_150px_auto]">
            <div>
              <Label className="text-xs">יום</Label>
              <Select value={slotDay} onValueChange={(v) => setSlotDay(v as WeeklyDayKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_DAYS.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">שעה</Label>
              <Select value={slotHour} onValueChange={setSlotHour}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {hourOptions.map((h) => <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">כותרת</Label>
              <Input value={slotTitle} onChange={(e) => setSlotTitle(e.target.value)} placeholder="גמרא — שיעור ראשון" />
            </div>
            <div>
              <Label className="text-xs">מקצוע</Label>
              <Input value={slotSubject} onChange={(e) => setSlotSubject(e.target.value)} placeholder="גמרא" />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  if (!slotTitle.trim()) { toast.error("חובה להזין כותרת"); return; }
                  slotM.mutate({
                    data: {
                      classId, dayKey: slotDay, hour: Number(slotHour), duration: 1,
                      title: slotTitle.trim(), subject: slotSubject.trim() || null,
                    },
                  });
                }}
              >
                הוסף
              </Button>
            </div>
          </div>

          {slotList.length === 0 ? (
            <p className="text-sm text-muted-foreground">המערכת הקבועה ריקה.</p>
          ) : (
            <ul className="divide-y rounded-xl border text-sm">
              {slotList
                .slice()
                .sort((a, b) => a.hour - b.hour)
                .map((slot) => (
                  <li key={slot.id} className="flex items-center gap-2 p-2">
                    <Badge variant="secondary">
                      {ALL_DAYS.find((d) => d.key === slot.day_key)?.label} · {String(slot.hour).padStart(2, "0")}:00
                    </Badge>
                    <span className="min-w-0 flex-1 truncate">{slot.title}</span>
                    {slot.subject && <span className="text-xs text-muted-foreground">{slot.subject}</span>}
                    <Button variant="ghost" size="icon" aria-label="מחק" onClick={() => delSlotM.mutate({ data: { id: slot.id } })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
