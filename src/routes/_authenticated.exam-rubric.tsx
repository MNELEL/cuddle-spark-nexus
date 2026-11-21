import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Copy, Loader2, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateClaudeExam } from "@/lib/claude-tools.functions";
import { claudeExamInput, type ClaudeExamInput } from "@/lib/claude-exam.schemas";
import { KODESH_SUBJECTS, type KodeshSubject } from "@/lib/kodesh-subjects";

export const Route = createFileRoute("/_authenticated/exam-rubric")({
  head: () => ({ meta: [
    { title: "מחולל מבחנים ומחווני בדיקה · ClassAlign Studio" },
    { name: "description", content: "מבחני בקיאות והעמקה לפי נושא או קטע מקור, עם תשובות ומחוון ציונים מפורט למלמד." },
    { property: "og:title", content: "מחולל מבחנים ומחוונים · ClassAlign Studio" },
    { property: "og:description", content: "מבחנים במקצועות קודש עם Claude, ניקוד חלקי וגרסאות להדפסה לתלמיד ולמלמד." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: ExamRubricPage,
});

function ExamRubricPage() {
  const [subject, setSubject] = useState<KodeshSubject>("גמרא");
  const [gradeLevel, setGradeLevel] = useState("ד׳");
  const [topic, setTopic] = useState("");
  const [source, setSource] = useState("");
  const [knowledgeCount, setKnowledgeCount] = useState(4);
  const [depthCount, setDepthCount] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [totalPoints, setTotalPoints] = useState(100);
  const [view, setView] = useState("student");
  const [validationError, setValidationError] = useState("");
  const generate = useServerFn(generateClaudeExam);
  const exam = useMutation({ mutationFn: (data: ClaudeExamInput) => generate({ data }), onSuccess: () => setView("student") });
  const result = exam.data;
  const rubric = view === "teacher";
  const copyResult = async () => {
    if (!result) return;
    const text = [result.title, result.instructions, ...result.questions.map((q, i) => [
      `${i + 1}. ${q.question} (${q.kind}, ${q.points} נקודות)`,
      ...(rubric ? [`תשובה צפויה: ${q.answer}`, ...q.criteria.map((c) => `${c.points} נקודות — ${c.description}`)] : []),
    ].join("\n"))].join("\n\n");
    try { await navigator.clipboard.writeText(text); toast.success("התוצאה הועתקה"); }
    catch { toast.error("ההעתקה נכשלה"); }
  };

  return <div dir="rtl" className="mx-auto max-w-3xl space-y-6">
    <header className="no-print space-y-2">
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardList className="size-4" /> Claude · כלי המלמד</p>
      <h1 className="font-display text-2xl font-bold">מחולל מבחנים ומחווני בדיקה</h1>
    </header>
    <form className="no-print space-y-4" onSubmit={(e) => {
      e.preventDefault();
      if (exam.isPending) return;
      setValidationError("");
      const parsed = claudeExamInput.safeParse({ subject, gradeLevel, topic, source, knowledgeCount, depthCount, durationMinutes, totalPoints });
      if (!parsed.success) { setValidationError(parsed.error.issues[0]?.message ?? "יש לבדוק את פרטי המבחן."); return; }
      exam.reset(); exam.mutate(parsed.data);
    }}>
      <fieldset disabled={exam.isPending} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="exam-subject">מקצוע</Label>
            <Select value={subject} onValueChange={(v) => setSubject(v as KodeshSubject)} disabled={exam.isPending}>
              <SelectTrigger id="exam-subject"><SelectValue /></SelectTrigger>
              <SelectContent>{KODESH_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="exam-grade">שכבת גיל</Label>
            <Select value={gradeLevel} onValueChange={setGradeLevel} disabled={exam.isPending}>
              <SelectTrigger id="exam-grade"><SelectValue /></SelectTrigger>
              <SelectContent>{["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ז׳", "ח׳"].map((g) => <SelectItem key={g} value={g}>כיתה {g}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2"><Label htmlFor="exam-topic">נושא / מקום לימוד</Label>
          <Input id="exam-topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="למשל: השבת אבדה, או משנה בבא מציעא פרק ב׳" />
        </div>
        <div className="space-y-2"><Label htmlFor="exam-source">קטע מקור</Label>
          <Textarea id="exam-source" value={source} onChange={(e) => setSource(e.target.value)} maxLength={12000} rows={5} placeholder="טקסט המקור שעליו ייבנה המבחן" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="exam-knowledge">שאלות בקיאות</Label><Input id="exam-knowledge" type="number" min={1} max={8} required value={knowledgeCount} onChange={(e) => setKnowledgeCount(e.target.valueAsNumber)} /></div>
          <div className="space-y-2"><Label htmlFor="exam-depth">שאלות העמקה</Label><Input id="exam-depth" type="number" min={1} max={4} required value={depthCount} onChange={(e) => setDepthCount(e.target.valueAsNumber)} /></div>
          <div className="space-y-2"><Label htmlFor="exam-duration">משך המבחן (דקות)</Label><Input id="exam-duration" type="number" min={15} max={180} required value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.valueAsNumber)} /></div>
          <div className="space-y-2"><Label htmlFor="exam-points">ציון כולל</Label><Input id="exam-points" type="number" min={20} max={200} required value={totalPoints} onChange={(e) => setTotalPoints(e.target.valueAsNumber)} /></div>
        </div>
        <Button type="submit" disabled={exam.isPending}>
          {exam.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {exam.isPending ? "Claude מכין את המבחן…" : "צור מבחן ומחוון"}
        </Button>
      </fieldset>
    </form>
    {(validationError || exam.error) && <p role="alert" className="no-print text-destructive">{validationError || exam.error?.message}</p>}
    {result && <div className="space-y-5 border-t pt-5" aria-live="polite">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={setView} dir="rtl">
          <TabsList><TabsTrigger value="student">מבחן לתלמיד</TabsTrigger><TabsTrigger value="teacher">מחוון למלמד</TabsTrigger></TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" /> הדפס A4</Button>
          <Button variant="ghost" size="icon" aria-label={rubric ? "העתק מחוון" : "העתק מבחן"} title={rubric ? "העתק מחוון" : "העתק מבחן"} onClick={copyResult}><Copy className="size-4" /></Button>
        </div>
      </div>
      <p className="no-print text-sm text-muted-foreground">{result.sourceCaution || "טיוטה — נדרשת בדיקת המלמד לפני מסירה לתלמידים."}</p>
      <article className="report-print-area space-y-6">
        <div className="space-y-2 border-b pb-4">
          <h2 className="font-display text-xl font-bold">{result.title}{rubric ? " — מחוון למלמד" : ""}</h2>
          <p className="text-sm text-muted-foreground">{result.questions.length} שאלות · {result.questions.reduce((sum, q) => sum + q.points, 0)} נקודות</p>
          {!rubric && <p className="text-sm">שם התלמיד: ____________________</p>}
          <p className="whitespace-pre-wrap">{result.instructions}</p>
        </div>
        {result.questions.map((q, i) => <div key={i} className="space-y-3 border-b pb-5 print:break-inside-avoid">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">שאלה {i + 1}</h3><Badge variant="secondary">{q.kind}</Badge><span className="text-sm text-muted-foreground">{q.points} נקודות</span></div>
          <p className="whitespace-pre-wrap">{q.question}</p>
          {rubric ? <div className="space-y-3">
            <div><h4 className="font-semibold">תשובה צפויה</h4><p className="whitespace-pre-wrap">{q.answer}</p></div>
            <div><h4 className="font-semibold">מחוון ניקוד</h4><ul className="mt-2 space-y-2">{q.criteria.map((c, j) => <li key={j} className="flex items-start justify-between gap-4 border-b pb-2"><span>{c.description}</span><span className="shrink-0 font-medium">{c.points} נק׳</span></li>)}</ul></div>
          </div> : <div aria-label="מקום לתשובה" className="space-y-6 pt-3">{Array.from({ length: q.kind === "העמקה" ? 5 : 3 }, (_, j) => <div key={j} className="border-b border-border" />)}</div>}
        </div>)}
      </article>
    </div>}
  </div>;
}