import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { upsertResource } from "@/lib/teaching-resources.functions";
import { generateResourceSummary } from "@/lib/resource-generators.functions";
import {
  saveGeneratorVersion, updateGeneratorVersion, type GeneratorVersion,
} from "@/lib/generator-versions.functions";
import { GeneratorHistory } from "@/components/generator-history";
import {
  STUDENT_LEVELS, STUDENT_LEVEL_LABELS, STUDENT_LEVEL_HINTS,
  SUMMARY_SCOPES, SUMMARY_SCOPE_LABELS, SUMMARY_SCOPE_HINTS,
  type StudentLevel, type SummaryScope,
} from "@/lib/generator-options";
import { OptionButtons, OutputPanel, useResourceOptions } from "@/components/generator-shared";

/** מחולל סיכום מותאם מחומר קיים בספרייה */
export function SummaryGenerator() {
  const resources = useResourceOptions();
  const generate = useServerFn(generateResourceSummary);
  const save = useServerFn(upsertResource);
  const saveVersion = useServerFn(saveGeneratorVersion);
  const updateVersion = useServerFn(updateGeneratorVersion);
  const qc = useQueryClient();

  const [resourceId, setResourceId] = useState("");
  const [level, setLevel] = useState<StudentLevel>("intermediate");
  const [scope, setScope] = useState<SummaryScope>("partial");
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
        description: `סיכום לרמה ${STUDENT_LEVEL_LABELS[level]}, ${SUMMARY_SCOPE_LABELS[scope]}`,
        subject: source?.subject ?? "",
        grade_level: source?.grade ?? "",
        resource_type: "summary",
        content: { body: text, ...(resourceId ? { source_resource_id: resourceId } : {}) },
        tags: ["סיכום"],
        ai_generated: true,
        source_prompt: notes,
        difficulty: "medium",
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teaching-resources"] });
      qc.invalidateQueries({ queryKey: ["resources"] });
      toast.success("הסיכום נשמר בספרייה");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">הגדרות הסיכום</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
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
            legend="היקף הסיכום"
            value={scope}
            onChange={setScope}
            options={SUMMARY_SCOPES.map((s) => ({
              value: s, label: SUMMARY_SCOPE_LABELS[s], hint: SUMMARY_SCOPE_HINTS[s],
            }))}
          />

          <div className="space-y-1.5">
            <Label htmlFor="sum-notes">הנחיות נוספות (אופציונלי)</Label>
            <Textarea
              id="sum-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="למשל: להדגיש את המחלוקת בין רש״י לתוספות"
            />
          </div>
          <Button onClick={() => genMut.mutate()} disabled={!resourceId || genMut.isPending}>
            {genMut.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="ms-1 h-4 w-4" aria-hidden />}
            {genMut.isPending ? "מפיק סיכום…" : "הפק סיכום"}
          </Button>
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
          if (STUDENT_LEVELS.includes(v.params["level"] as StudentLevel)) setLevel(v.params["level"] as StudentLevel);
          if (SUMMARY_SCOPES.includes(v.params["scope"] as SummaryScope)) setScope(v.params["scope"] as SummaryScope);
          if (typeof v.params["notes"] === "string") setNotes(v.params["notes"]);
        }}
      />
    </>
  );
}