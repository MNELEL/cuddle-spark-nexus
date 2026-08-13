import { FileCheck2, HardDrive } from "lucide-react";
import { MAX_UPLOAD_MB, describeAcceptDetailed } from "@/lib/upload-accept";

/**
 * מציג בבירור מה מותר להעלות — סוגי קבצים ומגבלת גודל.
 * כל המידע נגזר מהמקור המרכזי src/lib/upload-accept.ts (בלי שכפול רשימות).
 */
export function UploadLimitsInfo({
  accept,
  maxSizeMb = MAX_UPLOAD_MB,
  className = "",
}: {
  accept: string;
  maxSizeMb?: number;
  className?: string;
}) {
  const kinds = describeAcceptDetailed(accept);
  return (
    <div className={`flex flex-wrap items-center justify-center gap-1.5 text-xs ${className}`} dir="rtl">
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
        סוגי קבצים מותרים:
      </span>
      {kinds.length > 0 ? (
        kinds.map((k) => (
          <span key={k} className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 font-medium">
            {k}
          </span>
        ))
      ) : (
        <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 font-medium">כל סוג קובץ</span>
      )}
      <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 font-medium">
        <HardDrive className="h-3.5 w-3.5" aria-hidden="true" />
        עד {maxSizeMb}MB לקובץ
      </span>
    </div>
  );
}