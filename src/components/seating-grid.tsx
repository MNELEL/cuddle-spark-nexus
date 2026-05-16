import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Unlock, EyeOff, Shuffle, Settings2, Sparkles, AlertTriangle, Accessibility } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { listStudents, listRelations, setSeat, toggleSeatLock, clearAllSeats, toggleHiddenSeat, smartSortSeats } from "@/lib/students.functions";
import { getClass, updateClass } from "@/lib/classes.functions";
import { computeViolations, type ScoringStudent, type ScoringRelation } from "@/lib/seating-logic";

type Student = {
  id: string; class_id: string; name: string;
  height: "low" | "mid" | "high"; row_pref: "front" | "mid" | "back" | "any";
  corner_pref: boolean; seat_row: number | null; seat_col: number | null; seat_locked: boolean;
};

const seatKey = (r: number, c: number) => `${r}:${c}`;

function StudentChip({ student, dragging, highlight }: { student: Student; dragging?: boolean; highlight?: "friend" | "avoid" | "distance" | "self" | null }) {
  const cls =
    highlight === "self" ? "ring-2 ring-primary bg-primary/20"
    : highlight === "friend" ? "ring-2 ring-emerald-500 bg-emerald-500/15"
    : highlight === "avoid" ? "ring-2 ring-red-500 bg-red-500/15"
    : highlight === "distance" ? "ring-2 ring-amber-500 bg-amber-500/15"
    : "bg-primary/10";
  return (
    <div className={`select-none rounded-md border px-2 py-1 text-xs font-medium text-foreground shadow-sm ${cls} ${dragging ? "opacity-90 shadow-lg" : ""}`}>
      <div className="flex items-center gap-1">
        {student.seat_locked && <Lock className="h-3 w-3 text-amber-600" />}
        <span className="truncate max-w-[8rem]">{student.name}</span>
      </div>
    </div>
  );
}

function DraggableStudent({ student, id, highlight, onClick }: { student: Student; id: string; highlight?: "friend" | "avoid" | "distance" | "self" | null; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { studentId: student.id } });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onClick}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}>
      <StudentChip student={student} highlight={highlight} />
    </div>
  );
}

function Seat({
  row, col, hidden, child, onToggleHide, onToggleLock, lockedChild, highlight, onSelect,
  a11y, focused, grabbedId, onFocusSeat, seatRef,
}: {
  row: number; col: number; hidden: boolean; child: Student | null;
  onToggleHide: () => void; onToggleLock: () => void; lockedChild: boolean;
  highlight?: "friend" | "avoid" | "distance" | "self" | null;
  onSelect?: () => void;
  a11y?: boolean;
  focused?: boolean;
  grabbedId?: string | null;
  onFocusSeat?: () => void;
  seatRef?: (el: HTMLElement | null) => void;
}) {
  const dropId = `seat:${row}:${col}`;
  const { isOver, setNodeRef } = useDroppable({ id: dropId, data: { row, col }, disabled: hidden });

  if (hidden) {
    return (
      <button
        type="button"
        onClick={onToggleHide}
        ref={(el) => { seatRef?.(el); }}
        tabIndex={a11y ? (focused ? 0 : -1) : undefined}
        onFocus={onFocusSeat}
        aria-label={`מושב מוסתר בשורה ${row + 1} עמודה ${col + 1}. הקש Enter כדי להציג`}
        className={`aspect-[4/3] rounded-md border border-dashed border-muted bg-muted/20 text-[10px] text-muted-foreground hover:bg-muted/40 ${a11y && focused ? "outline outline-2 outline-offset-2 outline-primary" : ""} ${a11y ? "focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary" : ""}`}
        title="הסר הסתרה"
      >
        מוסתר
      </button>
    );
  }

  const seatLabel = child
    ? `שורה ${row + 1} עמודה ${col + 1}, תלמיד: ${child.name}${child.seat_locked ? ", נעול" : ""}${highlight ? `, ${highlight === "self" ? "נבחר" : highlight === "friend" ? "חבר" : highlight === "avoid" ? "להרחיק" : "מרחק"}` : ""}`
    : `שורה ${row + 1} עמודה ${col + 1}, מושב ריק${grabbedId ? ". הקש Enter כדי להניח כאן" : ""}`;

  return (
    <div
      ref={(el) => { setNodeRef(el); seatRef?.(el); }}
      role={a11y ? "gridcell" : undefined}
      tabIndex={a11y ? (focused ? 0 : -1) : undefined}
      aria-label={a11y ? seatLabel : undefined}
      aria-selected={a11y && !!child && highlight === "self"}
      onFocus={onFocusSeat}
      className={`group relative flex aspect-[4/3] items-center justify-center rounded-md border bg-card p-1 transition-colors ${
        isOver ? "border-primary bg-primary/10" : "border-border"
      } ${a11y && focused ? "outline outline-2 outline-offset-2 outline-primary z-10" : ""} ${a11y ? "focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:z-10" : ""} ${grabbedId && !child ? "ring-2 ring-primary/60" : ""}`}
    >
      <div className="absolute top-0.5 left-0.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {child && (
          <button type="button" onClick={onToggleLock}
            className="rounded p-0.5 hover:bg-accent" title={lockedChild ? "פתח נעילה" : "נעל מושב"}>
            {lockedChild ? <Lock className="h-3 w-3 text-amber-600" /> : <Unlock className="h-3 w-3" />}
          </button>
        )}
        {!child && (
          <button type="button" onClick={onToggleHide}
            className="rounded p-0.5 hover:bg-accent" title="הסתר מושב">
            <EyeOff className="h-3 w-3" />
          </button>
        )}
      </div>
      <span className="absolute bottom-0.5 right-1 text-[9px] text-muted-foreground">{row + 1},{col + 1}</span>
      {child ? (
        <DraggableStudent student={child} id={`student:${child.id}`} highlight={highlight} onClick={onSelect} />
      ) : (
        <span className="text-[10px] text-muted-foreground">ריק</span>
      )}
    </div>
  );
}

export function SeatingGrid({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const getC = useServerFn(getClass);
  const listS = useServerFn(listStudents);
  const listR = useServerFn(listRelations);
  const setSeatFn = useServerFn(setSeat);
  const toggleLockFn = useServerFn(toggleSeatLock);
  const clearFn = useServerFn(clearAllSeats);
  const toggleHideFn = useServerFn(toggleHiddenSeat);
  const updateClassFn = useServerFn(updateClass);
  const smartFn = useServerFn(smartSortSeats);

  const { data: cls } = useQuery({ queryKey: ["class", classId], queryFn: () => getC({ data: { id: classId } }) });
  const { data: students = [] } = useQuery({ queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }) }) as { data: Student[] };
  const { data: relations = [] } = useQuery({ queryKey: ["relations", classId], queryFn: () => listR({ data: { classId } }) }) as { data: ScoringRelation[] };

  const rows = cls?.grid_rows ?? 5;
  const cols = cls?.grid_cols ?? 6;
  const hiddenSet = useMemo(() => new Set<string>((cls?.hidden_seats as string[] | undefined) ?? []), [cls?.hidden_seats]);

  const seated = useMemo(() => {
    const map = new Map<string, Student>();
    for (const s of students) {
      if (s.seat_row !== null && s.seat_col !== null) map.set(seatKey(s.seat_row, s.seat_col), s);
    }
    return map;
  }, [students]);

  const unseated = students.filter((s) => s.seat_row === null || s.seat_col === null);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const highlightMap = useMemo(() => {
    const m = new Map<string, "friend" | "avoid" | "distance" | "self">();
    if (!selectedId) return m;
    m.set(selectedId, "self");
    for (const r of relations) {
      if (r.student_a === selectedId) m.set(r.student_b, r.kind);
      else if (r.student_b === selectedId) m.set(r.student_a, r.kind);
    }
    return m;
  }, [selectedId, relations]);

  const violations = useMemo(
    () => computeViolations(students as unknown as ScoringStudent[], relations, rows, cols),
    [students, relations, rows, cols],
  );
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "?";

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);

  // Accessibility mode (keyboard navigation + screen reader)
  const [a11y, setA11y] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("cmp.a11y") === "1";
  });
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("cmp.hc") === "1";
  });
  useEffect(() => { localStorage.setItem("cmp.a11y", a11y ? "1" : "0"); }, [a11y]);
  useEffect(() => { localStorage.setItem("cmp.hc", highContrast ? "1" : "0"); }, [highContrast]);

  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");
  const seatRefs = useRef<Map<string, HTMLElement>>(new Map());

  const announce = (msg: string) => setAnnouncement(msg);

  const isHidden = (r: number, c: number) => hiddenSet.has(seatKey(r, c));

  const moveFocus = (dr: number, dc: number) => {
    let nr = focus.r, nc = focus.c;
    for (let step = 0; step < rows * cols; step++) {
      nr = Math.max(0, Math.min(rows - 1, nr + dr));
      nc = Math.max(0, Math.min(cols - 1, nc + dc));
      if (!isHidden(nr, nc)) break;
      if (nr === 0 && dr < 0) break;
      if (nr === rows - 1 && dr > 0) break;
      if (nc === 0 && dc < 0) break;
      if (nc === cols - 1 && dc > 0) break;
    }
    setFocus({ r: nr, c: nc });
    requestAnimationFrame(() => seatRefs.current.get(seatKey(nr, nc))?.focus());
  };

  const activateSeat = () => {
    const { r, c } = focus;
    if (isHidden(r, c)) { hideM.mutate({ row: r, col: c }); return; }
    const child = seated.get(seatKey(r, c));
    if (grabbedId) {
      const student = students.find((s) => s.id === grabbedId);
      if (!student) { setGrabbedId(null); return; }
      const occupant = seated.get(seatKey(r, c));
      if (occupant?.seat_locked) { toast.error("המושב היעד נעול"); return; }
      moveM.mutate({ student_id: grabbedId, seat_row: r, seat_col: c });
      announce(`${student.name} הונח בשורה ${r + 1} עמודה ${c + 1}`);
      setGrabbedId(null);
    } else if (child) {
      if (child.seat_locked) { toast.error("המושב נעול"); return; }
      setGrabbedId(child.id);
      announce(`${child.name} נאסף. בחר מושב יעד והקש Enter.`);
    }
  };

  const onGridKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!a11y) return;
    const isRTL = true;
    switch (e.key) {
      case "ArrowUp": e.preventDefault(); moveFocus(-1, 0); break;
      case "ArrowDown": e.preventDefault(); moveFocus(1, 0); break;
      case "ArrowLeft": e.preventDefault(); moveFocus(0, isRTL ? 1 : -1); break;
      case "ArrowRight": e.preventDefault(); moveFocus(0, isRTL ? -1 : 1); break;
      case "Home": e.preventDefault(); setFocus({ r: focus.r, c: 0 }); break;
      case "End": e.preventDefault(); setFocus({ r: focus.r, c: cols - 1 }); break;
      case "Enter":
      case " ": e.preventDefault(); activateSeat(); break;
      case "Escape":
        if (grabbedId) { e.preventDefault(); setGrabbedId(null); announce("הפעולה בוטלה"); }
        else if (selectedId) { e.preventDefault(); setSelectedId(null); }
        break;
      case "l": case "L": {
        e.preventDefault();
        const child = seated.get(seatKey(focus.r, focus.c));
        if (child) { lockM.mutate({ id: child.id, locked: !child.seat_locked }); announce(child.seat_locked ? "נעילה הוסרה" : "המושב ננעל"); }
        break;
      }
      case "h": case "H": {
        e.preventDefault();
        if (!seated.get(seatKey(focus.r, focus.c))) { hideM.mutate({ row: focus.r, col: focus.c }); announce(isHidden(focus.r, focus.c) ? "הוצג" : "הוסתר"); }
        break;
      }
    }
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["students", classId] });
  };

  const moveM = useMutation({
    mutationFn: (v: { student_id: string; seat_row: number | null; seat_col: number | null }) =>
      setSeatFn({ data: { class_id: classId, ...v } }),
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const lockM = useMutation({
    mutationFn: (v: { id: string; locked: boolean }) => toggleLockFn({ data: v }),
    onSuccess: invalidate,
  });

  const hideM = useMutation({
    mutationFn: (v: { row: number; col: number }) => toggleHideFn({ data: { class_id: classId, ...v } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["class", classId] }); invalidate(); },
  });

  const clearM = useMutation({
    mutationFn: () => clearFn({ data: { class_id: classId } }),
    onSuccess: () => { invalidate(); toast.success("הסידור נוקה (פרט לנעולים)"); },
  });

  const randomM = useMutation({
    mutationFn: async () => {
      const lockedKeys = new Set<string>();
      for (const s of students) {
        if (s.seat_locked && s.seat_row !== null && s.seat_col !== null)
          lockedKeys.add(seatKey(s.seat_row, s.seat_col));
      }
      const freeSeats: { row: number; col: number }[] = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const k = seatKey(r, c);
        if (!hiddenSet.has(k) && !lockedKeys.has(k)) freeSeats.push({ row: r, col: c });
      }
      const movable = students.filter((s) => !s.seat_locked);
      // shuffle
      for (let i = freeSeats.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [freeSeats[i], freeSeats[j]] = [freeSeats[j], freeSeats[i]];
      }
      // clear movable first
      await Promise.all(movable.map((s) =>
        setSeatFn({ data: { class_id: classId, student_id: s.id, seat_row: null, seat_col: null } })));
      // assign
      for (let i = 0; i < movable.length && i < freeSeats.length; i++) {
        await setSeatFn({ data: { class_id: classId, student_id: movable[i].id, seat_row: freeSeats[i].row, seat_col: freeSeats[i].col } });
      }
    },
    onSuccess: () => { invalidate(); toast.success("בוצע מיון אקראי"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const smartM = useMutation({
    mutationFn: () => smartFn({ data: { class_id: classId } }),
    onSuccess: () => { invalidate(); toast.success("מיון חכם הושלם"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const onDragStart = (e: DragStartEvent) => {
    const sid = (e.active.data.current as { studentId?: string })?.studentId;
    setActiveStudent(students.find((s) => s.id === sid) ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveStudent(null);
    if (!e.over) return;
    const sid = (e.active.data.current as { studentId?: string })?.studentId;
    if (!sid) return;
    const student = students.find((s) => s.id === sid);
    if (!student || student.seat_locked) {
      if (student?.seat_locked) toast.error("המושב נעול");
      return;
    }
    const overId = String(e.over.id);
    if (overId === "tray") {
      moveM.mutate({ student_id: sid, seat_row: null, seat_col: null });
      return;
    }
    const data = e.over.data.current as { row?: number; col?: number } | undefined;
    if (data?.row === undefined || data.col === undefined) return;
    const occupant = seated.get(seatKey(data.row, data.col));
    if (occupant?.seat_locked) { toast.error("המושב היעד נעול"); return; }
    moveM.mutate({ student_id: sid, seat_row: data.row, seat_col: data.col });
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className={`space-y-4 ${highContrast ? "contrast-125 [&_*]:!border-foreground/60" : ""}`}>
        <div aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => smartM.mutate()} disabled={smartM.isPending || students.length === 0}>
              <Sparkles className="ms-1 h-4 w-4" /> מיון חכם
            </Button>
            <Button size="sm" variant="secondary" onClick={() => randomM.mutate()} disabled={randomM.isPending || students.length === 0}>
              <Shuffle className="ms-1 h-4 w-4" /> מיון אקראי
            </Button>
            <Button size="sm" variant="outline" onClick={() => clearM.mutate()} disabled={clearM.isPending}>
              נקה סידור
            </Button>
            {selectedId && (
              <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                בטל בחירה
              </Button>
            )}
            {grabbedId && (
              <Button size="sm" variant="destructive" onClick={() => { setGrabbedId(null); announce("הפעולה בוטלה"); }}>
                בטל הרמה ({nameOf(grabbedId)})
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant={a11y ? "default" : "ghost"} aria-pressed={a11y} aria-label="הגדרות נגישות">
                  <Accessibility className="ms-1 h-4 w-4" /> נגישות
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <Label htmlFor="a11y-toggle">ניווט מקלדת וקורא מסך</Label>
                  <Switch id="a11y-toggle" checked={a11y} onCheckedChange={setA11y} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="hc-toggle">ניגודיות גבוהה</Label>
                  <Switch id="hc-toggle" checked={highContrast} onCheckedChange={setHighContrast} />
                </div>
                <div className="rounded bg-muted/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
                  <div className="font-semibold mb-1">קיצורי מקלדת:</div>
                  חיצים — ניווט בין מושבים<br />
                  Enter / רווח — הרם תלמיד / הנח<br />
                  Esc — בטל הרמה / בחירה<br />
                  L — נעל / שחרר מושב<br />
                  H — הסתר / הצג מושב ריק<br />
                  Home / End — תחילת/סוף השורה
                </div>
              </PopoverContent>
            </Popover>
            <GridSettings rows={rows} cols={cols} onSave={(r, c) =>
              updateClassFn({ data: { id: classId, grid_rows: r, grid_cols: c } })
                .then(() => qc.invalidateQueries({ queryKey: ["class", classId] }))
            } />
          </div>
        </div>

        <div id="seating-grid-canvas" className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-2 text-center text-xs font-semibold text-muted-foreground">חזית הכיתה</div>
          <div
            role={a11y ? "grid" : undefined}
            aria-label={a11y ? `סידור הושבה, ${rows} שורות על ${cols} עמודות` : undefined}
            aria-rowcount={a11y ? rows : undefined}
            aria-colcount={a11y ? cols : undefined}
            onKeyDown={onGridKeyDown}
            className="grid gap-2 outline-none"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
          >
            {Array.from({ length: rows }).flatMap((_, r) =>
              Array.from({ length: cols }).map((__, c) => {
                const child = seated.get(seatKey(r, c)) ?? null;
                const hl = child ? highlightMap.get(child.id) ?? null : null;
                return (
                  <Seat key={`${r}-${c}`} row={r} col={c}
                    hidden={hiddenSet.has(seatKey(r, c))}
                    child={child}
                    lockedChild={!!child?.seat_locked}
                    highlight={hl}
                    onSelect={() => child && setSelectedId((cur) => cur === child.id ? null : child.id)}
                    onToggleHide={() => hideM.mutate({ row: r, col: c })}
                    onToggleLock={() => child && lockM.mutate({ id: child.id, locked: !child.seat_locked })}
                    a11y={a11y}
                    focused={a11y && focus.r === r && focus.c === c}
                    grabbedId={grabbedId}
                    onFocusSeat={() => setFocus({ r, c })}
                    seatRef={(el) => {
                      const k = seatKey(r, c);
                      if (el) seatRefs.current.set(k, el);
                      else seatRefs.current.delete(k);
                    }}
                  />
                );
              }),
            )}
          </div>
          {a11y && (
            <div className="mt-2 text-center text-[11px] text-muted-foreground">
              {grabbedId ? `מצב הרמה: ${nameOf(grabbedId)} — בחר מושב יעד והקש Enter (Esc לביטול)` : "השתמש בחיצים לניווט, Enter להרמה/הנחה"}
            </div>
          )}
        </div>

        <UnseatedTray students={unseated} highlightMap={highlightMap} onSelect={(id) => setSelectedId((cur) => cur === id ? null : id)} />

        <ViolationsPanel violations={violations} nameOf={nameOf} onFocus={setSelectedId} />
      </div>

      <DragOverlay>{activeStudent ? <StudentChip student={activeStudent} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function UnseatedTray({ students, highlightMap, onSelect }: { students: Student[]; highlightMap: Map<string, "friend" | "avoid" | "distance" | "self">; onSelect: (id: string) => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: "tray" });
  return (
    <Card>
      <CardContent ref={setNodeRef as never}
        className={`flex min-h-[80px] flex-wrap gap-2 py-3 transition-colors ${isOver ? "bg-accent/40" : ""}`}>
        <div className="w-full text-xs font-semibold text-muted-foreground">תלמידים לא משובצים ({students.length})</div>
        {students.length === 0 ? (
          <div className="w-full py-4 text-center text-xs text-muted-foreground">כולם מסודרים 🎉</div>
        ) : (
          students.map((s) => (
            <DraggableStudent key={s.id} student={s} id={`student:${s.id}`}
              highlight={highlightMap.get(s.id) ?? null}
              onClick={() => onSelect(s.id)} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ViolationsPanel({
  violations, nameOf, onFocus,
}: {
  violations: ReturnType<typeof computeViolations>;
  nameOf: (id: string) => string;
  onFocus: (id: string) => void;
}) {
  if (violations.length === 0) {
    return (
      <Card>
        <CardContent className="py-3 text-xs text-emerald-600 font-medium text-center">
          ✓ כל האילוצים וההעדפות מתקיימים
        </CardContent>
      </Card>
    );
  }
  const hard = violations.filter((v) => v.severity === "hard");
  const soft = violations.filter((v) => v.severity === "soft");
  return (
    <Card>
      <CardContent className="space-y-2 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          הפרות ({hard.length} קריטיות, {soft.length} רכות)
        </div>
        <ul className="space-y-1 text-xs">
          {[...hard, ...soft].map((v, i) => (
            <li key={i} className={`flex flex-wrap items-center gap-1 rounded px-2 py-1 ${v.severity === "hard" ? "bg-red-500/10" : "bg-amber-500/10"}`}>
              <span>{v.message}:</span>
              {v.studentIds.map((id) => (
                <button key={id} type="button" onClick={() => onFocus(id)}
                  className="rounded bg-background px-1.5 py-0.5 font-medium hover:bg-accent">
                  {nameOf(id)}
                </button>
              ))}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function GridSettings({ rows, cols, onSave }: { rows: number; cols: number; onSave: (r: number, c: number) => void }) {
  const [r, setR] = useState(rows);
  const [c, setC] = useState(cols);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost"><Settings2 className="ms-1 h-4 w-4" /> {rows}×{cols}</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-3">
        <div>
          <Label>שורות</Label>
          <Input type="number" min={1} max={20} value={r} onChange={(e) => setR(Number(e.target.value))} />
        </div>
        <div>
          <Label>עמודות</Label>
          <Input type="number" min={1} max={20} value={c} onChange={(e) => setC(Number(e.target.value))} />
        </div>
        <Button className="w-full" onClick={() => onSave(r, c)}>שמור</Button>
      </PopoverContent>
    </Popover>
  );
}