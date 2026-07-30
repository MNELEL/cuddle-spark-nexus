import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, FileQuestion, Loader2, Save, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  generateExam, type GeneratedExam, type ExamDifficulty, type GeneratedQuestion,
} from "@/lib/ai-exam-generator.functions";
import { listStudents } from "@/lib/students.functions";
import { upsertGrade } from "@/lib/tracking.functions";
import { getClass } from "@/lib/classes.functions";
import { KODESH_SUBJECTS } from "@/lib/kodesh-subjects";

export const Route = createFileRoute("/_authenticated/exam-generator/$classId")({
  component: ExamGeneratorPage,
  head: () => ({
    meta: [
      { title: "מחולל מבחנים · הכיתה שלי" },
      { name: "description", content: "צור מבחן AI מותאם: פתוחות + אמריקאיות, בדיקה אוטומטית וזרימה ישירה לטבלת הציונים." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function today() { return new Date().toISOString().slice(0, 10); }

function ExamGeneratorPage() {
  const { classId } = Route.useParams();
  const getCls = useServerFn(getClass);
  const list = useServerFn(listStudents);
  const gen = useServerFn(generateExam);
  const save = useServerFn(upsertGrade);

  const { data: cls } = useQuery({ queryKey: ["class", classId], queryFn: () => getCls({ data: { id: classId } }) });
  const { data: students } = useQuery({ queryKey: ["students", classId], queryFn: () => list({ data: { classId } }) });

  const [subject, setSubject] = useState<string>("גמרא");
  const [difficulty, setDifficulty] = useState<ExamDifficulty>("medium");
  const [openCount, setOpenCount] = useState<number>(3);
  const [mcCount, setMcCount] = useState<number>(7);
  const [totalMax, setTotalMax] = useState<number>(100);
  const [feedback, setFeedback] = useState<string>("");
  const [exam, setExam] = useState<GeneratedExam | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [mcAnswers, setMcAnswers] = useState<Record<string, number>>({});
  const [openScores, setOpenScores] = useState<Record<string, number>>({});

  const generate = useMutation({
    mutationFn: () => gen({ data: {
      subjects: subject, difficulty, numQuestions: openCount + mcCount,
      openCount, mcCount, totalMax, feedback, language: "he",
    }}),
    onSuccess: (r) => {
      setExam(r);
      setMcAnswers({});
      setOpenScores({});
      toast.success(`נוצר מבחן עם ${r.questions.length} שאלות`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "יצירת המבחן נכשלה"),
  });

  // Auto-grading: MC awards full points if correct, open uses manual score input.
  const { mcAwarded, mcMax, openAwarded, openMax, totalAwarded } = useMemo(() => {
    let mcA = 0, mcM = 0, opA = 0, opM = 0;
    for (const q of exam?.questions ?? []) {
      if (q.type === "mc") {
        mcM += q.points;
        if (mcAnswers[q.id] !== undefined && mcAnswers[q.id] === q.correctIndex) mcA += q.points;
      } else {
        opM += q.points;
        const s = openScores[q.id];
        if (typeof s === "number" && !Number.isNaN(s)) opA += Math.max(0, Math.min(q.points, s));
      }
    }
    return { mcAwarded: mcA, mcMax: mcM, openAwarded: opA, openMax: opM, totalAwarded: mcA + opA };
  }, [exam, mcAnswers, openScores]);

  const scaled = exam ? Math.round((totalAwarded / (exam.totalMax || 1)) * (exam.totalMax || 100)) : 0;

  const saveGrade = useMutation({
    mutationFn: async () => {
      if (!exam) throw new Error("אין מבחן");
      if (!selectedStudentId) throw new Error("בחר תלמיד");
      await save({ data: {
        class_id: classId,
        student_id: selectedStudentId,
        subject: exam.subject.slice(0, 60),
        value: scaled,
        max_value: exam.totalMax,
        date: today(),
        notes: `מחולל מבחנים AI — ${exam.questions.length} שאלות (סגורות ${mcAwarded}/${mcMax}, פתוחות ${openAwarded}/${openMax})`,
      }});
    },
    onSuccess: () => toast.success("הציון נשמר בטבלת הציונים"),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "שמירה נכשלה"),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/classes/$classId" params={{ classId }}>
            <Button variant="ghost" size="sm"><ArrowRight className="ms-1 h-4 w-4" /> חזרה לכיתה</Button>
          </Link>
          <h1 className="font-display text-2xl md:text-3xl font-bold">
            מחולל מבחנים AI · {cls?.name ?? "..."}
          </h1>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5" /> הגדרות מבחן</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>מקצוע / נושא</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KODESH_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="mt-2" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="או הזן נושא חופשי" />
            </div>
            <div>
              <Label>רמת קושי</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as ExamDifficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">קל</SelectItem>
                  <SelectItem value="medium">בינוני</SelectItem>
                  <SelectItem value="hard">קשה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>שאלות פתוחות</Label>
              <Input type="number" min={0} max={30} value={openCount} onChange={(e) => setOpenCount(Math.max(0, +e.target.value || 0))} />
            </div>
            <div>
              <Label>שאלות אמריקאיות</Label>
              <Input type="number" min={0} max={30} value={mcCount} onChange={(e) => setMcCount(Math.max(0, +e.target.value || 0))} />
            </div>
            <div>
              <Label>ציון מקסימלי</Label>
              <Input type="number" min={1} max={1000} value={totalMax} onChange={(e) => setTotalMax(Math.max(1, +e.target.value || 100))} />
            </div>
            <div className="md:col-span-2">
              <Label>משוב / הנחיה חופשית ל-AI (אופציונלי)</Label>
              <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2}
                placeholder='למשל: "פחות שאלות זיכרון, יותר הבנה"' />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={() => generate.mutate()} disabled={generate.isPending || (openCount + mcCount) === 0}>
                {generate.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Sparkles className="ms-1 h-4 w-4" />}
                צור מבחן
              </Button>
            </div>
          </CardContent>
        </Card>

        {exam && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2"><FileQuestion className="h-5 w-5" /> {exam.subject} · {exam.questions.length} שאלות</CardTitle>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">סגורות {mcAwarded}/{mcMax}</Badge>
                <Badge variant="secondary">פתוחות {openAwarded}/{openMax}</Badge>
                <Badge>סה"כ {totalAwarded}/{exam.totalMax}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {exam.questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  index={i}
                  q={q}
                  mcAnswer={mcAnswers[q.id]}
                  onMc={(idx) => setMcAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                  openScore={openScores[q.id]}
                  onOpen={(v) => setOpenScores((prev) => ({ ...prev, [q.id]: v }))}
                />
              ))}

              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="whitespace-nowrap">שיוך לתלמיד:</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                    <SelectTrigger className="w-64"><SelectValue placeholder="בחר תלמיד" /></SelectTrigger>
                    <SelectContent>
                      {(students ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex-1" />
                  <div className="text-sm text-muted-foreground">ציון סופי: <span className="font-bold text-foreground">{totalAwarded}/{exam.totalMax}</span></div>
                  <Button onClick={() => saveGrade.mutate()} disabled={saveGrade.isPending || !selectedStudentId}>
                    {saveGrade.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Save className="ms-1 h-4 w-4" />}
                    הזן לציונים
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  שאלות סגורות מחושבות אוטומטית לפי התשובה הנכונה. שאלות פתוחות דורשות ניקוד ידני של המלמד (0—מקס).
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  index, q, mcAnswer, onMc, openScore, onOpen,
}: {
  index: number;
  q: GeneratedQuestion;
  mcAnswer: number | undefined;
  onMc: (i: number) => void;
  openScore: number | undefined;
  onOpen: (v: number) => void;
}) {
  const correct = q.type === "mc" && mcAnswer !== undefined && mcAnswer === q.correctIndex;
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground mb-1">שאלה {index + 1} · {q.type === "mc" ? "אמריקאית" : "פתוחה"} · {q.points} נק'</div>
          <div className="font-semibold whitespace-pre-wrap">{q.prompt}</div>
        </div>
        {q.type === "mc" && mcAnswer !== undefined && (
          <Badge variant={correct ? "default" : "destructive"}>{correct ? `+${q.points}` : "0"}</Badge>
        )}
      </div>

      {q.type === "mc" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.choices ?? []).map((c, i) => {
            const isSelected = mcAnswer === i;
            const isCorrect = q.correctIndex === i;
            const showCorrect = mcAnswer !== undefined && isCorrect;
            const showWrong = isSelected && !isCorrect;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onMc(i)}
                className={`text-start rounded-md border px-3 py-2 text-sm transition ${
                  showCorrect ? "border-emerald-500 bg-emerald-500/10"
                  : showWrong ? "border-red-500 bg-red-500/10"
                  : isSelected ? "border-primary bg-primary/10"
                  : "hover:bg-accent"
                }`}
              >
                <span className="font-mono me-2 text-muted-foreground">{String.fromCharCode(0x05D0 + i)}.</span>
                {c || <span className="text-muted-foreground">—</span>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {q.modelAnswer && (
            <div className="rounded bg-amber/10 border border-amber/30 p-2 text-xs">
              <span className="font-semibold">תשובה מודלית לעזרת המלמד:</span> {q.modelAnswer}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap">ניקוד ידני:</Label>
            <Input
              type="number" min={0} max={q.points}
              value={openScore ?? ""}
              onChange={(e) => onOpen(Math.max(0, Math.min(q.points, +e.target.value || 0)))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">/ {q.points}</span>
          </div>
        </div>
      )}
    </div>
  );
}