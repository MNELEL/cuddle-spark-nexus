import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateClassSugya, adviseTeacher } from "@/lib/claude-tools.functions";
import { KODESH_SUBJECTS, type KodeshSubject } from "@/lib/kodesh-subjects";

export function ClaudeTeacherTool({ mode }: { mode: "sugya" | "advisor" }) {
  const [subject, setSubject] = useState<KodeshSubject>("גמרא");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState("");
  const [dilemma, setDilemma] = useState("");
  const sugyaFn = useServerFn(generateClassSugya);
  const advisorFn = useServerFn(adviseTeacher);
  const sugya = useMutation({ mutationFn: () => sugyaFn({ data: { subject, location, source } }) });
  const advisor = useMutation({ mutationFn: () => advisorFn({ data: { dilemma } }) });
  const active = mode === "sugya" ? sugya : advisor;
  const text = mode === "sugya" && sugya.data ? `${sugya.data.title}\n\n${sugya.data.introduction}\n\n${sugya.data.discussion.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\n${sugya.data.nextLesson}\n${sugya.data.sourceCaution}` : advisor.data ? `${advisor.data.summary}\n\n${advisor.data.steps.map((s, i) => `${i + 1}. ${s.title}\n${s.action}\nמדד הצלחה: ${s.success}`).join("\n\n")}` : "";
  return <div dir="rtl" className="mx-auto max-w-3xl space-y-6">
    <header><p className="text-sm text-muted-foreground">Claude · כלי המלמד</p><h1 className="font-display text-2xl font-bold">{mode === "sugya" ? "מחולל סוגיות כיתה" : "היועץ הפדגוגי למלמד"}</h1></header>
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); active.reset(); if (mode === "sugya") sugya.mutate(); else advisor.mutate(); }}>
      {mode === "sugya" ? <>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="ct-subject">מקצוע</Label><Select value={subject} onValueChange={(v) => setSubject(v as KodeshSubject)}><SelectTrigger id="ct-subject"><SelectValue /></SelectTrigger><SelectContent>{KODESH_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="ct-location">מקום לימוד</Label><Input id="ct-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="למשל: בבא מציעא, דף כא ע״א" required minLength={2} maxLength={200} /></div></div>
        <div className="space-y-2"><Label htmlFor="ct-source">טקסט המקור (רשות)</Label><Textarea id="ct-source" value={source} onChange={(e) => setSource(e.target.value)} rows={6} maxLength={12000} /></div>
      </> : <div className="space-y-2"><Label htmlFor="ct-dilemma">הדילמה הכיתתית</Label><Textarea id="ct-dilemma" value={dilemma} onChange={(e) => setDilemma(e.target.value)} placeholder="תאר את המצב בלי שמות או פרטים מזהים" rows={6} required minLength={10} maxLength={5000} /></div>}
      <Button type="submit" disabled={active.isPending}>{active.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{active.isPending ? "Claude מכין…" : mode === "sugya" ? "צור סוגיית כיתה" : "הכן תוכנית בשלושה צעדים"}</Button>
    </form>
    {active.error && <p role="alert" className="text-destructive">{active.error.message}</p>}
    {text && <section className="space-y-4 border-t pt-5" aria-live="polite"><div className="flex items-center justify-between"><h2 className="font-display text-xl">{mode === "sugya" ? "סוגיית הכיתה" : "תוכנית ההתערבות"}</h2><Button variant="ghost" size="icon" aria-label="העתק תוצאה" onClick={async () => { try { await navigator.clipboard.writeText(text); toast.success("התוצאה הועתקה"); } catch { toast.error("ההעתקה נכשלה"); } }}><Copy className="h-4 w-4" /></Button></div>
      {mode === "sugya" && sugya.data ? <><h3 className="font-semibold">{sugya.data.title}</h3><p className="whitespace-pre-wrap">{sugya.data.introduction}</p><ol className="list-inside list-decimal space-y-2">{sugya.data.discussion.map((q, i) => <li key={i}>{q}</li>)}</ol><h3 className="font-semibold">המשך הלימוד</h3><p>{sugya.data.nextLesson}</p><p className="text-sm text-muted-foreground">{sugya.data.sourceCaution}</p></> : advisor.data && <><p>{advisor.data.summary}</p><ol className="space-y-4">{advisor.data.steps.map((s, i) => <li key={i} className="space-y-2 border-b pb-4"><h3 className="font-semibold">{i + 1}. {s.title}</h3><p>{s.action}</p><p className="text-sm text-muted-foreground">מדד הצלחה: {s.success}</p></li>)}</ol></>}
    </section>}
  </div>;
}