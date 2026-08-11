import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { RoomObjectType } from "@/lib/classes.functions";

export type Seat3D = { row: number; col: number; name: string };
export type Object3D = { row: number; col: number; type: RoomObjectType };

type Props = {
  rows: number;
  cols: number;
  seats: Seat3D[];
  objects?: Object3D[];
  hidden?: string[];
};

/** Camera presets: teacher's point of view, the students' point of view, and a side view. */
const PRESETS = {
  teacher: { label: "מכיוון המורה", rotX: 58, rotY: 0, zoom: 1 },
  students: { label: "מכיוון התלמידים", rotX: 58, rotY: 180, zoom: 1 },
  side: { label: "מהצד", rotX: 68, rotY: 90, zoom: 0.9 },
} as const;
type PresetId = keyof typeof PRESETS;

const OBJ_STYLE: Record<RoomObjectType, { label: string; color: string; height: number }> = {
  board: { label: "לוח", color: "#1e293b", height: 46 },
  teacher_desk: { label: "שולחן מורה", color: "#92400e", height: 24 },
  cabinet: { label: "ארון", color: "#57534e", height: 56 },
  reading_corner: { label: "פינת קריאה", color: "#047857", height: 18 },
  door: { label: "דלת", color: "#1d4ed8", height: 62 },
  window: { label: "חלון", color: "#0ea5e9", height: 40 },
};

const CELL = 62;
const GAP = 14;

export function Classroom3D({ rows, cols, seats, objects = [], hidden = [] }: Props) {
  const [preset, setPreset] = useState<PresetId>("teacher");
  const [rotX, setRotX] = useState<number>(PRESETS.teacher.rotX);
  const [rotY, setRotY] = useState<number>(PRESETS.teacher.rotY);
  const [zoom, setZoom] = useState<number>(1);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);

  const applyPreset = (id: PresetId) => {
    setPreset(id);
    setRotX(PRESETS[id].rotX);
    setRotY(PRESETS[id].rotY);
    setZoom(PRESETS[id].zoom);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, rx: rotX, ry: rotY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setRotX(Math.min(85, Math.max(10, d.rx - (e.clientY - d.y) * 0.4)));
    setRotY(d.ry + (e.clientX - d.x) * 0.4);
  };
  const onPointerUp = () => { drag.current = null; };

  const width = cols * CELL + (cols - 1) * GAP;
  const depth = rows * CELL + (rows - 1) * GAP;
  const hiddenSet = new Set(hidden);
  const pos = (row: number, col: number) => ({
    left: col * (CELL + GAP),
    top: row * (CELL + GAP),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(PRESETS) as PresetId[]).map((id) => (
          <Button
            key={id}
            size="sm"
            variant={preset === id ? "default" : "outline"}
            aria-pressed={preset === id}
            onClick={() => applyPreset(id)}
          >
            {PRESETS[id].label}
          </Button>
        ))}
        <div className="flex min-w-[180px] flex-1 items-center gap-2 text-xs text-muted-foreground">
          זום
          <Slider value={[zoom * 100]} min={50} max={160} step={5}
            onValueChange={(v) => setZoom((v[0] ?? 100) / 100)} aria-label="זום" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">גרירה עם העכבר או האצבע מסובבת את הכיתה בתלת־ממד.</p>

      <div
        className="relative touch-none overflow-hidden rounded-xl border bg-gradient-to-b from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900"
        style={{ height: 460, perspective: "1400px", cursor: "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        role="img"
        aria-label={`תצוגת כיתה תלת־ממדית, ${rows} שורות על ${cols} עמודות, ${seats.length} תלמידים`}
      >
        {/* ceiling */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/70 to-transparent dark:from-slate-700/50"
          aria-hidden
        />
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            transform: `translate(-50%, -50%) scale(${zoom}) rotateX(${rotX}deg) rotateZ(${rotY}deg)`,
            transformStyle: "preserve-3d",
            width, height: depth,
          }}
        >
          {/* floor */}
          <div
            className="absolute inset-0 rounded-md border border-stone-400/60"
            style={{
              backgroundImage:
                "linear-gradient(45deg, rgba(120,113,108,.18) 25%, transparent 25%, transparent 75%, rgba(120,113,108,.18) 75%), linear-gradient(45deg, rgba(120,113,108,.18) 25%, transparent 25%, transparent 75%, rgba(120,113,108,.18) 75%)",
              backgroundSize: "40px 40px",
              backgroundPosition: "0 0, 20px 20px",
              backgroundColor: "#d6d3d1",
              transform: "translateZ(0px)",
            }}
            aria-hidden
          />

          {/* room objects */}
          {objects.map((o) => {
            const meta = OBJ_STYLE[o.type];
            const { left, top } = pos(o.row, o.col);
            return (
              <div key={`o-${o.row}-${o.col}`} className="absolute" style={{ left, top, width: CELL, height: CELL, transformStyle: "preserve-3d" }}>
                <div
                  className="absolute inset-0 flex items-center justify-center rounded text-[10px] font-bold text-white shadow-lg"
                  style={{ background: meta.color, transform: `translateZ(${meta.height}px)` }}
                >
                  {meta.label}
                </div>
                <div className="absolute inset-x-1 bottom-0 rounded bg-black/25" style={{ height: 6 }} aria-hidden />
              </div>
            );
          })}

          {/* desks + chairs + name plates */}
          {Array.from({ length: rows }).flatMap((_, r) =>
            Array.from({ length: cols }).map((__, c) => {
              if (hiddenSet.has(`${r}:${c}`)) return null;
              if (objects.some((o) => o.row === r && o.col === c)) return null;
              const student = seats.find((s) => s.row === r && s.col === c);
              const { left, top } = pos(r, c);
              return (
                <div key={`s-${r}-${c}`} className="absolute" style={{ left, top, width: CELL, height: CELL, transformStyle: "preserve-3d" }}>
                  {/* chair */}
                  <div
                    className="absolute rounded-sm bg-slate-500 shadow"
                    style={{ left: 14, top: CELL - 20, width: CELL - 28, height: 14, transform: "translateZ(10px)" }}
                    aria-hidden
                  />
                  {/* desk top */}
                  <div
                    className="absolute rounded-sm border border-amber-900/40 bg-amber-200 shadow-md dark:bg-amber-300"
                    style={{ left: 4, top: 6, width: CELL - 8, height: CELL - 26, transform: "translateZ(20px)" }}
                    aria-hidden
                  />
                  {student && (
                    <div
                      className="absolute flex items-center justify-center"
                      style={{ left: -6, top: 4, width: CELL + 12, transform: `translateZ(58px) rotateX(${-rotX}deg) rotateZ(${-rotY}deg)` }}
                    >
                      <span className="max-w-full truncate rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
                        {student.name}
                      </span>
                    </div>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
