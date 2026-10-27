import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Flag, Minus, Save, Settings2, Trash2, X } from "lucide-react";
import { listStudents } from "@/lib/students.functions";
import {
  addDayBonus, addDayEvent, deleteDayBonus, deleteDayEvent,
  deleteDaySlot, getDayData, moveDaySlot, saveDayAttendance, saveDayRatings, saveDaySlot,
  CRITERION_BEHAVIOR, CRITERION_LISTENING, CRITERION_PRAYER, CRITERION_READINESS, CRITERION_WORK,
  type DayCriterion, type DayData, type DayEventKind, type DaySlot,
} from "@/lib/day-tracking.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StudentFileSheet } from "@/components/student-file-sheet";

type Student = { id: string; name: string };

// דירוג של תלמיד בשעה אחת: מפתח קריטריון ← 1 חלש, 2 בינוני, 3 טוב
type Rating = Record<string, number>;
const ABBR: Record<string, string> = { readiness: "מוכ", listening: "הקש", behavior: "התנ", work_done: "עבו", prayer: "תפי" };
const abbr = (c: DayCriterion) => ABBR[c.key] ?? c.label.slice(0, 3);
const SUGGESTED: DayCriterion[] = [CRITERION_READINESS, CRITERION_LISTENING, CRITERION_BEHAVIOR, CRITERION_WORK, CRITERION_PRAYER];
const LESSON_DEFAULT: DayCriterion[] = [CRITERION_READINESS, CRITERION_LISTENING, CRITERION_BEHAVIOR, CRITERION_WORK];

// הרמה מסומנת גם בצורה ובטקסט, לא רק בצבע.
const LEVEL: Record<number, { text: string; cls: string; Icon: typeof Check }> = {
  3: { text: "טוב", cls: "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200", Icon: Check },
  2: { text: "בינוני", cls: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200", Icon: Minus },
  1: { text: "חלש", cls: "border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200", Icon: X },
};
const nextLevel = (v: number) => (v === 3 ? 2 : v === 2 ? 1 : 3);

const ATT: Record<string, { text: string; cls: string; next: string }> = {
  present: { text: "נוכח", cls: "border-border bg-background", next: "absent" },
  absent: { text: "חסר", cls: "border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200", next: "late" },
  late: { text: "איחר", cls: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200", next: "excused" },
  excused: { text: "מוצדק", cls: "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200", next: "present" },
};

const EVENT_LABEL: Record<DayEventKind, string> = {
  missing_writing: "חסר כלי כתיבה",
  missing_books: "חסרים ספרים",
  exceptional: "אירוע חריג",
};

function toIso(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function fromIso(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
function shiftIso(s: string, n: number) {
  const d = fromIso(s);
  d.setDate(d.getDate() + n);
  return toIso(d);
}
const hebFmt = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const gregFmt = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric", year: "numeric" });

/**
 * הדשבורד היומי: טבלה אחת לכל הכיתה, עם נוכחות וכל שעות היום יחד.
 * לכל שעה קריטריונים משלה (אפשר להוסיף ולמחוק). לחיצה על משבצת מחליפה בין טוב, בינוני וחלש.
 * הנוכחות נשמרת באותה טבלת `attendance` שבה משתמשים שאר המסכים.
 */
export function DayTrackingPanel({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const listS = useServerFn(listStudents);
  const dayFn = useServerFn(getDayData);
  const saveRatingsFn = useServerFn(saveDayRatings);
  const saveAttFn = useServerFn(saveDayAttendance);

  // התאריך נקבע אחרי הטעינה, כדי שהשרת והדפדפן לא יחלקו על היום הנוכחי.
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => { setDate(toIso(new Date())); }, []);

  const { data: students = [] } = useQuery({
    queryKey: ["students", classId],
    queryFn: () => listS({ data: { classId } }),
  }) as { data: Student[] };
  const { data: day, isLoading: dayLoading } = useQuery({
    queryKey: ["day", classId, date],
    enabled: !!date,
    queryFn: () => dayFn({ data: { classId, date: date! } }),
  }) as { data: DayData | undefined; isLoading: boolean };

  const [draft, setDraft] = useState<Record<string, Rating>>({});
  const [touched, setTouched] = useState<string[]>([]);
  const [attDraft, setAttDraft] = useState<Record<string, string>>({});
  const [eventFor, setEventFor] = useState<Student | null>(null);
  const [fileFor, setFileFor] = useState<Student | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => { setDraft({}); setTouched([]); setAttDraft({}); }, [date]);

  const ratedSlots = useMemo(
    () => (day?.slots ?? []).filter((s) => s.rated && s.criteria.length > 0),
    [day],
  );
  const saved = useMemo(() => {
    const m = new Map<string, Rating>();
    for (const r of day?.ratings ?? []) m.set(`${r.student_id}|${r.slot_id}`, r.scores);
    return m;
  }, [day]);
  const savedSlotIds = useMemo(() => new Set((day?.ratings ?? []).map((r) => r.slot_id)), [day]);
  const attSaved = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of day?.attendance ?? []) m.set(a.student_id, a.status);
    return m;
  }, [day]);
  const countByStudent = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of day?.events ?? []) m.set(e.student_id, (m.get(e.student_id) ?? 0) + 1);
    for (const b of day?.bonuses ?? []) m.set(b.student_id, (m.get(b.student_id) ?? 0) + 1);
    return m;
  }, [day]);

  const statusOf = (id: string) => attDraft[id] ?? attSaved.get(id) ?? "present";
  const isAway = (id: string) => statusOf(id) === "absent" || statusOf(id) === "excused";
  // ערך לכל קריטריון של השעה: טיוטה, אחרת השמור, אחרת "טוב"
  const ratingOf = (studentId: string, slot: DaySlot): Rating => {
    const key = `${studentId}|${slot.id}`;
    const out: Rating = {};
    for (const c of slot.criteria) out[c.key] = draft[key]?.[c.key] ?? saved.get(key)?.[c.key] ?? 3;
    return out;
  };

  const dirty = touched.length > 0 || Object.keys(attDraft).length > 0;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const cycleAtt = (id: string) => setAttDraft((d) => ({ ...d, [id]: ATT[statusOf(id)]!.next }));
  const allPresent = () => setAttDraft(Object.fromEntries(students.map((s) => [s.id, "present"])));

  const cycleRating = (studentId: string, slot: DaySlot, key: string) => {
    const cur = ratingOf(studentId, slot);
    setDraft((d) => ({ ...d, [`${studentId}|${slot.id}`]: { ...cur, [key]: nextLevel(cur[key] ?? 3) } }));
    setTouched((t) => (t.includes(slot.id) ? t : [...t, slot.id]));
  };
  const allGoodSlot = (slot: DaySlot) => {
    if (savedSlotIds.has(slot.id) && !touched.includes(slot.id) && !window.confirm("לאפס את כל הדירוגים בשעה הזו ל״טוב״?")) return;
    const good: Rating = Object.fromEntries(slot.criteria.map((c) => [c.key, 3]));
    setDraft((d) => {
      const n = { ...d };
      for (const s of students) n[`${s.id}|${slot.id}`] = { ...good };
      return n;
    });
    setTouched((t) => (t.includes(slot.id) ? t : [...t, slot.id]));
  };

  const saveM = useMutation({
    mutationFn: async () => {
      if (!date) return;
      const attRows = Object.entries(attDraft).map(([studentId, status]) => ({
        studentId,
        status: status as "present" | "absent" | "late" | "excused",
      }));
      if (attRows.length) await saveAttFn({ data: { classId, date, rows: attRows } });
      const rows: { studentId: string; slotId: string; scores: Rating }[] = [];
      for (const sid of touched) {
        const slot = ratedSlots.find((x) => x.id === sid);
        if (!slot) continue;
        for (const s of students) {
          if (isAway(s.id)) continue;
          rows.push({ studentId: s.id, slotId: sid, scores: ratingOf(s.id, slot) });
        }
      }
      if (rows.length) await saveRatingsFn({ data: { classId, date, rows } });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["day", classId, date] });
      // הנוכחות משותפת למסכי הציונים, הדוחות והתובנות
      qc.invalidateQueries({ queryKey: ["score-inputs", classId] });
      setDraft({}); setTouched([]); setAttDraft({});
      toast.success("נשמר");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  const go = (n: number) => {
    if (!date) return;
    if (dirty && !window.confirm("יש שינויים שלא נשמרו. לעבור יום בלי לשמור?")) return;
    setDate(shiftIso(date, n));
  };
  const goToday = () => {
    if (dirty && !window.confirm("יש שינויים שלא נשמרו. לעבור יום בלי לשמור?")) return;
    setDate(toIso(new Date()));
  };

  const noAttendanceYet = !!day && attSaved.size === 0 && Object.keys(attDraft).length === 0;

  return (
    <div className="pb-24">
      <div className="space-y-3">
        {/* בחירת יום */}
        <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2">
          <Button variant="outline" size="icon" aria-label="יום קודם" onClick={() => go(-1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <div className="font-bold">{date ? hebFmt.format(fromIso(date)) : "טוען..."}</div>
            <div className="text-xs text-muted-foreground">{date ? gregFmt.format(fromIso(date)) : ""}</div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={goToday}>היום</Button>
            <Button variant="outline" size="icon" aria-label="יום הבא" onClick={() => go(1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            לחיצה על משבצת מחליפה: טוב, בינוני, חלש. לחיצה על שם פותחת את תיק התלמיד.
            {noAttendanceYet ? " עדיין לא נשמרה נוכחות ליום הזה." : ""}
          </p>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={!day}>
              <Settings2 className="ms-1 h-4 w-4" /> עריכת עמודות
            </Button>
            <Button size="sm" variant="outline" onClick={allPresent} disabled={!students.length}>כולם נוכחים</Button>
          </div>
        </div>

        {dayLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
        {day && ratedSlots.length === 0 && (
          <p className="text-sm text-muted-foreground">אין עמודות לדירוג. אפשר להוסיף מ״עריכת עמודות״.</p>
        )}

        {students.length > 0 && (
          <section aria-label="טבלת היום" className="rounded-xl border bg-card">
            <div className="max-h-[75vh] overflow-auto">
              <table className="border-separate border-spacing-0 text-sm">
                <caption className="sr-only">נוכחות ודירוג של כל תלמידי הכיתה בכל שעות היום</caption>
                <thead>
                  <tr>
                    <th scope="col" rowSpan={2} className="sticky right-0 top-0 z-30 min-w-[8rem] max-w-[8rem] border-b border-l bg-muted px-2 py-1 text-start text-xs font-semibold">תלמיד</th>
                    <th scope="col" rowSpan={2} className="sticky top-0 z-20 w-14 border-b border-l bg-muted px-1 text-xs font-semibold">נוכחות</th>
                    <th scope="col" rowSpan={2} className="sticky top-0 z-20 w-11 border-b border-l bg-muted">
                      <span className="sr-only">חוסרים, אירועים ובונוסים</span>
                      <Flag className="mx-auto h-3.5 w-3.5" aria-hidden="true" />
                    </th>
                    {ratedSlots.map((s) => (
                      <th key={s.id} scope="colgroup" colSpan={s.criteria.length} className="sticky top-0 z-20 h-9 border-b border-l bg-muted px-1 text-xs font-semibold">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="whitespace-nowrap">{s.label}</span>
                          {savedSlotIds.has(s.id) && <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="מולא" />}
                          <button
                            type="button"
                            onClick={() => allGoodSlot(s)}
                            aria-label={`${s.label}: הכל טוב`}
                            className="whitespace-nowrap rounded border bg-background px-1.5 text-[10px] font-normal"
                          >
                            הכל טוב
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {ratedSlots.flatMap((s) =>
                      s.criteria.map((c, ci) => (
                        <th
                          key={`${s.id}-${c.key}`}
                          scope="col"
                          className={`sticky top-9 z-20 h-7 w-10 border-b bg-muted text-[11px] font-medium text-muted-foreground ${ci === s.criteria.length - 1 ? "border-l" : ""}`}
                        >
                          <abbr title={c.label} className="no-underline">{abbr(c)}</abbr>
                          <span className="sr-only"> {s.label}: {c.label}</span>
                        </th>
                      )),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const away = isAway(s.id);
                    const att = ATT[statusOf(s.id)]!;
                    const count = countByStudent.get(s.id) ?? 0;
                    return (
                      <tr key={s.id} className={away ? "opacity-60" : ""}>
                        <th scope="row" className="sticky right-0 z-10 min-w-[8rem] max-w-[8rem] border-b border-l bg-card px-2 py-1 text-start text-xs font-medium leading-tight">
                          <button
                            type="button"
                            onClick={() => setFileFor(s)}
                            aria-label={`פתח תיק תלמיד: ${s.name}`}
                            className="text-start hover:underline focus-visible:underline"
                          >
                            {s.name}
                          </button>
                        </th>
                        <td className="border-b border-l p-0.5">
                          <button
                            type="button"
                            onClick={() => cycleAtt(s.id)}
                            aria-label={`${s.name}, נוכחות: ${att.text}. לחיצה מחליפה סטטוס`}
                            className={`flex h-9 w-full items-center justify-center rounded-md border text-[11px] font-bold ${att.cls}`}
                          >
                            {att.text}
                          </button>
                        </td>
                        <td className="border-b border-l p-0.5">
                          <button
                            type="button"
                            onClick={() => setEventFor(s)}
                            aria-label={`${s.name}: חוסרים, אירועים ובונוסים${count ? ` (${count})` : ""}`}
                            className={`relative flex h-9 w-full items-center justify-center rounded-md border ${count ? "border-primary text-primary" : "text-muted-foreground"}`}
                          >
                            <Flag className="h-4 w-4" />
                            {count > 0 && (
                              <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                                {count}
                              </span>
                            )}
                          </button>
                        </td>
                        {ratedSlots.flatMap((sl) => {
                          const r = ratingOf(s.id, sl);
                          const unsaved = !savedSlotIds.has(sl.id) && !touched.includes(sl.id);
                          return sl.criteria.map((c, ci) => {
                            const v = r[c.key] ?? 3;
                            const meta = LEVEL[v]!;
                            const Icon = meta.Icon;
                            return (
                              <td key={`${sl.id}-${c.key}`} className={`border-b p-0.5 ${ci === sl.criteria.length - 1 ? "border-l" : ""}`}>
                                <button
                                  type="button"
                                  onClick={() => cycleRating(s.id, sl, c.key)}
                                  aria-label={`${s.name}, ${sl.label}, ${c.label}: ${meta.text}`}
                                  title={meta.text}
                                  className={`flex h-9 w-9 items-center justify-center rounded-md border ${meta.cls} ${unsaved ? "border-dashed opacity-60" : ""}`}
                                >
                                  <Icon className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </td>
                            );
                          });
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* פס שמירה */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 p-3">
          <span className="text-sm text-muted-foreground" aria-live="polite">
            {dirty ? "יש שינויים שלא נשמרו" : "הכל שמור"}
          </span>
          <Button onClick={() => saveM.mutate()} disabled={!dirty || saveM.isPending}>
            <Save className="ms-1 h-4 w-4" /> {saveM.isPending ? "שומר..." : "שמור"}
          </Button>
        </div>
      </div>

      {eventFor && date && day && (
        <StudentEventsDialog
          classId={classId}
          date={date}
          student={eventFor}
          day={day}
          onClose={() => setEventFor(null)}
        />
      )}
      {fileFor && (
        <StudentFileSheet
          open
          onOpenChange={(o) => { if (!o) setFileFor(null); }}
          classId={classId}
          studentId={fileFor.id}
          studentName={fileFor.name}
        />
      )}
      {editing && date && day && (
        <SlotsEditor classId={classId} date={date} slots={day.slots} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

/** הוספת קריטריון לשעה: הצעות מהירות או שם חופשי. */
function AddCriterion({ existing, onAdd, disabled }: {
  existing: DayCriterion[]; onAdd: (c: DayCriterion) => void; disabled: boolean;
}) {
  const [label, setLabel] = useState("");
  const missing = SUGGESTED.filter((s) => !existing.some((e) => e.key === s.key));
  const add = (c: DayCriterion) => { onAdd(c); setLabel(""); };
  const addCustom = () => {
    const l = label.trim();
    if (!l || existing.some((e) => e.label === l)) return;
    const standard = SUGGESTED.find((s) => s.label === l);
    add(standard ?? { key: `c_${Math.random().toString(36).slice(2, 8) || "x"}`, label: l });
  };
  return (
    <div className="flex w-full flex-wrap items-center gap-1.5">
      {missing.map((s) => (
        <button
          key={s.key}
          type="button"
          disabled={disabled}
          onClick={() => add(s)}
          className="rounded-full border border-dashed px-2 py-0.5 text-xs hover:bg-accent disabled:opacity-50"
        >
          + {s.label}
        </button>
      ))}
      <div className="flex items-center gap-1">
        <Input
          className="h-8 w-32"
          value={label}
          maxLength={24}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="קריטריון חדש"
          aria-label="שם קריטריון חדש"
        />
        <Button type="button" size="sm" variant="outline" disabled={disabled || !label.trim()} onClick={addCustom}>
          הוסף
        </Button>
      </div>
    </div>
  );
}

/** עריכת עמודות: הוספה, מחיקה, שינוי שם והזזה של שעות, והוספה והסרה של קריטריונים בכל שעה. */
function SlotsEditor({ classId, date, slots, onClose }: {
  classId: string; date: string; slots: DaySlot[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveDaySlot);
  const delFn = useServerFn(deleteDaySlot);
  const moveFn = useServerFn(moveDaySlot);
  const refresh = () => qc.invalidateQueries({ queryKey: ["day", classId, date] });
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה");
  const saveM = useMutation({ mutationFn: saveFn, onSuccess: refresh, onError });
  const delM = useMutation({ mutationFn: delFn, onSuccess: refresh, onError });
  const moveM = useMutation({ mutationFn: moveFn, onSuccess: refresh, onError });
  const busy = saveM.isPending || delM.isPending || moveM.isPending;

  const [newLabel, setNewLabel] = useState("");
  // "נוכחות" יש לה עמודה משלה בטבלה, ולכן לא מופיעה כאן
  const list = slots.filter((s) => s.label !== "נוכחות");

  const update = (s: DaySlot, patch: { label?: string; rated?: boolean; criteria?: DayCriterion[] }) =>
    saveM.mutate({
      data: {
        classId,
        slotId: s.id,
        label: patch.label ?? s.label,
        rated: patch.rated ?? s.rated,
        criteria: patch.criteria ?? s.criteria,
      },
    });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>עריכת עמודות</DialogTitle>
          <DialogDescription>
            אפשר להוסיף או למחוק שעות, ולבחור לכל שעה אילו דירוגים יופיעו בה. כל שינוי נשמר מיד. מחיקה רק מסתירה את העמודה, והנתונים שנשמרו נשארים.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {list.map((s) => (
            <li key={s.id} className="space-y-2 rounded-lg border p-2">
              <div className="flex items-center gap-1">
                <Input
                  key={`${s.id}-${s.label}`}
                  defaultValue={s.label}
                  maxLength={30}
                  aria-label="שם השעה"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.label) update(s, { label: v });
                  }}
                />
                <Button type="button" variant="ghost" size="icon" aria-label="הזז למעלה" disabled={busy}
                  onClick={() => moveM.mutate({ data: { classId, slotId: s.id, direction: "up" } })}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="הזז למטה" disabled={busy}
                  onClick={() => moveM.mutate({ data: { classId, slotId: s.id, direction: "down" } })}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`מחק את ${s.label}`} disabled={busy}
                  onClick={() => {
                    if (window.confirm(`למחוק את "${s.label}"? העמודה תוסתר, והנתונים שנשמרו נשארים.`)) {
                      delM.mutate({ data: { classId, slotId: s.id } });
                    }
                  }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={s.rated}
                  disabled={busy}
                  onChange={(e) =>
                    update(s, {
                      rated: e.target.checked,
                      criteria: e.target.checked && s.criteria.length === 0 ? LESSON_DEFAULT : s.criteria,
                    })
                  }
                />
                להציג בטבלת הדירוג
              </label>

              {s.rated && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {s.criteria.map((c) => (
                    <span key={c.key} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-sm">
                      {c.label}
                      <button
                        type="button"
                        aria-label={`הסר את ${c.label} מ${s.label}`}
                        disabled={busy}
                        className="rounded-full p-0.5 hover:bg-accent disabled:opacity-50"
                        onClick={() => update(s, { criteria: s.criteria.filter((x) => x.key !== c.key) })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  {s.criteria.length < 8 && (
                    <AddCriterion
                      existing={s.criteria}
                      disabled={busy}
                      onAdd={(c) => update(s, { criteria: [...s.criteria, c] })}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        <section className="space-y-2 border-t pt-3">
          <h3 className="text-sm font-bold">שעה חדשה</h3>
          <div className="flex gap-2">
            <Input
              value={newLabel}
              maxLength={30}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLabel.trim()) {
                  e.preventDefault();
                  saveM.mutate({ data: { classId, label: newLabel.trim(), rated: true, criteria: LESSON_DEFAULT } });
                  setNewLabel("");
                }
              }}
              placeholder="למשל: שיעור 4, הפסקה, תפילת מנחה"
              aria-label="שם השעה החדשה"
            />
            <Button
              type="button"
              disabled={busy || !newLabel.trim()}
              onClick={() => {
                saveM.mutate({ data: { classId, label: newLabel.trim(), rated: true, criteria: LESSON_DEFAULT } });
                setNewLabel("");
              }}
            >
              הוסף שעה
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function StudentEventsDialog({ classId, date, student, day, onClose }: {
  classId: string; date: string; student: Student; day: DayData; onClose: () => void;
}) {
  const qc = useQueryClient();
  const addEventFn = useServerFn(addDayEvent);
  const delEventFn = useServerFn(deleteDayEvent);
  const addBonusFn = useServerFn(addDayBonus);
  const delBonusFn = useServerFn(deleteDayBonus);

  const [exNote, setExNote] = useState("");
  const [bonusNote, setBonusNote] = useState("");
  const [points, setPoints] = useState(1);

  const refresh = () => qc.invalidateQueries({ queryKey: ["day", classId, date] });
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "שגיאה");
  const addEventM = useMutation({ mutationFn: addEventFn, onSuccess: refresh, onError });
  const delEventM = useMutation({ mutationFn: delEventFn, onSuccess: refresh, onError });
  const addBonusM = useMutation({ mutationFn: addBonusFn, onSuccess: refresh, onError });
  const delBonusM = useMutation({ mutationFn: delBonusFn, onSuccess: refresh, onError });

  const events = day.events.filter((e) => e.student_id === student.id);
  const bonuses = day.bonuses.filter((b) => b.student_id === student.id);
  const busy = addEventM.isPending || delEventM.isPending || addBonusM.isPending || delBonusM.isPending;

  const toggleMissing = (kind: "missing_writing" | "missing_books") => {
    const existing = events.find((e) => e.kind === kind);
    if (existing) delEventM.mutate({ data: { classId, id: existing.id } });
    else addEventM.mutate({ data: { classId, date, studentId: student.id, kind, note: "" } });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{student.name}</DialogTitle>
          <DialogDescription>חוסרים, אירועים ובונוסים של היום. כל שינוי נשמר מיד.</DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-bold">חוסרים</h3>
          <div className="flex flex-wrap gap-2">
            {(["missing_writing", "missing_books"] as const).map((k) => {
              const on = events.some((e) => e.kind === k);
              return (
                <Button key={k} type="button" variant={on ? "default" : "outline"} aria-pressed={on} disabled={busy} onClick={() => toggleMissing(k)}>
                  {on && <Check className="ms-1 h-4 w-4" />} {EVENT_LABEL[k]}
                </Button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-bold">אירוע חריג</h3>
          <div className="flex gap-2">
            <Input value={exNote} onChange={(e) => setExNote(e.target.value)} placeholder="מה קרה, בקצרה" aria-label="תיאור האירוע" />
            <Button
              type="button" disabled={busy || !exNote.trim()}
              onClick={() => {
                addEventM.mutate({ data: { classId, date, studentId: student.id, kind: "exceptional", note: exNote.trim() } });
                setExNote("");
              }}
            >
              הוסף
            </Button>
          </div>
          <ul className="space-y-1">
            {events.filter((e) => e.kind === "exceptional").map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm">
                <span>{e.note}</span>
                <Button type="button" variant="ghost" size="icon" aria-label="מחק אירוע" disabled={busy} onClick={() => delEventM.mutate({ data: { classId, id: e.id } })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-bold">בונוס מיוחד</h3>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="מספר נקודות">
            {[1, 2, 3, 5].map((p) => (
              <Button key={p} type="button" size="sm" variant={points === p ? "default" : "outline"} aria-pressed={points === p} onClick={() => setPoints(p)}>
                {p}
              </Button>
            ))}
            <span className="text-xs text-muted-foreground">נקודות</span>
          </div>
          <div className="flex gap-2">
            <Input value={bonusNote} onChange={(e) => setBonusNote(e.target.value)} placeholder="על מה, בקצרה" aria-label="סיבת הבונוס" />
            <Button
              type="button" disabled={busy}
              onClick={() => {
                addBonusM.mutate({ data: { classId, date, studentId: student.id, points, note: bonusNote.trim() } });
                setBonusNote("");
              }}
            >
              הוסף
            </Button>
          </div>
          <ul className="space-y-1">
            {bonuses.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-sm">
                <span>{b.points} נקודות{b.note ? ` · ${b.note}` : ""}</span>
                <Button type="button" variant="ghost" size="icon" aria-label="מחק בונוס" disabled={busy} onClick={() => delBonusM.mutate({ data: { classId, id: b.id } })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </DialogContent>
    </Dialog>
  );
}
