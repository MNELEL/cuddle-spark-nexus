import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Mic, MicOff, Send, Check, X, Loader2, HelpCircle, BookOpen,
  ExternalLink, AlertCircle, Pencil, Paperclip, History, Brain, Trash2, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  executeAssistantAction,
  type AssistantAction, type AssistantActionKind, type AssistantReply,
} from "@/lib/ai-assistant.functions";
import { assistantAgentQuery } from "@/lib/assistant-agent.functions";
import {
  addAssistantMemory, deleteAssistantMemory, deleteAssistantThread, getAssistantThread,
  learnFromThread, listAssistantMemory, listAssistantThreads,
} from "@/lib/assistant-memory.functions";
import { fieldsForKind, missingRequiredFields, isActionReady } from "@/lib/assistant-actions";
import { AssistantSnapshotTable } from "@/components/assistant-snapshot-table";

type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void;
  onend: () => void;
  onerror: (e: unknown) => void;
  start: () => void;
  stop: () => void;
};

const KIND_LABELS: Record<AssistantActionKind, string> = {
  add_grade: "הוספת ציון",
  mark_attendance: "רישום נוכחות",
  add_note: "הערה לתלמיד",
  add_behavior: "נקודות התנהגות",
  add_parent_call: "רישום קשר עם ההורים",
  add_daily_update: "עדכון יומי לכיתה",
  add_incident: "אירוע חריג לתלמיד",
  add_class_event: "אירוע בלוח",
  add_announcement: "הודעת כיתה",
  add_calendar_override: "עדכון לוח השנה",
  add_recurring_rule: "כלל חוזר במערכת",
  set_weekly_honor: "מצטיין או משקיע השבוע",
  save_pacing_subject: "הגדרת הספק למקצוע",
  compute_pacing: "חישוב תוכנית שנתית",
  approve_pacing: "אישור התוכנית ויישום בשיעורים",
  edit_pacing_week: "שינוי כמות בשבוע בתוכנית",
  set_day_column: "עמודה בדשבורד היומי",
  swap_seats: "החלפת מקומות ישיבה",
  import_timetable: "ייבוא מערכת שעות מתמונה",
};

const PARAM_LABELS: Record<string, string> = {
  subject: "מקצוע",
  value: "ציון",
  max_value: "מתוך",
  status: "סטטוס",
  date: "תאריך",
  end_date: "עד תאריך",
  points: "נקודות",
  category: "קטגוריה",
  channel: "ערוץ",
  severity: "חומרה",
  title: "כותרת",
  type: "סוג",
  kind: "סוג",
  week_start: "שבוע",
  amount: "כמות",
  total_amount: "כמות כוללת",
  unit_label: "יחידה",
  mode: "אופן הגדרה",
  rated: "מדורג",
  criteria: "קטגוריות",
  topics: "נושאים",
  replace: "להחליף את הקיים",
};

const VALUE_LABELS: Record<string, string> = {
  present: "נוכח", absent: "נעדר", late: "איחור", excused: "מאושר",
  phone: "טלפון", meeting: "פגישה", whatsapp: "וואטסאפ", email: "מייל",
  low: "קלה", medium: "בינונית", high: "חמורה",
  info: "מידע", warning: "אזהרה", urgent: "דחוף",
  exam: "מבחן", special_exam: "מבחן מיוחד", trip: "טיול", holiday: "חג",
  meeting_event: "מפגש", birthday: "יום הולדת", celebration: "שמחה", other: "אחר",
  positive: "חיובי", negative: "שלילי", neutral: "ניטרלי",
  excellent: "מצטיין", investing: "משקיע", amount: "כמות", topics: "נושאים", both: "כמות ונושאים",
};

const SUGGESTIONS = [
  "מי גר ברחוב ארלוזרוב?",
  "מי עוד לא חגג יום הולדת עברי השנה?",
  "מי עוד לא היה מצטיין השבוע?",
  "מי יכול להיות משקיע השבוע לפי נוכחות ועבודות?",
  "פתח לי את תכנון הקצב השנתי",
  "מי נעדר השבוע יותר מפעמיים?",
  "תוסיף ליוסי 85 בחומש",
  "תיעוד היום: סיימנו את פרק ב' בגמרא, שיעור חזרה מחר",
  "אירוע חריג לשמואל: עזב את הכיתה בלי רשות, חומרה בינונית",
  "תוסיף מבחן בהלכה ביום שלישי הבא ללוח",
  "הודעה לכיתה: מחר יוצאים לטיול, להביא כובע",
  "רשום שדיברתי עם אבא של משה בטלפון על שיפור בהתנהגות",
];

/** מקטין תמונה ל-1600 פיקסלים לכל היותר, כדי שלא תכביד על השליחה. */
async function fileToDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}
const localIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

/** הפרמטרים המשמעותיים של פעולה, בעברית קריאה. */
function readableParams(a: AssistantAction): string {
  const out: string[] = [];
  for (const [k, v] of Object.entries(a.params)) {
    if (k === "student_id" || v === null || v === "" || v === undefined) continue;
    const label = PARAM_LABELS[k];
    if (!label) continue;
    const raw = String(v);
    out.push(`${label}: ${VALUE_LABELS[raw] ?? raw}`);
  }
  return out.join(" · ");
}

export function AiAssistantDock({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [pending, setPending] = useState<AssistantAction[]>([]);
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "history" | "memory">("chat");
  const [memText, setMemText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const recRef = useRef<SR | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const askFn = useServerFn(assistantAgentQuery);
  const execFn = useServerFn(executeAssistantAction);
  const listThreadsFn = useServerFn(listAssistantThreads);
  const getThreadFn = useServerFn(getAssistantThread);
  const delThreadFn = useServerFn(deleteAssistantThread);
  const listMemFn = useServerFn(listAssistantMemory);
  const addMemFn = useServerFn(addAssistantMemory);
  const delMemFn = useServerFn(deleteAssistantMemory);
  const learnFn = useServerFn(learnFromThread);

  const threadsQ = useQuery({ queryKey: ["assistant-threads"], queryFn: () => listThreadsFn(), enabled: open && view === "history" });
  const memoryQ = useQuery({ queryKey: ["assistant-memory"], queryFn: () => listMemFn(), enabled: open && view === "memory" });

  function go(path: string) {
    const [p, q] = path.split("?");
    setOpen(false);
    void navigate({ to: p as never, search: (q ? Object.fromEntries(new URLSearchParams(q)) : {}) as never });
  }

  const ask = useMutation({
    mutationFn: (prompt: string) =>
      askFn({
        data: {
          classId, text: prompt.trim(), history: history.slice(-6), threadId,
          today: localIso(), path: window.location.pathname, ...(image ? { image } : {}),
        },
      }),
    onSuccess: (r, prompt) => {
      setReply(r);
      setPending(r.actions);
      if (r.threadId) setThreadId(r.threadId);
      setImage(null);
      if (r.navigation?.length === 1 && r.actions.length === 0) go(r.navigation[0]!.path);
      setHistory((h) =>
        [...h, { role: "user" as const, content: prompt.trim() },
          { role: "assistant" as const, content: r.clarify || r.answer }].slice(-6),
      );
      if (r.mode === "write" && r.actions.length > 0) {
        toast.info(`${r.actions.length} פעולות מחכות לסקירה ואישור`);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const exec = useMutation({
    mutationFn: (a: AssistantAction) => execFn({ data: { classId, action: a } }),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("בוצע");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  function send(prompt = text) {
    if (!prompt.trim() || ask.isPending) return;
    ask.mutate(prompt);
    setText("");
  }

  function toggleRec() {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { toast.error("הדפדפן לא תומך בהקלטה"); return; }
    if (recording) { recRef.current?.stop(); return; }
    const r = new Ctor();
    r.lang = "he-IL"; r.continuous = true; r.interimResults = false;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + " ";
      setText((prev) => (prev ? prev + " " : "") + t.trim());
    };
    r.onend = () => setRecording(false);
    r.onerror = () => setRecording(false);
    recRef.current = r; r.start(); setRecording(true);
  }

  useEffect(() => () => { recRef.current?.stop(); }, []);

  const readyCount = pending.filter((a) => isActionReady(a.kind, a.params)).length;

  async function approveAll() {
    const items = pending.filter((a) => isActionReady(a.kind, a.params));
    let done = 0;
    for (const a of items) {
      try { await exec.mutateAsync(a); done++; } catch { /* keep going */ }
    }
    setPending((p) => p.filter((a) => !isActionReady(a.kind, a.params)));
    setReply((r) => (r ? { ...r, answer: `${done} מתוך ${items.length} הפעולות בוצעו`, mode: "read" } : r));
  }

  function reset() {
    setText(""); setReply(null); setPending([]); setHistory([]); setThreadId(null); setImage(null); setView("chat");
  }

  /** בסגירת החלון: לומדים מהשיחה סגנון והעדפות (ברקע, בלי להפריע). */
  function closeAndLearn() {
    if (threadId && history.filter((m) => m.role === "user").length >= 2) void learnFn({ data: { threadId } }).catch(() => {});
  }

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const url = await fileToDataUrl(f);
      if (url.length > 6_500_000) { toast.error("התמונה גדולה מדי"); return; }
      setImage(url);
    } catch { toast.error("לא הצלחתי לקרוא את התמונה"); }
  }

  async function openThread(id: string) {
    try {
      const msgs = await getThreadFn({ data: { id } });
      setHistory(msgs.slice(-6).map((m) => ({ role: m.role, content: m.content })));
      setThreadId(id); setReply(null); setPending([]); setView("chat");
    } catch (e) { toast.error(e instanceof Error ? e.message : "שגיאה"); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { closeAndLearn(); reset(); } }}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-20 start-6 z-40 md:bottom-6 h-14 w-14 rounded-full shadow-lg p-0 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
          title="עוזר הרב"
          aria-label="עוזר הרב — פתח מסייע AI"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            עוזר הרב — שאל או בקש בקול / בכתב
          </DialogTitle>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button type="button" size="sm" variant={view === "history" ? "secondary" : "ghost"} className="h-8" onClick={() => setView(view === "history" ? "chat" : "history")}>
              <History className="ms-1 h-4 w-4" /> שיחות קודמות
            </Button>
            <Button type="button" size="sm" variant={view === "memory" ? "secondary" : "ghost"} className="h-8" onClick={() => setView(view === "memory" ? "chat" : "memory")}>
              <Brain className="ms-1 h-4 w-4" /> מה העוזר זוכר
            </Button>
          </div>
        </DialogHeader>

        {view === "history" && (
          <div className="space-y-2" aria-label="שיחות קודמות">
            {threadsQ.isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
            {threadsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">עוד אין שיחות שמורות.</p>}
            <ul className="space-y-1.5">
              {(threadsQ.data ?? []).map((t) => (
                <li key={t.id} className="flex items-center gap-1.5">
                  <Button type="button" variant="outline" className="h-auto flex-1 justify-start py-2 text-start text-sm font-normal" onClick={() => openThread(t.id)}>
                    <span className="line-clamp-1">{t.title || "שיחה"}</span>
                    <span className="ms-auto ps-2 text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleDateString("he-IL")}</span>
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="מחק שיחה"
                    onClick={() => void delThreadFn({ data: { id: t.id } }).then(() => qc.invalidateQueries({ queryKey: ["assistant-threads"] }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {view === "memory" && (
          <div className="space-y-3" aria-label="זיכרון העוזר">
            <p className="text-xs text-muted-foreground">
              העוזר לומד מהשיחות איך אתה אוהב לעבוד, ומשתמש בזה בשיחות הבאות. לא נשמרים שמות תלמידים. אפשר למחוק כל פריט.
            </p>
            <div className="flex gap-2">
              <Input value={memText} maxLength={400} onChange={(e) => setMemText(e.target.value)} placeholder="למשל: אני אוהב עלון קצר עם נקודות" aria-label="פריט חדש לזיכרון" />
              <Button type="button" disabled={memText.trim().length < 3}
                onClick={() => void addMemFn({ data: { content: memText.trim(), kind: "preference" } }).then(() => { setMemText(""); qc.invalidateQueries({ queryKey: ["assistant-memory"] }); })}>
                זכור
              </Button>
            </div>
            {memoryQ.data?.length === 0 && <p className="text-sm text-muted-foreground">עוד אין פריטים בזיכרון.</p>}
            <ul className="space-y-1.5">
              {(memoryQ.data ?? []).map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
                  <span>{m.content}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="מחק מהזיכרון"
                    onClick={() => void delMemFn({ data: { id: m.id } }).then(() => qc.invalidateQueries({ queryKey: ["assistant-memory"] }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={view === "chat" ? "space-y-3" : "hidden"}>
          {history.length > 0 && (
            <div className="space-y-1 rounded-md border bg-muted/30 p-2 text-xs">
              {history.slice(0, -2).map((m, i) => (
                <p key={i} className={m.role === "user" ? "font-medium" : "text-muted-foreground"}>
                  {m.role === "user" ? "שאלת: " : "העוזר: "}{m.content}
                </p>
              ))}
            </div>
          )}

          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
              }}
              placeholder={'נסה: "מי נעדר השבוע יותר מפעמיים?" · "תיעוד היום: סיימנו פרק ב\'" · "אירוע חריג לשמואל"'}
              rows={4}
              className="pe-20"
              aria-label="בקשה לעוזר הרב"
            />
            <div className="absolute top-2 end-2 flex gap-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} aria-label="צירוף תמונה" />
              <Button type="button" size="icon" variant={image ? "secondary" : "outline"} onClick={() => fileRef.current?.click()} title="צרף תמונה, למשל מערכת שעות" aria-label="צרף תמונה">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant={recording ? "destructive" : "outline"} onClick={toggleRec} title="הקלטה" aria-label={recording ? "עצור הקלטה" : "התחל הקלטה קולית"}>
                {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {image && (
            <div className="flex items-center gap-2 rounded-md border p-1.5">
              <img src={image} alt="תמונה מצורפת" className="h-14 w-14 rounded object-cover" />
              <span className="text-xs text-muted-foreground">התמונה תישלח עם הבקשה הבאה</span>
              <Button type="button" variant="ghost" size="icon" className="ms-auto h-7 w-7" onClick={() => setImage(null)} aria-label="הסר תמונה">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {!reply && !ask.isPending && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <Button key={s} type="button" size="sm" variant="outline" className="h-auto py-1 text-xs font-normal" onClick={() => setText(s)}>
                  {s}
                </Button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={() => send()} disabled={!text.trim() || ask.isPending} className="flex-1">
              {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="ms-1 h-4 w-4" />}
              שלח
            </Button>
            {(reply || text) && (
              <Button variant="ghost" onClick={reset}>נקה</Button>
            )}
          </div>

          {reply?.mode === "clarify" && reply.clarify && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="space-y-2 py-3">
                <p className="flex items-start gap-2 text-sm font-medium">
                  <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {reply.clarify}
                </p>
                {reply.clarifyOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {reply.clarifyOptions.map((o) => (
                      <Button key={o} size="sm" variant="secondary" className="h-auto py-1 text-xs" onClick={() => send(o)} disabled={ask.isPending}>
                        {o}
                      </Button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {reply?.answer && reply.mode !== "clarify" && (
            <Card className="border-amber/30 bg-amber/5">
              <CardContent className="space-y-2 py-3">
                <p className="whitespace-pre-wrap text-sm">{reply.answer}</p>
                {(reply.navigation?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {reply.navigation!.map((n) => (
                      <Button key={n.path} type="button" size="sm" variant="secondary" onClick={() => go(n.path)}>
                        <ArrowLeft className="ms-1 h-4 w-4" /> פתח: {n.label}
                      </Button>
                    ))}
                  </div>
                )}
                {reply.mode === "read" && (reply.snapshot?.length ?? 0) > 0 && (
                  <details className="rounded-md border">
                    <summary className="cursor-pointer select-none p-2 text-xs font-medium">טבלת מצב הכיתה</summary>
                    <div className="p-2"><AssistantSnapshotTable rows={reply.snapshot ?? []} /></div>
                  </details>
                )}
                {reply.mode === "read" && reply.sources.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      מבוסס על: {reply.sources.join(" · ")}
                    </p>
                    {reply.sourceLinks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {reply.sourceLinks.map((l) => (
                          <Button
                            key={l.to}
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-auto py-1 text-xs font-normal"
                          >
                            <Link
                              to={l.to as never}
                              params={{ classId } as never}
                              onClick={() => setOpen(false)}
                            >
                              <ExternalLink className="ms-1 h-3 w-3" aria-hidden="true" />
                              {l.label}
                            </Link>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {pending.length > 0 && (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{pending.length} פעולות לסקירה ואישור</Badge>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setPending([])}>דחה הכל</Button>
                  <Button size="sm" onClick={approveAll} disabled={exec.isPending}>
                    <Check className="ms-1 h-4 w-4" /> אשר הכל
                  </Button>
                </div>
              </div>
              {readyCount < pending.length && (
                <p className="flex items-center gap-1.5 px-1 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {pending.length - readyCount} פעולות חסרות פרטים — השלם אותן כאן ואשר, בלי לחזור למסך הסקירה.
                </p>
              )}
              {pending.map((a, i) => (
                <PendingActionCard
                  key={i}
                  action={a}
                  students={reply?.students ?? []}
                  busy={exec.isPending}
                  onChange={(next) => setPending((p) => p.map((x, j) => (j === i ? next : x)))}
                  onApprove={(next) =>
                    exec.mutate(next, {
                      onSuccess: () => setPending((p) => p.filter((_, j) => j !== i)),
                    })
                  }
                  onReject={() => setPending((p) => p.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** כרטיס פעולה לסקירה — עם עריכה מהירה של שדות חסרים ואישור מחדש במקום. */
function PendingActionCard({
  action, students, busy, onChange, onApprove, onReject,
}: {
  action: AssistantAction;
  students: { id: string; name: string }[];
  busy: boolean;
  onChange: (next: AssistantAction) => void;
  onApprove: (next: AssistantAction) => void;
  onReject: () => void;
}) {
  const missing = missingRequiredFields(action.kind, action.params);
  const [editing, setEditing] = useState(missing.length > 0);
  const fields = fieldsForKind(action.kind);
  const ready = missing.length === 0;

  function setParam(key: string, value: string) {
    onChange({ ...action, params: { ...action.params, [key]: value } });
  }

  return (
    <Card className={ready ? undefined : "border-destructive/50"}>
      <CardContent className="space-y-2 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-primary">{KIND_LABELS[action.kind] ?? action.kind}</div>
            <div className="text-sm">{action.summary}</div>
            {readableParams(action) && (
              <div className="text-xs text-muted-foreground">{readableParams(action)}</div>
            )}
            {!ready && (
              <div className="text-xs text-destructive">
                חסר: {missing.map((f) => f.label).join(", ")}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label={editing ? "סגור עריכה" : "ערוך פרטי פעולה"}
              aria-expanded={editing}
              onClick={() => setEditing((v) => !v)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label={ready ? "אשר פעולה" : "השלם את השדות החסרים כדי לאשר"}
              disabled={!ready || busy}
              onClick={() => onApprove(action)}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="דחה פעולה" onClick={onReject}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {editing && (
          <div className="grid gap-2 rounded-md border bg-muted/30 p-2 sm:grid-cols-2">
            {fields.map((f) => {
              const value = String(action.params[f.key] ?? "");
              const id = `${action.kind}-${f.key}-${action.summary.slice(0, 8)}`;
              const options = f.key === "student_id"
                ? students.map((s) => ({ value: s.id, label: s.name }))
                : f.options ?? [];
              return (
                <div key={f.key} className="space-y-1">
                  <Label htmlFor={id} className="text-xs">
                    {f.label}{f.required ? " *" : ""}
                  </Label>
                  {f.type === "select" ? (
                    <select
                      id={id}
                      value={value}
                      onChange={(e) => setParam(f.key, e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">בחר…</option>
                      {options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <Textarea
                      id={id}
                      rows={2}
                      value={value}
                      placeholder={f.placeholder}
                      onChange={(e) => setParam(f.key, e.target.value)}
                    />
                  ) : (
                    <Input
                      id={id}
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={value}
                      placeholder={f.placeholder}
                      onChange={(e) => setParam(f.key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
            <div className="sm:col-span-2 flex justify-end">
              <Button size="sm" disabled={!ready || busy} onClick={() => onApprove(action)}>
                <Check className="ms-1 h-4 w-4" /> שמור ואשר
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

