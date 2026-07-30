import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listClasses } from "@/lib/classes.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Play, Pause, RotateCcw, Shuffle, ChevronRight, ChevronLeft, Mic, MicOff, Wrench, ShieldCheck, BellRing,
  Music, Trophy, Dices, ClipboardList, ScanText, Wand2, Award, TrendingUp, FileText, Palette, Mail,
  Globe2, CalendarDays, LineChart, BookOpen, Library, MessageSquare,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecuritySettings } from "@/components/security-settings";
import { ReminderPreferencesCard } from "@/components/reminder-preferences-card";

export const Route = createFileRoute("/_authenticated/toolkit")({
  component: ToolkitPage,
  head: () => ({
    meta: [
      { title: "ארגז כלים לכיתה · הכיתה שלי" },
      { name: "description", content: "כלים מהירים לניהול השיעור — טיימר, בוחר תלמיד אקראי, הקראה, והגדרות אבטחה." },
      { property: "og:title", content: "ארגז כלים לכיתה · הכיתה שלי" },
      { property: "og:description", content: "כלים מהירים לניהול השיעור: טיימר, בוחר אקראי, הקראה ואבטחה." },
      { property: "og:url", content: "https://cuddle-spark-nexus.lovable.app/toolkit" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ToolkitPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ארגז כלים לכיתה</h1>
        <p className="text-sm text-muted-foreground">כל הכלים במקום אחד — כלי שיעור, צלצולים, מוטיבציה ופרסים, הערכה, מסמכים והגדרות.</p>
      </div>
      <Tabs defaultValue="tools" dir="rtl">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="tools"><Wrench className="ms-1 h-4 w-4" /> כלים</TabsTrigger>
          <TabsTrigger value="sound"><BellRing className="ms-1 h-4 w-4" /> צלצולים וסאונד</TabsTrigger>
          <TabsTrigger value="motivation"><Trophy className="ms-1 h-4 w-4" /> מוטיבציה ופרסים</TabsTrigger>
          <TabsTrigger value="assess"><ClipboardList className="ms-1 h-4 w-4" /> הערכה ומבחנים</TabsTrigger>
          <TabsTrigger value="docs"><FileText className="ms-1 h-4 w-4" /> מסמכים ותבניות</TabsTrigger>
          <TabsTrigger value="reminders"><BellRing className="ms-1 h-4 w-4" /> תזכורות</TabsTrigger>
          <TabsTrigger value="security"><ShieldCheck className="ms-1 h-4 w-4" /> אבטחה</TabsTrigger>
        </TabsList>
        <TabsContent value="tools" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <LessonTimer />
            <RandomPicker />
            <NoiseMeter />
            <FlashCards />
          </div>
        </TabsContent>

        <TabsContent value="sound" className="mt-4">
          <ToolLinkGrid
            items={[
              { to: "/bell-schedule", icon: BellRing, label: "לוח צלצולים", desc: "תזמון פעמוני שיעור והפסקות לאורך היום" },
              { to: "/sound-board", icon: Music, label: "לוח צלילים", desc: "צלילי כיתה מהירים — שקט, מחיאות כפיים, טיימר" },
            ]}
          />
        </TabsContent>

        <TabsContent value="motivation" className="mt-4">
          <ClassScopedTools
            title="בחר כיתה כדי לפתוח את כלי המוטיבציה"
            items={[
              { to: "/gamification/$classId", icon: Trophy, label: "מבצעים וגמיפיקציה", desc: "נקודות, פרסים, מבצעים כיתתיים וטבלת מובילים" },
              { to: "/raffle/$classId", icon: Dices, label: "הגרלות", desc: "גלגל מזל אינטראקטיבי להגרלת תלמידים ופרסים" },
              { to: "/poll/$classId", icon: MessageSquare, label: "סקר כיתה חי", desc: "שאלה לכיתה עם תוצאות בזמן אמת" },
            ]}
          />
        </TabsContent>

        <TabsContent value="assess" className="mt-4">
          <div className="space-y-4">
            <ToolLinkGrid
              items={[
                { to: "/questions", icon: ClipboardList, label: "מאגר שאלות", desc: "בנק שאלות לפי נושא ומקצוע" },
                { to: "/insights", icon: LineChart, label: "תובנות", desc: "מגמות ציונים, נוכחות והתנהגות" },
                { to: "/resources", icon: Library, label: "ספריית חומרי הוראה", desc: "מערכי שיעור, דפי עבודה ועזרים" },
              ]}
            />
            <ClassScopedTools
              title="כלים ברמת כיתה"
              items={[
                { to: "/exam-generator/$classId", icon: Wand2, label: "מחולל מבחנים AI", desc: "יצירת מבחן מותאם מהחומר שנלמד" },
                { to: "/exam-scanner/$classId", icon: ScanText, label: "סורק מבחנים", desc: "ניקוד מבחנים סרוקים בעזרת AI" },
                { to: "/analytics/$classId", icon: TrendingUp, label: "אנליטיקת כיתה", desc: "מגמות והתפלגות ציונים" },
                { to: "/pedagogical/$classId", icon: Award, label: "דוח פדגוגי", desc: "תמונת מצב פדגוגית והפקת דוח" },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <div className="space-y-4">
            <ToolLinkGrid
              items={[
                { to: "/settings/brand", icon: Palette, label: "תבנית ומיתוג המוסד", desc: "לוגו, שם מוסד וכותרת קבועה — מוטמעים בכל מסמך שמופק" },
                { to: "/ingest", icon: FileText, label: "העלאה חכמה", desc: "העלאת קבצים ושיבוץ אוטומטי של הנתונים" },
                { to: "/blog", icon: BookOpen, label: "מדריכים", desc: "מדריכים ותבניות מוכנות" },
              ]}
            />
            <ClassScopedTools
              title="הפקת מסמכים לכיתה"
              items={[
                { to: "/certificates/$classId", icon: Award, label: "תעודות", desc: "הפקת תעודות עם התבנית והלוגו של המוסד" },
                { to: "/daily/$classId", icon: FileText, label: "סיכום יומי", desc: "דוח יומי להדפסה ולשליחה" },
                { to: "/bulletins/$classId", icon: FileText, label: "עלון שבועי", desc: "עלון כיתתי עם סיכום, חידה ופעילויות" },
                { to: "/reports/$classId", icon: FileText, label: "דוחות", desc: "דוחות מעקב והתקדמות" },
                { to: "/parents/$classId", icon: Mail, label: "קשר עם הורים", desc: "מיילים ותקשורת עם ההורים" },
                { to: "/share/$classId", icon: Globe2, label: "שיתוף וקישורים", desc: "קישורי צפייה להורים ולעמוד הכיתה" },
                { to: "/calendar/$classId", icon: CalendarDays, label: "לוח אירועים", desc: "אירועי כיתה, מבחנים וימי הולדת" },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="reminders" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ReminderPreferencesCard />
          </div>
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <SecuritySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Tool link cards ---------- */
type ToolLink = { to: string; icon: typeof Wrench; label: string; desc: string };

function ToolCardShell({ icon: Icon, label, desc }: { icon: typeof Wrench; label: string; desc: string }) {
  return (
    <div className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
      </span>
    </div>
  );
}

function ToolLinkGrid({ items }: { items: ToolLink[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <Link key={it.to} to={it.to} className="block">
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
                <Link key={it.to} to={it.to} params={{ classId: active }} className="block">
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
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (ref.current) window.clearInterval(ref.current); };
  }, [running]);

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const danger = secs > 0 && secs <= 300;

  return (
    <Card>
      <CardHeader><CardTitle>טיימר שיעור</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className={`text-center font-mono-tabular text-6xl font-bold ${danger ? "text-destructive" : ""}`}>
          {mm}:{ss}
        </div>
        <div className="flex items-center justify-center gap-2">
          <Input
            type="number" min={1} max={120} value={minutes}
            onChange={(e) => { const v = Math.max(1, Math.min(120, Number(e.target.value) || 1)); setMinutes(v); setSecs(v * 60); }}
            className="w-24" disabled={running}
          />
          <span className="text-sm text-muted-foreground">דקות</span>
        </div>
        <div className="flex justify-center gap-2">
          <Button onClick={() => setRunning((r) => !r)} variant={running ? "secondary" : "default"}>
            {running ? <><Pause className="ms-1 h-4 w-4" /> השהה</> : <><Play className="ms-1 h-4 w-4" /> התחל</>}
          </Button>
          <Button variant="ghost" onClick={() => { setRunning(false); setSecs(minutes * 60); }}>
            <RotateCcw className="ms-1 h-4 w-4" /> איפוס
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
        />
        <div className="rounded-lg border-2 border-dashed bg-muted/40 p-4 text-center">
          <div className={`text-2xl font-bold ${spinning ? "animate-pulse" : ""}`}>
            {picked ?? <span className="text-sm font-normal text-muted-foreground">לחץ "בחר" כדי להגריל</span>}
          </div>
        </div>
        <Button onClick={pick} disabled={items.length === 0 || spinning} className="w-full">
          <Shuffle className="ms-1 h-4 w-4" /> בחר אקראי ({items.length})
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
        <div className="text-center font-mono-tabular text-5xl font-bold">{level}%</div>
        <div className="h-4 overflow-hidden rounded-full bg-muted">
          <div className={`h-full transition-all ${color}`} style={{ width: `${level}%` }} />
        </div>
        <Button onClick={active ? stop : start} className="w-full" variant={active ? "secondary" : "default"}>
          {active ? <><MicOff className="ms-1 h-4 w-4" /> עצור</> : <><Mic className="ms-1 h-4 w-4" /> התחל מדידה</>}
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
              onClick={() => setFlipped((f) => !f)}
              className="flex min-h-[140px] w-full items-center justify-center rounded-xl border-2 bg-gradient-to-br from-primary/10 to-accent/30 p-4 text-center text-xl font-semibold transition-all hover:scale-[1.01]"
            >
              {flipped ? current.a : current.q}
            </button>
            <div className="flex items-center justify-between">
              <Button size="sm" variant="ghost" onClick={() => { setIdx((i) => (i - 1 + cards.length) % cards.length); setFlipped(false); }}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">{idx + 1} / {cards.length}</span>
              <Button size="sm" variant="ghost" onClick={() => { setIdx((i) => (i + 1) % cards.length); setFlipped(false); }}>
                <ChevronLeft className="h-4 w-4" />
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
          <Input placeholder="שאלה" value={q} onChange={(e) => setQ(e.target.value)} />
          <Input placeholder="תשובה" value={a} onChange={(e) => setA(e.target.value)} />
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