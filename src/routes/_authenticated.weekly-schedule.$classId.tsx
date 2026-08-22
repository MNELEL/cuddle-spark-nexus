import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { ArrowRight, ChevronRight, ChevronLeft, Plus, Trash2, BookOpen, Printer } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ALL_DAYS, OVERRIDE_LABEL } from "@/components/schedule/schedule-context";
import { useScheduleYear } from "@/components/schedule/use-schedule-year";
import { CalendarSettingsPanel } from "@/components/schedule/calendar-settings-panel";
import { TasksPanel } from "@/components/schedule/tasks-panel";
import { DutiesPanel } from "@/components/schedule/duties-panel";
import { SemesterTargetsPanel } from "@/components/schedule/semester-targets-panel";
import { MonthView, YearView } from "@/components/schedule/month-year-views";
import { hebrewDayLabel, parashaForWeek } from "@/lib/parasha";
import { printHtmlTable } from "@/lib/print-schedule";
import { slotAllowed, timeLabel } from "@/lib/recurring-rules";
import { RecurringRulesPanel } from "@/components/schedule/recurring-rules-panel";

export const Route = createFileRoute("/_authenticated/weekly-schedule/$classId")({
  component: WeeklySchedulePage,
  head: () => ({
    meta: [
      { title: "לוח שבועי · הכיתה שלי" },
      { name: "description", content: "לוח שיעורים שבועי לכיתה בתלמוד תורה, ניתן לעריכה בגרירה ולשיתוף עם ההורים." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const DAYS = ALL_DAYS;

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
const MINUTES = [0, 15, 30, 45] as const;
type Minute = (typeof MINUTES)[number];

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
      <div className="font-mono-tabular text-[10px] opacity-70">{timeLabel(lesson.hour, lesson.minute)}</div>
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
  const [view, setView] = useState("week");
  const [dayIdx, setDayIdx] = useState(new Date().getDay());
  const [monthOffset, setMonthOffset] = useState(0);
  const [dialog, setDialog] = useState<{ open: boolean; day: WeeklyDayKey; hour: number; editing: WeeklyLesson | null }>({
    open: false, day: "sun", hour: 8, editing: null,
  });
  const [activeLesson, setActiveLesson] = useState<WeeklyLesson | null>(null);

  const weekStart = useMemo(() => addDays(getWeekStart(new Date()), weekOffset * 7), [weekOffset]);
  const weekKey = isoDate(weekStart);
  const weekLabel = `${shortDate(weekStart)} – ${shortDate(addDays(weekStart, 6))}`;

  const year = useScheduleYear(classId);
  const HOURS = useMemo(() => {
    const start = year.settings?.start_hour ?? 7;
    const end = year.settings?.end_hour ?? 16;
    return Array.from({ length: Math.max(1, end - start + 1) }, (_, i) => start + i);
  }, [year.settings]);

  const parasha = year.noteByWeek.get(weekKey)?.parasha_override ?? parashaForWeek(weekStart);
  const weekDates = useMemo(() => DAYS.map((_, i) => isoDate(addDays(weekStart, i))), [weekStart]);
  const teachingDatesThisWeek = weekDates.filter((d) => year.isTeachingDate(d));

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

  const invalidate = () => qc.invalidateQueries({ queryKey: ["weekly-lessons", classId] });

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
    const lessonId = (e.active.data.current as { lessonId?: string } | undefined)?.lessonId;
    const dragged = activeLesson;
    setActiveLesson(null);
    const over = e.over?.data.current as { dayKey?: WeeklyDayKey; hour?: number } | undefined;
    if (!lessonId || !over?.dayKey || over.hour === undefined) return;
    // Dragging changes day/hour only — the lesson keeps its exact minute
    // (e.g. a 14:15 lesson dropped on 15:00 becomes 15:15).
    const minute = (dragged?.minute ?? 0) as 0 | 15 | 30 | 45;
    moveM.mutate({ data: { id: lessonId, dayKey: over.dayKey, hour: over.hour, minute } });
  };

  const openNew = (day: WeeklyDayKey, hour: number) => setDialog({ open: true, day, hour, editing: null });
  const openEdit = (l: WeeklyLesson) => setDialog({ open: true, day: l.day_key, hour: l.hour, editing: l });

  const printWeek = () =>
    printHtmlTable({
      title: `לוח שבועי · ${weekLabel}`,
      subtitle: parasha ? `פרשת ${parasha}` : undefined,
      head: ["שעה", ...DAYS.map((d, i) => `${d.label} ${shortDate(addDays(weekStart, i))}`)],
      rows: HOURS.map((hour) => [
        `${pad2(hour)}:00`,
        ...DAYS.map((d, i) => {
          const iso = weekDates[i]!;
          const cell = (byCell.get(`${d.key}-${hour}`) ?? [])
            .map((l) => [l.title, l.subject].filter(Boolean).join(" · "))
            .join("\n");
          return { text: cell || "—", off: !year.isTeachingDate(iso) };
        }),
      ]),
    });

  const dayKeyForDayView = DAYS[dayIdx]?.key ?? "sun";
  const dayIso = weekDates[dayIdx] ?? weekKey;
  const monthAnchor = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const dayBadges = (iso: string) => {
    const items = [
      ...(year.holidayByDate.get(iso)?.title ? [year.holidayByDate.get(iso)!.title] : []),
      ...(year.overrideByDate.get(iso) ?? []).map((o) => o.label || OVERRIDE_LABEL[o.type] || o.type),
    ];
    return items;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/classes/$classId" params={{ classId }} className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="font-display text-3xl font-bold">לוח הכיתה ותכנון השנה</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          מערכת שבועית לשבעה ימים, סנכרון חגים מלוח השנה העברי, פרשת השבוע, תורנויות, משימות ומבחנים ויעדי הספק למחצית.
        </p>
      </div>

      <RecurringRulesSummary classId={classId} />

      <Tabs value={view} onValueChange={setView}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="day">יומי</TabsTrigger>
          <TabsTrigger value="week">שבועי</TabsTrigger>
          <TabsTrigger value="month">חודשי</TabsTrigger>
          <TabsTrigger value="year">שנתי</TabsTrigger>
          <TabsTrigger value="duties">תורנויות</TabsTrigger>
          <TabsTrigger value="targets">הספקים ויעדים</TabsTrigger>
          <TabsTrigger value="settings">הגדרות ומערכת קבועה</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setWeekOffset((v) => v - 1)} aria-label="שבוע קודם"><ChevronRight className="h-4 w-4" /></Button>
                <div className="min-w-40 text-center">
                  <CardTitle className="text-base">{weekLabel}</CardTitle>
                  {parasha && <div className="text-[11px] text-muted-foreground">פרשת {parasha}</div>}
                </div>
                <Button variant="outline" size="icon" onClick={() => setWeekOffset((v) => v + 1)} aria-label="שבוע הבא"><ChevronLeft className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => setWeekOffset(0)}>השבוע</Button>
                <Button variant="outline" size="sm" onClick={printWeek}><Printer className="ms-1 h-4 w-4" /> הדפסה</Button>
                <Button size="sm" onClick={() => openNew("sun", HOURS[0] ?? 8)}><Plus className="ms-1 h-4 w-4" /> הוסף שיעור</Button>
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
                  <div className="min-w-[860px]">
                    <div className="mb-1 grid gap-1" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
                      <div />
                      {DAYS.map((d, i) => {
                        const iso = weekDates[i]!;
                        const off = !year.isTeachingDate(iso);
                        return (
                          <div key={d.key} className={`rounded-xl py-2 text-center text-xs font-bold ${off ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                            <div>{d.label}</div>
                            <div className="mt-0.5 text-[11px] font-normal opacity-70">{shortDate(addDays(weekStart, i))} · {hebrewDayLabel(addDays(weekStart, i))}</div>
                            {dayBadges(iso).slice(0, 1).map((b) => (
                              <div key={b} className="mt-0.5 truncate px-1 text-[10px] font-normal">{b}</div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                    {HOURS.map((hour) => (
                      <div key={hour} className="mb-1 grid gap-1" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
                        <div className="flex items-start justify-center pt-2">
                          <span className="text-[11px] font-medium text-muted-foreground">{pad2(hour)}:00</span>
                        </div>
                        {DAYS.map((day, i) => {
                          const cellLessons = byCell.get(`${day.key}-${hour}`) ?? [];
                          const off = !year.isTeachingDate(weekDates[i]!);
                          // Blocked by a recurring rule (early end / late start).
                          const blocked = !off && !slotAllowed(year.rulesForDate(weekDates[i]!), hour, 0);
                          return (
                            <div key={day.key} className={off ? "opacity-60" : blocked ? "opacity-50" : ""} title={blocked ? "מחוץ לשעות הלימוד לפי כלל קבוע" : undefined}>
                              <DroppableCell dayKey={day.key} hour={hour} onClickEmpty={() => openNew(day.key, hour)}>
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
                            </div>
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

          <TasksPanel classId={classId} from={weekDates[0]!} to={weekDates[6]!} defaultDate={weekDates[0]!} heading="משימות ומבחנים לשבוע זה" />
        </TabsContent>

        <TabsContent value="day" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {DAYS.map((d, i) => (
                  <Button key={d.key} size="sm" variant={i === dayIdx ? "default" : "outline"} onClick={() => setDayIdx(i)}>
                    {d.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {dayIso} · {hebrewDayLabel(new Date(`${dayIso}T00:00:00`))}
                {!year.isTeachingDate(dayIso) && <Badge variant="destructive">אין לימודים</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {dayBadges(dayIso).map((b) => <Badge key={b} variant="secondary">{b}</Badge>)}
              {HOURS.map((hour) => {
                const cellLessons = byCell.get(`${dayKeyForDayView}-${hour}`) ?? [];
                return (
                  <div key={hour} className="flex items-start gap-3 rounded-xl border p-2">
                    <span className="w-14 shrink-0 pt-1 text-xs font-medium text-muted-foreground">{pad2(hour)}:00</span>
                    <div className="flex-1 space-y-1">
                      {cellLessons.length === 0 ? (
                        <button className="text-xs text-muted-foreground hover:underline" onClick={() => openNew(dayKeyForDayView, hour)}>
                          + הוסף שיעור
                        </button>
                      ) : (
                        cellLessons.map((l) => (
                          <div key={l.id} onClick={() => openEdit(l)} className="cursor-pointer">
                            <LessonChip
                              lesson={l}
                              color={subjectColor(l.subject, colorMap)}
                              onDelete={() => delM.mutate({ data: { id: l.id } })}
                              libraryItem={l.library_item_id ? resourceById.get(l.library_item_id) : null}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <TasksPanel classId={classId} from={dayIso} to={dayIso} defaultDate={dayIso} heading="משימות ומבחנים ליום זה" />
        </TabsContent>

        <TabsContent value="month" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMonthOffset((v) => v - 1)} aria-label="חודש קודם"><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="secondary" size="sm" onClick={() => setMonthOffset(0)}>החודש</Button>
            <Button variant="outline" size="icon" onClick={() => setMonthOffset((v) => v + 1)} aria-label="חודש הבא"><ChevronLeft className="h-4 w-4" /></Button>
          </div>
          <MonthView classId={classId} year={year} anchor={monthAnchor} />
        </TabsContent>

        <TabsContent value="year" className="mt-4">
          <YearView classId={classId} year={year} />
        </TabsContent>

        <TabsContent value="duties" className="mt-4">
          <DutiesPanel classId={classId} weekStart={weekKey} teachingDates={teachingDatesThisWeek} />
        </TabsContent>

        <TabsContent value="targets" className="mt-4">
          <SemesterTargetsPanel classId={classId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-4">
          <CalendarSettingsPanel classId={classId} year={year} />
          <RecurringRulesPanel classId={classId} />
        </TabsContent>
      </Tabs>

      {dialog.open && (
        <LessonForm
          key={dialog.editing?.id ?? `${dialog.day}-${dialog.hour}`}
          classId={classId}
          weekKey={weekKey}
          day={dialog.day}
          hour={dialog.hour}
          hours={HOURS}
          editing={dialog.editing}
          resources={resources as { id: string; title: string }[]}
          onClose={() => setDialog((d) => ({ ...d, open: false, editing: null }))}
          onSave={(payload) => upsertM.mutate({ data: payload })}
        />
      )}
    </div>
  );
}

function LessonForm({ classId, weekKey, day, hour, hours, editing, resources, onClose, onSave }: {
  classId: string; weekKey: string; day: WeeklyDayKey; hour: number; hours: number[]; editing: WeeklyLesson | null;
  resources: { id: string; title: string }[];
  onClose: () => void;
  onSave: (payload: {
    id?: string; classId: string; weekStart: string; dayKey: WeeklyDayKey; hour: number; minute: Minute;
    duration: 1 | 2; title: string; subject: string | null; notes: string | null; libraryItemId: string | null;
  }) => void;
}) {
  const [dayKey, setDayKey] = useState<WeeklyDayKey>(editing?.day_key ?? day);
  const [hourVal, setHourVal] = useState(editing?.hour ?? hour);
  const [minuteVal, setMinuteVal] = useState<Minute>(((editing?.minute ?? 0) as Minute));
  const [title, setTitle] = useState(editing?.title ?? "");
  const [subject, setSubject] = useState(editing?.subject ?? "");
  const [duration, setDuration] = useState<1 | 2>((editing?.duration as 1 | 2) ?? 1);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [libraryItemId, setLibraryItemId] = useState<string>(editing?.library_item_id ?? "none");

  const handleSave = () => {
    if (!title.trim()) { toast.error("חובה להזין כותרת"); return; }
    onSave({
      id: editing?.id,
      classId, weekStart: weekKey, dayKey, hour: hourVal, minute: minuteVal, duration,
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
              <Label>שעה מדויקת</Label>
              <div className="flex items-center gap-1">
                <Select value={String(hourVal)} onValueChange={(v) => setHourVal(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{hours.map((h) => <SelectItem key={h} value={String(h)}>{pad2(h)}</SelectItem>)}</SelectContent>
                </Select>
                <span aria-hidden>:</span>
                <Select value={String(minuteVal)} onValueChange={(v) => setMinuteVal(Number(v) as Minute)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MINUTES.map((m) => <SelectItem key={m} value={String(m)}>{pad2(m)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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
