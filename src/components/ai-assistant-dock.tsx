import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Mic, MicOff, Send, Check, X, Loader2, HelpCircle, BookOpen } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  assistantQuery, executeAssistantAction,
  type AssistantAction, type AssistantActionKind, type AssistantReply,
} from "@/lib/ai-assistant.functions";

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
};

const VALUE_LABELS: Record<string, string> = {
  present: "נוכח", absent: "נעדר", late: "איחור", excused: "מאושר",
  phone: "טלפון", meeting: "פגישה", whatsapp: "וואטסאפ", email: "מייל",
  low: "קלה", medium: "בינונית", high: "חמורה",
  info: "מידע", warning: "אזהרה", urgent: "דחוף",
  exam: "מבחן", special_exam: "מבחן מיוחד", trip: "טיול", holiday: "חג",
  meeting_event: "מפגש", birthday: "יום הולדת", celebration: "שמחה", other: "אחר",
  positive: "חיובי", negative: "שלילי", neutral: "ניטרלי",
};

const SUGGESTIONS = [
  "מי נעדר השבוע יותר מפעמיים?",
  "תוסיף ליוסי 85 בחומש",
  "תיעוד היום: סיימנו את פרק ב' בגמרא, שיעור חזרה מחר",
  "אירוע חריג לשמואל: עזב את הכיתה בלי רשות, חומרה בינונית",
  "תוסיף מבחן בהלכה ביום שלישי הבא ללוח",
  "הודעה לכיתה: מחר יוצאים לטיול, להביא כובע",
  "רשום שדיברתי עם אבא של משה בטלפון על שיפור בהתנהגות",
];

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
  const recRef = useRef<SR | null>(null);
  const qc = useQueryClient();

  const askFn = useServerFn(assistantQuery);
  const execFn = useServerFn(executeAssistantAction);

  const ask = useMutation({
    mutationFn: (prompt: string) =>
      askFn({ data: { classId, text: prompt.trim(), history: history.slice(-4) } }),
    onSuccess: (r, prompt) => {
      setReply(r);
      setPending(r.actions);
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

  async function approveAll() {
    const items = [...pending];
    let done = 0;
    for (const a of items) {
      try { await exec.mutateAsync(a); done++; } catch { /* keep going */ }
    }
    setPending([]);
    setReply((r) => (r ? { ...r, answer: `${done} מתוך ${items.length} הפעולות בוצעו`, mode: "read" } : r));
  }

  function reset() {
    setText(""); setReply(null); setPending([]); setHistory([]);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-6 start-6 z-40 h-14 w-14 rounded-full shadow-lg p-0 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
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
        </DialogHeader>

        <div className="space-y-3">
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
              <Button type="button" size="icon" variant={recording ? "destructive" : "outline"} onClick={toggleRec} title="הקלטה" aria-label={recording ? "עצור הקלטה" : "התחל הקלטה קולית"}>
                {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
          </div>

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
                {reply.mode === "read" && reply.sources.length > 0 && (
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    מבוסס על: {reply.sources.join(" · ")}
                  </p>
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
              {pending.map((a, i) => (
                <Card key={i}>
                  <CardContent className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-primary">{KIND_LABELS[a.kind] ?? a.kind}</div>
                      <div className="text-sm">{a.summary}</div>
                      {readableParams(a) && (
                        <div className="text-xs text-muted-foreground">{readableParams(a)}</div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="outline" aria-label="אשר פעולה" onClick={() => exec.mutate(a, { onSuccess: () => setPending((p) => p.filter((_, j) => j !== i)) })}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="דחה פעולה" onClick={() => setPending((p) => p.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
