import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronRight, Loader2, Sparkles, Save, Copy, FileText, ListChecks, GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listResources, upsertResource, DIFFICULTY_LABELS, DIFFICULTIES, type Difficulty,
} from "@/lib/teaching-resources.functions";
import { generateResourceSummary, generateResourceTasks } from "@/lib/resource-generators.functions";
import {
  saveGeneratorVersion, updateGeneratorVersion, type GeneratorVersion,
} from "@/lib/generator-versions.functions";
import { GeneratorHistory } from "@/components/generator-history";
import {
  STUDENT_LEVELS, STUDENT_LEVEL_LABELS, SUMMARY_SCOPES, SUMMARY_SCOPE_LABELS,
  TASK_KINDS, TASK_KIND_LABELS,
  type StudentLevel, type SummaryScope, type TaskKind,
} from "@/lib/generator-options";

export const Route = createFileRoute("/_authenticated/resources/generate")({
  component: GeneratePage,
  head: () => ({
    meta: [
      { title: "הפקת תוצרים מהספרייה · הכיתה שלי" },
      { name: "description", content: "מחולל סיכומים ומחולל משימות — בוחרים חומר מהספרייה, רמת תלמידים והיקף, ומקבלים תוצר מוכן להדפסה." },
      { property: "og:title", content: "הפקת תוצרים מהספרייה · הכיתה שלי" },
      { property: "og:description", content: "סיכומים ומשימות מותאמים מתוך חומרי ההוראה שלך." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function GeneratePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button asChild variant="ghost" size="sm" className="px-2">
          <Link to="/resources">
            <ChevronRight className="ms-1 h-4 w-4" aria-hidden /> חזרה לספריית חומרי הוראה
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden /> הפקת תוצרים מהספרייה
        </h1>
        <p className="text-sm text-muted-foreground">
          הכיוון ההפוך לספרייה: בוחרים חומר קיים ומפיקים ממנו סיכום לתלמידים או מערך משימות מותאם.
        </p>
      </div>

      <Tabs defaultValue="summary" dir="rtl">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="summary"><FileText className="ms-1 h-4 w-4" aria-hidden /> מחולל סיכומים</TabsTrigger>
          <TabsTrigger value="tasks"><ListChecks className="ms-1 h-4 w-4" aria-hidden /> מחולל משימות</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4"><SummaryGenerator /></TabsContent>
        <TabsContent value="tasks" className="mt-4"><TaskGenerator /></TabsContent>
      </Tabs>
    </div>
  );
}

function useResourceOptions() {
  const list = useServerFn(listResources);
  const { data = [] } = useQuery({
    queryKey: ["resources", "generator-picker"],
    queryFn: () => list({ data: {} }),
  });
  return useMemo(
    () => data.map((r) => ({ id: r.id, title: r.title, subject: r.subject, grade: r.grade_level })),
    [data],
  );
}

function OutputPanel({
  text, onTextChange, saving, onSave, saveLabel,
  onSaveVersion, savingVersion, versionButtonLabel,
}: {
  text: string;
  onTextChange: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  saveLabel: string;
  onSaveVersion: () => void;
  savingVersion: boolean;
  versionButtonLabel: string;
}) {
  if (!text) return null;
  return (
    <Card className="mt-4">
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">התוצר (ניתן לעריכה)</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => {
              navigator.clipboard.writeText(text).then(
                () => toast.success("הועתק ללוח"),
                () => toast.error("ההעתקה נכשלה"),
              );
            }}
            aria-label="העתק את התוצר ללוח"
          >
            <Copy className="ms-1 h-4 w-4" aria-hidden /> העתק
          </Button>
          <Button
            variant="outline" size="sm" onClick={onSaveVersion} disabled={savingVersion}
            aria-label={versionButtonLabel}
          >
            {savingVersion ? <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden /> : <GitBranch className="ms-1 h-4 w-4" aria-hidden />}
            {versionButtonLabel}
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving} aria-label={saveLabel}>
            {saving ? <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden /> : <Save className="ms-1 h-4 w-4" aria-hidden />}
            {saving ? "שומר…" : "שמור בספרייה"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          dir="rtl"
          rows={16}
          className="min-h-64 bg-muted text-sm leading-relaxed"
          aria-label="עריכת התוצר שהופק"
        />
      </CardContent>
    </Card>
  );
}

function SummaryGenerator() {
  const resources = useResourceOptions();
  const generate = useServerFn(generateResourceSummary);
  const save = useServerFn(upsertResource);
  const saveVersion = useServerFn(saveGeneratorVersion);
  const updateVersion = useServerFn(updateGeneratorVersion);
  const qc = useQueryClient();

  const [resourceId, setResourceId] = useState("");
  const [level, setLevel] = useState<StudentLevel>("average");
  const [scope, setScope] = useState<SummaryScope>("medium");
  const [notes, setNotes] = useState("");
  const [text, setText] = useState("");
  const [versionId, setVersionId] = useState<string | null>(null);

  const source = resources.find((r) => r.id === resourceId);

  const versionTitle = () =>
    `סיכום — ${source?.title ?? "חומר"} (${STUDENT_LEVEL_LABELS[level]}, ${SUMMARY_SCOPE_LABELS[scope]})`;

  const storeVersion = useMutation({
    mutationFn: (body: string) => saveVersion({
      data: {
        kind: "summary",
        title: versionTitle(),
        body,
        params: { level, scope, notes, resourceId },
        resourceId: resourceId || null,
      },
    }),
    onSuccess: (v) => {
      setVersionId(v.id);
      qc.invalidateQueries({ queryKey: ["generator-versions", "summary"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "שמירת הגרסה נכשלה"),
  });

  const updateMut = useMutation({
    mutationFn: () => updateVersion({ data: { id: versionId!, title: versionTitle(), body: text } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["generator-versions", "summary"] });
      toast.success("הגרסה עודכנה");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "עדכון הגרסה נכשל"),
  });

  const genMut = useMutation({
    mutationFn: () => generate({ data: { resourceId, level, scope, notes } }),
    onSuccess: (r) => { setText(r.text); setVersionId(null); storeVersion.mutate(r.text); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "ההפקה נכשלה"),
  });

  const saveMut = useMutation({
    mutationFn: () => save({
      data: {
        title: `סיכום — ${source?.title ?? "חומר"}`,
        description: `סיכום ל${STUDENT_LEVEL_LABELS[level]}, ${SUMMARY_SCOPE_LABELS[scope]}`,
        subject: source?.subject ?? "",
        grade_level: source?.grade ?? "",
        resource_type: "lesson_plan",
        content: { body: text },
        tags: ["סיכום"],
        ai_generated: true,
        source_prompt: notes,
        difficulty: "medium",
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resources"] });
      toast.success("הסיכום נשמר בספרייה");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">הגדרות הסיכום</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="sum-resource">חומר מהספרייה</Label>
            <Select value={resourceId} onValueChange={setResourceId}>
              <SelectTrigger id="sum-resource" aria-label="בחירת חומר מהספרייה לסיכום">
                <SelectValue placeholder="בחר חומר…" />
              </SelectTrigger>
              <SelectContent>
                {resources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sum-level">רמת התלמידים</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as StudentLevel)}>
              <SelectTrigger id="sum-level" aria-label="בחירת רמת התלמידים"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STUDENT_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{STUDENT_LEVEL_LABELS[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sum-scope">היקף הסיכום</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as SummaryScope)}>
              <SelectTrigger id="sum-scope" aria-label="בחירת היקף הסיכום"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUMMARY_SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>{SUMMARY_SCOPE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="sum-notes">הנחיות נוספות (אופציונלי)</Label>
            <Textarea
              id="sum-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="למשל: להדגיש את המחלוקת בין רש״י לתוספות"
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => genMut.mutate()} disabled={!resourceId || genMut.isPending}>
              {genMut.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="ms-1 h-4 w-4" aria-hidden />}
              {genMut.isPending ? "מפיק סיכום…" : "הפק סיכום"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <OutputPanel
        text={text} onTextChange={setText} saving={saveMut.isPending}
        onSave={() => saveMut.mutate()} saveLabel="שמור את הסיכום כחומר חדש בספרייה"
        savingVersion={storeVersion.isPending || updateMut.isPending}
        versionButtonLabel={versionId ? "עדכן גרסה" : "שמור גרסה"}
        onSaveVersion={() => (versionId ? updateMut.mutate() : storeVersion.mutate(text))}
      />
      <GeneratorHistory
        kind="summary"
        activeVersionId={versionId}
        onRestore={(v: GeneratorVersion) => {
          setText(v.body);
          setVersionId(v.id);
          if (typeof v.params["resourceId"] === "string") setResourceId(v.params["resourceId"]);
          if (typeof v.params["level"] === "string") setLevel(v.params["level"] as StudentLevel);
          if (typeof v.params["scope"] === "string") setScope(v.params["scope"] as SummaryScope);
          if (typeof v.params["notes"] === "string") setNotes(v.params["notes"]);
        }}
      />
    </>
  );
}

function TaskGenerator() {
  const resources = useResourceOptions();
  const generate = useServerFn(generateResourceTasks);
  const save = useServerFn(upsertResource);
  const saveVersion = useServerFn(saveGeneratorVersion);
  const updateVersion = useServerFn(updateGeneratorVersion);
  const qc = useQueryClient();

  const [mode, setMode] = useState<"library" | "topic">("library");
  const [resourceId, setResourceId] = useState("");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<StudentLevel>("average");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [kind, setKind] = useState<TaskKind>("questions");
  const [count, setCount] = useState(8);
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
        description: `${TASK_KIND_LABELS[kind]} ל${STUDENT_LEVEL_LABELS[level]}`,
        subject: mode === "library" ? source?.subject ?? "" : "",
        grade_level: mode === "library" ? source?.grade ?? "" : "",
        resource_type: kind === "questions" ? "question_bank" : "worksheet",
        content: { body: text },
        tags: ["משימות"],
        ai_generated: true,
        source_prompt: notes,
        difficulty,
      },
    }),
    onSuccess: () => {
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
        <CardContent className="grid gap-4 md:grid-cols-2">
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

          <div className="space-y-1.5">
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

          <div className="space-y-1.5">
            <Label htmlFor="task-difficulty">רמת קושי</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger id="task-difficulty" aria-label="בחירת רמת קושי"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d}>{DIFFICULTY_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-level">רמת התלמידים</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as StudentLevel)}>
              <SelectTrigger id="task-level" aria-label="בחירת רמת התלמידים"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STUDENT_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>{STUDENT_LEVEL_LABELS[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-count">כמות</Label>
            <Input
              id="task-count" type="number" min={1} max={30} value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
              aria-label="כמות המשימות להפקה"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="task-notes">הנחיות נוספות (אופציונלי)</Label>
            <Textarea
              id="task-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="למשל: לכלול שאלה אחת לחזרה מהשבוע שעבר"
            />
          </div>

          <div className="md:col-span-2">
            <Button onClick={() => genMut.mutate()} disabled={!canGenerate || genMut.isPending}>
              {genMut.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="ms-1 h-4 w-4" aria-hidden />}
              {genMut.isPending ? "מפיק משימות…" : "הפק משימות"}
            </Button>
          </div>
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
          if (typeof v.params["level"] === "string") setLevel(v.params["level"] as StudentLevel);
          if (typeof v.params["difficulty"] === "string") setDifficulty(v.params["difficulty"] as Difficulty);
          if (typeof v.params["kind"] === "string") setKind(v.params["kind"] as TaskKind);
          if (typeof v.params["count"] === "number") setCount(v.params["count"]);
          if (typeof v.params["notes"] === "string") setNotes(v.params["notes"]);
        }}
      />
    </>
  );
}
