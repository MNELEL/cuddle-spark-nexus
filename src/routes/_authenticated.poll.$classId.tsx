import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ArrowRight, MessageSquare, Plus, Sparkles, Trash2, X, Check, Radio, History, Lock, Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getClass } from "@/lib/classes.functions";
import { listStudents } from "@/lib/students.functions";
import {
  listPolls, getPoll, createPoll, closePoll, reopenPoll, deletePoll, setVote,
  type PollRow,
} from "@/lib/polls.functions";
import { suggestPollQuestion } from "@/lib/ai-poll.functions";

export const Route = createFileRoute("/_authenticated/poll/$classId")({
  component: PollPage,
  head: () => ({
    meta: [
      { title: "סקר כיתה חי · הכיתה שלי" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const OPT_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ef4444"];

function PollPage() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();

  const getC = useServerFn(getClass);
  const listS = useServerFn(listStudents);
  const listP = useServerFn(listPolls);
  const createP = useServerFn(createPoll);
  const suggest = useServerFn(suggestPollQuestion);

  const { data: cls } = useQuery({ queryKey: ["class", classId], queryFn: () => getC({ data: { id: classId } }) });
  const { data: students = [] } = useQuery({
    queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }),
  }) as { data: { id: string; name: string }[] };
  const { data: polls = [], refetch } = useQuery({
    queryKey: ["polls", classId], queryFn: () => listP({ data: { classId } }),
  });

  const active = polls.find((p) => p.status === "active");
  const closed = polls.filter((p) => p.status === "closed");

  // form state
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [topic, setTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const addOpt = () => options.length < 4 && setOptions([...options, ""]);
  const rmOpt = (i: number) =>
    options.length > 2 && setOptions(options.filter((_, idx) => idx !== i));
  const setOpt = (i: number, v: string) =>
    setOptions(options.map((o, idx) => (idx === i ? v : o)));

  const createMut = useMutation({
    mutationFn: async () => {
      const clean = options.map((o) => o.trim()).filter(Boolean);
      if (!question.trim()) throw new Error("נדרשת שאלה");
      if (clean.length < 2) throw new Error("נדרשות לפחות 2 אפשרויות");
      return createP({ data: { classId, question: question.trim(), options: clean } });
    },
    onSuccess: () => {
      toast.success("הסקר נוצר");
      setQuestion(""); setOptions(["", ""]);
      qc.invalidateQueries({ queryKey: ["polls", classId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doSuggest = async () => {
    setAiBusy(true);
    try {
      const r = await suggest({ data: { topic: topic.trim() || undefined, className: cls?.name } });
      setQuestion(r.question);
      setOptions(r.options.slice(0, 4).concat(Array(Math.max(0, 2 - r.options.length)).fill("")));
      toast.success("הצעה נטענה");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
      </div>

      <div className="rounded-2xl border bg-card bg-mesh p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber/15 p-3"><MessageSquare className="h-6 w-6 text-amber" /></div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              סקר כיתה חי — {cls?.name ?? "..."}
            </h1>
            <p className="text-sm text-muted-foreground">
              המורה מנהל סקר חי — סימון הצבעה עבור כל תלמיד, תוצאות בזמן אמת, והיסטוריה נשמרת.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue={active ? "live" : "create"} dir="rtl">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="live"><Radio className="ms-1 h-4 w-4" /> סקר פעיל</TabsTrigger>
          <TabsTrigger value="create"><Plus className="ms-1 h-4 w-4" /> יצירת סקר</TabsTrigger>
          <TabsTrigger value="history"><History className="ms-1 h-4 w-4" /> היסטוריה ({closed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          {active ? (
            <LivePoll pollId={active.id} students={students} onChanged={() => refetch()} />
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              אין סקר פעיל. עברו ללשונית "יצירת סקר".
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="create" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <div>
                  <Label>נושא לשאלה (רשות — עוזר ל-AI)</Label>
                  <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="לדוגמה: מידות, פרשת השבוע, סדר לימוד..." />
                </div>
                <div className="flex items-end">
                  <Button onClick={doSuggest} disabled={aiBusy} variant="outline" className="gap-2">
                    <Sparkles className="h-4 w-4" /> {aiBusy ? "טוען..." : "הצע שאלה עם AI"}
                  </Button>
                </div>
              </div>

              <div>
                <Label>שאלה</Label>
                <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} rows={2} placeholder="מהי השאלה שתעלה לדיון?" />
              </div>

              <div className="space-y-2">
                <Label>אפשרויות תשובה (2-4)</Label>
                {options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: OPT_COLORS[i] }} />
                    <Input value={o} onChange={(e) => setOpt(i, e.target.value)} maxLength={200} placeholder={`אפשרות ${i + 1}`} />
                    {options.length > 2 && (
                      <Button variant="ghost" size="icon" onClick={() => rmOpt(i)}><X className="h-4 w-4" /></Button>
                    )}
                  </div>
                ))}
                {options.length < 4 && (
                  <Button variant="outline" size="sm" onClick={addOpt}><Plus className="ms-1 h-4 w-4" /> הוסף אפשרות</Button>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="gap-2">
                  <Check className="h-4 w-4" /> {createMut.isPending ? "יוצר..." : "צור סקר והתחל"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          {closed.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              אין סקרים שנשמרו עדיין.
            </CardContent></Card>
          ) : closed.map((p) => (
            <ClosedPollCard key={p.id} poll={p} students={students} onChanged={() => refetch()} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Live poll ---------------- */

function LivePoll({
  pollId, students, onChanged,
}: { pollId: string; students: { id: string; name: string }[]; onChanged: () => void }) {
  const qc = useQueryClient();
  const getP = useServerFn(getPoll);
  const voteFn = useServerFn(setVote);
  const closeFn = useServerFn(closePoll);
  const delFn = useServerFn(deletePoll);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["poll", pollId], queryFn: () => getP({ data: { id: pollId } }),
    refetchInterval: 3000,
  });

  const voteMap = useMemo(() => {
    const m = new Map<string, number>();
    (data?.votes ?? []).forEach((v) => m.set(v.student_id, v.option_index));
    return m;
  }, [data]);

  const setV = useMutation({
    mutationFn: (args: { studentId: string; optionIndex: number | null }) =>
      voteFn({ data: { pollId, ...args } }),
    onSuccess: () => refetch(),
  });

  if (isLoading || !data) return <Card><CardContent className="py-12 text-center">טוען...</CardContent></Card>;
  const { poll } = data;
  const totals = poll.options.map((_, i) => Array.from(voteMap.values()).filter((v) => v === i).length);
  const total = totals.reduce((a, b) => a + b, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold">{poll.question}</h2>
            <Badge variant="outline" className="shrink-0">חי</Badge>
          </div>

          <div className="space-y-3">
            {poll.options.map((opt, i) => {
              const c = totals[i];
              const pct = total > 0 ? Math.round((c / total) * 100) : 0;
              return (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: OPT_COLORS[i] }} />
                      <span className="font-medium">{opt}</span>
                    </div>
                    <span className="font-mono-tabular">{c} · {pct}%</span>
                  </div>
                  <Progress value={pct} />
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between border-t">
            <div className="text-sm text-muted-foreground">
              הצביעו {total} מתוך {students.length}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={async () => {
                await closeFn({ data: { id: pollId } });
                toast.success("הסקר נסגר ונשמר בהיסטוריה");
                qc.invalidateQueries({ queryKey: ["polls"] });
                onChanged();
              }}><Lock className="ms-1 h-4 w-4" /> סיים ושמור</Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                if (!confirm("למחוק את הסקר?")) return;
                await delFn({ data: { id: pollId } });
                toast.success("נמחק");
                qc.invalidateQueries({ queryKey: ["polls"] });
                onChanged();
              }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-bold mb-3">סימון הצבעה לתלמיד</h3>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין תלמידים.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-auto">
              {students.map((s) => {
                const v = voteMap.get(s.id);
                return (
                  <div key={s.id} className="rounded-lg border p-2">
                    <div className="mb-1 text-sm font-medium">{s.name}</div>
                    <div className="flex flex-wrap gap-1">
                      {poll.options.map((opt, i) => (
                        <Button
                          key={i}
                          size="sm"
                          variant={v === i ? "default" : "outline"}
                          className="h-7 text-xs"
                          style={v === i ? { background: OPT_COLORS[i], borderColor: OPT_COLORS[i] } : { borderColor: OPT_COLORS[i] }}
                          onClick={() => setV.mutate({ studentId: s.id, optionIndex: v === i ? null : i })}
                        >
                          {opt.length > 20 ? opt.slice(0, 20) + "…" : opt}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Closed poll ---------------- */

function ClosedPollCard({
  poll, students, onChanged,
}: { poll: PollRow; students: { id: string; name: string }[]; onChanged: () => void }) {
  const qc = useQueryClient();
  const getP = useServerFn(getPoll);
  const reopenFn = useServerFn(reopenPoll);
  const delFn = useServerFn(deletePoll);

  const { data } = useQuery({ queryKey: ["poll", poll.id], queryFn: () => getP({ data: { id: poll.id } }) });
  const totals = poll.options.map((_, i) =>
    (data?.votes ?? []).filter((v) => v.option_index === i).length,
  );
  const total = totals.reduce((a, b) => a + b, 0);
  const dateStr = new Date(poll.closed_at ?? poll.updated_at).toLocaleDateString("he-IL");
  void students;

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold">{poll.question}</h3>
            <p className="text-xs text-muted-foreground">נסגר: {dateStr} · {total} הצבעות</p>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={async () => {
              await reopenFn({ data: { id: poll.id } });
              toast.success("הסקר נפתח מחדש");
              qc.invalidateQueries({ queryKey: ["polls"] });
              onChanged();
            }}><Unlock className="ms-1 h-3.5 w-3.5" /> פתח מחדש</Button>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={async () => {
              if (!confirm("למחוק?")) return;
              await delFn({ data: { id: poll.id } });
              qc.invalidateQueries({ queryKey: ["polls"] });
              onChanged();
            }}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="space-y-2">
          {poll.options.map((opt, i) => {
            const c = totals[i];
            const pct = total > 0 ? Math.round((c / total) * 100) : 0;
            return (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: OPT_COLORS[i] }} />
                    <span>{opt}</span>
                  </div>
                  <span className="font-mono-tabular text-xs text-muted-foreground">{c} · {pct}%</span>
                </div>
                <Progress value={pct} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}