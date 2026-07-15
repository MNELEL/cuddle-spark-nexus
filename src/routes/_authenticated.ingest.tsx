import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listClasses } from "@/lib/classes.functions";
import {
  getIngestUploadUrl, createIngestJob, analyzeIngestJob, getIngestJob,
  listIngestJobs, deleteIngestJob, commitRoster, commitResource, commitLessonAudio,
  remapRosterTabular, retryLessonQuestions,
  regenerateLessonSummary, commitAuto,
  AUTO_CATEGORY_LABEL,
  type IngestJob, type IngestKind, type RosterExtracted, type ResourceExtracted, type LessonExtracted,
  type LessonExamQuestion, type RosterTabular, type RosterTargetField,
  type AutoExtracted, type AutoItem, type AutoCategory,
} from "@/lib/ingest.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Upload, Users, FileText, Mic, Loader2, Trash2, CheckCircle2, XCircle, HelpCircle, Sigma, FileDown, AlertTriangle, RefreshCw, Wand2, Undo2, Eye, ScanLine, GraduationCap, Heart, BookMarked, MailOpen, Wand } from "lucide-react";
import { z } from "zod";
import { RosterReviewTable } from "@/components/ingest/roster-review-table";
import { ColumnMapper } from "@/components/ingest/column-mapper";
import { exportLessonSummaryPdf } from "@/lib/pdf/lesson-summary-pdf";
import { PdfPreviewDialog } from "@/components/ingest/pdf-preview-dialog";

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
      { property: "og:title", content: "העלאה חכמה · ClassAlign Studio" },
      { property: "og:description", content: "רשימות תלמידים, חומרי לימוד והקלטות שיעור — מנותחים ומשובצים אוטומטית." },
      { property: "og:url", content: "https://cuddle-spark-nexus.lovable.app/ingest" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const KIND_LABEL: Record<IngestKind, string> = {
  auto: "זיהוי אוטומטי",
  roster: "רשימת תלמידים",
  resource: "חומר לימוד",
  lesson_audio: "הקלטת שיעור",
};

const KIND_FORMATS: Record<IngestKind, string[]> = {
  auto: ["תמונה", "PDF", "טקסט"],
  roster: ["תמונה (JPG/PNG)", "PDF", "Excel (XLSX/XLS)", "CSV", "TXT"],
  resource: ["תמונה", "PDF", "DOCX", "TXT / Markdown"],
  lesson_audio: ["MP3", "WAV", "M4A", "WEBM"],
};

const KIND_HINT: Record<IngestKind, string> = {
  auto: "המערכת תזהה לבד אם זה ציונים, הערות, יומן, מכתב הורים או חומר לימוד — ותשבץ למקום הנכון.",
  roster: "לדוגמה: צילום רשימת כיתה עם שמות, ת.ז., תאריכי לידה, טלפוני הורים.",
  resource: "לדוגמה: דף עבודה בגמרא, מערך שיעור בהלכה או חידה לפרשת השבוע.",
  lesson_audio: "לדוגמה: הקלטת שיעור של 20–40 דקות; יופקו תמלול, סיכום ושאלות מבחן.",
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
      <div className="rounded-2xl border bg-card bg-mesh p-4 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">העלאה חכמה</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          העלה כל קובץ — ציונים, הערות, יומן, מכתב הורים, חומר לימוד או הקלטה — והמערכת תזהה ותשבץ אוטומטית.
        </p>
      </div>

      <SmartAutoCard
        classes={classes as { id: string; name: string }[]}
        classId={classId}
        setClassId={setClassId}
        onCreated={(id) => { setSelectedJobId(id); refetch(); }}
      />

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

      <DropZone
        classes={classes as { id: string; name: string }[]}
        classId={classId}
        setClassId={setClassId}
        onCreated={(id) => { setSelectedJobId(id); refetch(); }}
      />

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
  const [dragOver, setDragOver] = useState(false);
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
    <Card
      className={`transition hover:border-primary/40 hover:shadow-md ${dragOver ? "border-primary ring-2 ring-primary/30 bg-primary/5" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files?.[0]; if (f) void onFile(f);
      }}
    >
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center gap-2 text-primary">{icon}<span className="font-semibold text-foreground">{title}</span></div>
        <p className="text-xs text-muted-foreground min-h-8">{desc}</p>
        <div className="flex flex-wrap gap-1">
          {KIND_FORMATS[kind].map((f) => (
            <Badge key={f} variant="secondary" className="text-[10px] font-normal">{f}</Badge>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground italic">{KIND_HINT[kind]}</p>
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
          {busy ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> מעלה...</> : <><Upload className="ms-1 h-4 w-4" /> בחר קובץ או גרור לכאן</>}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------- Universal DropZone ---------------- */

function DropZone({
  classes, classId, setClassId, onCreated,
}: {
  classes: { id: string; name: string }[];
  classId?: string;
  setClassId: (v: string) => void;
  onCreated: (jobId: string) => void;
}) {
  const [kind, setKind] = useState<IngestKind>("roster");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const getUrl = useServerFn(getIngestUploadUrl);
  const create = useServerFn(createIngestJob);
  const analyze = useServerFn(analyzeIngestJob);

  const accept =
    kind === "roster" ? "image/*,application/pdf,.csv,.xlsx,.xls,.txt" :
    kind === "resource" ? "image/*,application/pdf,.txt,.md,.docx" :
    "audio/*";
  const requiresClass = kind === "roster" || kind === "lesson_audio";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" /> אזור העלאה מהיר (גרור ושחרר)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr] md:items-end">
          <div>
            <Label className="text-xs">סוג הקובץ</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as IngestKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="roster">רשימת תלמידים</SelectItem>
                <SelectItem value="resource">חומר לימוד</SelectItem>
                <SelectItem value="lesson_audio">הקלטת שיעור</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {requiresClass && (
            <div>
              <Label className="text-xs">כיתה</Label>
              <Select value={classId ?? ""} onValueChange={setClassId}>
                <SelectTrigger><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <input ref={inputRef} type="file" accept={accept} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />

        <div
          role="button"
          tabIndex={0}
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files?.[0]; if (f) void onFile(f);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition ${
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/30"
          } ${busy ? "opacity-60 pointer-events-none" : ""}`}
        >
          {busy ? (
            <><Loader2 className="h-8 w-8 animate-spin text-primary" /><span className="text-sm">מעלה ומנתח...</span></>
          ) : (
            <>
              <Upload className="h-8 w-8 text-primary" />
              <div className="text-sm font-medium">גרור קובץ לכאן או לחץ לבחירה</div>
              <div className="text-xs text-muted-foreground">קובץ אחד עד 20MB</div>
            </>
          )}
        </div>

        <div className="grid gap-2 rounded-lg bg-muted/40 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">פורמטים נתמכים ל{KIND_LABEL[kind]}:</span>
            {KIND_FORMATS[kind].map((f) => (
              <Badge key={f} variant="outline" className="font-normal">{f}</Badge>
            ))}
          </div>
          <div className="flex items-start gap-1.5 text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{KIND_HINT[kind]}</span>
          </div>
        </div>
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
  if (job.kind === "auto") return <AutoPreview job={job} classes={classes} preferredClassId={preferredClassId} onDone={onClose} />;
  return <LessonPreview
    job={job} classes={classes} preferredClassId={preferredClassId} onDone={onClose}
    onReanalyze={() => reAnalyze.mutate()} reanalyzing={reAnalyze.isPending || isFetching}
  />;
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

function LessonPreview({ job, classes, preferredClassId, onDone, onReanalyze, reanalyzing }: {
  job: IngestJob; classes: { id: string; name: string }[]; preferredClassId?: string; onDone: () => void;
  onReanalyze: () => void; reanalyzing: boolean;
}) {
  const ex = job.extracted as LessonExtracted;
  const [form, setForm] = useState<LessonExtracted>({
    ...ex,
    exam_questions: (ex.exam_questions ?? []).map((q) => ({ ...q, include: q.include !== false })),
  });
  const [saveAsResource, setSaveAsResource] = useState(true);
  const [classId, setClassId] = useState<string>(preferredClassId ?? job.class_id ?? "");
  const [exporting, setExporting] = useState(false);
  const commit = useServerFn(commitLessonAudio);
  const retryQs = useServerFn(retryLessonQuestions);
  const regenSum = useServerFn(regenerateLessonSummary);
  const [origTranscript] = useState<string>(ex.transcript ?? "");
  const [lastRegen, setLastRegen] = useState<{ summary: string; key_points: string[]; title: string } | null>(null);
  const retryQsM = useMutation({
    mutationFn: () => retryQs({ data: { id: job.id } }),
    onSuccess: (r) => {
      setForm((f) => ({
        ...f,
        exam_questions: r.exam_questions.map((q) => ({ ...q, include: q.include !== false })),
      }));
      toast.success(`הופקו ${r.exam_questions.length} שאלות מחדש`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בהפקת שאלות"),
  });
  const regenM = useMutation({
    mutationFn: () => regenSum({ data: {
      id: job.id, transcript: form.transcript, title: form.title,
    } }),
    onSuccess: (r) => {
      setLastRegen({ summary: form.summary, key_points: form.key_points, title: form.title });
      setForm((f) => ({
        ...f,
        title: r.title || f.title,
        summary: r.summary,
        key_points: r.key_points,
      }));
      toast.success("סיכום ונקודות מפתח שוחזרו מהתמלול המעודכן");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שחזור נכשל"),
  });
  function undoRegen() {
    if (!lastRegen) return;
    setForm((f) => ({ ...f, title: lastRegen.title, summary: lastRegen.summary, key_points: lastRegen.key_points }));
    setLastRegen(null);
    toast.success("השחזור בוטל");
  }
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
  const [qThreshold, setQThreshold] = useState<number>(50);
  const className = classes.find((c) => c.id === classId)?.name;
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewOnlyIncluded, setPreviewOnlyIncluded] = useState(true);
  async function exportPdf(onlyIncluded: boolean) {
    setExporting(true);
    try {
      await exportLessonSummaryPdf(form, { className, onlyIncluded });
      toast.success("קובץ PDF נוצר");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "יצירת PDF נכשלה");
    } finally {
      setExporting(false);
    }
  }
  function excludeQsBelowThreshold() {
    const min = qThreshold / 100;
    setForm({ ...form, exam_questions: questions.map((q) =>
      (q.confidence ?? 0) < min ? { ...q, include: false } : q) });
  }
  function includeAllQs() {
    setForm({ ...form, exam_questions: questions.map((q) => ({ ...q, include: true })) });
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mic className="h-5 w-5" /> סקירת הקלטת שיעור</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <LessonStages
          form={form}
          onRetryAll={onReanalyze}
          retryingAll={reanalyzing}
          onRetryQuestions={() => retryQsM.mutate()}
          retryingQuestions={retryQsM.isPending}
        />
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
        <TranscriptEditor
          value={form.transcript}
          onChange={(v) => setForm({ ...form, transcript: v })}
          originalValue={origTranscript}
          onRegenerate={() => regenM.mutate()}
          regenerating={regenM.isPending}
          canUndo={!!lastRegen}
          onUndo={undoRegen}
        />

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

          {questions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background/60 p-2 text-xs">
              <Sigma className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">סף ביטחון:</span>
              <input type="range" min={0} max={100} step={5}
                value={qThreshold}
                onChange={(e) => setQThreshold(Number(e.target.value))}
                className="h-1 w-24 accent-primary"
                aria-label="סף ביטחון לשאלות" />
              <span className="tabular-nums w-8">{qThreshold}%</span>
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={excludeQsBelowThreshold}>
                החרג שאלות מתחת לסף
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={includeAllQs}>
                כלול הכל
              </Button>
            </div>
          )}

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
          <Button variant="outline" onClick={() => { setPreviewOnlyIncluded(true); setPreviewOpen(true); }}>
            <Eye className="ms-1 h-4 w-4" /> תצוגה מקדימה
          </Button>
          <Button variant="outline" onClick={() => exportPdf(true)} disabled={exporting}>
            {exporting
              ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> יוצר PDF...</>
              : <><FileDown className="ms-1 h-4 w-4" /> ייצוא PDF (נכללות בלבד)</>}
          </Button>
          <Button variant="ghost" onClick={() => exportPdf(false)} disabled={exporting}>
            <FileDown className="ms-1 h-4 w-4" /> PDF מלא
          </Button>
          <Button variant="ghost" onClick={onDone}>ביטול</Button>
          <Button onClick={() => commitM.mutate()} disabled={commitM.isPending}>
            {commitM.isPending ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> שומר...</> : "אשר ושמור"}
          </Button>
        </div>
        <PdfPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          lesson={form}
          className={className}
          onlyIncluded={previewOnlyIncluded}
        />
      </CardContent>
    </Card>
  );
}

// silence unused imports guard
void z; void Link;

/* ---------------- Transcript editor ---------------- */

function TranscriptEditor({
  value, onChange, originalValue,
  onRegenerate, regenerating, canUndo, onUndo,
}: {
  value: string;
  onChange: (v: string) => void;
  originalValue: string;
  onRegenerate: () => void;
  regenerating: boolean;
  canUndo: boolean;
  onUndo: () => void;
}) {
  const dirty = value !== originalValue;
  const chars = value.length;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const canRegen = chars >= 40 && !regenerating;
  return (
    <div className="space-y-2 rounded-lg border p-3 bg-muted/10">
      <div className="flex items-center gap-2 flex-wrap">
        <Label className="text-sm font-semibold">עריכת תמלול</Label>
        <Badge variant="outline" className="text-[11px] tabular-nums">
          {words.toLocaleString("he-IL")} מילים · {chars.toLocaleString("he-IL")} תווים
        </Badge>
        {dirty && (
          <Badge variant="secondary" className="text-[11px] text-amber-700 border-amber-500/40">
            <AlertTriangle className="h-3 w-3 me-1" /> יש שינויים שלא שוקפו בסיכום
          </Badge>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          {dirty && (
            <Button size="sm" variant="ghost" onClick={() => onChange(originalValue)} disabled={regenerating}
              title="חזור לתמלול המקורי שנוצר על ידי המערכת">
              <Undo2 className="ms-1 h-3.5 w-3.5" /> החזר לתמלול המקורי
            </Button>
          )}
          {canUndo && (
            <Button size="sm" variant="ghost" onClick={onUndo} disabled={regenerating}>
              <Undo2 className="ms-1 h-3.5 w-3.5" /> בטל שחזור
            </Button>
          )}
          <Button size="sm" onClick={onRegenerate} disabled={!canRegen}
            title={chars < 40 ? "התמלול קצר מדי" : "צור מחדש סיכום ונקודות מפתח מהתמלול המעודכן"}>
            {regenerating
              ? <><Loader2 className="ms-1 h-3.5 w-3.5 animate-spin" /> משחזר סיכום...</>
              : <><Wand2 className="ms-1 h-3.5 w-3.5" /> שחזר סיכום ונקודות מפתח</>}
          </Button>
        </div>
      </div>
      <Textarea
        rows={12}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir="rtl"
        className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap"
        placeholder="ערוך את התמלול כאן. לאחר תיקונים לחץ 'שחזר סיכום ונקודות מפתח' כדי שהמערכת תעדכן את הסיכום בהתאם."
      />
      <p className="text-[11px] text-muted-foreground">
        טיפ: תקן תעתיקים, פסיקים ופסקאות. שינויים נשמרים אוטומטית עם שאר הטופס. שחזור הסיכום לא מוחק את השאלות הקיימות — כדי להפיק גם שאלות מחדש השתמש בכפתור "נסה שוב: שאלות" בסטטוס הניתוח.
      </p>
    </div>
  );
}

/* ---------------- Lesson stage status ---------------- */

type StageStatus = "ok" | "warn" | "fail";
type Stage = { key: string; label: string; status: StageStatus; hint: string };

function computeLessonStages(f: LessonExtracted): Stage[] {
  const t = (f.transcript ?? "").trim();
  const s = (f.summary ?? "").trim();
  const kp = f.key_points ?? [];
  const qs = f.exam_questions ?? [];
  return [
    {
      key: "transcript", label: "תמלול",
      status: t.length >= 200 ? "ok" : t.length > 0 ? "warn" : "fail",
      hint: t.length ? `${t.length.toLocaleString("he-IL")} תווים` : "לא הופק תמלול",
    },
    {
      key: "summary", label: "סיכום",
      status: s.length >= 120 ? "ok" : s.length > 0 ? "warn" : "fail",
      hint: s.length ? `${s.length.toLocaleString("he-IL")} תווים` : "לא נוצר סיכום",
    },
    {
      key: "key_points", label: "נקודות מפתח",
      status: kp.length >= 3 ? "ok" : kp.length > 0 ? "warn" : "fail",
      hint: `${kp.length} נקודות`,
    },
    {
      key: "questions", label: "שאלות מבחן",
      status: qs.length >= 4 ? "ok" : qs.length > 0 ? "warn" : "fail",
      hint: `${qs.length} שאלות`,
    },
  ];
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

function LessonStages({
  form, onRetryAll, retryingAll, onRetryQuestions, retryingQuestions,
}: {
  form: LessonExtracted;
  onRetryAll: () => void; retryingAll: boolean;
  onRetryQuestions: () => void; retryingQuestions: boolean;
}) {
  const stages = computeLessonStages(form);
  const anyFail = stages.some((s) => s.status !== "ok");
  const questionsStage = stages.find((s) => s.key === "questions")!;
  const transcriptStage = stages.find((s) => s.key === "transcript")!;
  return (
    <div className={`rounded-lg border p-3 space-y-2 ${anyFail ? "bg-amber-500/5 border-amber-500/30" : "bg-green-500/5 border-green-500/20"}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold">סטטוס ניתוח</span>
        {anyFail
          ? <Badge variant="outline" className="text-amber-700 border-amber-500/50">חלק מהשלבים חסרים</Badge>
          : <Badge variant="outline" className="text-green-700 border-green-500/50">כל השלבים הושלמו</Badge>}
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline"
            onClick={onRetryQuestions}
            disabled={retryingQuestions || retryingAll || transcriptStage.status === "fail"}
            title={transcriptStage.status === "fail" ? "אין תמלול — הרץ ניתוח מלא קודם" : "הפק שאלות מחדש מהתמלול"}>
            {retryingQuestions
              ? <><Loader2 className="ms-1 h-3.5 w-3.5 animate-spin" /> מפיק שאלות...</>
              : <><RefreshCw className="ms-1 h-3.5 w-3.5" /> נסה שוב: שאלות</>}
          </Button>
          <Button size="sm" variant={anyFail ? "default" : "ghost"}
            onClick={onRetryAll} disabled={retryingAll || retryingQuestions}>
            {retryingAll
              ? <><Loader2 className="ms-1 h-3.5 w-3.5 animate-spin" /> מריץ מחדש...</>
              : <><RefreshCw className="ms-1 h-3.5 w-3.5" /> הרץ ניתוח מלא מחדש</>}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {stages.map((s) => (
          <div key={s.key} className="flex items-center gap-2 rounded-md border bg-background/60 p-2">
            <StageIcon status={s.status} />
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{s.label}</div>
              <div className="text-[11px] text-muted-foreground truncate">{s.hint}</div>
            </div>
            {s.key === "questions" && s.status !== "ok" && (
              <button
                onClick={onRetryQuestions}
                disabled={retryingQuestions || retryingAll || transcriptStage.status === "fail"}
                className="ms-auto text-[10px] text-primary hover:underline disabled:opacity-40"
                title="הפק שאלות מחדש">
                נסה שוב
              </button>
            )}
          </div>
        ))}
      </div>
      {questionsStage.status === "fail" && transcriptStage.status !== "fail" && (
        <p className="text-[11px] text-muted-foreground">
          לא הופקו שאלות. ניתן ללחוץ "נסה שוב: שאלות" כדי לרוץ מחדש רק על שלב זה, בלי לתמלל שוב.
        </p>
      )}
    </div>
  );
}

/* ---------------- Smart Auto Card (primary CTA, mobile-friendly) ---------------- */

function SmartAutoCard({
  classes, classId, setClassId, onCreated,
}: {
  classes: { id: string; name: string }[];
  classId?: string;
  setClassId: (v: string) => void;
  onCreated: (jobId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const getUrl = useServerFn(getIngestUploadUrl);
  const create = useServerFn(createIngestJob);
  const analyze = useServerFn(analyzeIngestJob);

  async function onFile(file: File) {
    if (file.size > 20 * 1024 * 1024) { toast.error("הקובץ גדול מ-20MB"); return; }
    setBusy(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._\- ]/g, "_");
      const { path, token } = await getUrl({ data: { filename: safeName } });
      const up = await supabase.storage.from("ingest-staging").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (up.error) throw new Error(up.error.message);
      const { id } = await create({ data: {
        kind: "auto", source_path: path, file_name: file.name, mime_type: file.type,
        class_id: classId ?? null,
      }});
      toast.success("הועלה — ה-AI מזהה ומסווג...");
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
    <Card className="relative overflow-hidden border-primary/40 bg-gradient-to-br from-primary/5 via-card to-accent/5">
      <div className="pointer-events-none absolute -top-16 -end-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <CardContent className="relative space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Wand className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg sm:text-xl font-bold">זיהוי אוטומטי</h2>
              <Badge variant="secondary" className="text-[10px]">מומלץ</Badge>
            </div>
            <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
              העלה כל קובץ — ציונים, הערה, יומן, מכתב הורים או חומר לימוד — וה-AI יבחר לבד לאיזה תלמיד ולאן לשבץ.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {([
            ["grades", GraduationCap, "ציונים"],
            ["behavior", Heart, "הערות"],
            ["journal", BookMarked, "יומן"],
            ["parent_letter", MailOpen, "הורים"],
            ["resource", FileText, "חומר"],
          ] as const).map(([key, Icon, label]) => (
            <div key={key} className="flex items-center gap-1.5 rounded-lg border bg-background/50 px-2 py-1.5 text-xs">
              <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </div>

        {classes.length > 0 && (
          <div>
            <Label className="text-xs">כיתה (אופציונלי — ה-AI ינסה לזהות לבד)</Label>
            <Select value={classId ?? ""} onValueChange={setClassId}>
              <SelectTrigger className="h-10"><SelectValue placeholder="בחר כיתה או השאר ריק" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf,.txt,.md,.csv,.xlsx,.xls,.docx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
        />

        <div
          role="button"
          tabIndex={0}
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files?.[0]; if (f) void onFile(f);
          }}
          className={`flex min-h-32 sm:min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
            dragOver ? "border-primary bg-primary/10" : "border-primary/30 hover:border-primary/60 hover:bg-primary/5"
          } ${busy ? "opacity-60 pointer-events-none" : "cursor-pointer active:scale-[0.99]"}`}
        >
          {busy ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <span className="text-sm font-medium">ה-AI מזהה ומסווג את הקובץ...</span>
              <span className="text-xs text-muted-foreground">זה יכול לקחת 10–30 שניות</span>
            </>
          ) : (
            <>
              <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
                <ScanLine className="h-7 w-7" />
              </div>
              <div className="text-base sm:text-lg font-semibold">גרור קובץ או לחץ להעלאה</div>
              <div className="text-xs text-muted-foreground">תמונה, PDF, טקסט או Excel — עד 20MB</div>
            </>
          )}
        </div>

        <Button
          size="lg"
          className="w-full h-12 text-base font-semibold sm:hidden"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <><Loader2 className="ms-1 h-5 w-5 animate-spin" /> מעלה ומנתח...</> : <><Upload className="ms-1 h-5 w-5" /> בחר קובץ להעלאה</>}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------- Auto Preview (post-classification review) ---------------- */

const CATEGORY_ICON: Record<AutoCategory, React.ComponentType<{ className?: string }>> = {
  grades: GraduationCap,
  behavior: Heart,
  journal: BookMarked,
  parent_letter: MailOpen,
  resource: FileText,
  other: Sparkles,
};

function AutoPreview({ job, classes, preferredClassId, onDone }: {
  job: IngestJob; classes: { id: string; name: string }[]; preferredClassId?: string; onDone: () => void;
}) {
  const ex = job.extracted as unknown as AutoExtracted;
  const [items, setItems] = useState<AutoItem[]>(ex?.items ?? []);
  const [classId, setClassId] = useState<string>(preferredClassId ?? job.class_id ?? "");
  const commit = useServerFn(commitAuto);
  const commitM = useMutation({
    mutationFn: () => commit({ data: {
      jobId: job.id,
      class_id: classId ? classId : null,
      items,
    }}),
    onSuccess: (r) => {
      const parts: string[] = [];
      const s = (r as { results: Record<string, number> }).results;
      if (s.grades) parts.push(`${s.grades} ציונים`);
      if (s.behavior) parts.push(`${s.behavior} הערות`);
      if (s.journal) parts.push(`${s.journal} יומן`);
      if (s.parent_letter) parts.push(`${s.parent_letter} מכתבי הורים`);
      if (s.resource) parts.push(`${s.resource} חומרים`);
      if (s.other) parts.push(`${s.other} אחר`);
      toast.success(parts.length ? `נשמר: ${parts.join(" · ")}` : "לא נשמרו פריטים");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const included = items.filter((i) => i.include).length;
  const DetectedIcon = CATEGORY_ICON[ex?.detected ?? "other"];

  function updateItem(id: string, patch: Partial<AutoItem>) {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...patch } : it));
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <ScanLine className="h-5 w-5 text-primary" />
          <span>סקירת זיהוי אוטומטי</span>
          <Badge variant="secondary" className="gap-1"><DetectedIcon className="h-3 w-3" />{AUTO_CATEGORY_LABEL[ex?.detected ?? "other"]}</Badge>
          <span className="text-xs text-muted-foreground">· {included}/{items.length} נבחרו</span>
        </CardTitle>
        {ex?.reasoning && (
          <p className="text-xs text-muted-foreground italic">{ex.reasoning}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {classes.length > 0 && (
          <div className="rounded-lg bg-muted/40 p-3">
            <Label className="text-xs">כיתת ברירת מחדל (אם לא זוהתה מהתוכן)</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {items.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
            לא זוהו פריטים בקובץ.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const Icon = CATEGORY_ICON[it.category];
              const confPct = Math.round(it.confidence * 100);
              const confColor = it.confidence >= 0.7 ? "text-green-600" : it.confidence >= 0.4 ? "text-amber-600" : "text-destructive";
              return (
                <div key={it.id} className={`rounded-xl border p-3 transition ${it.include ? "bg-card" : "bg-muted/30 opacity-70"}`}>
                  <div className="flex items-start gap-3">
                    <label className="flex items-center pt-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={it.include}
                        onChange={(e) => updateItem(it.id, { include: e.target.checked })}
                        className="h-5 w-5 accent-primary"
                      />
                    </label>
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Select value={it.category} onValueChange={(v) => updateItem(it.id, { category: v as AutoCategory })}>
                          <SelectTrigger className="h-7 w-auto min-w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(AUTO_CATEGORY_LABEL) as AutoCategory[]).map((k) => (
                              <SelectItem key={k} value={k}>{AUTO_CATEGORY_LABEL[k]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {it.student?.name && (
                          <Badge variant={it.student.student_id ? "default" : "outline"} className="text-[10px]">
                            {it.student.student_id ? "✓" : "?"} {it.student.name}
                          </Badge>
                        )}
                        <span className={`ms-auto text-[11px] font-medium ${confColor}`}>{confPct}%</span>
                      </div>

                      {it.category === "grades" ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <Input className="h-8 text-sm" placeholder="מקצוע" value={it.subject ?? ""} onChange={(e) => updateItem(it.id, { subject: e.target.value })} />
                          <Input className="h-8 text-sm" type="number" placeholder="ציון" value={it.value ?? ""} onChange={(e) => updateItem(it.id, { value: e.target.value === "" ? undefined : Number(e.target.value) })} />
                          <Input className="h-8 text-sm" type="number" placeholder="מקס'" value={it.max_value ?? 100} onChange={(e) => updateItem(it.id, { max_value: Number(e.target.value) })} />
                          <Input className="h-8 text-sm" type="date" value={it.date ?? ""} onChange={(e) => updateItem(it.id, { date: e.target.value })} />
                        </div>
                      ) : it.category === "behavior" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Select value={it.behavior_type ?? "neutral"} onValueChange={(v) => updateItem(it.id, { behavior_type: v as AutoItem["behavior_type"] })}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="positive">חיובית</SelectItem>
                              <SelectItem value="neutral">ניטרלית</SelectItem>
                              <SelectItem value="negative">שלילית</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input className="h-8 text-sm" type="date" value={it.date ?? ""} onChange={(e) => updateItem(it.id, { date: e.target.value })} />
                          <Textarea className="text-sm sm:col-span-2" rows={2} placeholder="תיאור" value={it.description ?? ""} onChange={(e) => updateItem(it.id, { description: e.target.value })} />
                        </div>
                      ) : it.category === "parent_letter" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Select value={it.channel ?? "phone"} onValueChange={(v) => updateItem(it.id, { channel: v as AutoItem["channel"] })}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="phone">טלפון</SelectItem>
                              <SelectItem value="meeting">פגישה</SelectItem>
                              <SelectItem value="whatsapp">וואטסאפ</SelectItem>
                              <SelectItem value="email">אימייל</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input className="h-8 text-sm" type="date" value={it.date ?? ""} onChange={(e) => updateItem(it.id, { date: e.target.value })} />
                          <Input className="h-8 text-sm sm:col-span-2" placeholder="נושא" value={it.title ?? ""} onChange={(e) => updateItem(it.id, { title: e.target.value })} />
                          <Textarea className="text-sm sm:col-span-2" rows={2} placeholder="תמצית" value={it.description ?? ""} onChange={(e) => updateItem(it.id, { description: e.target.value })} />
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <Input className="h-8 text-sm" placeholder="כותרת" value={it.title ?? ""} onChange={(e) => updateItem(it.id, { title: e.target.value })} />
                          <Textarea className="text-sm" rows={2} placeholder="תיאור" value={it.description ?? ""} onChange={(e) => updateItem(it.id, { description: e.target.value })} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 border-t bg-card/95 backdrop-blur px-4 sm:px-6 py-3 flex flex-col sm:flex-row gap-2 justify-end">
          <Button variant="ghost" onClick={onDone} className="order-2 sm:order-1">ביטול</Button>
          <Button
            onClick={() => commitM.mutate()}
            disabled={commitM.isPending || included === 0}
            className="order-1 sm:order-2 h-11 sm:h-10 text-base sm:text-sm"
          >
            {commitM.isPending ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> שומר...</> : `אשר ושבץ (${included})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}