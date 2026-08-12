import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, ScanText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ResourceRow } from "@/lib/teaching-resources.functions";
import { updateResourceOcrText } from "@/lib/library-extras.functions";
import { analyzeExistingResource } from "@/lib/resource-understanding.functions";

function confidenceLabel(c: number | undefined) {
  if (c === undefined || c <= 0) return { text: "ודאות לא נמדדה", cls: "text-muted-foreground" };
  const pct = Math.round(c * 100);
  if (c >= 0.85)
    return { text: `ודאות גבוהה · ${pct}%`, cls: "text-emerald-600 dark:text-emerald-400" };
  if (c >= 0.6)
    return { text: `ודאות בינונית · ${pct}%`, cls: "text-amber-600 dark:text-amber-400" };
  return {
    text: `ודאות נמוכה · ${pct}% — כדאי לעבור על הטקסט`,
    cls: "text-rose-600 dark:text-rose-400",
  };
}

export function ResourceOcrEditor({
  resource,
  open,
  onClose,
}: {
  resource: ResourceRow;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(updateResourceOcrText);
  const analyzeFn = useServerFn(analyzeExistingResource);
  const c = resource.content ?? {};
  const [text, setText] = useState(c.original_text ?? "");
  const conf = confidenceLabel(c.ai_understanding?.ocr_confidence);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["teaching-resource", resource.id] });
    qc.invalidateQueries({ queryKey: ["teaching-resources"] });
  };

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { id: resource.id, original_text: text } }),
    onSuccess: (r) => {
      invalidate();
      toast.success(`הטקסט נשמר (${r.chars.toLocaleString("he-IL")} תווים) ואונדקס לחיפוש`);
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  const rescanMut = useMutation({
    mutationFn: () => analyzeFn({ data: { id: resource.id, force: true } }),
    onSuccess: () => {
      invalidate();
      toast.success("הסריקה הופעלה מחדש — סגור ופתח כדי לראות את הטקסט החדש");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "הסריקה נכשלה"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <ScanText className="h-4 w-4 text-amber" /> הטקסט שחולץ מהמסמך
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={conf.cls}>{conf.text}</span>
          <Badge variant="outline">{text.length.toLocaleString("he-IL")} תווים</Badge>
          {c.ai_understanding?.ocr_reviewed && <Badge variant="secondary">עבר בדיקה ידנית</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          אפשר לתקן כאן שגיאות OCR. אחרי השמירה הטקסט מאונדקס מחדש והחיפוש בתוך המסמך יעבוד לפי
          הגרסה המתוקנת.
        </p>
        <Textarea
          dir="rtl"
          rows={18}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="טקסט שחולץ ב-OCR"
          className="font-mono text-xs leading-relaxed"
        />
        <DialogFooter className="flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={rescanMut.isPending}
            onClick={() => rescanMut.mutate()}
          >
            {rescanMut.isPending ? (
              <Loader2 className="ms-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="ms-1 h-4 w-4" />
            )}
            הפעל סריקה מחדש
          </Button>
          <Button variant="ghost" onClick={onClose}>
            סגור
          </Button>
          <Button disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? (
              <Loader2 className="ms-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ms-1 h-4 w-4" />
            )}
            שמור תיקונים
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
