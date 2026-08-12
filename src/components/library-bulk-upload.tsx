import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createUploadedResource } from "@/lib/library-extras.functions";
import { analyzeExistingResource } from "@/lib/resource-understanding.functions";

type ItemState = {
  name: string;
  status: "pending" | "uploading" | "analyzing" | "done" | "error";
  note?: string;
};

function cleanName(name: string) {
  return name.replace(/[^\w.\-\u0590-\u05FF]+/g, "_").slice(-80);
}

export function LibraryBulkUpload({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const createFn = useServerFn(createUploadedResource);
  const analyzeFn = useServerFn(analyzeExistingResource);
  const [items, setItems] = useState<ItemState[]>([]);
  const [running, setRunning] = useState(false);

  const update = (i: number, p: Partial<ItemState>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...p } : it)));

  const handleFiles = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;
    if (files.length > 20) {
      toast.error("אפשר להעלות עד 20 קבצים בפעם אחת");
      return;
    }
    setItems(files.map((f) => ({ name: f.name, status: "pending" as const })));
    setRunning(true);

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      toast.error("נדרשת התחברות מחדש");
      setRunning(false);
      return;
    }

    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        update(i, { status: "uploading" });
        const path = `${uid}/${Date.now()}-${i}-${cleanName(file.name)}`;
        const up = await supabase.storage.from("teaching-resources").upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (up.error) throw new Error(up.error.message);
        const title = file.name.replace(/\.[^.]+$/, "").slice(0, 200) || "חומר חדש";
        const { id } = await createFn({
          data: { title, file_path: path, mime_type: file.type || "" },
        });
        update(i, { status: "analyzing" });
        try {
          const res = await analyzeFn({ data: { id, force: false } });
          update(i, {
            status: "done",
            note: res.ocr_added
              ? `חולצו ${res.ocr_chars.toLocaleString("he-IL")} תווים · סווג אוטומטית`
              : "נשמר וסווג",
          });
        } catch {
          update(i, { status: "done", note: "נשמר בספרייה — הניתוח האוטומטי לא הצליח" });
        }
        ok++;
      } catch (e) {
        update(i, { status: "error", note: e instanceof Error ? e.message : "העלאה נכשלה" });
      }
    }

    setRunning(false);
    qc.invalidateQueries({ queryKey: ["teaching-resources"] });
    toast.success(`הועלו ${ok} מתוך ${files.length} קבצים`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !running) {
          setItems([]);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <UploadCloud className="h-4 w-4 text-amber" /> העלאת כמה קבצים לספרייה
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          אפשר לבחור כמה קבצים יחד — כולל סרוקים ותמונות. כל קובץ נשמר כפי שהוא, עובר OCR וסיווג
          אוטומטי.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.txt"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <Button variant="outline" disabled={running} onClick={() => inputRef.current?.click()}>
          {running ? (
            <Loader2 className="ms-1 h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="ms-1 h-4 w-4" />
          )}
          בחר קבצים
        </Button>
        {items.length > 0 && (
          <ul className="space-y-1 text-xs" aria-live="polite">
            {items.map((it, i) => (
              <li
                key={`${it.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1.5"
              >
                <span className="truncate">{it.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                  {it.status === "uploading" && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> מעלה…
                    </>
                  )}
                  {it.status === "analyzing" && (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> מנתח…
                    </>
                  )}
                  {it.status === "pending" && "בהמתנה"}
                  {it.status === "done" && (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" /> {it.note}
                    </>
                  )}
                  {it.status === "error" && (
                    <>
                      <AlertTriangle className="h-3 w-3 text-destructive" /> {it.note}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={running}
            onClick={() => {
              setItems([]);
              onClose();
            }}
          >
            סגור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
