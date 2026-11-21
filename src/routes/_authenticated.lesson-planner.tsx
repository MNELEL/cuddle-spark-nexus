import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Copy, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateLessonPlan } from "@/lib/claude-tools.functions";
import { KODESH_SUBJECTS, type KodeshSubject } from "@/lib/kodesh-subjects";

const GRADE_LEVELS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ז׳", "ח׳"] as const;

export const Route = createFileRoute("/_authenticated/lesson-planner")({
  head: () => ({ meta: [
    { title: "מחולל מערכי שיעור ודפי עבודה · ClassAlign Studio" },
    { name: "description", content: "מערך שיעור מלא עם דפי עבודה בשלוש רמות, מוכן להדפסת A4." },
    { property: "og:title", content: "מחולל מערכי שיעור · ClassAlign Studio" },
    { property: "og:description", content: "מערכי שיעור ודפי עבודה בשלוש רמות עם Claude." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }),
  component: LessonPlannerPage,
});

function LessonPlannerPage() {
  const [subject, setSubject] = useState<KodeshSubject>("גמרא");
  const [gradeLevel, setGradeLevel] = useState<string>("ד׳");
  const [topic, setTopic] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [source, setSource] = useState("");
  const planFn = useServerFn(generateLessonPlan);
  const plan = useMutation({ mutationFn: () => planFn({ data: { subject, gradeLevel, topic, durationMinutes, source } }) });
  const result = plan.data;

  const text = result ? [
    result.title,
    `מטרות: ${result.objectives.join("; ")}`,
    `פתיחה: ${result.opening}`,
    ...result.timeline.map((t) => `${t.minutes} דקות — ${t.activity}`),
    `שאלות מנחות: ${result.guidingQuestions.join("; ")}`,
    ...result.worksheetLevels.map((w) => `דף עבודה — ${w.level}: ${w.questions.join("; ")}`),
    `שיעורי בית: ${result.homework}`,
    result.sourceCaution,
  ].join("\n") : "";

  return <div dir="rtl" className="mx-auto max-w-3xl space-y-6">
    <header className="print:hidden">
      <p className="text-sm text-muted-foreground">Claude · כלי המלמד</p>
      <h1 className="font-display text-2xl font-bold">מחולל מערכי שיעור ודפי עבודה</h1>
    </header>
    <form className="space-y-4 print:hidden" onSubmit={(e) => { e.preventDefault(); plan.reset(); plan.mutate(); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="lp-subject">מקצוע</Label>
          <Select value={subject} onValueChange={(v) => setSubject(v as KodeshSubject)}>
            <SelectTrigger id="lp-subject"><SelectValue /></SelectTrigger>
            <SelectContent>{KODESH_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label htmlFor="lp-grade">שכבת גיל</Label>
          <Select value={gradeLevel} onValueChange={setGradeLevel}>
            <SelectTrigger id="lp-grade"><SelectValue /></SelectTrigger>
            <SelectContent>{GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>כיתה {g}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label htmlFor="lp-topic">נושא / מקום לימוד</Label>
          <Input id="lp-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="למשל: פרשת לך לך, או בבא קמא דף ב׳" required minLength={2} maxLength={200} />
        </div>
        <div className="space-y-2"><Label htmlFor="lp-duration">משך השיעור (דקות)</Label>
          <Input id="lp-duration" type="number" min={20} max={180} value={durationMinutes} onChange={(e) => setDurationMinutes(Math.max(20, Math.min(180, Number(e.target.value) || 45)))} required />
        </div>
      </div>
      <div className="space-y-2"><Label htmlFor="lp-source">טקסט המקור (רשות)</Label>
        <Textarea id="lp-source" value={source} onChange={(e) => setSource(e.target.value)} rows={5} maxLength={12000} />
      </div>
      <Button type="submit" disabled={plan.isPending}>
        {plan.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {plan.isPending ? "Claude מכין…" : "צור מערך שיעור"}
      </Button>
    </form>
    {plan.error && <p role="alert" className="text-destructive print:hidden">{plan.error.message}</p>}
    {result && <section className="space-y-5 border-t pt-5 print:border-0 print:pt-0" aria-live="polite">
      <div className="flex items-center justify-between print:hidden">
        <h2 className="font-display text-xl">מערך השיעור</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> הדפס A4</Button>
          <Button variant="ghost" size="icon" aria-label="העתק תוצאה" onClick={async () => { try { await navigator.clipboard.writeText(text); toast.success("התוצאה הועתקה"); } catch { toast.error("ההעתקה נכשלה"); } }}><Copy className="h-4 w-4" /></Button>
        </div>
      </div>
      <h3 className="font-display text-lg font-bold">{result.title}</h3>
      <div><h4 className="font-semibold">מטרות השיעור</h4>
        <ul className="list-inside list-disc space-y-1">{result.objectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
      </div>
      <div><h4 className="font-semibold">פתיחה</h4><p className="whitespace-pre-wrap">{result.opening}</p></div>
      <div><h4 className="font-semibold">מהלך השיעור</h4>
        <ol className="list-inside list-decimal space-y-1">{result.timeline.map((t, i) => <li key={i}><span className="font-medium">{t.minutes} דקות</span> — {t.activity}</li>)}</ol>
      </div>
      <div><h4 className="font-semibold">שאלות מנחות להבנה</h4>
        <ol className="list-inside list-decimal space-y-1">{result.guidingQuestions.map((q, i) => <li key={i}>{q}</li>)}</ol>
      </div>
      <div className="space-y-4">
        <h4 className="font-semibold">דפי עבודה בשלוש רמות</h4>
        {result.worksheetLevels.map((w, i) => <div key={i} className="space-y-2 rounded-lg border p-4 print:break-inside-avoid">
          <h5 className="font-semibold">רמת {w.level}</h5>
          <ol className="list-inside list-decimal space-y-1">{w.questions.map((q, j) => <li key={j}>{q}</li>)}</ol>
        </div>)}
      </div>
      <div><h4 className="font-semibold">שיעורי בית</h4><p className="whitespace-pre-wrap">{result.homework}</p></div>
      <p className="text-sm text-muted-foreground">{result.sourceCaution}</p>
    </section>}
  </div>;
}
