import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Mic, Square, Upload, Loader2, Sparkles, Trash2, FileAudio, FileText, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listLessonTranscripts, createLessonRecording, deleteLessonTranscript,
  getLessonUploadUrl, transcribeAndSummarize, generateResourceFromTranscript,
  type LessonTranscript,
} from "@/lib/lessons.functions";

export function LessonsTab({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listLessonTranscripts);
  const { data: lessons = [], isLoading } = useQuery({
    queryKey: ["lessons", classId],
    queryFn: () => list({ data: { classId } }),
    refetchInterval: (q) => {
      const rows = (q.state.data ?? []) as LessonTranscript[];
      return rows.some((r) => r.status === "transcribing" || r.status === "pending") ? 5000 : false;
    },
  });

  return (
    <div className="space-y-4">
      <RecordOrUpload classId={classId} onCreated={() => qc.invalidateQueries({ queryKey: ["lessons", classId] })} />
      {isLoading ? (
        <div className="text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> טוען…</div>
      ) : lessons.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          אין עדיין הקלטות שיעור. הקלט או העלה קובץ אודיו וה-AI יתמלל ויסכם את השיעור.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {lessons.map((l) => <LessonCard key={l.id} lesson={l} classId={classId} />)}
        </div>
      )}
    </div>
  );
}

function RecordOrUpload({ classId, onCreated }: { classId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const getUrl = useServerFn(getLessonUploadUrl);
  const create = useServerFn(createLessonRecording);
  const transcribe = useServerFn(transcribeAndSummarize);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const f = new File([blob], `lesson-${Date.now()}.webm`, { type: "audio/webm" });
        setFile(f);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
    } catch (e) {
      console.error(e);
      toast.error("אין גישה למיקרופון");
    }
  }
  function stopRec() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function upload() {
    if (!file) { toast.error("בחר או הקלט קובץ"); return; }
    if (!title.trim()) { toast.error("הוסף כותרת לשיעור"); return; }
    if (file.size > 24 * 1024 * 1024) { toast.error("הקובץ גדול מ-24MB"); return; }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { path, token } = await getUrl({ data: { filename: safe } });
      const { error: upErr } = await supabase.storage
        .from("lesson-recordings").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { id } = await create({ data: { classId, title: title.trim(), audio_path: path } });
      toast.success("הועלה — מתחיל תמלול…");
      setFile(null); setTitle("");
      onCreated();
      transcribe({ data: { id } })
        .then(() => { toast.success("התמלול הושלם"); onCreated(); })
        .catch((e) => toast.error(e instanceof Error ? e.message : "תמלול נכשל"));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Mic className="h-4 w-4 text-amber" /> הקלטה / העלאה של שיעור
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <Label className="text-xs">כותרת השיעור</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder='למשל: "ברכות דף ל"ב — שיעור יום שני"' />
          </div>
          <div className="flex items-end">
            {!recording ? (
              <Button type="button" variant="outline" onClick={startRec}>
                <Mic className="ms-1 h-4 w-4" /> הקלט
              </Button>
            ) : (
              <Button type="button" variant="destructive" onClick={stopRec}>
                <Square className="ms-1 h-4 w-4" /> עצור
              </Button>
            )}
          </div>
          <div className="flex items-end">
            <label className="inline-flex">
              <input type="file" accept="audio/*" className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button type="button" variant="outline" asChild>
                <span><Upload className="ms-1 h-4 w-4" /> בחר קובץ</span>
              </Button>
            </label>
          </div>
        </div>
        {file && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileAudio className="h-3 w-3" /> {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB
            <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setFile(null)}>נקה</Button>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={upload} disabled={busy || !file || !title.trim()}>
            {busy ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Sparkles className="ms-1 h-4 w-4" />}
            העלה ותמלל
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          עד 24MB לקובץ. ה-AI יתמלל בעברית, יסכם, וישלוף נקודות מפתח שתוכל להפוך לדף עבודה.
        </p>
      </CardContent>
    </Card>
  );
}

function LessonCard({ lesson, classId }: { lesson: LessonTranscript; classId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [genType, setGenType] = useState<"worksheet" | "question_bank" | "riddle" | "lesson_plan">("worksheet");
  const [extra, setExtra] = useState("");

  const del = useServerFn(deleteLessonTranscript);
  const transcribe = useServerFn(transcribeAndSummarize);
  const gen = useServerFn(generateResourceFromTranscript);

  const delMut = useMutation({
    mutationFn: () => del({ data: { id: lesson.id } }),
    onSuccess: () => { toast.success("נמחק"); qc.invalidateQueries({ queryKey: ["lessons", classId] }); },
  });
  const retryMut = useMutation({
    mutationFn: () => transcribe({ data: { id: lesson.id } }),
    onSuccess: () => { toast.success("התמלול הושלם"); qc.invalidateQueries({ queryKey: ["lessons", classId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const genMut = useMutation({
    mutationFn: () => gen({ data: { transcript_id: lesson.id, resource_type: genType, extra_instructions: extra } }),
    onSuccess: () => { toast.success("נוסף לספרייה"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const statusLabel = {
    pending: "ממתין",
    transcribing: "מתמלל…",
    done: "מוכן",
    failed: "נכשל",
  }[lesson.status];

  return (
    <Card>
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-center gap-2">
          <div className="font-semibold">{lesson.title}</div>
          <Badge variant={lesson.status === "done" ? "default" : lesson.status === "failed" ? "destructive" : "secondary"}>
            {statusLabel}
          </Badge>
          <Button size="sm" variant="ghost" className="ms-auto text-destructive"
            onClick={() => { if (confirm("למחוק את ההקלטה והתמלול?")) delMut.mutate(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        {lesson.status === "failed" && lesson.error && (
          <div className="text-xs text-destructive">{lesson.error}</div>
        )}
        {(lesson.status === "failed" || lesson.status === "pending") && (
          <Button size="sm" variant="outline" onClick={() => retryMut.mutate()} disabled={retryMut.isPending}>
            {retryMut.isPending ? <Loader2 className="ms-1 h-3 w-3 animate-spin" /> : <Sparkles className="ms-1 h-3 w-3" />}
            הפעל תמלול
          </Button>
        )}
        {lesson.status === "done" && (
          <>
            {lesson.summary && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-3">{lesson.summary}</p>
            )}
            {lesson.key_points?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {lesson.key_points.slice(0, 4).map((k, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{k}</Badge>
                ))}
                {lesson.key_points.length > 4 && (
                  <Badge variant="outline" className="text-[10px]">+{lesson.key_points.length - 4}</Badge>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
                <FileText className="ms-1 h-3 w-3" /> {open ? "הסתר תמלול" : "הצג תמלול מלא"}
              </Button>
              <Select value={genType} onValueChange={(v) => setGenType(v as typeof genType)}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="worksheet">דף עבודה</SelectItem>
                  <SelectItem value="question_bank">מבחן / מאגר שאלות</SelectItem>
                  <SelectItem value="riddle">חידה</SelectItem>
                  <SelectItem value="lesson_plan">מערך שיעור</SelectItem>
                </SelectContent>
              </Select>
              <Input className="h-8 max-w-xs" placeholder="הנחיות נוספות (אופציונלי)…"
                value={extra} onChange={(e) => setExtra(e.target.value)} />
              <Button size="sm" onClick={() => genMut.mutate()} disabled={genMut.isPending}>
                {genMut.isPending ? <Loader2 className="ms-1 h-3 w-3 animate-spin" /> : <Sparkles className="ms-1 h-3 w-3" />}
                צור מהשיעור
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to="/resources"><ExternalLink className="ms-1 h-3 w-3" /> לספרייה</Link>
              </Button>
            </div>
            {open && (
              <div className="mt-2 max-h-72 overflow-y-auto rounded border bg-muted/30 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                {lesson.transcript || "אין תמלול"}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}