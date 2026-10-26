import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Flag, Minus, Save, Trash2, X } from "lucide-react";
import { getClass } from "@/lib/classes.functions";
import { useClassFallbackRedirect } from "@/hooks/use-class-fallback";
import { listStudents } from "@/lib/students.functions";
import {
  addDayBonus, addDayEvent, deleteDayBonus, deleteDayEvent,
  getDayData, saveDayAttendance, saveDayRatings,
  type DayData, type DayEventKind,
} from "@/lib/day-tracking.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/classes/$classId/day")({
  head: () => ({
    meta: [
      { title: "מעקב יומי · הכיתה שלי" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DayTracking,
});

type Student = { id: string; name: string };

const RATING_COLS = [
  { key: "readiness", label: "מוכנות" },
  { key: "listening", label: "הקשבה" },
  { key: "behavior", label: "התנהגות" },
  { key: "work_done", label: "עבודות" },
] as const;
type RatingKey = (typeof RATING_COLS)[number]["key"];
type Rating = Record<RatingKey, number>;
const GOOD: Rating = { readiness: 3, listening: 3, behavior: 3, work_done: 3 };

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

function DayTracking() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const getC = useServerFn(getClass);
  const listS = useServerFn(listStudents);
  const dayFn = useServerFn(getDayData);
  const saveRatingsFn = useServerFn(saveDayRatings);
  const saveAttFn = useServerFn(saveDayAttendance);

  // התאריך נקבע אחרי הטעינה, כדי שהשרת והדפדפן לא יחלקו על היום הנוכחי.
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => { setDate(toIso(new Date())); }, []);

  const { data: cls, isLoading: clsLoading } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getC({ data: { id: classId } }),
  });
  useClassFallbackRedirect(!clsLoading && !cls);
  const { data: students = [] } = useQuery({
    queryKey: ["students", classId],
    queryFn: () => listS({ data: { classId } }),
  }) as { data: Student[] };
  const { data: day, isLoading: dayLoading } = useQuery({
    queryKey: ["day", classId, date],
    enabled: !!date,
    queryFn: () => dayFn({ data: { classId, date: date! } }),
  }) as { data: DayData | undefined; isLoading: boolean };

  const [slotId, setSlotId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Rating>>({});
  const [touched, setTouched] = useState<string[]>([]);
  const [attDraft, setAttDraft] = useState<Record<string, string>>({});
  const [eventFor, setEventFor] = useState<Student | null>(null);

  useEffect(() => { setDraft({}); setTouched([]); setAttDraft({}); }, [date]);

  const ratedSlots = useMemo(() => (day?.slots ?? []).filter((s) => s.rated), [day]);
  useEffect(() => {
    if (ratedSlots.length && !ratedSlots.some((s) => s.id === slotId)) setSlotId(ratedSlots[0]!.id);
  }, [ratedSlots, slotId]);

  const saved = useMemo(() => {
    const m = new Map<string, Rating>();
    for (const r of day?.ratings ?? []) {
      m.set(`${r.student_id}|${r.slot_id}`, {
        readiness: r.readiness, listening: r.listening, behavior: r.behavior, work_done: r.work_done,
      });
    }
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
  const ratingOf = (studentId: string, sid: string): Rating =>
    draft[`${studentId}|${sid}`] ?? saved.get(`${studentId}|${sid}`) ?? GOOD;

  const dirty = touched.length > 0 || Object.keys(attDraft).length > 0;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const cycleAtt = (id: string) => setAttDraft((d) => ({ ...d, [id]: ATT[statusOf(id)]!.next }));
  const allPresent = () =>
    setAttDraft(Object.fromEntries(students.map((s) => [s.id, "present"])));

  const cycleRating = (studentId: string, col: RatingKey) => {
    if (!slotId) return;
    const cur = ratingOf(studentId, slotId);
    setDraft((d) => ({ ...d, [`${studentId}|${slotId}`]: { ...cur, [col]: nextLevel(cur[col]) } }));
    setTouched((t) => (t.includes(slotId) ? t : [...t, slotId]));
  };
  const allGood = () => {
    if (!slotId) return;
    if (savedSlotIds.has(slotId) && !window.confirm("לאפס את כל הדירוגים בשעה הזו ל״טוב״?")) return;
    setDraft((d) => {
      const n = { ...d };
      for (const s of students) n[`${s.id}|${slotId}`] = { ...GOOD };
      return n;
    });
    setTouched((t) => (t.includes(slotId) ? t : [...t, slotId]));
  };

  const saveM = useMutation({
    mutationFn: async () => {
      if (!date) return;
      const attRows = Object.entries(attDraft).map(([studentId, status]) => ({
        studentId,
        status: status as "present" | "absent" | "late" | "excused",
      }));
      if (attRows.length) await saveAttFn({ data: { classId, date, rows: attRows } });
      const rows: { studentId: string; slotId: string; readiness: number; listening: number; behavior: number; workDone: number }[] = [];
      for (const sid of touched) {
        for (const s of students) {
          if (isAway(s.id)) continue;
          const r = ratingOf(s.id, sid);
          rows.push({ studentId: s.id, slotId: sid, readiness: r.readiness, listening: r.listening, behavior: r.behavior, workDone: r.work_done });
        }
      }
      if (rows.length) await saveRatingsFn({ data: { classId, date, rows } });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["day", classId, date] });
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

  const currentSlot = ratedSlots.find((s) => s.id === slotId) ?? null;
  const slotUnsaved = currentSlot ? !savedSlotIds.has(currentSlot.id) && !touched.includes(currentSlot.id) : false;

  return (
    <div dir="rtl" className="min-h-screen bg-background p-3 pb-28 md:p-8 md:pb-28">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Link to="/classes/$classId" params={{ classId }} className="shrink-0">
            <Button variant="ghost" size="sm"><ArrowRight className="ms-1 h-4 w-4" /> חזרה</Button>
          </Link>
          <h1 className="font-display text-lg font-bold md:text-2xl">מעקב יומי{cls?.name ? ` · ${cls.name}` : ""}</h1>
          <span className="w-16" aria-hidden="true" />
        </div>

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

        {/* נוכחות */}
        <section aria-labelledby="att-title" className="rounded-xl border bg-card p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h2 id="att-title" className="font-bold">נוכחות</h2>
              {day && attSaved.size === 0 && Object.keys(attDraft).length === 0 && (
                <p className="text-xs text-muted-foreground">עדיין לא נשמרה נוכחות ליום הזה</p>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={allPresent}>כולם נוכחים</Button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {students.map((s) => {
              const meta = ATT[statusOf(s.id)]!;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => cycleAtt(s.id)}
                  aria-label={`${s.name}: ${meta.text}. לחיצה מחליפה סטטוס`}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-2 py-1 text-start text-sm ${meta.cls}`}
                >
                  <span className="line-clamp-2 leading-tight">{s.name}</span>
                  <span className="shrink-0 text-xs font-bold">{meta.text}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* דירוג לפי שעה */}
        <section aria-labelledby="rate-title" className="rounded-xl border bg-card">
          <div className="space-y-2 p-3">
            <h2 id="rate-title" className="font-bold">דירוג לפי שעה</h2>
            {dayLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
            {day && ratedSlots.length === 0 && (
              <p className="text-sm text-muted-foreground">אין שעות לדירוג בסדר היום של הכיתה.</p>
            )}
            <div className="flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="בחירת שעה">
              {ratedSlots.map((s) => {
                const active = s.id === slotId;
                const done = savedSlotIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSlotId(s.id)}
                    className={`flex min-h-10 shrink-0 items-center gap-1 rounded-full border px-3 text-sm ${
                      active ? "border-primary bg-primary text-primary-foreground" : "bg-background"
                    }`}
                  >
                    {s.label}
                    {done && <Check className="h-3.5 w-3.5" aria-label="מולא" />}
                    {touched.includes(s.id) && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-label="יש שינויים" />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {slotUnsaved ? "ערכי ברירת המחדל מוצגים כ״טוב״ ועדיין לא נשמרו. " : ""}
                לחיצה על משבצת מחליפה: טוב, בינוני, חלש.
              </p>
              <Button size="sm" variant="outline" onClick={allGood} disabled={!slotId}>הכל טוב</Button>
            </div>
          </div>

          {currentSlot && (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse">
                <caption className="sr-only">דירוג תלמידים בשעה {currentSlot.label}</caption>
                <colgroup>
                  <col />
                  <col className="w-11" />
                  {RATING_COLS.map((c) => <col key={c.key} className="w-12" />)}
                </colgroup>
                <thead>
                  <tr className="border-y bg-muted/50 text-[11px] text-muted-foreground">
                    <th scope="col" className="py-1.5 ps-3 pe-1 text-start font-medium">תלמיד</th>
                    <th scope="col" className="py-1.5 text-center font-medium"><span className="sr-only">חוסרים ואירועים</span><Flag className="mx-auto h-3.5 w-3.5" aria-hidden="true" /></th>
                    {RATING_COLS.map((c) => (
                      <th key={c.key} scope="col" className="py-1.5 text-center font-medium">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const away = isAway(s.id);
                    const r = ratingOf(s.id, currentSlot.id);
                    const count = countByStudent.get(s.id) ?? 0;
                    return (
                      <tr key={s.id} className={`border-b last:border-b-0 ${away ? "opacity-50" : ""}`}>
                        <th scope="row" className="py-1 ps-3 pe-1 text-start text-sm font-medium leading-tight">
                          {s.name}
                          {away && <span className="ms-1 text-xs font-normal text-muted-foreground">(חסר)</span>}
                        </th>
                        <td className="p-0.5">
                          <button
                            type="button"
                            onClick={() => setEventFor(s)}
                            aria-label={`${s.name}: חוסרים, אירועים ובונוסים${count ? ` (${count})` : ""}`}
                            className={`relative flex h-11 w-full items-center justify-center rounded-md border ${count ? "border-primary text-primary" : "text-muted-foreground"}`}
                          >
                            <Flag className="h-4 w-4" />
                            {count > 0 && (
                              <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                                {count}
                              </span>
                            )}
                          </button>
                        </td>
                        {RATING_COLS.map((c) => {
                          const v = r[c.key];
                          const meta = LEVEL[v]!;
                          const Icon = meta.Icon;
                          return (
                            <td key={c.key} className="p-0.5">
                              <button
                                type="button"
                                onClick={() => cycleRating(s.id, c.key)}
                                aria-label={`${s.name}, ${c.label}: ${meta.text}`}
                                title={meta.text}
                                className={`flex h-11 w-full items-center justify-center rounded-md border ${meta.cls} ${slotUnsaved ? "border-dashed opacity-60" : ""}`}
                              >
                                <Icon className="h-5 w-5" aria-hidden="true" />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
    </div>
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
