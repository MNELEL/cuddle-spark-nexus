import { useMemo, useState } from "react";
import { Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { splitOcrPages, parsePageRange, printOcrPages } from "@/lib/ocr-pages";

/** בחירת טווח עמודים מתוך טקסט ה-OCR והדפסה / שמירה כ-PDF חלקי. */
export function OcrPrintRangeDialog({
  open, onClose, title, meta, text,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  meta?: string;
  text: string;
}) {
  const pages = useMemo(() => splitOcrPages(text), [text]);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("");
  const [custom, setCustom] = useState("");

  const indexes = useMemo(() => {
    if (custom.trim()) return parsePageRange(custom, pages.length);
    const f = Math.max(1, Number(from) || 1);
    const t = to.trim() ? Number(to) || pages.length : pages.length;
    return parsePageRange(`${f}-${t}`, pages.length);
  }, [custom, from, to, pages.length]);

  const preview = indexes.length > 0 ? (pages[indexes[0]] ?? "").slice(0, 400) : "";

  const doPrint = () => {
    if (indexes.length === 0) {
      toast.error("בחר טווח עמודים חוקי");
      return;
    }
    const ok = printOcrPages({ title, meta, pages, indexes });
    if (!ok) toast.error("לא הצלחנו לפתוח את חלון ההדפסה");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <Printer className="h-4 w-4 text-amber" /> הדפסת טווח עמודים מהטקסט
          </DialogTitle>
        </DialogHeader>

        {pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            אין טקסט מחולץ לחומר הזה. הפעל תחילה OCR וניתוח AI.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{pages.length} עמודים בטקסט</Badge>
              <Badge variant="secondary">נבחרו {indexes.length} עמודים</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs" htmlFor="ocr-from">מעמוד</Label>
                <Input
                  id="ocr-from" inputMode="numeric" value={from}
                  disabled={Boolean(custom.trim())}
                  onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div>
                <Label className="text-xs" htmlFor="ocr-to">עד עמוד</Label>
                <Input
                  id="ocr-to" inputMode="numeric" value={to}
                  placeholder={String(pages.length)}
                  disabled={Boolean(custom.trim())}
                  onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs" htmlFor="ocr-custom">או טווח חופשי (למשל 1-3,7)</Label>
              <Input
                id="ocr-custom" value={custom} placeholder="1-3,7"
                onChange={(e) => setCustom(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Button size="sm" variant="outline" onClick={() => { setCustom(""); setFrom("1"); setTo(""); }}>
                כל העמודים
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setCustom(""); setFrom("1"); setTo("1"); }}>
                עמוד ראשון בלבד
              </Button>
            </div>
            {preview && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" /> תחילת עמוד {indexes[0] + 1}
                </div>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{preview}…</p>
              </div>
            )}
          </>
        )}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={onClose}>סגור</Button>
          <Button disabled={indexes.length === 0} onClick={doPrint}>
            <Printer className="ms-1 h-4 w-4" /> הדפס / שמור כ-PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}