import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildLessonSummaryPdf } from "@/lib/pdf/lesson-summary-pdf";
import { downloadPdfBlob } from "@/lib/pdf/pdf-builder";
import type { LessonExtracted } from "@/lib/ingest.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lesson: LessonExtracted;
  className?: string;
  onlyIncluded: boolean;
};

export function PdfPreviewDialog({ open, onOpenChange, lesson, className, onlyIncluded }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [filename, setFilename] = useState<string>("lesson.pdf");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let revoked = false;
    let currentUrl: string | null = null;
    setLoading(true);
    buildLessonSummaryPdf(lesson, { className, onlyIncluded })
      .then((res) => {
        if (revoked) return;
        currentUrl = URL.createObjectURL(res.blob);
        setUrl(currentUrl);
        setBlob(res.blob);
        setFilename(res.filename);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "יצירת תצוגה מקדימה נכשלה"))
      .finally(() => { if (!revoked) setLoading(false); });
    return () => {
      revoked = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      setUrl(null);
      setBlob(null);
    };
  }, [open, lesson, className, onlyIncluded]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-4 gap-3">
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <DialogTitle className="text-base truncate">
            תצוגה מקדימה · {filename}
          </DialogTitle>
          <Button
            size="sm"
            disabled={!blob}
            onClick={() => blob && downloadPdfBlob(blob, filename)}
          >
            <FileDown className="ms-1 h-4 w-4" /> הורדה
          </Button>
        </DialogHeader>
        <div className="flex-1 min-h-0 rounded-md border bg-muted/30 overflow-hidden">
          {loading || !url ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> יוצר תצוגה מקדימה...
            </div>
          ) : (
            <iframe title="PDF preview" src={url} className="h-full w-full" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}