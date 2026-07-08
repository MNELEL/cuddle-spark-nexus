import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listClasses } from "@/lib/classes.functions";
import {
  getIngestUploadUrl, createIngestJob, analyzeIngestJob, getIngestJob,
  listIngestJobs, deleteIngestJob, commitRoster, commitResource, commitLessonAudio,
  remapRosterTabular,
  type IngestJob, type IngestKind, type RosterExtracted, type ResourceExtracted, type LessonExtracted,
  type LessonExamQuestion, type RosterTabular, type RosterTargetField,
} from "@/lib/ingest.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Upload, Users, FileText, Mic, Loader2, Trash2, CheckCircle2, XCircle, HelpCircle, Sigma } from "lucide-react";
import { z } from "zod";
import { RosterReviewTable } from "@/components/ingest/roster-review-table";
import { ColumnMapper } from "@/components/ingest/column-mapper";

type SearchParams = { classId?: string };

export const Route = createFileRoute("/_authenticated/ingest")({
  component: IngestPage,
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    classId: typeof s.classId === "string" ? s.classId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "העלאה חכמה · ClassAlign Studio" },
      { name: "description", content: "העלאה חכמה של קבצים – רשימות תלמידים, חומרי לימוד והקלטות שיעור מנותחים אוטומטית ומשובצים למקומם." },
    ],
  }),
});

const KIND_LABEL: Record<IngestKind, string> = {
  roster: "רשימת תלמידים",
  resource: "חומר לימוד",
  lesson_audio: "הקלטת שיעור",
};

function IngestPage() {
  const search = useSearch({ from: "/_authenticated/ingest" });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | undefined>(search.classId);
  const listFn = useServerFn(listIngestJobs);
  const listClsFn = useServerFn(listClasses);

  const { data: jobs = [], refetch } = useQuery({ queryKey: ["ingest-jobs"], queryFn: () => listFn() });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => listClsFn() });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border bg-card bg-mesh p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="font-display text-3xl font-bold tracking-tight">העלאה חכמה</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          העלה כל קובץ — רשימת תלמידים, חומר לימוד או הקלטה — והמערכת תזהה, תחלץ ותציע היכן לשבץ.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <UploadCard kind="roster" icon={<Users className="h-6 w-6" />}
          title="רשימת תלמידים" desc="תמונה, PDF או Excel/CSV — עמודות טבלאיות ימופו אוטומטית לשדות המערכת עם אפשרות תיקון ידני"
          accept="image/*,application/pdf,.csv,.xlsx,.xls,.txt"
          onCreated={(id) => { setSelectedJobId(id); refetch(); }}
          classes={classes as { id: string; name: string }[]}
          classId={classId} setClassId={setClassId} requiresClass />
        <UploadCard kind="resource" icon={<FileText className="h-6 w-6" />}
          title="חומר לימוד" desc="דף עבודה, מערך שיעור, חידה, סיפור"
          accept="image/*,application/pdf,.txt,.md,.docx"
          onCreated={(id) => { setSelectedJobId(id); refetch(); }} />
        <UploadCard kind="lesson_audio" icon={<Mic className="h-6 w-6" />}
          title="הקלטת שיעור" desc="MP3, WAV, M4A, WEBM — עד 20MB"
          accept="audio/*"
          onCreated={(id) => { setSelectedJobId(id); refetch(); }}
          classes={classes as { id: string; name: string }[]}
          classId={classId} setClassId={setClassId} requiresClass />
      </div>

      {selectedJobId && (
        <JobDetail jobId={selectedJobId} classes={classes as { id: string; name: string }[]}
          preferredClassId={classId} onClose={() => { setSelectedJobId(null); refetch(); }} />
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">היסטוריית העלאות</CardTitle></CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">עדיין לא הועלו קבצים.</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((j) => <JobRow key={j.id} job={j} onOpen={() => setSelectedJobId(j.id)} onDeleted={() => refetch()} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UploadCard({
  kind, icon, title, desc, accept, onCreated,
  classes, classId, setClassId, requiresClass,
}: {
  kind: IngestKind; icon: React.ReactNode; title: string; desc: string; accept: string;
  onCreated: (jobId: string) => void;
  classes?: { id: string; name: string }[]; classId?: string; setClassId?: (v: string) => void;
  requiresClass?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const getUrl = useServerFn(getIngestUploadUrl);
  const create = useServerFn(createIngestJob);
  const analyze = useServerFn(analyzeIngestJob);

  async function onFile(file: File) {
    if (requiresClass && !classId) { toast.error("בחר כיתה קודם"); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("הקובץ גדול מ-20MB"); return; }
    setBusy(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._\- ]/g, "_");
      const { path, token } = await getUrl({ data: { filename: safeName } });
      const up = await supabase.storage.from("ingest-staging").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (up.error) throw new Error(up.error.message);
      const { id } = await create({ data: {
        kind, source_path: path, file_name: file.name, mime_type: file.type,
        class_id: requiresClass ? (classId ?? null) : null,
      }});
      toast.success("הועלה, מנתח...");
      onCreated(id);
      await analyze({ data: { id } }).catch((e) => toast.error(e instanceof Error ? e.message : "שגיאה בניתוח"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בהעלאה");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card className="transition hover:border-primary/40 hover:shadow-md">
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center gap-2 text-primary">{icon}<span className="font-semibold text-foreground">{title}</span></div>
        <p className="text-xs text-muted-foreground min-h-8">{desc}</p>
        {requiresClass && (
          <div>
            <Label className="text-xs">כיתה</Label>
            <Select value={classId ?? ""} onValueChange={(v) => setClassId?.(v)}>
              <SelectTrigger><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
              <SelectContent>
                {(classes ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <input ref={inputRef} type="file" accept={accept} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
        <Button className="w-full" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> מעלה...</> : <><Upload className="ms-1 h-4 w-4" /> בחר קובץ</>}
        </Button>
      </CardContent>
    </Card>
  );
}

function JobRow({ job, onOpen, onDeleted }: { job: IngestJob; onOpen: () => void; onDeleted: () => void }) {
  const del = useServerFn(deleteIngestJob);
  const removeM = useMutation({
    mutationFn: () => del({ data: { id: job.id } }),
    onSuccess: () => { toast.success("נמחק"); onDeleted(); },
  });
  const statusIcon =
    job.status === "committed" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
    job.status === "failed" ? <XCircle className="h-4 w-4 text-destructive" /> :
    job.status === "analyzing" ? <Loader2 className="h-4 w-4 animate-spin" /> : null;
  return (
    <div className="flex items-center gap-2 rounded-lg border p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{KIND_LABEL[job.kind]}</Badge>
          {statusIcon}
          <span className="truncate text-sm">{job.file_name}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{job.summary || job.error || job.status}</div>
      </div>
      {job.status === "ready" && <Button size="sm" onClick={onOpen}>סקירה ואישור</Button>}
      {job.status === "failed" && <Button size="sm" variant="outline" onClick={onOpen}>נסה שוב</Button>}
      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeM.mutate()}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function JobDetail({ jobId, classes, preferredClassId, onClose }: {
  jobId: string; classes: { id: string; name: string }[]; preferredClassId?: string; onClose: () => void;
}) {
  const getFn = useServerFn(getIngestJob);
  const analyze = useServerFn(analyzeIngestJob);
  const qc = useQueryClient();
  const { data: job, refetch, isFetching } = useQuery({
    queryKey: ["ingest-job", jobId],
    queryFn: () => getFn({ data: { id: jobId } }),
    refetchInterval: (q) => {
      const s = (q.state.data as IngestJob | null)?.status;
      return s === "analyzing" || s === "uploaded" ? 1500 : false;
    },
  });
  const reAnalyze = useMutation({
    mutationFn: () => analyze({ data: { id: jobId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ingest-job", jobId] }); refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  if (!job) return null;
  if (job.status === "analyzing" || job.status === "uploaded") {
    return (
      <Card><CardContent className="py-10 text-center space-y-2">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <div className="text-sm text-muted-foreground">מנתח את הקובץ, זה יכול לקחת מספר שניות...</div>
      </CardContent></Card>
    );
  }
  if (job.status === "failed") {
    return (
      <Card><CardContent className="py-6 space-y-3">
        <div className="flex items-center gap-2 text-destructive"><XCircle className="h-5 w-5" /> הניתוח נכשל</div>
        <p className="text-sm text-muted-foreground">{job.error}</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => reAnalyze.mutate()} disabled={reAnalyze.isPending || isFetching}>נסה שוב</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>סגור</Button>
        </div>
      </CardContent></Card>
    );
  }
  if (job.status !== "ready") return null;

  if (job.kind === "roster") return <RosterPreview job={job} classes={classes} preferredClassId={preferredClassId} onDone={onClose} />;
  if (job.kind === "resource") return <ResourcePreview job={job} onDone={onClose} />;
  return <LessonPreview job={job} classes={classes} preferredClassId={preferredClassId} onDone={onClose} />;
}

/* ---------------- Roster Preview ---------------- */

function RosterPreview({ job, classes, preferredClassId, onDone }: {
  job: IngestJob; classes: { id: string; name: string }[]; preferredClassId?: string; onDone: () => void;
}) {
  const ex = job.extracted as RosterExtracted & { tabular?: RosterTabular };
  const [initialRows, setInitialRows] = useState(ex.students ?? []);
  const [tabular, setTabular] = useState<RosterTabular | undefined>(ex.tabular);
  const [mapping, setMapping] = useState<RosterTargetField[]>(ex.tabular?.mapping ?? []);
  const [rows, setRows] = useState((ex.students ?? []).map((s) => ({ ...s, include: s.include !== false })));
  const [errorCount, setErrorCount] = useState(0);
  const [classId, setClassId] = useState<string>(preferredClassId ?? job.class_id ?? "");
  const commit = useServerFn(commitRoster);
  const remap = useServerFn(remapRosterTabular);
  const remapM = useMutation({
    mutationFn: () => remap({ data: { id: job.id, mapping } }),
    onSuccess: (r) => {
      const students = r.students.map((s) => ({ ...s, include: true }));
      setInitialRows(students);
      setRows(students);
      if (tabular) setTabular({ ...tabular, mapping });
      toast.success(r.summary);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const commitM = useMutation({
    mutationFn: () => {
      const included = rows.filter((r) => r.include).map((r) => ({
        name: r.name,
        national_id: r.national_id || null,
        birth_date: r.birth_date || null,
        address: r.address || null,
        father_name: r.father_name || null,
        father_id: r.father_id || null,
        father_phone: r.father_phone || null,
        mother_name: r.mother_name || null,
        mother_id: r.mother_id || null,
        mother_phone: r.mother_phone || null,
      }));
      if (!included.length) throw new Error("לא נבחרו תלמידים");
      if (!classId) throw new Error("בחר כיתה");
      return commit({ data: { jobId: job.id, class_id: classId, students: included } });
    },
    onSuccess: (r) => { toast.success(`נוספו ${r.inserted} תלמידים`); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-5 w-5" /> סקירת רשימת תלמידים ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <Label className="text-sm">כיתה:</Label>
          <div className="w-56">
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {tabular && (
          <ColumnMapper
            tabular={tabular}
            mapping={mapping}
            onChange={setMapping}
            onApply={() => remapM.mutate()}
            applying={remapM.isPending}
          />
        )}

        <RosterReviewTable
          key={initialRows.length + ":" + (tabular?.mapping.join(",") ?? "")}
          initialRows={initialRows}
          onChange={(next, errs) => { setRows(next); setErrorCount(errs); }}
        />

        <div className="flex gap-2 justify-end pt-2">
          {errorCount > 0 && (
            <div className="me-auto text-xs text-destructive self-center">
              {errorCount} שורות שנבחרו מכילות שגיאות ולידציה — תקן או החרג לפני שמירה.
            </div>
          )}
          <Button variant="ghost" onClick={onDone}>ביטול</Button>
          <Button onClick={() => commitM.mutate()} disabled={commitM.isPending || errorCount > 0}>
            {commitM.isPending ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> משבץ...</> : "אשר ושבץ לכיתה"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Resource Preview ---------------- */

function ResourcePreview({ job, onDone }: { job: IngestJob; onDone: () => void }) {
  const ex = job.extracted as ResourceExtracted;
  const [form, setForm] = useState(ex);
  const commit = useServerFn(commitResource);
  const commitM = useMutation({
    mutationFn: () => commit({ data: {
      jobId: job.id,
      title: form.title, description: form.description,
      subject: form.subject, grade_level: form.grade_level,
      resource_type: form.resource_type, tags: form.tags,
      body: form.body, questions: form.questions,
    }}),
    onSuccess: () => { toast.success("החומר נוסף לספרייה"); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-5 w-5" /> סקירת חומר לימוד</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>כותרת</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>מקצוע</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div><Label>כיתה</Label><Input value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} /></div>
          <div><Label>סוג</Label><Input value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value })} /></div>
        </div>
        <div><Label>תיאור</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><Label>תוכן</Label><Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        {form.questions.length > 0 && (
          <div>
            <Label>שאלות ({form.questions.length})</Label>
            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-2">
              {form.questions.map((q, i) => (
                <div key={i} className="space-y-1">
                  <Input value={q.q} onChange={(e) => {
                    const next = [...form.questions]; next[i] = { ...next[i], q: e.target.value };
                    setForm({ ...form, questions: next });
                  }} placeholder={`שאלה ${i + 1}`} />
                  <Input value={q.a ?? ""} onChange={(e) => {
                    const next = [...form.questions]; next[i] = { ...next[i], a: e.target.value };
                    setForm({ ...form, questions: next });
                  }} placeholder="תשובה (אופציונלי)" />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onDone}>ביטול</Button>
          <Button onClick={() => commitM.mutate()} disabled={commitM.isPending}>
            {commitM.isPending ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> שומר...</> : "אשר והוסף לספרייה"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Lesson Preview ---------------- */

function LessonPreview({ job, classes, preferredClassId, onDone }: {
  job: IngestJob; classes: { id: string; name: string }[]; preferredClassId?: string; onDone: () => void;
}) {
  const ex = job.extracted as LessonExtracted;
  const [form, setForm] = useState<LessonExtracted>({
    ...ex,
    exam_questions: (ex.exam_questions ?? []).map((q) => ({ ...q, include: q.include !== false })),
  });
  const [saveAsResource, setSaveAsResource] = useState(true);
  const [classId, setClassId] = useState<string>(preferredClassId ?? job.class_id ?? "");
  const commit = useServerFn(commitLessonAudio);
  const commitM = useMutation({
    mutationFn: () => {
      if (!classId) throw new Error("בחר כיתה");
      const included = (form.exam_questions ?? []).filter((q) => q.include !== false).map((q) => ({
        q: q.q, a: q.a, difficulty: q.difficulty, topic: q.topic, confidence: q.confidence,
      }));
      return commit({ data: {
        jobId: job.id, class_id: classId,
        title: form.title, transcript: form.transcript,
        summary: form.summary, key_points: form.key_points,
        exam_questions: included, save_as_resource: saveAsResource,
      } });
    },
    onSuccess: (r) => {
      toast.success(r.question_bank_id ? "השיעור ומאגר השאלות נשמרו" : "השיעור נשמר");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const questions = form.exam_questions ?? [];
  const includedCount = questions.filter((q) => q.include !== false).length;
  const avgConf = questions.length
    ? Math.round((questions.reduce((s, q) => s + (q.confidence ?? 0), 0) / questions.length) * 100)
    : 0;

  function updateQ(i: number, patch: Partial<LessonExamQuestion>) {
    const next = [...questions];
    next[i] = { ...next[i], ...patch };
    setForm({ ...form, exam_questions: next });
  }
  function addQ() {
    setForm({ ...form, exam_questions: [...questions, {
      q: "", a: "", difficulty: "medium", confidence: 1, include: true,
    }] });
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mic className="h-5 w-5" /> סקירת הקלטת שיעור</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>כותרת</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>כיתה</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>סיכום</Label><Textarea rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div>
        <div><Label>נקודות מפתח</Label>
          <Textarea rows={4} value={form.key_points.join("\n")}
            onChange={(e) => setForm({ ...form, key_points: e.target.value.split("\n").filter(Boolean) })} />
        </div>
        <div><Label>תמלול</Label><Textarea rows={8} value={form.transcript} onChange={(e) => setForm({ ...form, transcript: e.target.value })} /></div>

        <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
          <div className="flex items-center gap-2 flex-wrap">
            <HelpCircle className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">שאלות למבחן שהופקו מהשיעור</span>
            <Badge variant="outline">{includedCount}/{questions.length} נכללות</Badge>
            {questions.length > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Sigma className="h-3 w-3" /> ביטחון ממוצע {avgConf}%
              </Badge>
            )}
            <label className="ms-auto flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={saveAsResource} onChange={(e) => setSaveAsResource(e.target.checked)} />
              שמור גם כמאגר שאלות בספריית העזרים
            </label>
          </div>

          {questions.length === 0 && (
            <p className="text-xs text-muted-foreground">
              לא הופקו שאלות אוטומטית (ייתכן שהתמלול קצר מדי). ניתן להוסיף שאלה ידנית.
            </p>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto pe-1">
            {questions.map((q, i) => {
              const confPct = Math.round((q.confidence ?? 0) * 100);
              const confColor = confPct >= 80 ? "bg-green-500" : confPct >= 50 ? "bg-amber-500" : "bg-destructive";
              return (
                <div key={i}
                  className={`rounded-md border p-2 space-y-1.5 ${q.include === false ? "opacity-50 bg-muted/30" : "bg-card"}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="checkbox" checked={q.include !== false}
                      onChange={(e) => updateQ(i, { include: e.target.checked })} />
                    <span className="text-xs text-muted-foreground">#{i + 1}</span>
                    <Select value={q.difficulty}
                      onValueChange={(v) => updateQ(i, { difficulty: v as LessonExamQuestion["difficulty"] })}>
                      <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">קל</SelectItem>
                        <SelectItem value="medium">בינוני</SelectItem>
                        <SelectItem value="hard">מאתגר</SelectItem>
                      </SelectContent>
                    </Select>
                    {q.topic && <Badge variant="outline" className="text-[10px]">{q.topic}</Badge>}
                    <div className="ms-auto flex items-center gap-1.5" title={`ביטחון ${confPct}%`}>
                      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${confColor}`} style={{ width: `${confPct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-8 text-end">{confPct}%</span>
                    </div>
                  </div>
                  <Input value={q.q} placeholder="שאלה"
                    onChange={(e) => updateQ(i, { q: e.target.value })} />
                  <Input value={q.a ?? ""} placeholder="תשובה מצופה (אופציונלי)"
                    onChange={(e) => updateQ(i, { a: e.target.value })} />
                </div>
              );
            })}
          </div>

          <Button variant="outline" size="sm" onClick={addQ}>+ הוסף שאלה</Button>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onDone}>ביטול</Button>
          <Button onClick={() => commitM.mutate()} disabled={commitM.isPending}>
            {commitM.isPending ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> שומר...</> : "אשר ושמור"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// silence unused imports guard
void z; void Link;