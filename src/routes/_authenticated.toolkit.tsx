import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClasses } from "@/lib/classes.functions";
import { useAppSounds } from "@/hooks/use-app-sounds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Play, Pause, RotateCcw, Shuffle, ChevronRight, ChevronLeft, Mic, MicOff, Wrench, Settings, BellRing,
  Music, Trophy, Dices, ClipboardList, ScanText, Wand2, Award, TrendingUp, FileText, Palette, Mail,
  Globe2, CalendarDays, LineChart, BookOpen, Library, MessageSquare, Sparkles, Building2, ShieldCheck,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToolAccess } from "@/hooks/use-tool-access";
import { TOOLS, canUseTool, type ToolEntry, type ToolSection } from "@/lib/tool-registry";

const SECTION_IDS: ToolSection[] = ["tools", "sound", "motivation", "assess", "docs", "settings"];

export const Route = createFileRoute("/_authenticated/toolkit")({
  component: ToolkitPage,
  validateSearch: (search: Record<string, unknown>): { section?: ToolSection } => {
    const raw = String(search.section ?? "");
    return (SECTION_IDS as string[]).includes(raw) ? { section: raw as ToolSection } : {};
  },
  head: () => ({
    meta: [
      { title: "ארגז כלים לכיתה · הכיתה שלי" },
      { name: "description", content: "כלים מהירים לניהול השיעור — טיימר, בוחר תלמיד אקראי, הקראה, והגדרות אבטחה." },
      { property: "og:title", content: "ארגז כלים לכיתה · הכיתה שלי" },
      { property: "og:description", content: "כלים מהירים לניהול השיעור: טיימר, בוחר אקראי, הקראה ואבטחה." },
      { property: "og:url", content: "https://hakitasheli.lovable.app/toolkit" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ToolkitPage() {
  const { section = "tools" } = Route.useSearch();
  const { access } = useToolAccess();
  const navigate = useNavigate();

  /** Tools of a section the current user is actually allowed to open. */
  function visible(sec: ToolSection, classScoped: boolean) {
    return TOOLS.filter(
      (t) => t.section === sec && Boolean(t.classScoped) === classScoped && canUseTool(t, access),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ארגז כלים לכיתה</h1>
        <p className="text-sm text-muted-foreground">כל הכלים במקום אחד — כלי שיעור, צלצולים, מוטיבציה ופרסים, הערכה, מסמכים והגדרות.</p>
      </div>
      <Tabs
        value={section}
        onValueChange={(v) => navigate({ to: "/toolkit", search: { section: v as ToolSection }, replace: true })}
        dir="rtl"
      >
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="tools"><Wrench className="ms-1 h-4 w-4" aria-hidden /> כלים</TabsTrigger>
          <TabsTrigger value="sound"><BellRing className="ms-1 h-4 w-4" aria-hidden /> צלצולים וסאונד</TabsTrigger>
          <TabsTrigger value="motivation"><Trophy className="ms-1 h-4 w-4" aria-hidden /> מוטיבציה ופרסים</TabsTrigger>
          <TabsTrigger value="assess"><ClipboardList className="ms-1 h-4 w-4" aria-hidden /> הערכה ומבחנים</TabsTrigger>
          <TabsTrigger value="docs"><FileText className="ms-1 h-4 w-4" aria-hidden /> מסמכים ותבניות</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="ms-1 h-4 w-4" aria-hidden /> הגדרות</TabsTrigger>
        </TabsList>

        <TabsContent value="tools" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <LessonTimer />
            <RandomPicker />
            <NoiseMeter />
            <FlashCards />
            <RandomGroups />
            <QuickCheck />
          </div>
          <ClassScopedTools title="כלים ברמת כיתה" items={visible("tools", true)} />
        </TabsContent>

        <TabsContent value="sound" className="mt-4">
          <ToolLinkGrid items={visible("sound", false)} />
        </TabsContent>

        <TabsContent value="motivation" className="mt-4">
          <ClassScopedTools title="בחר כיתה כדי לפתוח את כלי המוטיבציה" items={visible("motivation", true)} />
        </TabsContent>

        <TabsContent value="assess" className="mt-4">
          <div className="space-y-4">
            <ToolLinkGrid items={visible("assess", false)} />
            <ClassScopedTools title="כלים ברמת כיתה" items={visible("assess", true)} />
          </div>
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <div className="space-y-4">
            <ToolLinkGrid items={[...visible("docs", false), { to: "/blog", icon: "BookOpen", label: "מדריכים", desc: "מדריכים ותבניות מוכנות", section: "docs" as ToolSection, requires: "any" as const }]} />
            <ClassScopedTools title="הפקת מסמכים לכיתה" items={visible("docs", true)} />
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <ToolLinkGrid
            items={[
              ...visible("settings", false),
              { to: "/theme-test", icon: "Palette", label: "השוואת ערכות נושא", desc: "כל ערכות הנושא במסך אחד", section: "settings" as ToolSection, requires: "any" as const },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Tool link cards ---------- */
const ICONS: Record<string, typeof Wrench> = {
  BellRing, Music, CalendarDays, Globe2, Trophy, Dices, MessageSquare, ClipboardList, LineChart,
  Library, Wand2, ScanText, TrendingUp, Award, Palette, FileText, Sparkles, Mail, Settings,
  Building2, ShieldCheck, BookOpen, Wrench,
};

type ToolLink = Pick<ToolEntry, "to" | "icon" | "label" | "desc">;

function ToolCardShell({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  const Icon = ICONS[icon] ?? Wrench;
  return (
    <div className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" aria-hidden /></span>
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
      </span>
    </div>
  );
}

function ToolLinkGrid({ items }: { items: ToolLink[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">אין כלים זמינים בקטגוריה הזו עבור ההרשאות שלך.</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <Link key={it.to} to={it.to as never} className="block">
          <ToolCardShell icon={it.icon} label={it.label} desc={it.desc} />
        </Link>
      ))}
    </div>
  );
}

function ClassScopedTools({ title, items }: { title: string; items: ToolLink[] }) {
  const list = useServerFn(listClasses);
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => list() });
  const [classId, setClassId] = useState<string>("");
  const active = classId || classes[0]?.id || "";

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {classes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            עדיין אין כיתות. <Link to="/classes" className="underline">צור כיתה ראשונה</Link>
          </p>
        ) : (
          <>
            <Select value={active} onValueChange={setClassId}>
              <SelectTrigger className="max-w-xs"><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
              <SelectContent>
                {classes.map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((it) => (
                <Link key={it.to} to={it.to as never} params={{ classId: active } as never} className="block">
                  <ToolCardShell icon={it.icon} label={it.label} desc={it.desc} />
                </Link>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Lesson Timer ---------- */
function LessonTimer() {
  const { playEvent } = useAppSounds();
  const [minutes, setMinutes] = useState(10);
  const [secs, setSecs] = useState(600);
  const [running, setRunning] = useState(false);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    ref.current = window.setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          setRunning(false);
          beep();
          playEvent("timer_end");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (ref.current) window.clearInterval(ref.current); };
  }, [running, playEvent]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const danger = secs > 0 && secs <= 300;

  return (
      <Card>
      <CardHeader><CardTitle id="lesson-timer-title">טיימר שיעור</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div
          role="timer"
          aria-labelledby="lesson-timer-title"
          aria-label={`נותרו ${mm} דקות ו-${ss} שניות`}
          className={`text-center font-mono-tabular text-6xl font-bold ${danger ? "text-destructive" : ""}`}
        >
          {mm}:{ss}
        </div>
        <p className="sr-only" role="status" aria-live="polite">
          {secs === 0 ? "הטיימר הסתיים" : running ? "הטיימר פועל" : ""}
        </p>
        <div className="flex items-center justify-center gap-2">
          <Input
            id="timer-minutes"
            aria-label="משך הטיימר בדקות"
            type="number" min={1} max={120} value={minutes}
            onChange={(e) => { const v = Math.max(1, Math.min(120, Number(e.target.value) || 1)); setMinutes(v); setSecs(v * 60); }}
            className="w-24" disabled={running}
          />
          <span className="text-sm text-muted-foreground" aria-hidden>דקות</span>
        </div>
        <div className="flex justify-center gap-2">
          <Button onClick={() => setRunning((r) => !r)} variant={running ? "secondary" : "default"} aria-pressed={running}>
            {running ? <><Pause className="ms-1 h-4 w-4" aria-hidden /> השהה</> : <><Play className="ms-1 h-4 w-4" aria-hidden /> התחל</>}
          </Button>
          <Button variant="ghost" onClick={() => { setRunning(false); setSecs(minutes * 60); }}>
            <RotateCcw className="ms-1 h-4 w-4" aria-hidden /> איפוס
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Random Groups ---------- */
function RandomGroups() {
  const [text, setText] = useState(() => {
    try { return localStorage.getItem("groups_list") || ""; } catch { return ""; }
  });
  const [size, setSize] = useState(3);
  const [groups, setGroups] = useState<string[][]>([]);

  useEffect(() => {
    try { localStorage.setItem("groups_list", text); } catch { /* ignore */ }
  }, [text]);

  const names = text.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

  function shuffleIntoGroups() {
    const pool = [...names];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const out: string[][] = [];
    for (let i = 0; i < pool.length; i += size) out.push(pool.slice(i, i + size));
    setGroups(out);
  }

  return (
    <Card>
      <CardHeader><CardTitle>קבוצות אקראיות</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={3} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="שמות התלמידים, כל אחד בשורה או מופרד בפסיק"
          aria-label="רשימת תלמידים לחלוקה לקבוצות"
        />
        <div className="flex items-center gap-2">
          <Input
            type="number" min={2} max={12} value={size} className="w-24"
            onChange={(e) => setSize(Math.max(2, Math.min(12, Number(e.target.value) || 2)))}
            aria-label="מספר תלמידים בקבוצה"
          />
          <span className="text-sm text-muted-foreground">תלמידים בקבוצה</span>
          <Button className="ms-auto" onClick={shuffleIntoGroups} disabled={names.length < 2}>
            <Shuffle className="ms-1 h-4 w-4" aria-hidden /> חלק לקבוצות
          </Button>
        </div>
        {groups.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2" role="status" aria-live="polite" aria-label="חלוקה לקבוצות">
            {groups.map((g, i) => (
              <li key={i} className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="mb-1 font-medium">קבוצה {i + 1}</p>
                <p className="text-muted-foreground">{g.join(", ")}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Quick Comprehension Check ---------- */
const QUICK_CHECK_LEVELS = [
  { key: "got_it", label: "הבנתי היטב", tone: "bg-primary/15 text-primary" },
  { key: "partly", label: "חלקית", tone: "bg-accent/40 text-accent-foreground" },
  { key: "lost", label: "לא הבנתי", tone: "bg-destructive/10 text-destructive" },
] as const;

function QuickCheck() {
  const [counts, setCounts] = useState<Record<string, number>>({ got_it: 0, partly: 0, lost: 0 });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader><CardTitle>בדיקת הבנה מהירה</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          שואלים את הכיתה ומקישים לפי הרמזור — תמונת מצב מיידית לפני שממשיכים.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {QUICK_CHECK_LEVELS.map((l) => (
            <Button
              key={l.key} variant="outline" className="h-auto flex-col py-3"
              onClick={() => setCounts((c) => ({ ...c, [l.key]: (c[l.key] ?? 0) + 1 }))}
              aria-label={`הוסף תלמיד לרמה: ${l.label}`}
            >
              <span className={`rounded-md px-2 py-0.5 text-xs ${l.tone}`}>{l.label}</span>
              <span className="mt-1 font-mono-tabular text-2xl font-bold">{counts[l.key] ?? 0}</span>
            </Button>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span role="status" aria-live="polite">
            סה״כ תשובות: {total} · הבנתי היטב {counts["got_it"] ?? 0}, חלקית {counts["partly"] ?? 0}, לא הבנתי {counts["lost"] ?? 0}
          </span>
          <Button
            variant="ghost" size="sm"
            onClick={() => setCounts({ got_it: 0, partly: 0, lost: 0 })}
            aria-label="אפס את בדיקת ההבנה"
          >
            <RotateCcw className="ms-1 h-4 w-4" aria-hidden /> איפוס
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Random Picker ---------- */
function RandomPicker() {
  const [text, setText] = useState(() => localStorage.getItem("picker_list") || "");
  const [picked, setPicked] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  useEffect(() => { localStorage.setItem("picker_list", text); }, [text]);

  const items = text.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

  function pick() {
    if (items.length === 0) return;
    setSpinning(true);
    let n = 0;
    const interval = window.setInterval(() => {
      setPicked(items[Math.floor(Math.random() * items.length)]);
      n++;
      if (n > 15) {
        window.clearInterval(interval);
        setPicked(items[Math.floor(Math.random() * items.length)]);
        setSpinning(false);
      }
    }, 70);
  }

  return (
    <Card>
      <CardHeader><CardTitle>בחירה אקראית</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={3} value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="שמות תלמידים או פריטים, כל אחד בשורה או מופרד בפסיק"
          aria-label="רשימת שמות או פריטים להגרלה"
        />
        <div className="rounded-lg border-2 border-dashed bg-muted/40 p-4 text-center" role="status" aria-live="polite">
          <div className={`text-2xl font-bold ${spinning ? "animate-pulse" : ""}`}>
            {picked ?? <span className="text-sm font-normal text-muted-foreground">לחץ "בחר" כדי להגריל</span>}
          </div>
        </div>
        <Button onClick={pick} disabled={items.length === 0 || spinning} aria-busy={spinning} className="w-full">
          <Shuffle className="ms-1 h-4 w-4" aria-hidden /> בחר אקראי ({items.length})
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------- Noise Meter ---------- */
function NoiseMeter() {
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(100, Math.round(rms * 250)));
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
      setActive(true);
    } catch { alert("לא ניתן לגשת למיקרופון"); }
  }
  function stop() {
    setActive(false); setLevel(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close();
  }
  useEffect(() => () => stop(), []);

  const color = level < 33 ? "bg-emerald-500" : level < 66 ? "bg-yellow-500" : "bg-destructive";

  return (
    <Card>
      <CardHeader><CardTitle>מד רעש</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center font-mono-tabular text-5xl font-bold" aria-hidden>{level}%</div>
        <div
          className="h-4 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="עוצמת הרעש בכיתה"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={level}
          aria-valuetext={`${level} אחוז`}
        >
          <div className={`h-full transition-all ${color}`} style={{ width: `${level}%` }} />
        </div>
        <Button onClick={active ? stop : start} className="w-full" variant={active ? "secondary" : "default"} aria-pressed={active}>
          {active ? <><MicOff className="ms-1 h-4 w-4" aria-hidden /> עצור</> : <><Mic className="ms-1 h-4 w-4" aria-hidden /> התחל מדידה</>}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------- FlashCards ---------- */
type FlashCard = { q: string; a: string };
function FlashCards() {
  const [cards, setCards] = useState<FlashCard[]>(() => {
    try { return JSON.parse(localStorage.getItem("flashcards") || "[]"); } catch { return []; }
  });
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [q, setQ] = useState(""); const [a, setA] = useState("");

  useEffect(() => { localStorage.setItem("flashcards", JSON.stringify(cards)); }, [cards]);

  function add() {
    if (!q.trim() || !a.trim()) return;
    setCards((c) => [...c, { q: q.trim(), a: a.trim() }]);
    setQ(""); setA("");
  }

  const current = cards[idx];

  return (
    <Card>
      <CardHeader><CardTitle>כרטיסי שאלות (Flashcards)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {current ? (
          <>
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              aria-pressed={flipped}
              aria-label={flipped ? "הצג את השאלה" : "הצג את התשובה"}
              className="flex min-h-[140px] w-full items-center justify-center rounded-xl border-2 bg-gradient-to-br from-primary/10 to-accent/30 p-4 text-center text-xl font-semibold transition-all hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              <span role="status" aria-live="polite">{flipped ? current.a : current.q}</span>
            </button>
            <div className="flex items-center justify-between">
              <Button
                size="icon" variant="ghost" className="min-h-11 min-w-11"
                aria-label="לכרטיס הקודם"
                onClick={() => { setIdx((i) => (i - 1 + cards.length) % cards.length); setFlipped(false); }}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
              <span className="text-sm text-muted-foreground">כרטיס {idx + 1} מתוך {cards.length}</span>
              <Button
                size="icon" variant="ghost" className="min-h-11 min-w-11"
                aria-label="לכרטיס הבא"
                onClick={() => { setIdx((i) => (i + 1) % cards.length); setFlipped(false); }}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <Button size="sm" variant="outline" className="w-full" onClick={() => {
              setCards((c) => c.filter((_, i) => i !== idx));
              setIdx(0); setFlipped(false);
            }}>מחק כרטיס נוכחי</Button>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">אין כרטיסים עדיין — הוסף למטה</p>
        )}
        <div className="space-y-2 border-t pt-3">
          <Input placeholder="שאלה" aria-label="שאלה לכרטיס חדש" value={q} onChange={(e) => setQ(e.target.value)} />
          <Input placeholder="תשובה" aria-label="תשובה לכרטיס חדש" value={a} onChange={(e) => setA(e.target.value)} />
          <Button size="sm" onClick={add} disabled={!q.trim() || !a.trim()} className="w-full">הוסף כרטיס</Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- helpers ---------- */
function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; g.gain.value = 0.2;
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 600);
  } catch { /* ignore */ }
}