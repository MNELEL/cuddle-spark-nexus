import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowRight, Sparkles, Loader2, Save, Trash2, Printer, Plus, FileText, FileDown, Eye,
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
  publishBulletin, unpublishBulletin, listBulletinVersions,
  normalizeExtras,
  type BulletinDraft, type StoredBulletin, type BulletinSnapshot,
  type StudySchedule, type HonoredStudent, type SpecialNotice,
} from "@/lib/bulletins.functions";
import {
  suggestResourcesForBulletin, listBulletinResources, linkResourceToBulletin,
  generateQuizFromBulletin, generateQuizFromSchedule, listScheduleResources,
  reassignResourceToBulletin,
} from "@/lib/bulletin-sync.functions";
import { BulletinImportQuestionsDialog } from "@/components/bulletin-import-questions-dialog";
import { Library, Link2, Wand2, Lock, Unlock, History, Send, ExternalLink, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { buildBulletinPdf } from "@/lib/pdf/bulletin-pdf";
import { downloadPdfBlob } from "@/lib/pdf/pdf-builder";
import { PdfPreviewDialog } from "@/components/pdf/pdf-preview-dialog";
import { bulletinToMarkdown } from "@/lib/text-export";
import { getClass } from "@/lib/classes.functions";
import { hebrewDateTime } from "@/lib/hebrew-date";

export const Route = createFileRoute("/_authenticated/bulletins/$classId")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: BulletinsPage,
});

function todayIso() { return new Date().toISOString().slice(0, 10); }
function weekAgoIso() {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

type Editing = (BulletinDraft & {
  id?: string; startDate: string; endDate: string; notes: string;
  status?: "draft" | "published";
}) | null;

function emptyDraft(): NonNullable<Editing> {
  return {
    title: "", digest_summary: "", study_points: [], recap_questions: [],
    weekly_riddle: "", weekly_riddle_answer: "", activities: [],
    startDate: weekAgoIso(), endDate: todayIso(), notes: "",
    status: "draft",
    ...normalizeExtras(null),
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
    status: b.status ?? "draft",
    ...normalizeExtras(b),
  };
}

/** מקצועות ההספק השבועי — סדר קבוע לתצוגה ולתוויות השדות. */
const SCHEDULE_ROWS = [
  { key: "gemara", label: "גמרא", a: ["daf", "דף"], b: ["topic", "נושא"] },
  { key: "mishna", label: "משנה", a: ["masechet", "מסכת"], b: ["perek", "פרק"] },
  { key: "torah", label: "חומש", a: ["parasha", "פרשה"], b: ["pasuk_range", "פסוקים"] },
  { key: "navi", label: "נביא", a: ["sefer", "ספר"], b: ["perek", "פרק"] },
  { key: "halacha", label: "הלכה", a: ["siman", "סימן"], b: ["seif", "סעיף"] },
] as const;

type ScheduleKey = (typeof SCHEDULE_ROWS)[number]["key"];

const HONOR_TYPES: { value: HonoredStudent["type"]; label: string }[] = [
  { value: "vort", label: "ווארט / דבר תורה" },
  { value: "mazal_tov", label: "מזל טוב" },
  { value: "other", label: "יישר כח" },
];

function BulletinsPage() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const list = useServerFn(listBulletins);
  const gen = useServerFn(generateBulletin);
  const save = useServerFn(saveBulletin);
  const del = useServerFn(deleteBulletin);
  const publish = useServerFn(publishBulletin);
  const unpublish = useServerFn(unpublishBulletin);
  const getCls = useServerFn(getClass);

  const [editing, setEditing] = useState<Editing>(null);
  const [lessonNotes, setLessonNotes] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const genFromSchedule = useServerFn(generateQuizFromSchedule);
  const listSchedRes = useServerFn(listScheduleResources);
  const reassignRes = useServerFn(reassignResourceToBulletin);

  /** תיקון עקביות: העברת חומר שמקושר גם לעלון אחר אל העלון הנוכחי בלבד. */
  const reassignMut = useMutation({
    mutationFn: (resourceId: string) => {
      if (!editing?.id) throw new Error("שמור את העלון קודם");
      return reassignRes({ data: { bulletin_id: editing.id, resource_id: resourceId } });
    },
    onSuccess: () => {
      toast.success("הקישור עודכן — החומר משויך כעת לעלון הזה בלבד");
      if (editing?.id) {
        qc.invalidateQueries({ queryKey: ["bulletin-schedule-resources", editing.id] });
        qc.invalidateQueries({ queryKey: ["bulletin-linked", editing.id] });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const { data: bulletins, isLoading } = useQuery({
    queryKey: ["bulletins", classId],
    queryFn: () => list({ data: { classId } }),
  });

  const { data: cls } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getCls({ data: { id: classId } }),
  });

  const onPdf = async () => {
    if (!editing) return;
    try {
      const { blob, filename } = await buildBulletinPdf({
        bulletin: editing,
        className: cls?.name ?? "כיתה",
      });
      downloadPdfBlob(blob, filename);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ייצוא ה-PDF נכשל");
    }
  };

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
        torah_dvar_title: editing.torah_dvar_title,
        torah_dvar_body: editing.torah_dvar_body,
        study_schedule: editing.study_schedule,
        honored_students: editing.honored_students,
        special_notices: editing.special_notices,
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

  const publishMut = useMutation({
    mutationFn: (id: string) => publish({ data: { id } }),
    onSuccess: () => {
      toast.success("העלון פורסם ונעול לעריכה");
      setEditing((prev) => prev ? { ...prev, status: "published" } : prev);
      qc.invalidateQueries({ queryKey: ["bulletins", classId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const unpublishMut = useMutation({
    mutationFn: (id: string) => unpublish({ data: { id } }),
    onSuccess: (_r, id) => {
      toast.success("הנעילה שוחררה — ניתן לערוך");
      setEditing((prev) => prev ? { ...prev, status: "draft" } : prev);
      qc.invalidateQueries({ queryKey: ["bulletins", classId] });
      qc.invalidateQueries({ queryKey: ["bulletin-versions", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const locked = editing?.status === "published";

  const scheduleQuizMut = useMutation({
    mutationFn: (subject: ScheduleKey) => {
      if (!editing?.id) throw new Error("שמור את העלון לפני יצירת חומר");
      return genFromSchedule({ data: { bulletin_id: editing.id, subject } });
    },
    onSuccess: () => {
      toast.success("דף שאלות נוצר בספרייה ושויך לעלון");
      qc.invalidateQueries({ queryKey: ["teaching-resources"] });
      if (editing?.id) {
        qc.invalidateQueries({ queryKey: ["bulletin-linked", editing.id] });
        qc.invalidateQueries({ queryKey: ["bulletin-schedule-resources", editing.id] });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  /** חומרים שנוצרו אוטומטית מההספק — כדי להציג קישור לעריכה ולאישור הקשר לעלון. */
  const { data: scheduleResources = [] } = useQuery({
    queryKey: ["bulletin-schedule-resources", editing?.id ?? ""],
    queryFn: () => listSchedRes({ data: { bulletin_id: editing!.id! } }),
    enabled: !!editing?.id,
  });

  function updateField<K extends keyof NonNullable<Editing>>(k: K, v: NonNullable<Editing>[K]) {
    setEditing((prev) => prev ? { ...prev, [k]: v } : prev);
  }

  function updateSchedule(key: ScheduleKey, field: string, value: string) {
    setEditing((prev) => {
      if (!prev) return prev;
      const current = (prev.study_schedule ?? {}) as Record<string, Record<string, string>>;
      const row = { ...(current[key] ?? {}), [field]: value };
      return { ...prev, study_schedule: { ...current, [key]: row } as StudySchedule };
    });
  }

  /** סידור מחדש של ההודעות המיוחדות — הסדר בטופס הוא הסדר בעלון. */
  function moveNotice(from: number, to: number) {
    setEditing((prev) => {
      if (!prev) return prev;
      if (to < 0 || to >= prev.special_notices.length || from === to) return prev;
      const arr = [...prev.special_notices];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item!);
      return { ...prev, special_notices: arr };
    });
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
                {locked && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber/40 bg-amber/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Lock className="h-4 w-4 text-amber" aria-hidden="true" />
                      העלון פורסם ונעול לעריכה
                    </div>
                    <Button size="sm" variant="outline" disabled={unpublishMut.isPending}
                      onClick={() => {
                        if (!editing.id) return;
                        if (confirm("לשחרר את נעילת העלון לעריכה? הגרסה הנוכחית תישמר בהיסטוריה.")) {
                          unpublishMut.mutate(editing.id);
                        }
                      }}>
                      <Unlock className="ms-1 h-4 w-4" aria-hidden="true" /> שחרר נעילה לעריכה
                    </Button>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">מתאריך</Label>
                    <Input type="date" value={editing.startDate} disabled={locked}
                      onChange={(e) => updateField("startDate", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">עד תאריך</Label>
                    <Input type="date" value={editing.endDate} disabled={locked}
                      onChange={(e) => updateField("endDate", e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">תקציר שיעורים / הערות הרב (אופציונלי, יזין את ה-AI)</Label>
                  <Textarea
                    rows={3}
                    disabled={locked}
                    placeholder='למשל: "השבוע למדנו דף ל"ב בברכות, הוספנו מסכת תפילין, היה מבחן בחומש שמות..."'
                    value={lessonNotes}
                    onChange={(e) => setLessonNotes(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending || locked}>
                    {generateMut.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Sparkles className="ms-1 h-4 w-4" />}
                    {editing.title ? "צור מחדש עם AI" : "צור עלון עם AI"}
                  </Button>
                  {!locked && (
                    <Button variant="outline" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !editing.title}>
                      <Save className="ms-1 h-4 w-4" /> שמור
                    </Button>
                  )}
                  {!locked && editing.id && (
                    <Button variant="outline" disabled={publishMut.isPending || !editing.title}
                      onClick={() => editing.id && publishMut.mutate(editing.id)}>
                      <Send className="ms-1 h-4 w-4" aria-hidden="true" /> פרסם
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer className="ms-1 h-4 w-4" /> הדפס / PDF
                  </Button>
                  <Button variant="outline" onClick={onPdf} disabled={!editing.title}>
                    <FileDown className="ms-1 h-4 w-4" /> הורד PDF
                  </Button>
                  <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!editing.title}>
                    <Eye className="ms-1 h-4 w-4" /> תצוגה מקדימה
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
                    disabled={locked}
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
                    disabled={locked}
                    className="border-0 px-0 focus-visible:ring-0 print:border-0"
                    value={editing.digest_summary}
                    onChange={(e) => updateField("digest_summary", e.target.value)}
                  />
                </section>

                <section>
                  <h2 className="mb-2 text-lg font-semibold text-primary">דבר תורה</h2>
                  <Input
                    className="!font-semibold border-0 focus-visible:ring-0 px-0"
                    placeholder="כותרת דבר התורה…"
                    value={editing.torah_dvar_title}
                    disabled={locked}
                    onChange={(e) => updateField("torah_dvar_title", e.target.value)}
                  />
                  <Textarea
                    rows={7}
                    disabled={locked}
                    className="mt-1 border-0 px-0 focus-visible:ring-0 print:border-0"
                    placeholder="דבר תורה מורחב לעלון…"
                    value={editing.torah_dvar_body}
                    onChange={(e) => updateField("torah_dvar_body", e.target.value)}
                  />
                </section>

                <section>
                  <h2 className="mb-2 text-lg font-semibold text-primary">ההספק הלימודי</h2>
                  <div className="space-y-2">
                    {SCHEDULE_ROWS.map((row) => {
                      const cur = ((editing.study_schedule ?? {}) as Record<string, Record<string, string>>)[row.key] ?? {};
                      const generated = scheduleResources.filter((r) => r.schedule_key === row.key);
                      return (
                        <div key={row.key} className="rounded-lg border p-2">
                          <div className="grid items-center gap-2 sm:grid-cols-[80px_1fr_1fr_auto]">
                          <div className="text-sm font-medium">{row.label}</div>
                          <Input
                            placeholder={row.a[1]} disabled={locked}
                            value={cur[row.a[0]] ?? ""}
                            onChange={(e) => updateSchedule(row.key, row.a[0], e.target.value)}
                          />
                          <Input
                            placeholder={row.b[1]} disabled={locked}
                            value={cur[row.b[0]] ?? ""}
                            onChange={(e) => updateSchedule(row.key, row.b[0], e.target.value)}
                          />
                          <Button
                            size="sm" variant="outline" className="print:hidden"
                            disabled={!editing.id || scheduleQuizMut.isPending}
                            title="צור דף שאלות חזרה בספרייה לפי ההספק במקצוע הזה"
                            onClick={() => scheduleQuizMut.mutate(row.key)}
                          >
                            <Wand2 className="ms-1 h-3 w-3" aria-hidden="true" /> צור חומר
                          </Button>
                          </div>
                          {generated.length > 0 && (
                            <div className="mt-2 space-y-1 print:hidden">
                              {generated.map((r) => (
                                <div key={r.id} className="rounded-md bg-muted/40 px-2 py-1 text-xs">
                                  <div className="flex flex-wrap items-center gap-2">
                                  {r.other_bulletins.length > 0
                                    ? <Badge variant="destructive">מקושר גם לעלון אחר</Badge>
                                    : <Badge variant="outline" className="border-amber text-amber">מקושר לעלון</Badge>}
                                  <Link
                                    to="/resources/$resourceId" params={{ resourceId: r.id }}
                                    className="font-medium hover:underline"
                                  >
                                    {r.title}
                                  </Link>
                                  <Link
                                    to="/resources/$resourceId" params={{ resourceId: r.id }}
                                    className="ms-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                  >
                                    <ExternalLink className="h-3 w-3" aria-hidden="true" /> פתח לעריכה
                                  </Link>
                                  </div>
                                  {r.other_bulletins.length > 0 && (
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                      <span>
                                        אזהרה: החומר משויך גם ל{r.other_bulletins.length > 1 ? "-" : ""}
                                        {r.other_bulletins.map((b) => b.title).join(", ")}.
                                      </span>
                                      <Button
                                        size="sm" variant="outline" className="h-6 px-2 text-[11px]"
                                        disabled={reassignMut.isPending}
                                        onClick={() => reassignMut.mutate(r.id)}
                                      >
                                        עדכן קישור לעלון הזה
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground print:hidden">
                    שמור את העלון כדי לאפשר יצירת חומר לפי ההספק.
                  </p>
                </section>

                <section>
                  <h2 className="mb-2 text-lg font-semibold text-primary">נקודות לימוד</h2>
                  <Textarea
                    rows={4}
                    disabled={locked}
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
                          disabled={locked}
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
                          disabled={locked}
                          onChange={(e) => {
                            const arr = [...editing.recap_questions];
                            arr[i] = { ...arr[i], answer: e.target.value };
                            updateField("recap_questions", arr);
                          }}
                          placeholder="תשובה…"
                        />
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 print:hidden">
                      <Button variant="outline" size="sm"
                        disabled={locked}
                        onClick={() => updateField("recap_questions",
                          [...editing.recap_questions, { question: "", answer: "" }])}>
                        <Plus className="ms-1 h-4 w-4" /> הוסף שאלה
                      </Button>
                      <Button variant="outline" size="sm"
                        disabled={locked || !editing.id}
                        title={editing.id ? undefined : "שמור את העלון כדי לייבא שאלות"}
                        onClick={() => setImportOpen(true)}>
                        <Library className="ms-1 h-4 w-4" aria-hidden="true" /> ייבא משאלות קיימות בספרייה
                      </Button>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-amber/30 bg-amber/5 p-4">
                  <Badge variant="outline" className="border-amber text-amber">חידה שבועית</Badge>
                  <Input
                    className="mt-2 !font-semibold border-0 focus-visible:ring-0 px-0"
                    placeholder="חידה…"
                    value={editing.weekly_riddle}
                    disabled={locked}
                    onChange={(e) => updateField("weekly_riddle", e.target.value)}
                  />
                  <Input
                    className="mt-1 !text-sm !text-muted-foreground border-0 focus-visible:ring-0 px-0"
                    placeholder="תשובה (בעמוד הבא של העלון)…"
                    value={editing.weekly_riddle_answer}
                    disabled={locked}
                    onChange={(e) => updateField("weekly_riddle_answer", e.target.value)}
                  />
                </section>

                <section>
                  <h2 className="mb-2 text-lg font-semibold text-primary">פעילויות ויוזמות</h2>
                  <Textarea
                    rows={3}
                    disabled={locked}
                    className="border-0 px-0 focus-visible:ring-0 print:border-0"
                    placeholder="פעילות אחת בשורה…"
                    value={editing.activities.join("\n")}
                    onChange={(e) => updateField("activities",
                      e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
                  />
                </section>

                <section>
                  <h2 className="mb-2 text-lg font-semibold text-primary">יישר כח ומזל טוב</h2>
                  <div className="space-y-2">
                    {editing.honored_students.map((h, i) => (
                      <div key={i} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_160px_1fr_auto]">
                        <Input
                          placeholder="שם התלמיד…" value={h.name} disabled={locked}
                          onChange={(e) => {
                            const arr = [...editing.honored_students];
                            arr[i] = { ...arr[i], name: e.target.value };
                            updateField("honored_students", arr);
                          }}
                        />
                        <select
                          className="h-9 rounded-md border bg-background px-2 text-sm"
                          value={h.type} disabled={locked}
                          aria-label="סוג ההוקרה"
                          onChange={(e) => {
                            const arr = [...editing.honored_students];
                            arr[i] = { ...arr[i], type: e.target.value as HonoredStudent["type"] };
                            updateField("honored_students", arr);
                          }}
                        >
                          {HONOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <Input
                          placeholder="הערה (אופציונלי)…" value={h.note} disabled={locked}
                          onChange={(e) => {
                            const arr = [...editing.honored_students];
                            arr[i] = { ...arr[i], note: e.target.value };
                            updateField("honored_students", arr);
                          }}
                        />
                        <Button variant="ghost" size="sm" className="text-destructive print:hidden" disabled={locked}
                          onClick={() => updateField("honored_students",
                            editing.honored_students.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="print:hidden" disabled={locked}
                      onClick={() => updateField("honored_students",
                        [...editing.honored_students, { name: "", type: "other" as const, note: "" }])}>
                      <Plus className="ms-1 h-4 w-4" /> הוסף תלמיד
                    </Button>
                  </div>
                </section>

                <section>
                  <h2 className="mb-2 text-lg font-semibold text-primary">הודעות מיוחדות</h2>
                  <div className="space-y-2">
                    {editing.special_notices.map((n, i) => (
                      <div
                        key={i}
                        className={`space-y-1 rounded-lg border p-2 ${dragIndex === i ? "border-amber bg-amber/5" : ""}`}
                        draggable={!locked}
                        onDragStart={() => setDragIndex(i)}
                        onDragEnd={() => setDragIndex(null)}
                        onDragOver={(e) => { if (dragIndex !== null && !locked) e.preventDefault(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null) moveNotice(dragIndex, i);
                          setDragIndex(null);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="cursor-grab text-muted-foreground print:hidden"
                            aria-hidden="true"
                            title="גרור כדי לסדר מחדש"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                          <Input
                            className="!font-medium" placeholder="כותרת ההודעה…" value={n.title} disabled={locked}
                            onChange={(e) => {
                              const arr = [...editing.special_notices];
                              arr[i] = { ...arr[i], title: e.target.value };
                              updateField("special_notices", arr);
                            }}
                          />
                          <Button variant="ghost" size="sm" className="print:hidden" disabled={locked || i === 0}
                            aria-label="הזז למעלה" onClick={() => moveNotice(i, i - 1)}>
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button variant="ghost" size="sm" className="print:hidden"
                            disabled={locked || i === editing.special_notices.length - 1}
                            aria-label="הזז למטה" onClick={() => moveNotice(i, i + 1)}>
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive print:hidden" disabled={locked}
                            aria-label="מחק הודעה"
                            onClick={() => updateField("special_notices",
                              editing.special_notices.filter((_, j) => j !== i))}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                        <Textarea
                          rows={2} placeholder="תוכן ההודעה…" value={n.body} disabled={locked}
                          onChange={(e) => {
                            const arr = [...editing.special_notices];
                            arr[i] = { ...arr[i], body: e.target.value };
                            updateField("special_notices", arr);
                          }}
                        />
                      </div>
                    ))}
                    {editing.special_notices.length > 1 && (
                      <p className="text-xs text-muted-foreground print:hidden">
                        גרור הודעה או השתמש בחצים כדי לשנות את הסדר — זה גם הסדר שיוצג בעלון.
                      </p>
                    )}
                    <Button variant="outline" size="sm" className="print:hidden" disabled={locked}
                      onClick={() => updateField("special_notices",
                        [...editing.special_notices, { title: "", body: "" } as SpecialNotice])}>
                      <Plus className="ms-1 h-4 w-4" /> הוסף הודעה מיוחדת
                    </Button>
                  </div>
                </section>

                {editing.id && (
                  <>
                    <BulletinSyncPanel bulletinId={editing.id} classId={classId} />
                    <BulletinVersionsPanel
                      bulletinId={editing.id}
                      onLoad={(snap) => {
                        setEditing((prev) => prev ? {
                          ...prev,
                          title: snap.title,
                          digest_summary: snap.digest_summary,
                          study_points: snap.study_points ?? [],
                          recap_questions: snap.recap_questions ?? [],
                          weekly_riddle: snap.weekly_riddle,
                          weekly_riddle_answer: snap.weekly_riddle_answer,
                          activities: snap.activities ?? [],
                          notes: snap.notes ?? "",
                          startDate: snap.start_date ?? prev.startDate,
                          endDate: snap.end_date ?? prev.endDate,
                          ...normalizeExtras(snap),
                        } : prev);
                        toast.success("הגרסה נטענה לטופס — לא נשמרה עדיין");
                      }}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <PdfPreviewDialog
              open={previewOpen}
              onOpenChange={setPreviewOpen}
              title="תצוגה מקדימה של העלון"
              cacheKey={editing.id ?? "new"}
              buildPdf={() => buildBulletinPdf({ bulletin: editing, className: cls?.name ?? "כיתה" })}
              buildText={() => bulletinToMarkdown(editing, cls?.name ?? "כיתה")}
              textFilename={`עלון_${editing.startDate}.md`}
              textMime="text/markdown"
            />

            {editing.id && (
              <BulletinImportQuestionsDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                bulletinId={editing.id}
                onImport={(qs) => updateField("recap_questions", [...editing.recap_questions, ...qs])}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Version history of a bulletin — clicking a version loads it into the form (no auto-save). */
function BulletinVersionsPanel({
  bulletinId, onLoad,
}: { bulletinId: string; onLoad: (snapshot: BulletinSnapshot) => void }) {
  const listVersions = useServerFn(listBulletinVersions);
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["bulletin-versions", bulletinId],
    queryFn: () => listVersions({ data: { bulletinId } }),
  });

  return (
    <section className="print:hidden space-y-2 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-amber" aria-hidden="true" />
        <h3 className="font-semibold">היסטוריית גרסאות</h3>
      </div>
      {isLoading && <div className="text-sm text-muted-foreground">טוען…</div>}
      {!isLoading && versions.length === 0 && (
        <div className="text-sm text-muted-foreground">
          אין עדיין גרסאות קודמות. גרסה נשמרת בכל שחרור נעילה של עלון שפורסם.
        </div>
      )}
      <ul className="space-y-1">
        {versions.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => onLoad(v.snapshot)}
              className="min-h-9 w-full rounded-md border bg-card px-3 py-2 text-right text-sm transition hover:border-amber/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-medium">{v.snapshot?.title || "(ללא כותרת)"}</span>
              <span className="ms-2 text-xs text-muted-foreground">
                נשמר: {hebrewDateTime(v.created_at)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BulletinSyncPanel({ bulletinId, classId: _classId }: { bulletinId: string; classId: string }) {
  const qc = useQueryClient();
  const suggest = useServerFn(suggestResourcesForBulletin);
  const listLinked = useServerFn(listBulletinResources);
  const link = useServerFn(linkResourceToBulletin);
  const genQuiz = useServerFn(generateQuizFromBulletin);

  const { data: suggestions = [], isFetching: loadingS } = useQuery({
    queryKey: ["bulletin-suggest", bulletinId],
    queryFn: () => suggest({ data: { bulletin_id: bulletinId, limit: 6 } }),
  });
  const { data: linked = [] } = useQuery({
    queryKey: ["bulletin-linked", bulletinId],
    queryFn: () => listLinked({ data: { bulletin_id: bulletinId } }),
  });

  const linkMut = useMutation({
    mutationFn: (rid: string) => link({ data: { bulletin_id: bulletinId, resource_id: rid } }),
    onSuccess: () => {
      toast.success("שויך לעלון");
      qc.invalidateQueries({ queryKey: ["bulletin-linked", bulletinId] });
    },
  });
  const quizMut = useMutation({
    mutationFn: () => genQuiz({ data: { bulletin_id: bulletinId } }),
    onSuccess: () => {
      toast.success("מבחן חזרה נוסף לספרייה ושויך לעלון");
      qc.invalidateQueries({ queryKey: ["bulletin-linked", bulletinId] });
      qc.invalidateQueries({ queryKey: ["teaching-resources"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const linkedIds = new Set(linked.map((r) => r.id));

  return (
    <section className="print:hidden rounded-xl border bg-muted/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Library className="h-4 w-4 text-amber" />
        <h3 className="font-semibold">סנכרון עם ספריית החומרים</h3>
        <Button size="sm" variant="outline" className="ms-auto"
          onClick={() => quizMut.mutate()} disabled={quizMut.isPending}>
          {quizMut.isPending ? <Loader2 className="ms-1 h-3 w-3 animate-spin" /> : <Wand2 className="ms-1 h-3 w-3" />}
          צור מבחן חזרה מהשבוע
        </Button>
      </div>

      {linked.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-muted-foreground">חומרים מקושרים לעלון</div>
          <div className="flex flex-wrap gap-2">
            {linked.map((r) => (
              <Link key={r.id} to="/resources/$resourceId" params={{ resourceId: r.id }}
                className="rounded-md border bg-card px-2 py-1 text-xs hover:border-amber/40">
                {r.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-xs font-medium text-muted-foreground">
          הצעות מתאימות לנקודות הלימוד {loadingS && <Loader2 className="inline h-3 w-3 animate-spin" />}
        </div>
        {suggestions.length === 0 && !loadingS && (
          <div className="text-xs text-muted-foreground">אין הצעות עדיין — הוסף נקודות לימוד ושמור את העלון.</div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {suggestions.map((r) => {
            const isLinked = linkedIds.has(r.id);
            return (
              <div key={r.id} className="rounded-lg border bg-card p-2 text-xs flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <Link to="/resources/$resourceId" params={{ resourceId: r.id }}
                    className="font-semibold line-clamp-1 hover:underline">{r.title}</Link>
                  <div className="text-[10px] text-muted-foreground">
                    {r.resource_type}{r.subject ? ` · ${r.subject}` : ""} · התאמה {Math.round((r.similarity ?? 0) * 100)}%
                  </div>
                </div>
                <Button size="sm" variant={isLinked ? "secondary" : "outline"}
                  disabled={isLinked || linkMut.isPending}
                  onClick={() => linkMut.mutate(r.id)}>
                  <Link2 className="ms-1 h-3 w-3" /> {isLinked ? "מקושר" : "קשר"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}