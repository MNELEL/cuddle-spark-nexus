import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowRight, Sparkles, Loader2, Save, Trash2, Printer, Plus, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  listBulletins, generateBulletin, saveBulletin, deleteBulletin,
  type BulletinDraft, type StoredBulletin,
} from "@/lib/bulletins.functions";

export const Route = createFileRoute("/_authenticated/bulletins/$classId")({
  component: BulletinsPage,
});

function todayIso() { return new Date().toISOString().slice(0, 10); }
function weekAgoIso() {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

type Editing = (BulletinDraft & { id?: string; startDate: string; endDate: string; notes: string }) | null;

function emptyDraft(): NonNullable<Editing> {
  return {
    title: "", digest_summary: "", study_points: [], recap_questions: [],
    weekly_riddle: "", weekly_riddle_answer: "", activities: [],
    startDate: weekAgoIso(), endDate: todayIso(), notes: "",
  };
}

function fromStored(b: StoredBulletin): NonNullable<Editing> {
  return {
    id: b.id, title: b.title,
    digest_summary: b.digest_summary,
    study_points: b.study_points ?? [],
    recap_questions: b.recap_questions ?? [],
    weekly_riddle: b.weekly_riddle, weekly_riddle_answer: b.weekly_riddle_answer,
    activities: b.activities ?? [],
    startDate: b.start_date, endDate: b.end_date, notes: b.notes ?? "",
  };
}

function BulletinsPage() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const list = useServerFn(listBulletins);
  const gen = useServerFn(generateBulletin);
  const save = useServerFn(saveBulletin);
  const del = useServerFn(deleteBulletin);

  const [editing, setEditing] = useState<Editing>(null);
  const [lessonNotes, setLessonNotes] = useState("");

  const { data: bulletins, isLoading } = useQuery({
    queryKey: ["bulletins", classId],
    queryFn: () => list({ data: { classId } }),
  });

  const generateMut = useMutation({
    mutationFn: () => gen({ data: {
      classId,
      startDate: editing?.startDate ?? weekAgoIso(),
      endDate: editing?.endDate ?? todayIso(),
      lessonNotes: lessonNotes || undefined,
    } }),
    onSuccess: (draft) => {
      setEditing((prev) => ({ ...(prev ?? emptyDraft()), ...draft }));
      toast.success("העלון נוצר! ניתן לערוך לפני השמירה");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const saveMut = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("אין עלון לעריכה");
      return save({ data: {
        id: editing.id, classId,
        startDate: editing.startDate, endDate: editing.endDate,
        title: editing.title, digest_summary: editing.digest_summary,
        study_points: editing.study_points, recap_questions: editing.recap_questions,
        weekly_riddle: editing.weekly_riddle, weekly_riddle_answer: editing.weekly_riddle_answer,
        activities: editing.activities, notes: editing.notes,
      } });
    },
    onSuccess: () => {
      toast.success("העלון נשמר");
      qc.invalidateQueries({ queryKey: ["bulletins", classId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("נמחק");
      qc.invalidateQueries({ queryKey: ["bulletins", classId] });
      setEditing(null);
    },
  });

  function updateField<K extends keyof NonNullable<Editing>>(k: K, v: NonNullable<Editing>[K]) {
    setEditing((prev) => prev ? { ...prev, [k]: v } : prev);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">עלונים שבועיים</div>
          <h1 className="text-2xl font-bold">עלון שבועי לכיתה</h1>
        </div>
        <Button asChild variant="ghost">
          <Link to="/classes/$classId" params={{ classId }}>
            חזרה לכיתה <ArrowRight className="ms-1 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Sidebar — list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">עלונים קודמים</CardTitle>
            <Button size="sm" onClick={() => setEditing(emptyDraft())}>
              <Plus className="ms-1 h-4 w-4" /> חדש
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <div className="text-sm text-muted-foreground">טוען…</div>}
            {!isLoading && (bulletins?.length ?? 0) === 0 && (
              <div className="text-sm text-muted-foreground">אין עדיין עלונים. צור עלון חדש כדי להתחיל.</div>
            )}
            {bulletins?.map((b) => (
              <button
                key={b.id}
                onClick={() => setEditing(fromStored(b))}
                className={`w-full rounded-lg border p-3 text-right transition hover:bg-accent/10 ${editing?.id === b.id ? "border-primary bg-accent/5" : ""}`}
              >
                <div className="line-clamp-1 font-medium">{b.title || "(ללא כותרת)"}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {b.start_date} → {b.end_date}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Editor */}
        {!editing ? (
          <Card>
            <CardContent className="flex h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
              <Sparkles className="h-10 w-10 text-amber" />
              <div>בחר עלון קיים מהרשימה, או צור עלון חדש</div>
              <Button onClick={() => setEditing(emptyDraft())}>
                <Plus className="ms-1 h-4 w-4" /> צור עלון חדש
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 print:bg-white">
            {/* Controls */}
            <Card className="print:hidden">
              <CardContent className="space-y-3 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">מתאריך</Label>
                    <Input type="date" value={editing.startDate}
                      onChange={(e) => updateField("startDate", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">עד תאריך</Label>
                    <Input type="date" value={editing.endDate}
                      onChange={(e) => updateField("endDate", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">תקציר שיעורים / הערות הרב (אופציונלי, יזין את ה-AI)</Label>
                  <Textarea
                    rows={3}
                    placeholder='למשל: "השבוע למדנו דף ל"ב בברכות, הוספנו מסכת תפילין, היה מבחן בחומש שמות..."'
                    value={lessonNotes}
                    onChange={(e) => setLessonNotes(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
                    {generateMut.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Sparkles className="ms-1 h-4 w-4" />}
                    {editing.title ? "צור מחדש עם AI" : "צור עלון עם AI"}
                  </Button>
                  <Button variant="outline" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !editing.title}>
                    <Save className="ms-1 h-4 w-4" /> שמור
                  </Button>
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="ms-1 h-4 w-4" /> הדפס / PDF
                  </Button>
                  {editing.id && (
                    <Button variant="ghost" className="text-destructive ms-auto"
                      onClick={() => { if (confirm("למחוק את העלון?")) deleteMut.mutate(editing.id!); }}>
                      <Trash2 className="ms-1 h-4 w-4" /> מחק
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Preview / editor */}
            <Card className="print:border-0 print:shadow-none">
              <CardContent className="space-y-4 p-6 print:p-0">
                <div className="space-y-2">
                  <Input
                    className="!text-2xl !font-bold border-0 focus-visible:ring-0 px-0 print:!border-0"
                    value={editing.title}
                    placeholder="כותרת העלון…"
                    onChange={(e) => updateField("title", e.target.value)}
                  />
                  <div className="text-xs text-muted-foreground">
                    {editing.startDate} — {editing.endDate}
                  </div>
                </div>

                <Separator />

                <section>
                  <h2 className="mb-2 text-lg font-semibold text-primary">סיכום השבוע</h2>
                  <Textarea
                    rows={6}
                    className="border-0 px-0 focus-visible:ring-0 print:border-0"
                    value={editing.digest_summary}
                    onChange={(e) => updateField("digest_summary", e.target.value)}
                  />
                </section>

                <section>
                  <h2 className="mb-2 text-lg font-semibold text-primary">נקודות לימוד</h2>
                  <Textarea
                    rows={4}
                    className="border-0 px-0 focus-visible:ring-0 print:border-0"
                    placeholder="נקודה אחת בשורה…"
                    value={editing.study_points.join("\n")}
                    onChange={(e) => updateField("study_points",
                      e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
                  />
                  {editing.study_points.length > 0 && (
                    <ul className="hidden list-disc space-y-1 ps-6 text-sm print:block">
                      {editing.study_points.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  )}
                </section>

                <section>
                  <h2 className="mb-2 text-lg font-semibold text-primary">שאלות חזרה להורים</h2>
                  <div className="space-y-2">
                    {editing.recap_questions.map((q, i) => (
                      <div key={i} className="rounded-lg border p-3">
                        <Input
                          className="!font-medium border-0 focus-visible:ring-0 px-0"
                          value={q.question}
                          onChange={(e) => {
                            const arr = [...editing.recap_questions];
                            arr[i] = { ...arr[i], question: e.target.value };
                            updateField("recap_questions", arr);
                          }}
                          placeholder="שאלה…"
                        />
                        <Input
                          className="!text-sm !text-muted-foreground border-0 focus-visible:ring-0 px-0"
                          value={q.answer}
                          onChange={(e) => {
                            const arr = [...editing.recap_questions];
                            arr[i] = { ...arr[i], answer: e.target.value };
                            updateField("recap_questions", arr);
                          }}
                          placeholder="תשובה…"
                        />
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="print:hidden"
                      onClick={() => updateField("recap_questions",
                        [...editing.recap_questions, { question: "", answer: "" }])}>
                      <Plus className="ms-1 h-4 w-4" /> הוסף שאלה
                    </Button>
                  </div>
                </section>

                <section className="rounded-xl border border-amber/30 bg-amber/5 p-4">
                  <Badge variant="outline" className="border-amber text-amber">חידה שבועית</Badge>
                  <Input
                    className="mt-2 !font-semibold border-0 focus-visible:ring-0 px-0"
                    placeholder="חידה…"
                    value={editing.weekly_riddle}
                    onChange={(e) => updateField("weekly_riddle", e.target.value)}
                  />
                  <Input
                    className="mt-1 !text-sm !text-muted-foreground border-0 focus-visible:ring-0 px-0"
                    placeholder="תשובה (בעמוד הבא של העלון)…"
                    value={editing.weekly_riddle_answer}
                    onChange={(e) => updateField("weekly_riddle_answer", e.target.value)}
                  />
                </section>

                <section>
                  <h2 className="mb-2 text-lg font-semibold text-primary">פעילויות ויוזמות</h2>
                  <Textarea
                    rows={3}
                    className="border-0 px-0 focus-visible:ring-0 print:border-0"
                    placeholder="פעילות אחת בשורה…"
                    value={editing.activities.join("\n")}
                    onChange={(e) => updateField("activities",
                      e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
                  />
                </section>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}