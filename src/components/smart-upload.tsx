import { useRef, useState } from "react";
import { Loader2, ScanLine, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
  maxSizeMb = 20,
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
  const blocked = busy || disabled;

  function accepted(file: File): boolean {
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`הקובץ "${file.name}" גדול מ-${maxSizeMb}MB`);
      return false;
    }
    const rules = accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (rules.length === 0) return true;
    const name = file.name.toLowerCase();
    const type = (file.type || "").toLowerCase();
    const ok = rules.some((r) => {
      if (r === "*/*" || r === "*") return true;
      if (r.startsWith(".")) return name.endsWith(r);
      if (r.endsWith("/*")) return type.startsWith(r.slice(0, -1));
      return type === r;
    });
    if (!ok) toast.error(`סוג הקובץ "${file.name}" אינו נתמך`);
    return ok;
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (!files) return;
    const list = Array.from(files).filter(accepted);
    if (list.length === 0) return;
    for (const f of multiple ? list : [list[0]!]) {
      await onFile(f);
    }
  }

  const hintText = hint ?? `עד ${maxSizeMb}MB לכל קובץ`;

  const inputs = (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => { const f = e.target.files; e.currentTarget.value = ""; void handleFiles(f); }}
      />
      {allowFolder && (
        <input
          ref={folderRef}
          type="file"
          className="hidden"
          multiple
          // non-standard attributes for folder selection
          {...{ webkitdirectory: "", directory: "" }}
          onChange={(e) => { const f = e.target.files; e.currentTarget.value = ""; void handleFiles(f); }}
        />
      )}
    </>
  );

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
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
            <div className="text-xs text-muted-foreground">{hintText}</div>
          </>
        )}
      </div>

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