import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Library, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  suggestResourcesForBulletin, listQuestionsFromResource,
} from "@/lib/bulletin-sync.functions";
import type { QuizQuestion } from "@/lib/bulletins.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bulletinId: string;
  /** Called with the questions the teacher picked; caller appends them to the draft. */
  onImport: (questions: QuizQuestion[]) => void;
};

/** ייבוא שאלות חזרה מחומרים קיימים בספריית החומרים אל תוך העלון. */
export function BulletinImportQuestionsDialog({ open, onOpenChange, bulletinId, onImport }: Props) {
  const suggest = useServerFn(suggestResourcesForBulletin);
  const listQuestions = useServerFn(listQuestionsFromResource);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const { data: resources = [], isFetching: loadingResources } = useQuery({
    queryKey: ["bulletin-import-suggest", bulletinId],
    queryFn: () => suggest({ data: { bulletin_id: bulletinId, limit: 12 } }),
    enabled: open,
  });

  const { data: loaded, isFetching: loadingQuestions } = useQuery({
    queryKey: ["bulletin-import-questions", resourceId],
    queryFn: () => listQuestions({ data: { resource_id: resourceId! } }),
    enabled: open && !!resourceId,
  });

  const questions = loaded?.questions ?? [];
  const selected = useMemo(
    () => questions.filter((_q, i) => picked[String(i)]),
    [questions, picked],
  );

  const reset = () => { setResourceId(null); setPicked({}); };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}
    >
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-4 w-4 text-amber" aria-hidden="true" />
            ייבוא שאלות מהספרייה
          </DialogTitle>
          <DialogDescription>
            בחר חומר מהספרייה, ואז סמן אילו שאלות להוסיף לשאלות החזרה של העלון.
          </DialogDescription>
        </DialogHeader>

        {!resourceId ? (
          <div className="space-y-2">
            {loadingResources && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> טוען חומרים…
              </div>
            )}
            {!loadingResources && resources.length === 0 && (
              <div className="text-sm text-muted-foreground">
                לא נמצאו חומרים מתאימים. הוסף נקודות לימוד או הספק לימודי לעלון ושמור אותו.
              </div>
            )}
            <ScrollArea className="max-h-72">
              <ul className="space-y-1 pe-2">
                {resources.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => { setResourceId(r.id); setPicked({}); }}
                      className="min-h-9 w-full rounded-md border bg-card px-3 py-2 text-right text-sm transition hover:border-amber/40 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="font-medium">{r.title}</span>
                      <span className="ms-2 text-xs text-muted-foreground">
                        {r.resource_type}{r.subject ? ` · ${r.subject}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{loaded?.title || "חומר"}</div>
              <Button size="sm" variant="ghost" onClick={reset}>בחר חומר אחר</Button>
            </div>
            {loadingQuestions && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> טוען שאלות…
              </div>
            )}
            {!loadingQuestions && questions.length === 0 && (
              <div className="text-sm text-muted-foreground">בחומר הזה אין שאלות לייבוא.</div>
            )}
            <ScrollArea className="max-h-72">
              <ul className="space-y-2 pe-2">
                {questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-md border p-2">
                    <Checkbox
                      id={`q-${i}`}
                      checked={!!picked[String(i)]}
                      onCheckedChange={(v) => setPicked((p) => ({ ...p, [String(i)]: !!v }))}
                    />
                    <Label htmlFor={`q-${i}`} className="flex-1 cursor-pointer text-sm font-normal">
                      <span className="font-medium">{q.question}</span>
                      {q.answer && (
                        <span className="mt-1 block text-xs text-muted-foreground">{q.answer}</span>
                      )}
                    </Label>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button
            disabled={selected.length === 0}
            onClick={() => {
              onImport(selected);
              toast.success(`יובאו ${selected.length} שאלות לעלון`);
              reset();
              onOpenChange(false);
            }}
          >
            <Check className="ms-1 h-4 w-4" aria-hidden="true" />
            ייבא {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}