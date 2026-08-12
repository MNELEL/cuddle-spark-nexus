import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Tag, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { KODESH_SUBJECTS } from "@/lib/kodesh-subjects";
import {
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  type Difficulty,
  type ResourceRow,
  type ResourceType,
} from "@/lib/teaching-resources.functions";
import { patchResourceClassification } from "@/lib/library-extras.functions";

const GRADES = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"] as const;

export function ResourceClassificationEditor({
  resource,
  open,
  onClose,
}: {
  resource: ResourceRow;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(patchResourceClassification);
  const [subject, setSubject] = useState(resource.subject ?? "");
  const [grade, setGrade] = useState(resource.grade_level ?? "");
  const [type, setType] = useState<ResourceType>(resource.resource_type);
  const [difficulty, setDifficulty] = useState<Difficulty>(resource.difficulty ?? "medium");
  const [description, setDescription] = useState(resource.description ?? "");
  const [tags, setTags] = useState<string[]>(resource.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");

  const addTag = () => {
    const t = tagDraft.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags([...tags, t].slice(0, 25));
    setTagDraft("");
  };

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: resource.id,
          subject,
          grade_level: grade,
          resource_type: type,
          difficulty,
          description,
          tags,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teaching-resources"] });
      qc.invalidateQueries({ queryKey: ["teaching-resource", resource.id] });
      toast.success("הסיווג והתגיות עודכנו");
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">עריכת הסיווג והתגיות</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          כאן אפשר לתקן את מה שה-AI קבע — סוג החומר, המקצוע, הכיתה והתגיות.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="cls-type">סוג החומר</Label>
            <Select value={type} onValueChange={(v) => setType(v as ResourceType)}>
              <SelectTrigger id="cls-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {RESOURCE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cls-difficulty">רמת קושי</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger id="cls-difficulty">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cls-subject">מקצוע</Label>
            <Select
              value={subject || "none"}
              onValueChange={(v) => setSubject(v === "none" ? "" : v)}
            >
              <SelectTrigger id="cls-subject">
                <SelectValue placeholder="ללא" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא</SelectItem>
                {KODESH_SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cls-grade">כיתה</Label>
            <Select value={grade || "none"} onValueChange={(v) => setGrade(v === "none" ? "" : v)}>
              <SelectTrigger id="cls-grade">
                <SelectValue placeholder="ללא" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא</SelectItem>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g}>
                    כיתה {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cls-desc">תיאור</Label>
          <Textarea
            id="cls-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cls-tag">תגיות</Label>
          <div className="flex gap-2">
            <Input
              id="cls-tag"
              value={tagDraft}
              placeholder="הוסף תגית ולחץ Enter"
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addTag}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
              >
                <Tag className="h-3 w-3" /> {t}
                <button
                  type="button"
                  aria-label={`הסר את התגית ${t}`}
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {tags.length === 0 && <span className="text-xs text-muted-foreground">אין תגיות</span>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? (
              <Loader2 className="ms-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ms-1 h-4 w-4" />
            )}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
