import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  upsertResource, DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty,
} from "@/lib/teaching-resources.functions";
import { generateResourceTasks } from "@/lib/resource-generators.functions";
import {
  saveGeneratorVersion, updateGeneratorVersion, type GeneratorVersion,
} from "@/lib/generator-versions.functions";
import { GeneratorHistory } from "@/components/generator-history";
import {
  STUDENT_LEVELS, STUDENT_LEVEL_LABELS, STUDENT_LEVEL_HINTS,
  TASK_KINDS, TASK_KIND_LABELS, TASK_COUNTS,
  type StudentLevel, type TaskKind,
} from "@/lib/generator-options";
import { OptionButtons, OutputPanel, useResourceOptions } from "@/components/generator-shared";

/** מחולל משימות מחומר בספרייה או מנושא חופשי */
export function TaskGenerator() {
  const resources = useResourceOptions();
  const generate = useServerFn(generateResourceTasks);
  const save = useServerFn(upsertResource);
  const saveVersion = useServerFn(saveGeneratorVersion);
  const updateVersion = useServerFn(updateGeneratorVersion);
  const qc = useQueryClient();

  const [mode, setMode] = useState<"library" | "topic">("library");
  const [resourceId, setResourceId] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<StudentLevel>("intermediate");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [kind, setKind] = useState<TaskKind>("questions");
  const [count, setCount] = useState<number>(8);
  const [notes, setNotes] = useState("");
  const [text, setText] = useState("");
  const [versionId, setVersionId] = useState<string | null>(null);

  const source = resources.find((r) => r.id === resourceId);

  const versionTitle = () =>
    `${TASK_KIND_LABELS[kind]} — ${mode === "library" ? source?.title ?? "חומר" : topic || "נושא חופשי"}`;

  const storeVersion = useMutation({
    mutationFn: (body: string) => saveVersion({
      data: {
        kind: "tasks",
        title: versionTitle(),
        body,
        params: { mode, resourceId, topic, level, difficulty, kind, count, notes },
        resourceId: mode === "library" && resourceId ? resourceId : null,
      },
    }),
    onSuccess: (v) => {
      setVersionId(v.id);
      qc.invalidateQueries({ queryKey: ["generator-versions", "tasks"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "שמירת הגרסה נכשלה"),
  });

  const updateMut = useMutation({
    mutationFn: () => updateVersion({ data: { id: versionId!, title: versionTitle(), body: text } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["generator-versions", "tasks"] });
      toast.success("הגרסה עודכנה");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "עדכון הגרסה נכשל"),
  });

  const genMut = useMutation({
    mutationFn: () => generate({
      data: {
        resourceId: mode === "library" && resourceId ? resourceId : undefined,
        topic: mode === "topic" ? topic : "",
        level, difficulty, kind, count, notes,
      },
    }),
    onSuccess: (r) => { setText(r.text); setVersionId(null); storeVersion.mutate(r.text); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "ההפקה נכשלה"),
  });

  const saveMut = useMutation({
    mutationFn: () => save({
      data: {
        title: `${TASK_KIND_LABELS[kind]} — ${mode === "library" ? source?.title ?? "חומר" : topic}`,
        description: `${TASK_KIND_LABELS[kind]} לרמה ${STUDENT_LEVEL_LABELS[level]}`,
        subject: mode === "library" ? source?.subject ?? "" : "",
        grade_level: mode === "library" ? source?.grade ?? "" : "",
        resource_type: kind === "questions" ? "question_bank" : "worksheet",
        content: {
          body: text,
          ...(mode === "library" && resourceId ? { source_resource_id: resourceId } : {}),
        },
        tags: ["משימות"],
        ai_generated: true,
        source_prompt: notes,
        difficulty,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teaching-resources"] });
      qc.invalidateQueries({ queryKey: ["resources"] });
      toast.success("המשימות נשמרו בספרייה");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  const canGenerate = mode === "library" ? Boolean(resourceId) : topic.trim().length > 2;

  return (
    <>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">הגדרות המשימות</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-mode">מקור</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "library" | "topic")}>
                <SelectTrigger id="task-mode" aria-label="בחירת מקור המשימות"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="library">חומר מהספרייה</SelectItem>
                  <SelectItem value="topic">נושא חופשי</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "library" ? (
              <div className="space-y-1.5">
                <Label htmlFor="task-resource">חומר מהספרייה</Label>
                <Select value={resourceId} onValueChange={setResourceId}>
                  <SelectTrigger id="task-resource" aria-label="בחירת חומר מהספרייה למשימות">
                    <SelectValue placeholder="בחר חומר…" />
                  </SelectTrigger>
                  <SelectContent>
                    {resources.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="task-topic">נושא חופשי</Label>
                <Input
                  id="task-topic" value={topic} onChange={(e) => setTopic(e.target.value)}
                  placeholder="למשל: פרשת נח — קשת בענן"
                />
              </div>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="task-kind">סוג המשימות</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as TaskKind)}>
                <SelectTrigger id="task-kind" aria-label="בחירת סוג המשימות"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TASK_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{TASK_KIND_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <OptionButtons
            legend="רמת התלמידים"
            columns={4}
            value={level}
            onChange={setLevel}
            options={STUDENT_LEVELS.map((l) => ({
              value: l, label: STUDENT_LEVEL_LABELS[l], hint: STUDENT_LEVEL_HINTS[l],
            }))}
          />

          <OptionButtons
            legend="רמת קושי"
            columns={3}
            value={difficulty}
            onChange={setDifficulty}
            options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))}
          />

          <OptionButtons
            legend="כמות שאלות"
            columns={4}
            value={count}
            onChange={setCount}
            options={TASK_COUNTS.map((c) => ({ value: c as number, label: String(c) }))}
          />

          <div className="space-y-1.5">
            <Label htmlFor="task-notes">הנחיות נוספות (אופציונלי)</Label>
            <Textarea
              id="task-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="למשל: לכלול שאלה אחת לחזרה מהשבוע שעבר"
            />
          </div>

          <Button onClick={() => genMut.mutate()} disabled={!canGenerate || genMut.isPending}>
            {genMut.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="ms-1 h-4 w-4" aria-hidden />}
            {genMut.isPending ? "מפיק משימות…" : "הפק משימות"}
          </Button>
        </CardContent>
      </Card>
      <OutputPanel
        text={text} onTextChange={setText} saving={saveMut.isPending}
        onSave={() => saveMut.mutate()} saveLabel="שמור את המשימות כחומר חדש בספרייה"
        savingVersion={storeVersion.isPending || updateMut.isPending}
        versionButtonLabel={versionId ? "עדכן גרסה" : "שמור גרסה"}
        onSaveVersion={() => (versionId ? updateMut.mutate() : storeVersion.mutate(text))}
      />
      <GeneratorHistory
        kind="tasks"
        activeVersionId={versionId}
        onRestore={(v: GeneratorVersion) => {
          setText(v.body);
          setVersionId(v.id);
          if (v.params["mode"] === "library" || v.params["mode"] === "topic") setMode(v.params["mode"]);
          if (typeof v.params["resourceId"] === "string") setResourceId(v.params["resourceId"]);
          if (typeof v.params["topic"] === "string") setTopic(v.params["topic"]);
          if (STUDENT_LEVELS.includes(v.params["level"] as StudentLevel)) setLevel(v.params["level"] as StudentLevel);
          if (typeof v.params["difficulty"] === "string") setDifficulty(v.params["difficulty"] as Difficulty);
          if (typeof v.params["kind"] === "string") setKind(v.params["kind"] as TaskKind);
          if (typeof v.params["count"] === "number") setCount(v.params["count"]);
          if (typeof v.params["notes"] === "string") setNotes(v.params["notes"]);
        }}
      />
    </>
  );
}