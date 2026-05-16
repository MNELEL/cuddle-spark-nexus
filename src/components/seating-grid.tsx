import { useMemo, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Unlock, EyeOff, Shuffle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { listStudents, setSeat, toggleSeatLock, clearAllSeats, toggleHiddenSeat } from "@/lib/students.functions";
import { getClass, updateClass } from "@/lib/classes.functions";

type Student = {
  id: string; class_id: string; name: string;
  height: "low" | "mid" | "high"; row_pref: "front" | "mid" | "back" | "any";
  corner_pref: boolean; seat_row: number | null; seat_col: number | null; seat_locked: boolean;
};

const seatKey = (r: number, c: number) => `${r}:${c}`;

function StudentChip({ student, dragging }: { student: Student; dragging?: boolean }) {
  return (
    <div className={`select-none rounded-md border bg-primary/10 px-2 py-1 text-xs font-medium text-foreground shadow-sm ${dragging ? "opacity-90 shadow-lg" : ""}`}>
      <div className="flex items-center gap-1">
        {student.seat_locked && <Lock className="h-3 w-3 text-amber-600" />}
        <span className="truncate max-w-[8rem]">{student.name}</span>
      </div>
    </div>
  );
}

function DraggableStudent({ student, id }: { student: Student; id: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { studentId: student.id } });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}>
      <StudentChip student={student} />
    </div>
  );
}

function Seat({
  row, col, hidden, child, onToggleHide, onToggleLock, lockedChild,
}: {
  row: number; col: number; hidden: boolean; child: Student | null;
  onToggleHide: () => void; onToggleLock: () => void; lockedChild: boolean;
}) {
  const dropId = `seat:${row}:${col}`;
  const { isOver, setNodeRef } = useDroppable({ id: dropId, data: { row, col }, disabled: hidden });

  if (hidden) {
    return (
      <button
        type="button"
        onClick={onToggleHide}
        className="aspect-[4/3] rounded-md border border-dashed border-muted bg-muted/20 text-[10px] text-muted-foreground hover:bg-muted/40"
        title="הסר הסתרה"
      >
        מוסתר
      </button>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`group relative flex aspect-[4/3] items-center justify-center rounded-md border bg-card p-1 transition-colors ${
        isOver ? "border-primary bg-primary/10" : "border-border"
      }`}
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
        <DraggableStudent student={child} id={`student:${child.id}`} />
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
  const setSeatFn = useServerFn(setSeat);
  const toggleLockFn = useServerFn(toggleSeatLock);
  const clearFn = useServerFn(clearAllSeats);
  const toggleHideFn = useServerFn(toggleHiddenSeat);
  const updateClassFn = useServerFn(updateClass);

  const { data: cls } = useQuery({ queryKey: ["class", classId], queryFn: () => getC({ data: { id: classId } }) });
  const { data: students = [] } = useQuery({ queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }) }) as { data: Student[] };

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);

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
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => randomM.mutate()} disabled={randomM.isPending || students.length === 0}>
              <Shuffle className="ms-1 h-4 w-4" /> מיון אקראי
            </Button>
            <Button size="sm" variant="outline" onClick={() => clearM.mutate()} disabled={clearM.isPending}>
              נקה סידור
            </Button>
          </div>
          <GridSettings rows={rows} cols={cols} onSave={(r, c) =>
            updateClassFn({ data: { id: classId, grid_rows: r, grid_cols: c } })
              .then(() => qc.invalidateQueries({ queryKey: ["class", classId] }))
          } />
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-2 text-center text-xs font-semibold text-muted-foreground">חזית הכיתה</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
            {Array.from({ length: rows }).flatMap((_, r) =>
              Array.from({ length: cols }).map((__, c) => {
                const child = seated.get(seatKey(r, c)) ?? null;
                return (
                  <Seat key={`${r}-${c}`} row={r} col={c}
                    hidden={hiddenSet.has(seatKey(r, c))}
                    child={child}
                    lockedChild={!!child?.seat_locked}
                    onToggleHide={() => hideM.mutate({ row: r, col: c })}
                    onToggleLock={() => child && lockM.mutate({ id: child.id, locked: !child.seat_locked })}
                  />
                );
              }),
            )}
          </div>
        </div>

        <UnseatedTray students={unseated} />
      </div>

      <DragOverlay>{activeStudent ? <StudentChip student={activeStudent} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function UnseatedTray({ students }: { students: Student[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: "tray" });
  return (
    <Card>
      <CardContent ref={setNodeRef as never}
        className={`flex min-h-[80px] flex-wrap gap-2 py-3 transition-colors ${isOver ? "bg-accent/40" : ""}`}>
        <div className="w-full text-xs font-semibold text-muted-foreground">תלמידים לא משובצים ({students.length})</div>
        {students.length === 0 ? (
          <div className="w-full py-4 text-center text-xs text-muted-foreground">כולם מסודרים 🎉</div>
        ) : (
          students.map((s) => <DraggableStudent key={s.id} student={s} id={`student:${s.id}`} />)
        )}
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