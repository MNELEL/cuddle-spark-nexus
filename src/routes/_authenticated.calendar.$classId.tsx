import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight, ChevronLeft, Plus, Trash2, Pencil, Sparkles, RefreshCw, Cake } from "lucide-react";
import { toast } from "sonner";
import {
  listClassEvents, upsertClassEvent, deleteClassEvent,
  type ClassEvent, type ClassEventType,
} from "@/lib/class-events.functions";
import { buildWeeklySummary } from "@/lib/ai-weekly-summary.functions";
import { listStudents } from "@/lib/students.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/calendar/$classId")({
  component: CalendarPage,
  head: () => ({
    meta: [
      { title: "יומן אירועים כיתתי · ClassAlign Studio" },
      { name: "description", content: "יומן אירועים חודשי לכיתה עם סיכום שבועי AI." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const TYPE_META: Record<ClassEventType, { label: string; color: string }> = {
  birthday: { label: "יום הולדת", color: "bg-pink-500" },
  exam:     { label: "מבחן",     color: "bg-red-500" },
  trip:     { label: "טיול",     color: "bg-emerald-500" },
  holiday:  { label: "חג",       color: "bg-amber-500" },
  meeting:  { label: "פגישה",    color: "bg-blue-500" },
  other:    { label: "אחר",      color: "bg-slate-500" },
};

const HEBREW_MONTHS = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];
const DOW_HE = ["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","שבת"];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // back to Sunday
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function weekBoundsOf(iso: string): { start: string; end: string } {
  const d = new Date(iso + "T00:00:00");
  const s = new Date(d); s.setDate(d.getDate() - d.getDay());
  const e = new Date(s); e.setDate(s.getDate() + 6);
  return { start: isoDate(s), end: isoDate(e) };
}

function CalendarPage() {
  const { classId } = Route.useParams();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClassEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [weekAnchor, setWeekAnchor] = useState<string>(isoDate(today));

  const list = useServerFn(listClassEvents);
  const listS = useServerFn(listStudents);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => monthGrid(year, month), [year, month]);
  const gridFrom = isoDate(cells[0]);
  const gridTo = isoDate(cells[cells.length - 1]);

  const { data: events = [] } = useQuery({
    queryKey: ["class-events", classId, gridFrom, gridTo],
    queryFn: () => list({ data: { classId, from: gridFrom, to: gridTo } }),
  });
  const { data: students = [] } = useQuery({
    queryKey: ["students", classId],
    queryFn: () => listS({ data: { classId } }),
  });

  const byDay = useMemo(() => {
    const map = new Map<string, ClassEvent[]>();
    for (const e of events as ClassEvent[]) {
      const start = new Date(e.date + "T00:00:00");
      const end = e.end_date ? new Date(e.end_date + "T00:00:00") : start;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const k = isoDate(d);
        const arr = map.get(k) ?? [];
        arr.push(e);
        map.set(k, arr);
      }
    }
    return map;
  }, [events]);

  const openDay = (iso: string) => { setDayOpen(iso); setEditing(null); };
  const openNew = (iso: string) => { setEditing({ id: "", class_id: classId, title: "", type: "other", date: iso, end_date: null, student_id: null, notes: null, color: null }); setFormOpen(true); };
  const openEdit = (ev: ClassEvent) => { setEditing(ev); setFormOpen(true); };

  const todayIso = isoDate(today);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="font-display text-3xl font-bold">יומן אירועים כיתתי</h1>
        <p className="mt-1 text-sm text-muted-foreground">ימי הולדת, מבחנים, טיולים ופגישות — כולל סיכום AI שבועי.</p>
      </div>

      <WeeklySummaryCard classId={classId} anchor={weekAnchor} onAnchorChange={setWeekAnchor} />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="חודש קודם"><ChevronRight className="h-4 w-4" /></Button>
            <CardTitle className="min-w-40 text-center">{HEBREW_MONTHS[month]} {year}</CardTitle>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="חודש הבא"><ChevronLeft className="h-4 w-4" /></Button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>היום</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
            {DOW_HE.map((d) => <div key={d} className="py-1 font-semibold">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d) => {
              const iso = isoDate(d);
              const inMonth = d.getMonth() === month;
              const dayEvents = byDay.get(iso) ?? [];
              const hasBirthday = dayEvents.some((e) => e.type === "birthday");
              return (
                <button
                  key={iso}
                  onClick={() => openDay(iso)}
                  className={`relative min-h-20 rounded-lg border p-1 text-start transition hover:border-primary/60 ${inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground"} ${iso === todayIso ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono-tabular">{d.getDate()}</span>
                    {hasBirthday && <Cake className="h-3.5 w-3.5 text-pink-500" aria-label="יום הולדת" />}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <span key={e.id + iso} className={`h-1.5 w-1.5 rounded-full ${TYPE_META[e.type].color}`} title={e.title} />
                    ))}
                    {dayEvents.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>}
                  </div>
                  {dayEvents[0] && (
                    <div className="mt-1 line-clamp-1 text-[11px]">{dayEvents[0].title}</div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {(Object.keys(TYPE_META) as ClassEventType[]).map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                <span className={`h-2 w-2 rounded-full ${TYPE_META[t].color}`} />{TYPE_META[t].label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {dayOpen && (
        <DayDialog
          open={!!dayOpen}
          onOpenChange={(o) => !o && setDayOpen(null)}
          iso={dayOpen}
          events={byDay.get(dayOpen) ?? []}
          onNew={() => openNew(dayOpen)}
          onEdit={openEdit}
          classId={classId}
        />
      )}

      {formOpen && editing && (
        <EventForm
          open={formOpen}
          onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
          initial={editing}
          classId={classId}
          students={students as { id: string; name: string }[]}
          onSaved={() => { setFormOpen(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function WeeklySummaryCard({ classId, anchor, onAnchorChange }: { classId: string; anchor: string; onAnchorChange: (v: string) => void }) {
  const { start, end } = useMemo(() => weekBoundsOf(anchor), [anchor]);
  const build = useServerFn(buildWeeklySummary);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["weekly-summary", classId, start, end],
    queryFn: () => build({ data: { classId, weekStart: start, weekEnd: end } }),
  });

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" /> סיכום שבועי AI
        </CardTitle>
        <div className="flex items-center gap-2">
          <Input type="date" className="w-40" value={anchor} onChange={(e) => onAnchorChange(e.target.value)} />
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`ms-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> רענן
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2 text-xs text-muted-foreground">שבוע {start} – {end}</div>
        {data && (
          <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
            <Badge variant="secondary">{data.counts.events} אירועים</Badge>
            <Badge variant="secondary">{data.counts.lessons} שיעורים</Badge>
            {data.counts.behaviorPositive > 0 && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">+{data.counts.behaviorPositive} התנהגות</Badge>}
            {data.counts.behaviorNegative > 0 && <Badge variant="secondary" className="bg-red-50 text-red-700">-{data.counts.behaviorNegative} התנהגות</Badge>}
            {data.counts.absences > 0 && <Badge variant="secondary">{data.counts.absences} חיסורים</Badge>}
          </div>
        )}
        {isFetching && !data ? (
          <div className="text-sm text-muted-foreground">מפיק סיכום…</div>
        ) : (
          <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{data?.summary ?? "אין סיכום זמין."}</pre>
        )}
      </CardContent>
    </Card>
  );
}

function DayDialog({ open, onOpenChange, iso, events, onNew, onEdit, classId }: {
  open: boolean; onOpenChange: (o: boolean) => void; iso: string;
  events: ClassEvent[]; onNew: () => void; onEdit: (e: ClassEvent) => void; classId: string;
}) {
  const remove = useServerFn(deleteClassEvent);
  const qc = useQueryClient();
  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-events", classId] });
      qc.invalidateQueries({ queryKey: ["weekly-summary", classId] });
      toast.success("האירוע נמחק");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const d = new Date(iso + "T00:00:00");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{d.getDate()} {HEBREW_MONTHS[d.getMonth()]} {d.getFullYear()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין אירועים ביום זה.</p>
          ) : events.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_META[e.type].color}`} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">{TYPE_META[e.type].label}{e.end_date ? ` · עד ${e.end_date}` : ""}</div>
                  {e.notes && <div className="text-xs text-muted-foreground line-clamp-2">{e.notes}</div>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label="ערוך" onClick={() => onEdit(e)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="מחק" className="text-destructive" onClick={() => removeM.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={onNew}><Plus className="ms-1 h-4 w-4" /> הוסף אירוע</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventForm({ open, onOpenChange, initial, classId, students, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial: ClassEvent;
  classId: string; students: { id: string; name: string }[]; onSaved: () => void;
}) {
  const upsert = useServerFn(upsertClassEvent);
  const qc = useQueryClient();
  const [title, setTitle] = useState(initial.title);
  const [type, setType] = useState<ClassEventType>(initial.type);
  const [date, setDate] = useState(initial.date);
  const [endDate, setEndDate] = useState(initial.end_date ?? "");
  const [studentId, setStudentId] = useState<string>(initial.student_id ?? "none");
  const [notes, setNotes] = useState(initial.notes ?? "");

  const m = useMutation({
    mutationFn: () => upsert({ data: {
      id: initial.id || undefined,
      classId, title: title.trim(), type, date,
      endDate: endDate || null,
      studentId: studentId === "none" ? null : studentId,
      notes: notes || null,
    }}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-events", classId] });
      qc.invalidateQueries({ queryKey: ["weekly-summary", classId] });
      toast.success(initial.id ? "עודכן" : "האירוע נוסף");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{initial.id ? "עריכת אירוע" : "אירוע חדש"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>כותרת</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: מבחן בגמרא" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>סוג</Label>
              <Select value={type} onValueChange={(v) => setType(v as ClassEventType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as ClassEventType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>תלמיד (אופציונלי)</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ללא —</SelectItem>
                  {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>תאריך</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>תאריך סיום (לאירוע רב-יומי)</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>
          <div>
            <Label>הערות</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={() => m.mutate()} disabled={!title.trim() || !date || m.isPending}>
            {initial.id ? "שמור" : "הוסף"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}