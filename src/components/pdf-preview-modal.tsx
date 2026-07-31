import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadPdfBlob } from "@/lib/pdf/pdf-builder";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Builds the PDF to preview. Re-run whenever the dialog opens. */
  build: () => Promise<{ blob: Blob; filename: string }>;
  title?: string;
};

/**
 * Generic "check before you download" PDF preview: renders the built blob in an
 * iframe so the layout and data can be verified, with a download button.
 */
export function PdfPreviewModal({ open, onOpenChange, build, title }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [filename, setFilename] = useState("document.pdf");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let currentUrl: string | null = null;
    setLoading(true);
    build()
      .then((res) => {
        if (cancelled) return;
        currentUrl = URL.createObjectURL(res.blob);
        setUrl(currentUrl);
        setBlob(res.blob);
        setFilename(res.filename);
      })
      .catch(() => toast.error("יצירת תצוגה מקדימה נכשלה"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      setUrl(null);
      setBlob(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-5xl w-[95vw] h-[90vh] flex flex-col gap-3 p-4">
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <DialogTitle className="truncate text-base">
            {title || "תצוגה מקדימה"} · {filename}
          </DialogTitle>
          <Button size="sm" disabled={!blob} onClick={() => blob && downloadPdfBlob(blob, filename)}>
            <FileDown className="ml-2 h-4 w-4" aria-hidden="true" /> הורדה
          </Button>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/30">
          {loading || !url ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> יוצר תצוגה מקדימה...
            </div>
          ) : (
            <iframe title="תצוגה מקדימה של PDF" src={url} className="h-full w-full" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}