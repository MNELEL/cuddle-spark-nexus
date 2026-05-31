import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Mic, MicOff, Send, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  assistantQuery, executeAssistantAction, type AssistantAction,
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

export function AiAssistantDock({ classId }: { classId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [pending, setPending] = useState<AssistantAction[]>([]);
  const recRef = useRef<SR | null>(null);
  const qc = useQueryClient();

  const askFn = useServerFn(assistantQuery);
  const execFn = useServerFn(executeAssistantAction);

  const ask = useMutation({
    mutationFn: () => askFn({ data: { classId, text: text.trim() } }),
    onSuccess: (r) => { setAnswer(r.answer); setPending(r.actions); },
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
    for (const a of pending) {
      try { await exec.mutateAsync(a); } catch { /* keep going */ }
    }
    setPending([]); setAnswer("כל הפעולות בוצעו");
  }

  function reset() { setText(""); setAnswer(null); setPending([]); }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-6 start-6 z-40 h-14 w-14 rounded-full shadow-lg p-0 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
          title="עוזר הרב"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            עוזר הרב — שאל או בקש בקול / בכתב
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='נסה: "מי נעדר השבוע יותר מפעמיים?" · "תוסיף ליוסי 85 בחומש" · "סכם לי את משה כהן"'
              rows={4}
              className="pe-20"
            />
            <div className="absolute top-2 end-2 flex gap-1">
              <Button type="button" size="icon" variant={recording ? "destructive" : "outline"} onClick={toggleRec} title="הקלטה">
                {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => ask.mutate()} disabled={!text.trim() || ask.isPending} className="flex-1">
              {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="ms-1 h-4 w-4" />}
              שלח
            </Button>
            {(answer || text) && (
              <Button variant="ghost" onClick={reset}>נקה</Button>
            )}
          </div>

          {answer && (
            <Card className="border-amber/30 bg-amber/5">
              <CardContent className="py-3 text-sm whitespace-pre-wrap">{answer}</CardContent>
            </Card>
          )}

          {pending.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{pending.length} פעולות לאישור</Badge>
                <Button size="sm" onClick={approveAll} disabled={exec.isPending}>
                  <Check className="ms-1 h-4 w-4" /> אשר הכל
                </Button>
              </div>
              {pending.map((a, i) => (
                <Card key={i}>
                  <CardContent className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground">{a.kind}</div>
                      <div className="text-sm">{a.summary}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="outline" onClick={() => exec.mutate(a, { onSuccess: () => setPending((p) => p.filter((_, j) => j !== i)) })}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setPending((p) => p.filter((_, j) => j !== i))}>
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