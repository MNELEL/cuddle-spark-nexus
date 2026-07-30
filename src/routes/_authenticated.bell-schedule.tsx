import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, Pause, Play, Plus, Trash2, Volume2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bell-schedule")({
  component: BellSchedulePage,
  head: () => ({
    meta: [
      { title: "לוח פעמונים · הכיתה שלי" },
      { name: "description", content: "מתזמן פעמוני שיעורים אוטומטי עם צלילים מותאמים." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type BellSound = "classic" | "chime" | "digital" | "melody";
type Period = {
  id: string;
  label: string;
  time: string; // HH:MM
  sound: BellSound;
  enabled: boolean;
};

const STORAGE = "ca_bell_schedule_v1";

const DEFAULT_PERIODS: Period[] = [
  { id: "p1", label: "תפילת שחרית", time: "08:00", sound: "chime", enabled: true },
  { id: "p2", label: "שיעור ראשון", time: "08:45", sound: "classic", enabled: true },
  { id: "p3", label: "הפסקה", time: "09:30", sound: "digital", enabled: true },
  { id: "p4", label: "שיעור שני", time: "09:45", sound: "classic", enabled: true },
  { id: "p5", label: "מנחה", time: "13:30", sound: "melody", enabled: true },
];

/* ---------- audio synthesis ---------- */
let _ctx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!_ctx) {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    _ctx = new AC();
  }
  return _ctx;
}

function playTone(ctx: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.25) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}

export function playBellSound(kind: BellSound) {
  try {
    const ctx = getCtx();
    if (ctx.state === "suspended") ctx.resume();
    switch (kind) {
      case "classic":
        // two-tone school bell
        [0, 0.35, 0.7, 1.05].forEach((t, i) => {
          playTone(ctx, i % 2 === 0 ? 880 : 660, t, 0.35, "triangle", 0.35);
        });
        break;
      case "chime":
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playTone(ctx, f, i * 0.18, 0.6, "sine", 0.3));
        break;
      case "digital":
        for (let i = 0; i < 5; i++) playTone(ctx, 1200, i * 0.15, 0.1, "square", 0.2);
        break;
      case "melody": {
        const notes = [523.25, 587.33, 659.25, 783.99, 659.25, 523.25];
        notes.forEach((f, i) => playTone(ctx, f, i * 0.28, 0.28, "triangle", 0.28));
        break;
      }
    }
  } catch (e) {
    console.error("[Bell] play error", e);
  }
}

function nowHm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function BellSchedulePage() {
  const [periods, setPeriods] = useState<Period[]>(DEFAULT_PERIODS);
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState(nowHm());
  const firedRef = useRef<Set<string>>(new Set()); // "id|HH:MM"

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setPeriods(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const persist = useCallback((next: Period[]) => {
    setPeriods(next);
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  // clock + firing loop
  useEffect(() => {
    const t = window.setInterval(() => {
      const hm = nowHm();
      setNow(hm);
      if (!running) return;
      periods.forEach((p) => {
        if (!p.enabled) return;
        const key = `${p.id}|${hm}`;
        if (p.time === hm && !firedRef.current.has(key)) {
          firedRef.current.add(key);
          playBellSound(p.sound);
          toast.success(`🔔 ${p.label} (${p.time})`);
          // clear old marks so it can re-fire tomorrow
          if (firedRef.current.size > 200) firedRef.current = new Set([key]);
        }
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [running, periods]);

  const sorted = useMemo(() => [...periods].sort((a, b) => a.time.localeCompare(b.time)), [periods]);
  const nextPeriod = useMemo(() => sorted.find((p) => p.enabled && p.time > now), [sorted, now]);

  const addPeriod = () => {
    persist([...periods, { id: crypto.randomUUID(), label: "שיעור חדש", time: "10:00", sound: "classic", enabled: true }]);
  };
  const patch = (id: string, up: Partial<Period>) => persist(periods.map((p) => p.id === id ? { ...p, ...up } : p));
  const remove = (id: string) => persist(periods.filter((p) => p.id !== id));

  const toggle = () => {
    if (!running) {
      // unlock audio on user gesture
      try { getCtx().resume(); playTone(getCtx(), 880, 0, 0.05, "sine", 0.01); } catch { /* ignore */ }
      toast.success("המתזמן פעיל — הפעמונים ישוגרו בזמן האמת");
    } else toast("המתזמן הושהה");
    setRunning((r) => !r);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><BellRing className="h-6 w-6 text-primary" /> לוח פעמונים</h1>
          <p className="text-sm text-muted-foreground">מתזמן פעמוני שיעורים אוטומטי לפי לוח יומי. השאר את הלשונית פתוחה בזמן היום.</p>
        </div>
        <div className="text-end">
          <div className="text-3xl font-bold tabular-nums">{now}</div>
          <Button className="mt-2" onClick={toggle} variant={running ? "destructive" : "default"}>
            {running ? <><Pause className="ms-1 h-4 w-4" /> השהה</> : <><Play className="ms-1 h-4 w-4" /> הפעל מתזמן</>}
          </Button>
        </div>
      </div>

      {nextPeriod && (
        <Card>
          <CardContent className="flex items-center justify-between py-3 text-sm">
            <span className="text-muted-foreground">הצלצול הבא:</span>
            <span className="font-semibold">{nextPeriod.label} · {nextPeriod.time}</span>
            <Badge variant="secondary">{soundLabel(nextPeriod.sound)}</Badge>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">מקטעי היום</CardTitle>
          <Button size="sm" variant="outline" onClick={addPeriod}><Plus className="ms-1 h-4 w-4" /> הוסף מקטע</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.map((p) => (
            <div key={p.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_120px_170px_auto_auto] sm:items-end">
              <div>
                <Label className="text-xs">תיאור</Label>
                <Input value={p.label} onChange={(e) => patch(p.id, { label: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">שעה</Label>
                <Input type="time" value={p.time} onChange={(e) => patch(p.id, { time: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">צליל</Label>
                <Select value={p.sound} onValueChange={(v) => patch(p.id, { sound: v as BellSound })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">פעמון קלאסי</SelectItem>
                    <SelectItem value="chime">צלצול</SelectItem>
                    <SelectItem value="digital">דיגיטלי</SelectItem>
                    <SelectItem value="melody">מנגינה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={p.enabled} onCheckedChange={(v) => patch(p.id, { enabled: v })} />
                <Button size="icon" variant="ghost" onClick={() => playBellSound(p.sound)} aria-label="נגן צליל בדיקה">
                  <Volume2 className="h-4 w-4" />
                </Button>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(p.id)} aria-label="מחק מקטע">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {periods.length === 0 && <p className="text-sm text-muted-foreground">אין מקטעים. לחץ "הוסף מקטע".</p>}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        <Bell className="me-1 inline h-3 w-3" />
        הצלילים נוצרים בדפדפן (Web Audio) — אין צורך בקבצי מדיה. שמור את הלשונית פתוחה בזמן היום כדי שהמתזמן ישגר את הצלצולים.
      </p>
    </div>
  );
}

function soundLabel(s: BellSound) {
  return s === "classic" ? "פעמון קלאסי" : s === "chime" ? "צלצול" : s === "digital" ? "דיגיטלי" : "מנגינה";
}