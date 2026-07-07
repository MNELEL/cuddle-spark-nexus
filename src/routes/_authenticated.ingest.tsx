import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listClasses } from "@/lib/classes.functions";
import {
  getIngestUploadUrl, createIngestJob, analyzeIngestJob, getIngestJob,
  listIngestJobs, deleteIngestJob, commitRoster, commitResource, commitLessonAudio,
  type IngestJob, type IngestKind, type RosterExtracted, type ResourceExtracted, type LessonExtracted,
} from "@/lib/ingest.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Sparkles, Upload, Users, FileText, Mic, Loader2, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { z } from "zod";
import { RosterReviewTable } from "@/components/ingest/roster-review-table";

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
          title="רשימת תלמידים" desc="תמונה, PDF או Excel של רשימת כיתה"
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
  const initial = (job.extracted as RosterExtracted).students ?? [];
  const [rows, setRows] = useState(initial.map((s) => ({ ...s, include: s.include !== false })));
  const [classId, setClassId] = useState<string>(preferredClassId ?? job.class_id ?? "");
  const commit = useServerFn(commitRoster);
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

  function update(i: number, key: keyof typeof rows[number], val: string | boolean) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  }

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
          <div className="ms-auto text-xs text-muted-foreground">
            {rows.filter((r) => r.include).length} נבחרו
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-2 text-start">✓</th>
                <th className="p-2 text-start">שם</th>
                <th className="p-2 text-start">ת.ז.</th>
                <th className="p-2 text-start">ת. לידה</th>
                <th className="p-2 text-start">כתובת</th>
                <th className="p-2 text-start">אב · טלפון</th>
                <th className="p-2 text-start">אם · טלפון</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={`border-b ${r.include ? "" : "opacity-40"}`}>
                  <td className="p-1"><input type="checkbox" checked={!!r.include} onChange={(e) => update(i, "include", e.target.checked)} /></td>
                  <td className="p-1"><Input className="h-7 text-xs" value={r.name} onChange={(e) => update(i, "name", e.target.value)} /></td>
                  <td className="p-1"><Input className="h-7 text-xs w-24" value={r.national_id ?? ""} onChange={(e) => update(i, "national_id", e.target.value)} /></td>
                  <td className="p-1"><Input className="h-7 text-xs w-28" value={r.birth_date ?? ""} onChange={(e) => update(i, "birth_date", e.target.value)} /></td>
                  <td className="p-1"><Input className="h-7 text-xs" value={r.address ?? ""} onChange={(e) => update(i, "address", e.target.value)} /></td>
                  <td className="p-1 space-y-1">
                    <Input className="h-7 text-xs" placeholder="שם אב" value={r.father_name ?? ""} onChange={(e) => update(i, "father_name", e.target.value)} />
                    <Input className="h-7 text-xs" placeholder="טלפון" value={r.father_phone ?? ""} onChange={(e) => update(i, "father_phone", e.target.value)} />
                  </td>
                  <td className="p-1 space-y-1">
                    <Input className="h-7 text-xs" placeholder="שם אם" value={r.mother_name ?? ""} onChange={(e) => update(i, "mother_name", e.target.value)} />
                    <Input className="h-7 text-xs" placeholder="טלפון" value={r.mother_phone ?? ""} onChange={(e) => update(i, "mother_phone", e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onDone}>ביטול</Button>
          <Button onClick={() => commitM.mutate()} disabled={commitM.isPending}>
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
  const [form, setForm] = useState(ex);
  const [classId, setClassId] = useState<string>(preferredClassId ?? job.class_id ?? "");
  const commit = useServerFn(commitLessonAudio);
  const commitM = useMutation({
    mutationFn: () => {
      if (!classId) throw new Error("בחר כיתה");
      return commit({ data: { jobId: job.id, class_id: classId,
        title: form.title, transcript: form.transcript, summary: form.summary, key_points: form.key_points } });
    },
    onSuccess: () => { toast.success("השיעור נשמר"); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

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