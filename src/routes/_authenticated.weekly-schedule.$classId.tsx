import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { ArrowRight, ChevronRight, ChevronLeft, Plus, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import {
  listWeeklyLessons, upsertWeeklyLesson, moveWeeklyLesson, deleteWeeklyLesson,
  type WeeklyLesson, type WeeklyDayKey,
} from "@/lib/weekly-schedule.functions";
import { listResources } from "@/lib/teaching-resources.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/weekly-schedule/$classId")({
  component: WeeklySchedulePage,
  head: () => ({
    meta: [
      { title: "לוח שבועי · ClassAlign Studio" },
      { name: "description", content: "לוח שיעורים שבועי לכיתה, ניתן לעריכה בגרירה." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const DAYS: { key: WeeklyDayKey; label: string }[] = [
  { key: "sun", label: "ראשון" },
  { key: "mon", label: "שני" },
  { key: "tue", label: "שלישי" },
  { key: "wed", label: "רביעי" },
  { key: "thu", label: "חמישי" },
];

const HOURS = Array.from({ length: 10 }, (_, i) => 7 + i); // 07:00–16:00

const SUBJECT_COLORS = [
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-purple-100 text-purple-700 border-purple-200",
  "bg-orange-100 text-orange-700 border-orange-200",
  "bg-pink-100 text-pink-700 border-pink-200",
  "bg-teal-100 text-teal-700 border-teal-200",
  "bg-yellow-100 text-yellow-700 border-yellow-200",
  "bg-rose-100 text-rose-700 border-rose-200",
];

function subjectColor(subject: string | null, map: Map<string, string>): string {
  const key = subject ?? "";
  if (!map.has(key)) map.set(key, SUBJECT_COLORS[map.size % SUBJECT_COLORS.length]);
  return map.get(key)!;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function getWeekStart(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay()); // back to Sunday
  r.setHours(0, 0, 0, 0);
  return r;
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function shortDate(d: Date) { return `${d.getDate()}/${d.getMonth() + 1}`; }

function LessonChip({ lesson, color, onDelete, libraryItem }: {
  lesson: WeeklyLesson; color: string; onDelete: () => void; libraryItem?: { title: string } | null;
}) {
  return (
    <div className={`group relative rounded-xl border px-2 py-1.5 text-xs ${color}`} style={{ minHeight: 52 }}>
      <div className="font-semibold leading-tight line-clamp-2">{lesson.title}</div>
      {lesson.subject && <div className="mt-0.5 truncate opacity-70">{lesson.subject}</div>}
      {libraryItem && (
        <div className="mt-1 flex items-center gap-1 opacity-60">
          <BookOpen className="h-3 w-3 shrink-0" />
          <span className="truncate">{libraryItem.title}</span>
        </div>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="מחק שיעור"
        className="absolute left-1 top-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function DraggableLesson({ lesson, color, onDelete, libraryItem }: {
  lesson: WeeklyLesson; color: string; onDelete: () => void; libraryItem?: { title: string } | null;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lesson-${lesson.id}`,
    data: { lessonId: lesson.id },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? "opacity-40" : ""}>
      <LessonChip lesson={lesson} color={color} onDelete={onDelete} libraryItem={libraryItem} />
    </div>
  );
}

function DroppableCell({ dayKey, hour, children, onClickEmpty }: {
  dayKey: WeeklyDayKey; hour: number; children: ReactNode; onClickEmpty: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${dayKey}-${hour}`, data: { dayKey, hour } });
  return (
    <div
      ref={setNodeRef}
      onClick={(e) => { if ((e.target as HTMLElement).closest("[data-no-cell]")) return; onClickEmpty(); }}
      className={`flex min-h-[64px] cursor-pointer flex-col gap-1 rounded-xl border p-1 transition-colors ${
        isOver ? "border-primary bg-accent/30" : "border-border/50 bg-card/60 hover:border-primary/30 hover:bg-accent/20"
      }`}
    >
      {children}
    </div>
  );
}

function WeeklySchedulePage() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialog, setDialog] = useState<{ open: boolean; day: WeeklyDayKey; hour: number; editing: WeeklyLesson | null }>({
    open: false, day: "sun", hour: 8, editing: null,
  });
  const [activeLesson, setActiveLesson] = useState<WeeklyLesson | null>(null);

  const weekStart = useMemo(() => addDays(getWeekStart(new Date()), weekOffset * 7), [weekOffset]);
  const weekKey = isoDate(weekStart);
  const weekLabel = `${shortDate(weekStart)} – ${shortDate(addDays(weekStart, 4))}`;

  const list = useServerFn(listWeeklyLessons);
  const upsert = useServerFn(upsertWeeklyLesson);
  const move = useServerFn(moveWeeklyLesson);
  const del = useServerFn(deleteWeeklyLesson);
  const listResourcesFn = useServerFn(listResources);

  const { data: lessons = [] } = useQuery({
    queryKey: ["weekly-lessons", classId, weekKey],
    queryFn: () => list({ data: { classId, weekStart: weekKey } }),
  });
  const { data: resources = [] } = useQuery({
    queryKey: ["teaching-resources-light"],
    queryFn: () => listResourcesFn({ data: {} }).catch(() => []),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["weekly-lessons", classId, weekKey] });

  const upsertM = useMutation({
    mutationFn: upsert,
    onSuccess: () => { invalidate(); toast.success("השיעור נשמר"); setDialog((d) => ({ ...d, open: false, editing: null })); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const moveM = useMutation({
    mutationFn: move,
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const delM = useMutation({
    mutationFn: del,
    onSuccess: () => { invalidate(); toast("השיעור נמחק"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const byCell = useMemo(() => {
    const map = new Map<string, WeeklyLesson[]>();
    for (const l of lessons as WeeklyLesson[]) {
      const key = `${l.day_key}-${l.hour}`;
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
    }
    return map;
  }, [lessons]);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lessons as WeeklyLesson[]) if (l.subject) subjectColor(l.subject, map);
    return map;
  }, [lessons]);

  const resourceById = useMemo(() => {
    const map = new Map<string, { title: string }>();
    for (const r of resources as { id: string; title: string }[]) map.set(r.id, r);
    return map;
  }, [resources]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragStart = (e: DragStartEvent) => {
    const lessonId = (e.active.data.current as { lessonId?: string } | undefined)?.lessonId;
    setActiveLesson((lessons as WeeklyLesson[]).find((l) => l.id === lessonId) ?? null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setActiveLesson(null);
    const lessonId = (e.active.data.current as { lessonId?: string } | undefined)?.lessonId;
    const over = e.over?.data.current as { dayKey?: WeeklyDayKey; hour?: number } | undefined;
    if (!lessonId || !over?.dayKey || over.hour === undefined) return;
    moveM.mutate({ data: { id: lessonId, dayKey: over.dayKey, hour: over.hour } });
  };

  const openNew = (day: WeeklyDayKey, hour: number) => setDialog({ open: true, day, hour, editing: null });
  const openEdit = (l: WeeklyLesson) => setDialog({ open: true, day: l.day_key, hour: l.hour, editing: l });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/classes/$classId" params={{ classId }} className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="font-display text-3xl font-bold">לוח שבועי</h1>
        <p className="mt-1 text-sm text-muted-foreground">תכנון שיעורים לפי יום ושעה, כולל קישור לחומרי הוראה מהספרייה.</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((v) => v - 1)} aria-label="שבוע קודם"><ChevronRight className="h-4 w-4" /></Button>
            <CardTitle className="min-w-32 text-center text-base">{weekLabel}</CardTitle>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset((v) => v + 1)} aria-label="שבוע הבא"><ChevronLeft className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setWeekOffset(0)}>השבוע</Button>
            <Button size="sm" onClick={() => openNew("sun", 8)}><Plus className="ms-1 h-4 w-4" /> הוסף שיעור</Button>
          </div>
        </CardHeader>
        <CardContent>
          {colorMap.size > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {Array.from(colorMap.entries()).map(([subject, color]) => (
                <span key={subject} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${color}`}>{subject}</span>
              ))}
            </div>
          )}

          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="mb-1 grid gap-1" style={{ gridTemplateColumns: "48px repeat(5, 1fr)" }}>
                  <div />
                  {DAYS.map((d, i) => (
                    <div key={d.key} className="rounded-xl bg-muted py-2 text-center text-xs font-bold text-muted-foreground">
                      <div>{d.label}</div>
                      <div className="mt-0.5 text-[11px] font-normal text-muted-foreground/60">{shortDate(addDays(weekStart, i))}</div>
                    </div>
                  ))}
                </div>
                {HOURS.map((hour) => (
                  <div key={hour} className="mb-1 grid gap-1" style={{ gridTemplateColumns: "48px repeat(5, 1fr)" }}>
                    <div className="flex items-start justify-center pt-2">
                      <span className="text-[11px] font-medium text-muted-foreground">{pad2(hour)}:00</span>
                    </div>
                    {DAYS.map((day) => {
                      const cellLessons = byCell.get(`${day.key}-${hour}`) ?? [];
                      return (
                        <DroppableCell key={day.key} dayKey={day.key} hour={hour} onClickEmpty={() => openNew(day.key, hour)}>
                          {cellLessons.map((l) => (
                            <div key={l.id} data-no-cell onClick={() => openEdit(l)}>
                              <DraggableLesson
                                lesson={l}
                                color={subjectColor(l.subject, colorMap)}
                                onDelete={() => delM.mutate({ data: { id: l.id } })}
                                libraryItem={l.library_item_id ? resourceById.get(l.library_item_id) : null}
                              />
                            </div>
                          ))}
                        </DroppableCell>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <DragOverlay>
              {activeLesson && (
                <LessonChip lesson={activeLesson} color={subjectColor(activeLesson.subject, colorMap)} onDelete={() => {}} />
              )}
            </DragOverlay>
          </DndContext>
        </CardContent>
      </Card>

      {dialog.open && (
        <LessonForm
          key={dialog.editing?.id ?? `${dialog.day}-${dialog.hour}`}
          classId={classId}
          weekKey={weekKey}
          day={dialog.day}
          hour={dialog.hour}
          editing={dialog.editing}
          resources={resources as { id: string; title: string }[]}
          onClose={() => setDialog((d) => ({ ...d, open: false, editing: null }))}
          onSave={(payload) => upsertM.mutate({ data: payload })}
        />
      )}
    </div>
  );
}

function LessonForm({ classId, weekKey, day, hour, editing, resources, onClose, onSave }: {
  classId: string; weekKey: string; day: WeeklyDayKey; hour: number; editing: WeeklyLesson | null;
  resources: { id: string; title: string }[];
  onClose: () => void;
  onSave: (payload: {
    id?: string; classId: string; weekStart: string; dayKey: WeeklyDayKey; hour: number;
    duration: 1 | 2; title: string; subject: string | null; notes: string | null; libraryItemId: string | null;
  }) => void;
}) {
  const [dayKey, setDayKey] = useState<WeeklyDayKey>(editing?.day_key ?? day);
  const [hourVal, setHourVal] = useState(editing?.hour ?? hour);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [subject, setSubject] = useState(editing?.subject ?? "");
  const [duration, setDuration] = useState<1 | 2>((editing?.duration as 1 | 2) ?? 1);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [libraryItemId, setLibraryItemId] = useState<string>(editing?.library_item_id ?? "none");

  const handleSave = () => {
    if (!title.trim()) { toast.error("חובה להזין כותרת"); return; }
    onSave({
      id: editing?.id,
      classId, weekStart: weekKey, dayKey, hour: hourVal, duration,
      title: title.trim(), subject: subject.trim() || null, notes: notes || null,
      libraryItemId: libraryItemId === "none" ? null : libraryItemId,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "עריכת שיעור" : "הוספת שיעור"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>יום</Label>
              <Select value={dayKey} onValueChange={(v) => setDayKey(v as WeeklyDayKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>שעה</Label>
              <Select value={String(hourVal)} onValueChange={(v) => setHourVal(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={String(h)}>{pad2(h)}:00</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>כותרת השיעור</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: פרשת בשלח – פתיחה" />
          </div>
          <div>
            <Label>מקצוע / נושא</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="למשל: תנ״ך, מתמטיקה..." />
          </div>
          <div>
            <Label>משך (שעות)</Label>
            <div className="flex gap-2">
              {[1, 2].map((n) => (
                <Button key={n} type="button" variant={duration === n ? "default" : "outline"} className="flex-1" onClick={() => setDuration(n as 1 | 2)}>
                  {n} שע׳
                </Button>
              ))}
            </div>
          </div>
          {resources.length > 0 && (
            <div>
              <Label>קישור לפריט ספרייה (אופציונלי)</Label>
              <Select value={libraryItemId} onValueChange={setLibraryItemId}>
                <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ללא —</SelectItem>
                  {resources.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>הערות</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
          <Button onClick={handleSave}>{editing ? "שמור" : "הוסף"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
