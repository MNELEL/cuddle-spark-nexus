import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getClass } from "@/lib/classes.functions";
import { listStudents } from "@/lib/students.functions";
import { listClassScoreInputs } from "@/lib/scoring.functions";
import { computeStudentScore, tierColorClasses } from "@/lib/performance-score";
import { Button } from "@/components/ui/button";
import { ArrowRight, Printer, Box, Square, Eye, EyeOff, Hash, Plane, User, RotateCcw, MoveHorizontal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/classes/$classId/display")({
  component: DisplayMode,
});

type Student = {
  id: string; name: string;
  seat_row: number | null; seat_col: number | null;
};

type Preset = "normal" | "bird" | "student" | "side";
const PRESETS: Record<Preset, { pitch: number; yaw: number; zoom: number; label: string }> = {
  normal:  { pitch: 35, yaw: 0,   zoom: 1.00, label: "רגיל" },
  bird:    { pitch: 80, yaw: 0,   zoom: 0.85, label: "מבט-על" },
  student: { pitch: 25, yaw: 0,   zoom: 1.15, label: "עיני תלמיד" },
  side:    { pitch: 45, yaw: 45,  zoom: 0.95, label: "מהצד" },
};

// Detect weak devices once on mount, before paint, to keep the first render light.
function detectLowPower(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const cores = nav.hardwareConcurrency ?? 8;
  const mem = nav.deviceMemory ?? 8;
  const saveData = nav.connection?.saveData === true;
  const slowNet = nav.connection?.effectiveType === "2g" || nav.connection?.effectiveType === "slow-2g";
  return Boolean(reduce) || cores <= 4 || mem <= 4 || saveData || slowNet;
}

function DisplayMode() {
  const { classId } = Route.useParams();
  const getC = useServerFn(getClass);
  const listS = useServerFn(listStudents);
  const listScores = useServerFn(listClassScoreInputs);

  const { data: cls } = useQuery({ queryKey: ["class", classId], queryFn: () => getC({ data: { id: classId } }) });
  const { data: students = [] } = useQuery({
    queryKey: ["students", classId],
    queryFn: () => listS({ data: { classId } }),
  }) as { data: Student[] };
  const { data: scoreInputs } = useQuery({
    queryKey: ["score-inputs", classId],
    queryFn: () => listScores({ data: { classId } }),
  });

  const [is3D, setIs3D] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showNames, setShowNames] = useState(true);
  const [pitch, setPitch] = useState(PRESETS.normal.pitch);
  const [yaw, setYaw] = useState(PRESETS.normal.yaw);
  const [zoom, setZoom] = useState(PRESETS.normal.zoom);
  const [lowPower, setLowPower] = useState(false);
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setLowPower(detectLowPower()); }, []);

  // rAF-throttled setters for slider drags — avoid React re-renders on every input event.
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ pitch?: number; yaw?: number; zoom?: number }>({});
  const flush = useCallback(() => {
    rafRef.current = null;
    const p = pendingRef.current;
    pendingRef.current = {};
    if (p.pitch !== undefined) setPitch(p.pitch);
    if (p.yaw !== undefined) setYaw(p.yaw);
    if (p.zoom !== undefined) setZoom(p.zoom);
  }, []);
  const schedule = useCallback((patch: { pitch?: number; yaw?: number; zoom?: number }) => {
    Object.assign(pendingRef.current, patch);
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(flush);
  }, [flush]);
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  const rows = cls?.grid_rows ?? 5;
  const cols = cls?.grid_cols ?? 6;
  const hidden = useMemo(
    () => new Set<string>(((cls?.hidden_seats as string[] | undefined) ?? [])),
    [cls?.hidden_seats],
  );
  const seated = useMemo(() => {
    const m = new Map<string, Student>();
    for (const s of students) {
      if (s.seat_row !== null && s.seat_col !== null) m.set(`${s.seat_row}:${s.seat_col}`, s);
    }
    return m;
  }, [students]);

  // sequential seat numbers row-major
  const seatNumber = useMemo(() => {
    const m = new Map<string, number>();
    let n = 1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = `${r}:${c}`;
      if (!hidden.has(k)) m.set(k, n++);
    }
    return m;
  }, [rows, cols, hidden]);

  // Pre-compute every student's score once per scoreInputs change instead of on every cell render.
  const scoreByStudent = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeStudentScore>>();
    if (!scoreInputs) return m;
    for (const s of students) {
      m.set(s.id, computeStudentScore(s.id, scoreInputs.grades, scoreInputs.attendance, scoreInputs.behavior));
    }
    return m;
  }, [students, scoreInputs]);

  const applyPreset = (p: Preset) => {
    setIs3D(true);
    setPitch(PRESETS[p].pitch);
    setYaw(PRESETS[p].yaw);
    setZoom(PRESETS[p].zoom);
  };

  // Only enable smooth transition when preset jumps (not while dragging sliders).
  const transitionClass = dragging ? "" : "transition-transform duration-500 ease-out";
  const stopDrag = () => setDragging(false);

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 md:p-8 print:p-0">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <Link to="/classes/$classId" params={{ classId }}>
            <Button variant="ghost" size="sm">
              <ArrowRight className="ms-1 h-4 w-4" /> חזרה לכיתה
            </Button>
          </Link>
          <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight">
            {cls?.name ?? "..."} — סידור הושבה
          </h1>
          <div className="flex gap-2">
            <Button size="sm" variant={is3D ? "default" : "outline"} onClick={() => setIs3D((v) => !v)}>
              {is3D ? <Square className="ms-1 h-4 w-4" /> : <Box className="ms-1 h-4 w-4" />}
              {is3D ? "מצב דו-ממד" : "מצב תלת-ממד"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="ms-1 h-4 w-4" /> הדפסה
            </Button>
          </div>
        </div>

        <div className="hidden print:block text-center text-2xl font-bold mb-4">
          {cls?.name} — סידור הושבה
        </div>

        {/* Stage */}
        <div
          ref={stageRef}
          className="rounded-2xl border-2 border-amber/40 bg-card p-6 md:p-10 shadow-lg print:shadow-none print:border-foreground overflow-hidden"
          style={is3D ? {
            perspective: lowPower ? "1800px" : "1250px",
            perspectiveOrigin: "50% 30%",
            contain: "layout paint",
          } : undefined}
        >
          <div className="mb-4 rounded-md bg-amber/15 py-2 text-center text-sm md:text-lg font-bold tracking-wide text-amber">
            חזית הכיתה · לוח
          </div>

          <div
            className={transitionClass}
            style={is3D ? {
              transformStyle: "preserve-3d",
              transform: `translateZ(0) rotateX(${pitch}deg) rotateY(${yaw}deg) scale(${zoom})`,
              transformOrigin: "50% 50%",
              willChange: dragging ? "transform" : "auto",
              backfaceVisibility: "hidden",
            } : undefined}
          >
            <div
              className="grid gap-2 md:gap-3"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
                transformStyle: is3D ? "preserve-3d" : undefined,
                contentVisibility: "auto",
              }}
            >
              {Array.from({ length: rows }).flatMap((_, r) =>
                Array.from({ length: cols }).map((__, c) => {
                  const k = `${r}:${c}`;
                  if (hidden.has(k)) {
                    return <div key={k} className="aspect-[5/3] rounded-md border border-dashed border-muted/40 print:hidden" />;
                  }
                  const child = seated.get(k);
                  const num = seatNumber.get(k);
                  const sc = child ? scoreByStudent.get(child.id) ?? null : null;
                  const tc = sc ? tierColorClasses(sc.tier) : null;
                  const display = child ? (showNames ? child.name : `שולחן ${num}`) : null;
                  return (
                    <div
                      key={k}
                      className={`relative flex aspect-[5/3] items-center justify-center rounded-lg border p-2 text-center transition ${
                        child ? "border-amber/40 bg-amber/5" : "border-dashed border-muted bg-muted/10"
                      }`}
                      style={is3D ? { transformStyle: "preserve-3d", backfaceVisibility: "hidden" } : undefined}
                    >
                      {/* Seat number badge */}
                      {showLabels && !hidden.has(k) && (
                        <span className="absolute top-1 right-1 rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground print:hidden">
                          #{num}
                        </span>
                      )}

                      {/* Score tooltip floating above (3D only, skipped while dragging or on low-power devices) */}
                      {is3D && !dragging && !lowPower && child && sc && tc && (
                        <div
                          className={`absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full rounded-md border ${tc.border} ${tc.bg} px-2 py-1 text-xs font-bold ${tc.text} shadow-md print:hidden whitespace-nowrap`}
                          style={{ transform: "translateX(-50%) translateY(-100%) translateZ(15px)" }}
                        >
                          ציון {sc.score}
                          <span className="block h-2 w-2 mx-auto -mb-2 mt-1 rotate-45 border-b border-l ${tc.border} ${tc.bg}" />
                        </div>
                      )}

                      {child ? (
                        <span className="font-display text-lg md:text-3xl font-bold leading-tight text-foreground break-words">
                          {display}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">ריק</span>
                      )}
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground print:hidden">
          {students.filter((s) => s.seat_row !== null).length} / {students.length} תלמידים משובצים
        </div>
      </div>

      {/* HUD — presentation control bar */}
      {is3D && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 print:hidden animate-fade-in">
          <div className={`rounded-2xl border border-amber/30 ${lowPower ? "bg-card" : "bg-card/95 backdrop-blur-md"} shadow-2xl px-3 py-2 md:px-4 md:py-3 flex flex-wrap items-center gap-2 md:gap-3`}>
            <Button size="sm" variant={showLabels ? "default" : "outline"} onClick={() => setShowLabels((v) => !v)}>
              <Hash className="ms-1 h-4 w-4" /> מספרים
            </Button>
            <Button size="sm" variant={showNames ? "default" : "outline"} onClick={() => setShowNames((v) => !v)}>
              {showNames ? <Eye className="ms-1 h-4 w-4" /> : <EyeOff className="ms-1 h-4 w-4" />}
              {showNames ? "שמות" : "אנונימי"}
            </Button>
            <div className="w-px h-6 bg-border" />
            <Button size="sm" variant="ghost" onClick={() => applyPreset("normal")}>
              <RotateCcw className="ms-1 h-4 w-4" /> רגיל
            </Button>
            <Button size="sm" variant="ghost" onClick={() => applyPreset("bird")}>
              <Plane className="ms-1 h-4 w-4" /> מבט-על
            </Button>
            <Button size="sm" variant="ghost" onClick={() => applyPreset("student")}>
              <User className="ms-1 h-4 w-4" /> עיני תלמיד
            </Button>
            <Button size="sm" variant="ghost" onClick={() => applyPreset("side")}>
              <MoveHorizontal className="ms-1 h-4 w-4" /> מהצד
            </Button>
            <div className="w-px h-6 bg-border" />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono w-10">{pitch}°</span>
              <input type="range" min={0} max={90} value={pitch}
                onPointerDown={() => setDragging(true)} onPointerUp={stopDrag} onPointerCancel={stopDrag}
                onChange={(e) => schedule({ pitch: +e.target.value })}
                className="w-24 accent-amber" />
              <span>גובה</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono w-10">{yaw}°</span>
              <input type="range" min={-180} max={180} value={yaw}
                onPointerDown={() => setDragging(true)} onPointerUp={stopDrag} onPointerCancel={stopDrag}
                onChange={(e) => schedule({ yaw: +e.target.value })}
                className="w-24 accent-amber" />
              <span>סטייה</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono w-10">{zoom.toFixed(2)}x</span>
              <input type="range" min={0.5} max={1.5} step={0.05} value={zoom}
                onPointerDown={() => setDragging(true)} onPointerUp={stopDrag} onPointerCancel={stopDrag}
                onChange={(e) => schedule({ zoom: +e.target.value })}
                className="w-20 accent-amber" />
              <span>זום</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}