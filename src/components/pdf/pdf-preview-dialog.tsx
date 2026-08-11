import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadPdfBlob } from "@/lib/pdf/pdf-builder";
import { downloadTextBlob } from "@/lib/text-export";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Builds the PDF to preview. Runs each time the dialog opens. */
  buildPdf: () => Promise<{ blob: Blob; filename: string }>;
  title?: string;
  /** Optional plain-text/Markdown export of the same document. */
  buildText?: () => string;
  textFilename?: string;
  textMime?: string;
  /**
   * When provided and unchanged since the previous open of this dialog
   * instance, the already-built PDF is reused instead of rebuilt.
   */
  cacheKey?: string | number;
};

/**
 * Generic Hebrew "check before download" preview: renders the built PDF in an
 * iframe, with PDF download and optional text download.
 */
export function PdfPreviewDialog({
  open, onOpenChange, buildPdf, title, buildText, textFilename, textMime, cacheKey,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [filename, setFilename] = useState("document.pdf");
  const [loading, setLoading] = useState(false);
  const lastBuiltKey = useRef<string | number | null>(null);
  const cachedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const canCache = cacheKey !== undefined;
    // Reuse the previously built PDF when the key is unchanged.
    if (canCache && lastBuiltKey.current === cacheKey && cachedUrl.current) {
      return;
    }
    let cancelled = false;
    let currentUrl: string | null = null;
    setLoading(true);
    buildPdf()
      .then((res) => {
        if (cancelled) return;
        currentUrl = URL.createObjectURL(res.blob);
        if (canCache) {
          if (cachedUrl.current && cachedUrl.current !== currentUrl) {
            URL.revokeObjectURL(cachedUrl.current);
          }
          cachedUrl.current = currentUrl;
          lastBuiltKey.current = cacheKey;
        }
        setUrl(currentUrl);
        setBlob(res.blob);
        setFilename(res.filename);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "יצירת תצוגה מקדימה נכשלה"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (canCache) return; // keep the cached blob/url for the next open
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      setUrl(null);
      setBlob(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cacheKey]);

  // Release the cached object URL when the dialog unmounts.
  useEffect(() => () => {
    if (cachedUrl.current) URL.revokeObjectURL(cachedUrl.current);
    cachedUrl.current = null;
  }, []);

  const onText = () => {
    if (!buildText) return;
    try {
      downloadTextBlob(
        buildText(),
        textFilename || filename.replace(/\.pdf$/i, "") + ".txt",
        textMime || "text/plain",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ייצוא הטקסט נכשל");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="flex h-[90vh] w-[95vw] max-w-5xl flex-col gap-3 p-4">
        <DialogHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <DialogTitle className="truncate text-base">
            {title || "תצוגה מקדימה"} · {filename}
          </DialogTitle>
          <div className="flex items-center gap-2">
            {buildText && (
              <Button size="sm" variant="outline" onClick={onText}>
                <FileText className="ms-1 h-4 w-4" aria-hidden="true" /> הורד כטקסט
              </Button>
            )}
            <Button size="sm" disabled={!blob} onClick={() => blob && downloadPdfBlob(blob, filename)}>
              <FileDown className="ms-1 h-4 w-4" aria-hidden="true" /> הורד PDF
            </Button>
          </div>
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
