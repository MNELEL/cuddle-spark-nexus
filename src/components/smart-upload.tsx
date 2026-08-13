import { useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, RotateCcw, ScanLine, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_UPLOAD_MB, validateUploadFile } from "@/lib/upload-accept";
import { UploadLimitsInfo } from "@/components/upload-limits-info";

type QueueStatus = "pending" | "uploading" | "done" | "error";
type QueueItem = { id: string; file: File; status: QueueStatus; error?: string };

/**
 * Shared upload surface for the whole app ("תחנת העלאה" אחת).
 * Handles drag & drop, click, keyboard, multi-file, whole-folder picking,
 * size/type validation and busy state — so every upload point behaves the same.
 */
export type SmartUploadProps = {
  /** accept attribute (mime / extensions) */
  accept: string;
  /** called per selected file, sequentially */
  onFile: (file: File) => void | Promise<void>;
  busy?: boolean;
  /** default 20MB */
  maxSizeMb?: number;
  multiple?: boolean;
  /** allow picking a whole folder (desktop browsers) */
  allowFolder?: boolean;
  title?: string;
  hint?: string;
  busyLabel?: string;
  /** compact inline variant for use inside existing cards */
  compact?: boolean;
  /** label for the compact button */
  buttonLabel?: string;
  className?: string;
  disabled?: boolean;
};

export function SmartUpload({
  accept,
  onFile,
  busy = false,
  maxSizeMb = MAX_UPLOAD_MB,
  multiple = false,
  allowFolder = false,
  title = "גרור קובץ או לחץ להעלאה",
  hint,
  busyLabel = "מעלה ומנתח...",
  compact = false,
  buttonLabel = "בחר קובץ להעלאה",
  className = "",
  disabled = false,
}: SmartUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const blocked = busy || disabled || running;

  const patchItem = (id: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  /** מריץ קובץ בודד ומעדכן את הסטטוס שלו. כשל בקובץ אחד לא עוצר את התור. */
  async function runItem(item: QueueItem) {
    patchItem(item.id, { status: "uploading", error: undefined });
    const res = validateUploadFile(item.file, accept, maxSizeMb);
    if (!res.ok) {
      patchItem(item.id, { status: "error", error: res.message });
      return false;
    }
    try {
      await onFile(item.file);
      patchItem(item.id, { status: "done" });
      return true;
    } catch (e) {
      const message = e instanceof Error && e.message ? e.message : "ההעלאה נכשלה. נסה שוב.";
      patchItem(item.id, { status: "error", error: message });
      return false;
    }
  }

  async function runQueue(items: QueueItem[]) {
    setRunning(true);
    let failed = 0;
    for (const item of items) {
      const ok = await runItem(item);
      if (!ok) failed += 1;
    }
    setRunning(false);
    if (items.length > 1) {
      if (failed === 0) toast.success(`הועלו ${items.length} קבצים בהצלחה`);
      else toast.error(`${failed} מתוך ${items.length} קבצים נכשלו — אפשר לנסות שוב כל קובץ בנפרד`);
    }
  }

  async function retryItem(id: string) {
    const item = queue.find((it) => it.id === id);
    if (!item || running) return;
    setRunning(true);
    await runItem(item);
    setRunning(false);
  }

  /** בודק התאמה של קובץ בודד. quiet=true — בלי הודעה פרטנית (לבחירת תיקייה שלמה). */
  function accepted(file: File, quiet = false): boolean {
    const res = validateUploadFile(file, accept, maxSizeMb);
    if (!res.ok && !quiet) toast.error(res.message);
    return res.ok;
  }

  async function handleFiles(files: FileList | File[] | null, fromFolder = false) {
    if (!files) return;
    const all = Array.from(files);
    if (all.length === 0) {
      toast.error("לא נבחר קובץ. נסה שוב.");
      return;
    }
    // בבחירת תיקייה שלמה מסננים בשקט (בלי שורות שגיאה) ומדווחים סיכום אחד
    if (fromFolder) {
      const list = all.filter((f) => accepted(f, true));
      if (list.length === 0) {
        toast.error("לא נמצאו בתיקייה קבצים נתמכים להעלאה");
        return;
      }
      const skipped = all.length - list.length;
      if (skipped > 0) toast.info(`מעלה ${list.length} קבצים · ${skipped} דולגו (סוג או גודל לא נתמכים)`);
      const items: QueueItem[] = list.map((f, i) => ({ id: `${Date.now()}-${i}-${f.name}`, file: f, status: "pending" }));
      setQueue(items);
      await runQueue(items);
      return;
    }
    const chosen = multiple ? all : [all[0]!];
    const items: QueueItem[] = chosen.map((f, i) => ({ id: `${Date.now()}-${i}-${f.name}`, file: f, status: "pending" }));
    setQueue(items);
    // קובץ בודד — משאירים את הודעת השגיאה המיידית כדי לא לשנות התנהגות מוכרת
    if (items.length === 1) accepted(items[0]!.file);
    await runQueue(items);
  }

  const total = queue.length;
  const completed = queue.filter((it) => it.status === "done" || it.status === "error").length;
  const doneCount = queue.filter((it) => it.status === "done").length;

  const queueView = total > 0 && (
    <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-card/40 p-3" dir="rtl">
      {total > 1 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{completed} מתוך {total} הושלמו</span>
            <span>{doneCount} הצליחו</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}>
            <div className="h-full bg-primary transition-all" style={{ width: `${(completed / total) * 100}%` }} />
          </div>
        </div>
      )}
      <ul className="space-y-1">
        {queue.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-2 text-xs">
            {it.status === "pending" && <Clock className="h-4 w-4 text-muted-foreground" aria-label="ממתין" />}
            {it.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-label="מעלה" />}
            {it.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="הושלם" />}
            {it.status === "error" && <XCircle className="h-4 w-4 text-destructive" aria-label="נכשל" />}
            <span className="max-w-[16rem] truncate font-medium">{it.file.name}</span>
            {it.status === "error" && (
              <>
                <span className="text-destructive">{it.error}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2"
                  disabled={running}
                  onClick={() => void retryItem(it.id)}
                >
                  <RotateCcw className="ms-1 h-3.5 w-3.5" aria-hidden="true" /> נסה שוב
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  const inputs = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        // חשוב: להעתיק את הקבצים למערך לפני איפוס value — איפוס מרוקן את ה-FileList החי
        onChange={(e) => { const f = Array.from(e.target.files ?? []); e.currentTarget.value = ""; void handleFiles(f); }}
      />
      {allowFolder && (
        <input
          ref={folderRef}
          type="file"
          className="hidden"
          multiple
          // non-standard attributes for folder selection
          {...{ webkitdirectory: "", directory: "" }}
          onChange={(e) => { const f = Array.from(e.target.files ?? []); e.currentTarget.value = ""; void handleFiles(f, true); }}
        />
      )}
    </>
  );

  if (compact) {
    return (
      <div className={className}>
        <div className="flex flex-wrap items-center gap-2">
        {inputs}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={blocked}
          aria-label={buttonLabel}
          onClick={() => inputRef.current?.click()}
        >
          {busy
            ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> {busyLabel}</>
            : <><Upload className="ms-1 h-4 w-4" /> {buttonLabel}</>}
        </Button>
        {allowFolder && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={blocked}
            aria-label="בחר תיקייה שלמה להעלאה"
            onClick={() => folderRef.current?.click()}
          >
            תיקייה שלמה
          </Button>
        )}
        </div>
        {queueView}
      </div>
    );
  }

  return (
    <div className={className}>
      {inputs}
      <div
        role="button"
        tabIndex={0}
        aria-label={title}
        aria-busy={busy}
        onClick={() => !blocked && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !blocked) { e.preventDefault(); inputRef.current?.click(); }
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          if (!blocked) void handleFiles(e.dataTransfer.files);
        }}
        className={`flex min-h-32 sm:min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragOver ? "border-primary bg-primary/10" : "border-primary/30 hover:border-primary/60 hover:bg-primary/5"
        } ${blocked ? "opacity-60 pointer-events-none" : "cursor-pointer active:scale-[0.99]"}`}
      >
        {busy ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <span className="text-sm font-medium">{busyLabel}</span>
            <span className="text-xs text-muted-foreground">זה יכול לקחת 10–30 שניות</span>
          </>
        ) : (
          <>
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
              <ScanLine className="h-7 w-7" />
            </div>
            <div className="text-base sm:text-lg font-semibold">{title}</div>
            {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
          </>
        )}
      </div>

      <UploadLimitsInfo accept={accept} maxSizeMb={maxSizeMb} className="mt-3" />

      {queueView}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="lg"
          className="h-12 flex-1 text-base font-semibold sm:hidden"
          disabled={blocked}
          aria-label={buttonLabel}
          onClick={() => inputRef.current?.click()}
        >
          {busy
            ? <><Loader2 className="ms-1 h-5 w-5 animate-spin" /> {busyLabel}</>
            : <><Upload className="ms-1 h-5 w-5" /> {buttonLabel}</>}
        </Button>
        {allowFolder && (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-12 flex-1 text-base"
            disabled={blocked}
            aria-label="בחר תיקייה שלמה להעלאה"
            onClick={() => folderRef.current?.click()}
          >
            העלה תיקייה שלמה
          </Button>
        )}
      </div>
    </div>
  );
}