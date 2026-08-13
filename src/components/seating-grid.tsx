import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Unlock, EyeOff, Shuffle, Settings2, Sparkles, AlertTriangle, Accessibility, Undo2, Redo2, Printer, FileDown, Check, Loader2, Star, X, Presentation, Armchair, DoorOpen, Rows3, BookOpen, PanelTopOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { listStudents, listRelations, setSeat, toggleSeatLock, clearAllSeats, toggleHiddenSeat, smartSortSeats } from "@/lib/students.functions";
import { getClass, updateClass, type RoomObject, type RoomObjectType, ROOM_OBJECT_TYPES } from "@/lib/classes.functions";
import { listGroups } from "@/lib/groups.functions";
import { computeViolations, type ScoringStudent, type ScoringRelation } from "@/lib/seating-logic";
import { SeatingSnapshots } from "@/components/seating-snapshots";
import { Classroom3D } from "@/components/classroom-3d";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Box } from "lucide-react";
import { SeatingWizardModal } from "@/components/SeatingWizardModal";
import {
  emptyHistory, recordChange, undo as undoHistory, redo as redoHistory,
  canUndo, canRedo, type SeatHistory, type SeatSnapshot,
} from "@/lib/seat-history";
import {
  printSeatingLayout, exportSeatingPdf, printSeatKey, PAPER_SIZE_LABELS,
  DEFAULT_SEATING_PRINT_OPTIONS, type SeatingPrintCell, type SeatingPrintOptions,
  type PaperSize, type PaperOrientation,
} from "@/lib/print-seating";

type Student = {
  id: string; class_id: string; name: string;
  height: "low" | "mid" | "high"; row_pref: "front" | "mid" | "back" | "any";
  corner_pref: boolean; seat_row: number | null; seat_col: number | null; seat_locked: boolean;
  has_special_accommodation?: boolean; accommodation_note?: string | null;
};

const seatKey = (r: number, c: number) => `${r}:${c}`;
/** רוחב אובייקט בעמודות — תמיד בין 1 ל-6 */
const objSpan = (o: RoomObject) => Math.max(1, Math.min(6, o.span ?? 1));
/** כל המשבצות שאובייקט תופס (רצף מחובר על פני כמה מקומות) */
const objCells = (o: RoomObject) => {
  const keys: string[] = [];
  for (let i = 0; i < objSpan(o); i++) keys.push(seatKey(o.row, o.col + i));
  return keys;
};

export const ROOM_OBJECT_META: Record<RoomObjectType, { label: string; icon: typeof Star; className: string }> = {
  board: { label: "לוח מחיק", icon: Presentation, className: "bg-slate-700 text-white" },
  teacher_desk: { label: "שולחן מורה", icon: PanelTopOpen, className: "bg-amber-700 text-white" },
  cabinet: { label: "ארון", icon: Rows3, className: "bg-stone-600 text-white" },
  reading_corner: { label: "פינת קריאה", icon: BookOpen, className: "bg-emerald-700 text-white" },
  door: { label: "דלת", icon: DoorOpen, className: "bg-blue-700 text-white" },
  window: { label: "חלון", icon: Armchair, className: "bg-sky-500 text-white" },
};

function StudentChip({ student, dragging, highlight, groupColor }: { student: Student; dragging?: boolean; highlight?: "friend" | "avoid" | "distance" | "self" | null; groupColor?: string | null }) {
  const cls =
    highlight === "self" ? "ring-2 ring-primary bg-primary/20"
    : highlight === "friend" ? "ring-2 ring-emerald-500 bg-emerald-500/15"
    : highlight === "avoid" ? "ring-2 ring-red-500 bg-red-500/15"
    : highlight === "distance" ? "ring-2 ring-amber-500 bg-amber-500/15"
    : "bg-primary/10";
  return (
    <div
      className={`select-none rounded-md border px-2 py-1 text-xs font-medium text-foreground shadow-sm ${cls} ${dragging ? "opacity-90 shadow-lg" : ""}`}
      style={groupColor && !highlight ? { borderColor: groupColor, boxShadow: `inset 0 0 0 9999px ${groupColor}22` } : undefined}
      title={student.has_special_accommodation ? (student.accommodation_note || "התאמות/צרכים מיוחדים") : undefined}
    >
      <div className="flex items-center gap-1">
        {student.seat_locked && <Lock className="h-3 w-3 text-amber-600" />}
        {student.has_special_accommodation && (
          <Star
            className="h-3 w-3 shrink-0 fill-amber-400 text-amber-500"
            aria-label={`התאמות: ${student.accommodation_note || "צרכים מיוחדים"}`}
          />
        )}
        {groupColor && <span className="inline-block h-2 w-2 rounded-full" style={{ background: groupColor }} aria-hidden />}
        <span className="truncate max-w-[8rem]">{student.name}</span>
      </div>
    </div>
  );
}

function DraggableStudent({ student, id, highlight, onClick, groupColor }: { student: Student; id: string; highlight?: "friend" | "avoid" | "distance" | "self" | null; onClick?: () => void; groupColor?: string | null }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: { studentId: student.id } });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={onClick}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}>
      <StudentChip student={student} highlight={highlight} groupColor={groupColor} />
    </div>
  );
}

function Seat({
  row, col, hidden, child, onToggleHide, onToggleLock, lockedChild, highlight, onSelect, groupColor,
  roomObject, onDeleteObject, onUpdateObject, seatNumber, maxSpan,
  a11y, focused, grabbedId, onFocusSeat, seatRef,
}: {
  row: number; col: number; hidden: boolean; child: Student | null;
  onToggleHide: () => void; onToggleLock: () => void; lockedChild: boolean;
  highlight?: "friend" | "avoid" | "distance" | "self" | null;
  onSelect?: () => void;
  groupColor?: string | null;
  roomObject?: RoomObject | null;
  onDeleteObject?: (id: string) => void;
  onUpdateObject?: (id: string, patch: { label?: string; span?: number }) => void;
  /** מספר מקום ישיבה — רק למשבצות ישיבה אמיתיות (אובייקטים ומוסתרים לא נספרים) */
  seatNumber?: number | null;
  /** הרוחב המקסימלי האפשרי לאובייקט במשבצת הזו */
  maxSpan?: number;
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
      style={{
        ...(groupColor ? { background: `linear-gradient(135deg, ${groupColor}1a, transparent 60%)`, borderColor: `${groupColor}55` } : {}),
        ...(roomObject && objSpan(roomObject) > 1 ? { gridColumn: `span ${objSpan(roomObject)} / span ${objSpan(roomObject)}` } : {}),
      }}
      className={`group relative flex aspect-[4/3] items-center justify-center rounded-md border bg-card p-1 transition-colors ${
        isOver ? "border-primary bg-primary/10" : "border-border"
      } ${a11y && focused ? "outline outline-2 outline-offset-2 outline-primary z-10" : ""} ${a11y ? "focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary focus:z-10" : ""} ${grabbedId && !child ? "ring-2 ring-primary/60" : ""}`}
    >
      <div className="absolute top-0.5 left-0.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {child && (
          <button type="button" onClick={onToggleLock}
            aria-label={lockedChild ? "פתח נעילה" : "נעל מושב"}
            className="rounded p-0.5 hover:bg-accent" title={lockedChild ? "פתח נעילה" : "נעל מושב"}>
            {lockedChild ? <Lock className="h-3 w-3 text-amber-600" /> : <Unlock className="h-3 w-3" />}
          </button>
        )}
        {!child && !roomObject && (
          <button type="button" onClick={onToggleHide}
            aria-label="הסתר מושב"
            className="rounded p-0.5 hover:bg-accent" title="הסתר מושב">
            <EyeOff className="h-3 w-3" />
          </button>
        )}
        {roomObject && onDeleteObject && (
          <button type="button" onClick={() => onDeleteObject(roomObject.id)}
            aria-label="מחק אובייקט" className="rounded p-0.5 hover:bg-destructive/20 text-destructive" title="מחק">
            <X className="h-3 w-3" />
          </button>
        )}
        {roomObject && onUpdateObject && (
          <RoomObjectEditor obj={roomObject} maxSpan={maxSpan ?? 1} onSave={(patch) => onUpdateObject(roomObject.id, patch)} />
        )}
      </div>
      {roomObject ? (
        <span className="absolute bottom-0.5 right-1 text-[9px] text-muted-foreground">אובייקט</span>
      ) : (
        <span
          className="absolute bottom-0.5 right-1 text-[9px] font-semibold text-muted-foreground"
          title={`מקום ${seatNumber} · שורה ${row + 1} עמודה ${col + 1}`}
        >
          מקום {seatNumber}
        </span>
      )}
      {child ? (
        <DraggableStudent student={child} id={`student:${child.id}`} highlight={highlight} onClick={onSelect} groupColor={groupColor} />
      ) : roomObject ? (
        <DraggableRoomObject obj={roomObject} />
      ) : (
        <span className="text-[10px] text-muted-foreground">ריק</span>
      )}
    </div>
  );
}

/** עריכת שם האובייקט והרוחב שלו (רצף מחובר על פני כמה מקומות) */
function RoomObjectEditor({
  obj, maxSpan, onSave,
}: { obj: RoomObject; maxSpan: number; onSave: (patch: { label?: string; span?: number }) => void }) {
  const meta = ROOM_OBJECT_META[obj.type];
  const [label, setLabel] = useState(obj.label ?? "");
  const [span, setSpan] = useState(objSpan(obj));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="ערוך אובייקט" title="ערוך שם ורוחב" className="rounded p-0.5 hover:bg-accent">
          <Settings2 className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3" dir="rtl" align="start">
        <div className="space-y-1">
          <Label htmlFor={`obj-label-${obj.id}`} className="text-xs">שם האובייקט</Label>
          <Input
            id={`obj-label-${obj.id}`}
            value={label}
            placeholder={meta.label}
            maxLength={60}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`obj-span-${obj.id}`} className="text-xs">רוחב (מספר מקומות ברצף)</Label>
          <select
            id={`obj-span-${obj.id}`}
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={span}
            onChange={(e) => setSpan(Number(e.target.value))}
          >
            {Array.from({ length: Math.max(1, Math.min(6, maxSpan)) }).map((_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            רוחב גדול מ-1 יוצר אובייקט מחובר (למשל ארון או לוח) שנפרס על פני כמה מקומות. מקומות שנתפסים כך אינם מקבלים מספר מקום.
          </p>
        </div>
        <Button size="sm" className="w-full" onClick={() => onSave({ label: label.trim(), span })}>
          <Check className="ms-1 h-4 w-4" /> שמור
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function RoomObjectChip({ obj, dragging }: { obj: RoomObject; dragging?: boolean }) {
  const meta = ROOM_OBJECT_META[obj.type];
  const Icon = meta.icon;
  return (
    <div className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold shadow-sm ${meta.className} ${dragging ? "opacity-90 shadow-lg" : ""}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate max-w-[7rem]">{obj.label || meta.label}</span>
    </div>
  );
}

function DraggableRoomObject({ obj }: { obj: RoomObject }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `obj:${obj.id}`, data: { objectId: obj.id },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}>
      <RoomObjectChip obj={obj} />
    </div>
  );
}

function PaletteItem({ type }: { type: RoomObjectType }) {
  const meta = ROOM_OBJECT_META[type];
  const Icon = meta.icon;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `objnew:${type}`, data: { newType: type },
  });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold shadow-sm cursor-grab active:cursor-grabbing ${meta.className} ${isDragging ? "opacity-40" : ""}`}
      title={`גרור ל"${meta.label}"`}
    >
      <Icon className="h-4 w-4" />
      <span>{meta.label}</span>
    </div>
  );
}

function RoomObjectPalette() {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-2 py-3">
        <span className="text-xs font-semibold text-muted-foreground me-2">אובייקטי סביבה — גרור לתוך הגריד:</span>
        {ROOM_OBJECT_TYPES.map((t) => <PaletteItem key={t} type={t} />)}
      </CardContent>
    </Card>
  );
}

// שורות קלאסיות — מילוי רציף שורה-אחר-שורה, מדלג על מושבים מוסתרים/נעולים
function applyClassicRowsTemplate(
  students: Student[],
  rows: number,
  cols: number,
  hiddenSet: Set<string>,
) {
  const movable = students.filter((s) => !s.seat_locked);
  const lockedKeys = new Set<string>();
  for (const s of students) {
    if (s.seat_locked && s.seat_row !== null && s.seat_col !== null) lockedKeys.add(seatKey(s.seat_row, s.seat_col));
  }
  const freeSeats: { row: number; col: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = seatKey(r, c);
      if (!hiddenSet.has(k) && !lockedKeys.has(k)) freeSeats.push({ row: r, col: c });
    }
  }
  const placements: { studentId: string; row: number; col: number }[] = [];
  movable.forEach((s, i) => {
    if (i < freeSeats.length) placements.push({ studentId: s.id, row: freeSeats[i].row, col: freeSeats[i].col });
  });
  return { placements, movable };
}

// צורת ח' — רק היקף הגריד: שורה ראשונה + טור ראשון + טור אחרון, מדלג על מוסתר/נעול
function applyUShapeTemplate(
  students: Student[],
  rows: number,
  cols: number,
  hiddenSet: Set<string>,
) {
  const movable = students.filter((s) => !s.seat_locked);
  const lockedKeys = new Set<string>();
  for (const s of students) {
    if (s.seat_locked && s.seat_row !== null && s.seat_col !== null) lockedKeys.add(seatKey(s.seat_row, s.seat_col));
  }
  const perimeter: { row: number; col: number }[] = [];
  for (let c = 0; c < cols; c++) perimeter.push({ row: 0, col: c }); // שורה ראשונה
  for (let r = 1; r < rows; r++) {
    perimeter.push({ row: r, col: 0 }); // טור ראשון
    if (cols > 1) perimeter.push({ row: r, col: cols - 1 }); // טור אחרון
  }
  const freeSeats = perimeter.filter(({ row, col }) => {
    const k = seatKey(row, col);
    return !hiddenSet.has(k) && !lockedKeys.has(k);
  });
  const placements: { studentId: string; row: number; col: number }[] = [];
  movable.forEach((s, i) => {
    if (i < freeSeats.length) placements.push({ studentId: s.id, row: freeSeats[i].row, col: freeSeats[i].col });
  });
  return { placements, movable };
}

// קבוצות עם מעברים — מילוי רציף תוך דילוג על טורי-מסדרון קבועים (כל טור שלישי)
function applyGroupsWithAislesTemplate(
  students: Student[],
  rows: number,
  cols: number,
  hiddenSet: Set<string>,
  aisleEvery = 3,
) {
  const movable = students.filter((s) => !s.seat_locked);
  const lockedKeys = new Set<string>();
  for (const s of students) {
    if (s.seat_locked && s.seat_row !== null && s.seat_col !== null) lockedKeys.add(seatKey(s.seat_row, s.seat_col));
  }
  const usable: { row: number; col: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((c + 1) % aisleEvery === 0) continue; // טור מסדרון — דלג
      const k = seatKey(r, c);
      if (!hiddenSet.has(k) && !lockedKeys.has(k)) usable.push({ row: r, col: c });
    }
  }
  const placements: { studentId: string; row: number; col: number }[] = [];
  movable.forEach((s, i) => {
    if (i < usable.length) placements.push({ studentId: s.id, row: usable[i].row, col: usable[i].col });
  });
  return { placements, movable };
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
  const listG = useServerFn(listGroups);
  const { data: groupsData } = useQuery({ queryKey: ["groups", classId], queryFn: () => listG({ data: { classId } }) });

  // Map studentId -> primary (first) group color
  const studentColor = useMemo(() => {
    const m = new Map<string, string>();
    if (!groupsData) return m;
    const colorByGroup = new Map(groupsData.groups.map((g) => [g.id, g.color]));
    for (const mem of groupsData.memberships) {
      if (!m.has(mem.student_id)) {
        const c = colorByGroup.get(mem.group_id);
        if (c) m.set(mem.student_id, c);
      }
    }
    return m;
  }, [groupsData]);

  // היסטוריית שינויים (Undo / Redo) של סידור ההושבה
  const [history, setHistory] = useState<SeatHistory>(() => emptyHistory());
  const captureSnapshot = (): SeatSnapshot[] =>
    students.map((s) => ({ id: s.id, seat_row: s.seat_row, seat_col: s.seat_col, seat_locked: s.seat_locked }));
  const pushUndo = () => setHistory((prev) => recordChange(prev, captureSnapshot()));

  // מצב שמירה אוטומטית — כל שינוי בשיבוץ נשמר מיד בשרת
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const rows = cls?.grid_rows ?? 5;
  const cols = cls?.grid_cols ?? 6;
  const hiddenSet = useMemo(() => new Set<string>((cls?.hidden_seats as string[] | undefined) ?? []), [cls?.hidden_seats]);

  // Room objects (persisted on classes.room_objects)
  const roomObjects = useMemo<RoomObject[]>(
    () => {
      const raw = (cls as unknown as { room_objects?: unknown } | undefined)?.room_objects;
      return Array.isArray(raw) ? (raw as RoomObject[]) : [];
    },
    [cls],
  );
  const objectAt = useMemo(() => {
    const m = new Map<string, RoomObject>();
    for (const o of roomObjects) m.set(seatKey(o.row, o.col), o);
    return m;
  }, [roomObjects]);
  /** כל משבצת שאובייקט תופס (כולל המשך של רצף מחובר) → האובייקט עצמו */
  const objectCover = useMemo(() => {
    const m = new Map<string, RoomObject>();
    for (const o of roomObjects) for (const k of objCells(o)) m.set(k, o);
    return m;
  }, [roomObjects]);
  // Seats that must never receive a student: hidden seats + cells taken by room objects.
  const blockedSet = useMemo(() => {
    const s = new Set<string>(hiddenSet);
    for (const o of roomObjects) for (const k of objCells(o)) s.add(k);
    return s;
  }, [hiddenSet, roomObjects]);
  /**
   * מספור מקומות הישיבה: רק משבצות ישיבה אמיתיות מקבלות מספר רץ (1,2,3...).
   * מושבים מוסתרים ומשבצות שאובייקט תופס אינם נספרים כלל.
   */
  const seatNumbers = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = seatKey(r, c);
      if (blockedSet.has(k)) continue;
      m.set(k, ++n);
    }
    return m;
  }, [rows, cols, blockedSet]);
  const [editEnv, setEditEnv] = useState(false);
  const saveObjectsM = useMutation({
    mutationFn: (next: RoomObject[]) => updateClassFn({ data: { id: classId, room_objects: next } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class", classId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const addObject = (type: RoomObjectType, r: number, c: number) => {
    if (hiddenSet.has(seatKey(r, c))) { toast.error("לא ניתן להניח במושב מוסתר"); return; }
    if (seated.get(seatKey(r, c))) { toast.error("המשבצת תפוסה על ידי תלמיד"); return; }
    if (objectCover.get(seatKey(r, c))) { toast.error("המשבצת תפוסה על ידי אובייקט"); return; }
    const id = `obj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    saveObjectsM.mutate([...roomObjects, { id, type, row: r, col: c }]);
  };
  const moveObject = (id: string, r: number, c: number) => {
    const current = roomObjects.find((o) => o.id === id);
    const span = current ? objSpan(current) : 1;
    if (c + span > cols) { toast.error("אין מספיק מקום ברצף — קרב את האובייקט או צמצם את הרוחב"); return; }
    for (let i = 0; i < span; i++) {
      const k = seatKey(r, c + i);
      if (hiddenSet.has(k)) { toast.error("לא ניתן להניח במושב מוסתר"); return; }
      if (seated.get(k)) { toast.error("המשבצת תפוסה"); return; }
      const other = objectCover.get(k);
      if (other && other.id !== id) { toast.error("המשבצת תפוסה"); return; }
    }
    saveObjectsM.mutate(roomObjects.map((o) => o.id === id ? { ...o, row: r, col: c } : o));
  };
  /** עדכון שם/רוחב של אובייקט, כולל בדיקה שהרצף לא חורג ולא דורך על תלמיד או אובייקט אחר */
  const updateObject = (id: string, patch: { label?: string; span?: number }) => {
    const current = roomObjects.find((o) => o.id === id);
    if (!current) return;
    const span = Math.max(1, Math.min(6, patch.span ?? objSpan(current)));
    if (current.col + span > cols) { toast.error("הרוחב חורג מגבול הכיתה"); return; }
    for (let i = 1; i < span; i++) {
      const k = seatKey(current.row, current.col + i);
      if (hiddenSet.has(k)) { toast.error("הרצף עובר על מושב מוסתר"); return; }
      if (seated.get(k)) { toast.error("הרצף עובר על מושב של תלמיד"); return; }
      const other = objectCover.get(k);
      if (other && other.id !== id) { toast.error("הרצף עובר על אובייקט אחר"); return; }
    }
    const label = patch.label?.trim();
    saveObjectsM.mutate(
      roomObjects.map((o) => o.id === id ? { ...o, span, ...(label ? { label } : { label: undefined }) } : o),
    );
  };
  const deleteObject = (id: string) => {
    saveObjectsM.mutate(roomObjects.filter((o) => o.id !== id));
  };

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
  const [activeObject, setActiveObject] = useState<RoomObject | null>(null);
  const [activeNewType, setActiveNewType] = useState<RoomObjectType | null>(null);

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
    setLastSavedAt(new Date());
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
    mutationFn: async () => { pushUndo(); return clearFn({ data: { class_id: classId } }); },
    onSuccess: () => { invalidate(); toast.success("הסידור נוקה (פרט לנעולים)"); },
  });

  const randomM = useMutation({
    mutationFn: async () => {
      pushUndo();
      const lockedKeys = new Set<string>();
      for (const s of students) {
        if (s.seat_locked && s.seat_row !== null && s.seat_col !== null)
          lockedKeys.add(seatKey(s.seat_row, s.seat_col));
      }
      const freeSeats: { row: number; col: number }[] = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const k = seatKey(r, c);
        if (!blockedSet.has(k) && !lockedKeys.has(k)) freeSeats.push({ row: r, col: c });
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
    mutationFn: async () => { pushUndo(); return smartFn({ data: { class_id: classId } }); },
    onSuccess: () => { invalidate(); toast.success("מיון חכם הושלם"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const templateM = useMutation({
    mutationFn: async (fn: (s: Student[], r: number, c: number, h: Set<string>) => { placements: { studentId: string; row: number; col: number }[]; movable: Student[] }) => {
      pushUndo();
      const { placements, movable } = fn(students, rows, cols, blockedSet);
      // clear movable seats first (same approach as מיון אקראי), then assign new positions
      await Promise.all(movable.map((s) =>
        setSeatFn({ data: { class_id: classId, student_id: s.id, seat_row: null, seat_col: null } })));
      for (const p of placements) {
        await setSeatFn({ data: { class_id: classId, student_id: p.studentId, seat_row: p.row, seat_col: p.col } });
      }
    },
    onSuccess: () => { invalidate(); toast.success("התבנית הופעלה"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const runTemplate = (
    fn: (s: Student[], r: number, c: number, h: Set<string>) => { placements: { studentId: string; row: number; col: number }[]; movable: Student[] },
  ) => {
    const hasExisting = students.some((s) => s.seat_row !== null && s.seat_col !== null);
    if (hasExisting) {
      const ok = window.confirm("הפעלת התבנית תחליף את הסידור הנוכחי (מלבד מושבים נעולים). להמשיך?");
      if (!ok) return;
    }
    templateM.mutate(fn);
  };

  const applySnapshot = async (snap: SeatSnapshot[]) => {
    // שחזור סדרתי — כיתות קטנות, וכל setSeat שומר מיד בשרת
    for (const s of snap) {
      await setSeatFn({ data: { class_id: classId, student_id: s.id, seat_row: s.seat_row, seat_col: s.seat_col } });
    }
  };

  const undoM = useMutation({
    mutationFn: async () => {
      const step = undoHistory(history, captureSnapshot());
      if (!step) return false;
      await applySnapshot(step.restore);
      setHistory(step.history);
      return true;
    },
    onSuccess: (ok) => { if (ok) { invalidate(); toast.success("הפעולה בוטלה"); } },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const redoM = useMutation({
    mutationFn: async () => {
      const step = redoHistory(history, captureSnapshot());
      if (!step) return false;
      await applySnapshot(step.restore);
      setHistory(step.history);
      return true;
    },
    onSuccess: (ok) => { if (ok) { invalidate(); toast.success("הפעולה שוחזרה"); } },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  // בניית נתוני ההדפסה מהמצב הנוכחי של הגריד
  const printOptsKey = `seating-print-opts:${classId}`;
  const [printOpts, setPrintOpts] = useState<SeatingPrintOptions>(DEFAULT_SEATING_PRINT_OPTIONS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(printOptsKey);
      if (raw) setPrintOpts({ ...DEFAULT_SEATING_PRINT_OPTIONS, ...JSON.parse(raw) });
      else setPrintOpts(DEFAULT_SEATING_PRINT_OPTIONS);
    } catch { /* התעלם מנתונים פגומים */ }
  }, [printOptsKey]);
  const updatePrintOpts = (patch: Partial<SeatingPrintOptions>) =>
    setPrintOpts((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(printOptsKey, JSON.stringify(next)); } catch { /* אחסון חסום */ }
      return next;
    });

  const buildPrintInput = () => {
    const cells: Record<string, SeatingPrintCell> = {};
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = seatKey(r, c);
      const child = seated.get(k);
      const obj = objectAt.get(k);
      cells[printSeatKey(r, c)] =
        child ? { kind: "student", name: child.name, locked: child.seat_locked }
        : obj ? { kind: "object", label: ROOM_OBJECT_META[obj.type]?.label ?? "אובייקט" }
        : hiddenSet.has(k) ? { kind: "hidden" }
        : { kind: "empty" };
    }
    return {
      className: cls?.name ?? "כיתה",
      rows, cols, cells,
      unseated: unseated.map((s) => s.name),
      options: printOpts,
    };
  };

  const handlePrint = () => {
    if (!printSeatingLayout(buildPrintInput())) {
      toast.error("הדפדפן חסם את חלון ההדפסה — אשר חלונות קופצים ונסה שוב");
    }
  };

  const [pdfBusy, setPdfBusy] = useState(false);
  const handlePdf = async () => {
    setPdfBusy(true);
    try {
      await exportSeatingPdf("seating-grid-canvas", `seating-${cls?.name ?? "class"}.pdf`, printOpts);
      toast.success("קובץ ה-PDF הורד");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ייצוא ה-PDF נכשל");
    } finally {
      setPdfBusy(false);
    }
  };

  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as { studentId?: string; objectId?: string; newType?: RoomObjectType } | undefined;
    if (d?.studentId) setActiveStudent(students.find((s) => s.id === d.studentId) ?? null);
    else if (d?.objectId) setActiveObject(roomObjects.find((o) => o.id === d.objectId) ?? null);
    else if (d?.newType) setActiveNewType(d.newType);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const d = e.active.data.current as { studentId?: string; objectId?: string; newType?: RoomObjectType } | undefined;
    setActiveStudent(null); setActiveObject(null); setActiveNewType(null);
    if (!e.over) return;
    const overId = String(e.over.id);
    const overData = e.over.data.current as { row?: number; col?: number } | undefined;

    if (d?.objectId) {
      if (overId === "tray") { deleteObject(d.objectId); return; }
      if (overData?.row === undefined || overData.col === undefined) return;
      moveObject(d.objectId, overData.row, overData.col);
      return;
    }
    if (d?.newType) {
      if (overData?.row === undefined || overData.col === undefined) return;
      addObject(d.newType, overData.row, overData.col);
      return;
    }
    const sid = d?.studentId;
    if (!sid) return;
    const student = students.find((s) => s.id === sid);
    if (!student || student.seat_locked) {
      if (student?.seat_locked) toast.error("המושב נעול");
      return;
    }
    if (overId === "tray") {
      moveM.mutate({ student_id: sid, seat_row: null, seat_col: null });
      return;
    }
    if (overData?.row === undefined || overData.col === undefined) return;
    if (objectAt.get(seatKey(overData.row, overData.col))) { toast.error("המשבצת תפוסה על ידי אובייקט"); return; }
    const occupant = seated.get(seatKey(overData.row, overData.col));
    if (occupant?.seat_locked) { toast.error("המושב היעד נעול"); return; }
    pushUndo();
    moveM.mutate({ student_id: sid, seat_row: overData.row, seat_col: overData.col });
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className={`space-y-4 ${highContrast ? "contrast-125 [&_*]:!border-foreground/60" : ""}`}>
        <div aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</div>
        {/* Toolbar: grouped by intent — first "arrange", then "room", then "view" */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-[11px] font-semibold text-muted-foreground sm:inline">סידור</span>
            <Button size="sm" onClick={() => smartM.mutate()} disabled={smartM.isPending || students.length === 0}>
              <Sparkles className="ms-1 h-4 w-4" /> מיון חכם
            </Button>
            <SeatingWizardModal classId={classId} studentNameById={new Map(students.map((s) => [s.id, s.name]))} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={students.length === 0}>
                  <Rows3 className="ms-1 h-4 w-4" /> תבניות
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>תבניות הושבה</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => runTemplate(applyClassicRowsTemplate)}>שורות קלאסיות</DropdownMenuItem>
                <DropdownMenuItem onClick={() => runTemplate(applyUShapeTemplate)}>צורת ח׳</DropdownMenuItem>
                <DropdownMenuItem onClick={() => runTemplate(applyGroupsWithAislesTemplate)}>קבוצות עם מעברים</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => randomM.mutate()}>מיון אקראי</DropdownMenuItem>
                <DropdownMenuItem onClick={() => clearM.mutate()} className="text-destructive">נקה סידור</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" onClick={() => undoM.mutate()}
              disabled={!canUndo(history) || undoM.isPending} title="בטל את השינוי האחרון">
              <Undo2 className="ms-1 h-4 w-4" /> בטל{canUndo(history) ? ` (${history.past.length})` : ""}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => redoM.mutate()}
              disabled={!canRedo(history) || redoM.isPending} title="בצע מחדש את השינוי שבוטל">
              <Redo2 className="ms-1 h-4 w-4" /> בצע מחדש{canRedo(history) ? ` (${history.future.length})` : ""}
            </Button>
            <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" aria-hidden />
            <span className="hidden text-[11px] font-semibold text-muted-foreground sm:inline">סביבת הכיתה</span>
            <Button size="sm" variant={editEnv ? "default" : "outline"} onClick={() => setEditEnv((v) => !v)} title="הוסף/הזז אובייקטי סביבה">
              <Presentation className="ms-1 h-4 w-4" /> {editEnv ? "סיים עריכה" : "עריכת סביבה"}
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground" aria-live="polite">
              {moveM.isPending || saveObjectsM.isPending || hideM.isPending || lockM.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> שומר…</>
              ) : (
                <><Check className="h-3.5 w-3.5 text-emerald-600" /> נשמר אוטומטית
                  {lastSavedAt ? ` · ${lastSavedAt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </>
              )}
            </span>
            <Button size="sm" variant="ghost" onClick={handlePrint} title="הדפסת פריסת ההושבה">
              <Printer className="ms-1 h-4 w-4" /> הדפסה
            </Button>
            <Button size="sm" variant="ghost" onClick={handlePdf} disabled={pdfBusy} title="ייצוא הפריסה ל-PDF">
              {pdfBusy ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <FileDown className="ms-1 h-4 w-4" />} PDF
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" title="הגדרות הדפסה" aria-label="הגדרות הדפסה">
                  <Settings2 className="ms-1 h-4 w-4" /> הגדרות הדפסה
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" dir="rtl" className="w-80 space-y-3 text-sm">
                <div className="font-semibold">הגדרות הדפסה</div>
                <div className="space-y-1">
                  <Label htmlFor="print-paper">גודל נייר</Label>
                  <select
                    id="print-paper"
                    value={printOpts.paperSize}
                    onChange={(e) => updatePrintOpts({ paperSize: e.target.value as PaperSize })}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  >
                    {(Object.keys(PAPER_SIZE_LABELS) as PaperSize[]).map((p) => (
                      <option key={p} value={p}>{PAPER_SIZE_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="print-orientation">כיוון הדף</Label>
                  <select
                    id="print-orientation"
                    value={printOpts.orientation}
                    onChange={(e) => updatePrintOpts({ orientation: e.target.value as PaperOrientation })}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="landscape">לרוחב</option>
                    <option value="portrait">לאורך</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="print-margin">שוליים (מ״מ)</Label>
                  <Input
                    id="print-margin"
                    type="number"
                    min={0}
                    max={40}
                    value={printOpts.marginMm}
                    onChange={(e) => updatePrintOpts({ marginMm: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="print-title">כותרת מותאמת אישית</Label>
                  <Input
                    id="print-title"
                    value={printOpts.title ?? ""}
                    placeholder={`פריסת הושבה — ${cls?.name ?? "כיתה"}`}
                    onChange={(e) => updatePrintOpts({ title: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="print-footer">כותרת תחתונה</Label>
                  <Input
                    id="print-footer"
                    value={printOpts.footer ?? ""}
                    placeholder="הופק במערכת ClassAlign Studio"
                    onChange={(e) => updatePrintOpts({ footer: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="print-positions">הצגת מספרי מקום בכל תא</Label>
                  <Switch
                    id="print-positions"
                    checked={printOpts.showPositions !== false}
                    onCheckedChange={(v) => updatePrintOpts({ showPositions: v })}
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => updatePrintOpts(DEFAULT_SEATING_PRINT_OPTIONS)}>
                  איפוס להגדרות ברירת המחדל
                </Button>
              </PopoverContent>
            </Popover>
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
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" aria-label="תצוגת מבטים תלת־ממדית">
                  <Box className="ms-1 h-4 w-4" /> מבטים
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl" dir="rtl">
                <DialogHeader>
                  <DialogTitle>מבטי הכיתה בתלת־ממד</DialogTitle>
                </DialogHeader>
                <Classroom3D
                  rows={rows}
                  cols={cols}
                  hidden={[...hiddenSet]}
                  objects={roomObjects.map((o) => ({ row: o.row, col: o.col, type: o.type }))}
                  seats={students
                    .filter((st) => st.seat_row !== null && st.seat_col !== null)
                    .map((st) => ({ row: st.seat_row as number, col: st.seat_col as number, name: st.name }))}
                />
              </DialogContent>
            </Dialog>
            <SeatingSnapshots classId={classId} />
          </div>
        </div>

        {editEnv && <RoomObjectPalette />}

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
              Array.from({ length: cols }).flatMap((__, c) => {
                const child = seated.get(seatKey(r, c)) ?? null;
                const obj = objectAt.get(seatKey(r, c)) ?? null;
                const cover = objectCover.get(seatKey(r, c)) ?? null;
                // משבצת שהיא המשך של אובייקט מחובר — לא מרנדרים, האובייקט נפרס עליה
                if (cover && !obj) return [];
                // כמה מקומות פנויים יש מכאן ועד סוף השורה — הרוחב המקסימלי לאובייקט
                let maxSpan = 1;
                if (obj) {
                  for (let i = 1; i < 6 && c + i < cols; i++) {
                    const k = seatKey(r, c + i);
                    const other = objectCover.get(k);
                    if (hiddenSet.has(k) || seated.get(k) || (other && other.id !== obj.id)) break;
                    maxSpan = i + 1;
                  }
                }
                const hl = child ? highlightMap.get(child.id) ?? null : null;
                const gc = child ? studentColor.get(child.id) ?? null : null;
                return [(
                  <Seat key={`${r}-${c}`} row={r} col={c}
                    hidden={hiddenSet.has(seatKey(r, c))}
                    child={child}
                    lockedChild={!!child?.seat_locked}
                    highlight={hl}
                    groupColor={gc}
                    roomObject={obj}
                    seatNumber={seatNumbers.get(seatKey(r, c)) ?? null}
                    maxSpan={maxSpan}
                    onDeleteObject={editEnv ? deleteObject : undefined}
                    onUpdateObject={editEnv ? updateObject : undefined}
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
                )];
              }),
            )}
          </div>
          {a11y && (
            <div className="mt-2 text-center text-[11px] text-muted-foreground">
              {grabbedId ? `מצב הרמה: ${nameOf(grabbedId)} — בחר מושב יעד והקש Enter (Esc לביטול)` : "השתמש בחיצים לניווט, Enter להרמה/הנחה"}
            </div>
          )}
        </div>

        <UnseatedTray students={unseated} highlightMap={highlightMap} studentColor={studentColor} onSelect={(id) => setSelectedId((cur) => cur === id ? null : id)} />

        <ViolationsPanel violations={violations} nameOf={nameOf} onFocus={setSelectedId} />
      </div>

      <DragOverlay>
        {activeStudent ? <StudentChip student={activeStudent} dragging />
          : activeObject ? <RoomObjectChip obj={activeObject} dragging />
          : activeNewType ? <RoomObjectChip obj={{ id: "new", type: activeNewType, row: 0, col: 0 }} dragging />
          : null}
      </DragOverlay>
    </DndContext>
  );
}

function UnseatedTray({ students, highlightMap, studentColor, onSelect }: { students: Student[]; highlightMap: Map<string, "friend" | "avoid" | "distance" | "self">; studentColor: Map<string, string>; onSelect: (id: string) => void }) {
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
              groupColor={studentColor.get(s.id) ?? null}
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
