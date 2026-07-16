import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Dices, Gift, Plus, Trash2, Sparkles, Trophy, Minus, RotateCcw, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getClass } from "@/lib/classes.functions";
import { listStudents } from "@/lib/students.functions";
import { listGroups } from "@/lib/groups.functions";

export const Route = createFileRoute("/_authenticated/raffle/$classId")({
  component: RafflePage,
  head: () => ({ meta: [{ title: "הגרלות · גלגל מזל · ClassAlign Studio" }, { name: "robots", content: "noindex" }] }),
});

const DEFAULT_PRIZES = [
  "5 דקות הפסקה נוספת",
  "לבחור מקום ישיבה",
  "פטור משיעורי בית",
  "תעודת הצטיינות",
  "מדבקה מיוחדת",
  "לבחור שיר לכיתה",
  "לצאת ראשון להפסקה",
  "עוזר הרב ליום",
];

type Prize = { id: string; text: string };
type ScoreMap = Record<string, number>;

function useLocalState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [v, setV] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setV(JSON.parse(raw));
    } catch { /* ignore */ }
    loaded.current = true;
  }, [key]);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
  }, [key, v]);
  return [v, setV];
}

function RafflePage() {
  const { classId } = Route.useParams();
  const getC = useServerFn(getClass);
  const listS = useServerFn(listStudents);
  const listG = useServerFn(listGroups);

  const { data: cls } = useQuery({ queryKey: ["class", classId], queryFn: () => getC({ data: { id: classId } }) });
  const { data: students = [] } = useQuery({ queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }) }) as { data: { id: string; name: string }[] };
  const { data: groupsData } = useQuery({ queryKey: ["groups", classId], queryFn: () => listG({ data: { classId } }) });

  type G = { id: string; name: string; color: string };
  type M = { student_id: string; group_id: string };
  const groups: G[] = groupsData?.groups ?? [];
  const memberships: M[] = groupsData?.memberships ?? [];

  const [source, setSource] = useState<string>("all");

  const names = useMemo(() => {
    if (source === "all") return students.map((s) => s.name);
    const ids = new Set(memberships.filter((m) => m.group_id === source).map((m) => m.student_id));
    return students.filter((s) => ids.has(s.id)).map((s) => s.name);
  }, [source, students, memberships]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
        <div className="ms-auto">
          <Link to="/gamification/$classId" params={{ classId }}>
            <Button variant="outline" size="sm"><Trophy className="ms-1 h-4 w-4" /> ניקוד אישי מלא</Button>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border bg-card bg-mesh p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber/15 p-3"><Dices className="h-6 w-6 text-amber" /></div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">הגרלות — {cls?.name ?? "..."}</h1>
            <p className="text-sm text-muted-foreground">גלגל מזל לבחירת תלמיד, הגרלת פרסים וניקוד קבוצתי.</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="students" dir="rtl">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="students">גלגל תלמידים</TabsTrigger>
          <TabsTrigger value="prizes">גלגל פרסים</TabsTrigger>
          <TabsTrigger value="scores">ניקוד קבוצתי</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Label>מקור השמות</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הכיתה ({students.length})</SelectItem>
                  {groups.map((g) => {
                    const c = memberships.filter((m) => m.group_id === g.id).length;
                    return <SelectItem key={g.id} value={g.id}>{g.name} ({c})</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          <Wheel items={names} emptyMsg="אין תלמידים למקור זה" />
        </TabsContent>

        <TabsContent value="prizes" className="mt-4">
          <PrizesPanel classId={classId} />
        </TabsContent>

        <TabsContent value="scores" className="mt-4">
          <GroupScoresPanel classId={classId} groups={groups} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Wheel ---------------- */

const WHEEL_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

function Wheel({ items, emptyMsg }: { items: string[]; emptyMsg: string }) {
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const n = items.length;
  const seg = n > 0 ? 360 / n : 0;

  const spin = () => {
    if (n === 0 || spinning) return;
    setWinner(null);
    const winIdx = Math.floor(Math.random() * n);
    const turns = 6 + Math.floor(Math.random() * 4);
    // Pointer at top (12 o'clock). Segment i center is at (i*seg + seg/2) measured CW from top.
    // We want that center to land at pointer (0°). Final angle mod 360 = -( i*seg + seg/2 ).
    const finalOffset = -(winIdx * seg + seg / 2);
    const target = turns * 360 + finalOffset;
    // Continue from current rotation: pick a new absolute target ≥ current.
    const current = angle;
    const base = current - (current % 360);
    const next = base + target + 360; // ensure forward
    setSpinning(true);
    setAngle(next);
    setTimeout(() => {
      setSpinning(false);
      setWinner(items[winIdx]);
      setHistory((h) => [items[winIdx], ...h].slice(0, 20));
    }, 4200);
  };

  if (n === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">{emptyMsg}</CardContent></Card>;
  }

  const size = 380;
  const r = size / 2;
  const cx = r, cy = r;

  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
      <Card>
        <CardContent className="pt-6">
          <div className="relative mx-auto" style={{ width: size, height: size }}>
            {/* Pointer */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-10 h-0 w-0 border-x-[14px] border-x-transparent border-t-[22px] border-t-amber drop-shadow" />
            <svg
              width={size} height={size} viewBox={`0 0 ${size} ${size}`}
              style={{
                transform: `rotate(${angle}deg)`,
                transition: spinning ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
                filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.25))",
              }}
            >
              {items.map((label, i) => {
                const start = i * seg - 90; // start from top
                const end = start + seg;
                const large = seg > 180 ? 1 : 0;
                const sx = cx + r * Math.cos((start * Math.PI) / 180);
                const sy = cy + r * Math.sin((start * Math.PI) / 180);
                const ex = cx + r * Math.cos((end * Math.PI) / 180);
                const ey = cy + r * Math.sin((end * Math.PI) / 180);
                const path = `M${cx},${cy} L${sx},${sy} A${r},${r} 0 ${large} 1 ${ex},${ey} Z`;
                const mid = start + seg / 2;
                const tx = cx + r * 0.62 * Math.cos((mid * Math.PI) / 180);
                const ty = cy + r * 0.62 * Math.sin((mid * Math.PI) / 180);
                return (
                  <g key={i}>
                    <path d={path} fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} stroke="#0f172a" strokeWidth="1" />
                    <text
                      x={tx} y={ty} fill="#fff" fontSize={Math.max(10, Math.min(16, 140 / n))}
                      textAnchor="middle" dominantBaseline="middle"
                      transform={`rotate(${mid + 90}, ${tx}, ${ty})`}
                      style={{ fontFamily: "Heebo, sans-serif", fontWeight: 700, direction: "rtl" }}
                    >
                      {label.length > 12 ? label.slice(0, 12) + "…" : label}
                    </text>
                  </g>
                );
              })}
              <circle cx={cx} cy={cy} r={22} fill="#0f172a" stroke="#f59e0b" strokeWidth="3" />
            </svg>
          </div>
          <div className="mt-6 flex justify-center">
            <Button size="lg" onClick={spin} disabled={spinning} className="gap-2">
              <Dices className="h-5 w-5" /> {spinning ? "מסתובב..." : "סובב את הגלגל"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {winner && (
          <Card className="border-amber/60 shadow-glow-amber animate-scale-in">
            <CardContent className="pt-6 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-amber mb-2" />
              <div className="text-xs text-muted-foreground mb-1">התוצאה</div>
              <div className="font-display text-3xl font-bold">{winner}</div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold">היסטוריה</h3>
              {history.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setHistory([])}><RotateCcw className="ms-1 h-3.5 w-3.5" /> נקה</Button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">עדיין לא הוגרל.</p>
            ) : (
              <ol className="space-y-1 text-sm font-mono-tabular">
                {history.map((h, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Badge variant="outline">{history.length - i}</Badge> {h}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Prizes ---------------- */

function PrizesPanel({ classId }: { classId: string }) {
  const [prizes, setPrizes] = useLocalState<Prize[]>(
    `raffle:prizes:${classId}`,
    DEFAULT_PRIZES.map((t, i) => ({ id: `d${i}`, text: t })),
  );
  const [newText, setNewText] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const add = () => {
    const t = newText.trim();
    if (!t) return;
    setPrizes((p) => [...p, { id: crypto.randomUUID(), text: t }]);
    setNewText("");
  };
  const remove = (id: string) => setPrizes((p) => p.filter((x) => x.id !== id));
  const saveEdit = () => {
    if (!editId) return;
    setPrizes((p) => p.map((x) => x.id === editId ? { ...x, text: editText.trim() || x.text } : x));
    setEditId(null);
  };
  const resetDefaults = () => setPrizes(DEFAULT_PRIZES.map((t, i) => ({ id: `d${i}`, text: t })));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><Gift className="h-4 w-4 text-amber" /> רשימת הפרסים</h3>
            <Button variant="ghost" size="sm" onClick={resetDefaults}>ברירת מחדל</Button>
          </div>
          <div className="flex gap-2">
            <Input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="פרס חדש..." onKeyDown={(e) => e.key === "Enter" && add()} />
            <Button onClick={add}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1">
            {prizes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">אין פרסים.</p>
            ) : prizes.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded border p-2">
                {editId === p.id ? (
                  <>
                    <Input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
                    <Button size="icon" variant="ghost" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm">{p.text}</span>
                    <Button size="icon" variant="ghost" onClick={() => { setEditId(p.id); setEditText(p.text); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Wheel items={prizes.map((p) => p.text)} emptyMsg="הוסיפו פרסים כדי לסובב" />
    </div>
  );
}

/* ---------------- Group scores ---------------- */

function GroupScoresPanel({ classId, groups }: { classId: string; groups: { id: string; name: string; color: string }[] }) {
  const [scores, setScores] = useLocalState<ScoreMap>(`raffle:groupScores:${classId}`, {});
  const [classScore, setClassScore] = useLocalState<number>(`raffle:classScore:${classId}`, 0);

  const add = (id: string, delta: number) => setScores((s) => ({ ...s, [id]: (s[id] ?? 0) + delta }));
  const reset = () => { setScores({}); setClassScore(0); toast.success("אופס"); };

  const sorted = [...groups].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));
  const max = Math.max(1, ...groups.map((g) => scores[g.id] ?? 0));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold flex items-center gap-2"><Trophy className="h-4 w-4 text-amber" /> ניקוד הכיתה כולה</h3>
            <p className="text-xs text-muted-foreground">ניקוד קולקטיבי לכיתה כתמריץ כללי.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setClassScore(classScore - 1)}><Minus className="h-4 w-4" /></Button>
            <div className="font-display text-3xl font-bold w-16 text-center font-mono-tabular">{classScore}</div>
            <Button variant="outline" size="icon" onClick={() => setClassScore(classScore + 1)}><Plus className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setClassScore(classScore + 5)}>+5</Button>
            <Button variant="ghost" size="sm" onClick={reset} className="ms-2"><RotateCcw className="ms-1 h-3.5 w-3.5" /> אפס הכל</Button>
          </div>
        </CardContent>
      </Card>

      {groups.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          אין קבוצות. צור קבוצות במסך הכיתה כדי לצבור ניקוד קבוצתי.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h3 className="font-bold">לוח מובילים קבוצתי</h3>
            {sorted.map((g, i) => {
              const s = scores[g.id] ?? 0;
              return (
                <div key={g.id} className="flex items-center gap-3">
                  <div className="w-8 text-center font-mono-tabular text-sm text-muted-foreground">#{i + 1}</div>
                  <span className="h-4 w-4 rounded-full shrink-0" style={{ background: g.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{g.name}</span>
                      <span className="font-mono-tabular text-sm">{s}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-amber" style={{ width: `${Math.max(2, (s / max) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" onClick={() => add(g.id, -1)}><Minus className="h-3.5 w-3.5" /></Button>
                    <Button variant="outline" size="icon" onClick={() => add(g.id, 1)}><Plus className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => add(g.id, 5)}>+5</Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        לניקוד אישי מלא ולוח מובילים אישי — עברו למסך <Link to="/gamification/$classId" params={{ classId }} className="text-amber underline">גיימיפיקציה</Link>.
      </p>
    </div>
  );
}