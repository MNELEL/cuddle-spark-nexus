import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Folder, FolderOpen, File, Loader2, ChevronLeft, AlertTriangle } from "lucide-react";
import { listDriveFolder, importDriveFile, type DriveImportResult } from "@/lib/drive.functions";
import type { DriveFile } from "@/lib/drive.server";
import { isGoogleCloudFile } from "@/lib/drive.server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ROOT = { id: "root", name: "הדרייב שלי" };

export type DriveItemState = {
  file: DriveFile;
  status: "pending" | "importing" | "done" | "duplicate" | "error";
  note?: string;
  targetName: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  subject: string;
  resourceType: string;
  onComplete?: (importedCount: number) => void;
};

/**
 * בורר תיקיות Google Drive: ניווט לתוך תיקיות, פירורי לחם של הנתיב,
 * ו"ייבא הכל מכאן" — ייבוא מרובה עם התקדמות ועמידות לשגיאה קובץ-קובץ.
 */
export function GoogleDrivePicker({ open, onClose, subject, resourceType, onComplete }: Props) {
  const listFn = useServerFn(listDriveFolder);
  const importFn = useServerFn(importDriveFile);

  const [path, setPath] = useState<{ id: string; name: string }[]>([ROOT]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [folders, setFolders] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<DriveItemState[]>([]);
  const [running, setRunning] = useState(false);
  const [currentName, setCurrentName] = useState<string | null>(null);

  const currentFolder = path[path.length - 1];

  const load = useCallback(
    async (folderId: string) => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await listFn({ data: { folderId } });
        if (res.error) {
          setLoadError(res.error);
          setFiles([]);
          setFolders([]);
        } else {
          setFiles(res.files);
          setFolders(res.folders);
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "טעינת התיקייה נכשלה");
        setFiles([]);
        setFolders([]);
      } finally {
        setLoading(false);
      }
    },
    [listFn],
  );

  useEffect(() => {
    if (open) {
      setItems([]);
      setPath([ROOT]);
      void load("root");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openFolder = (f: DriveFile) => {
    setPath((prev) => [...prev, { id: f.id, name: f.name }]);
    void load(f.id);
  };
  const goTo = (i: number) => {
    const next = path.slice(0, i + 1);
    setPath(next);
    void load(next[next.length - 1].id);
  };

  const targetName = (f: DriveFile) =>
    isGoogleCloudFile(f.mimeType) ? f.name.replace(/\.[^.]+$/, "") + " (ייצוא)" : f.name;

  const runImport = async (filesToImport: DriveFile[]) => {
    if (filesToImport.length === 0) {
      toast.info("אין קבצים בתיקייה הזו");
      return;
    }
    setItems(
      filesToImport.map((file) => ({ file, status: "pending" as const, targetName: targetName(file) })),
    );
    setRunning(true);
    let ok = 0;
    let duplicates = 0;
    const failed: number[] = [];
    for (let i = 0; i < filesToImport.length; i++) {
      const f = filesToImport[i];
      setCurrentName(f.name);
      setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "importing" } : it)));
      try {
        const res: DriveImportResult = await importFn({
          data: { file: { id: f.id, name: f.name, mimeType: f.mimeType }, subject, resourceType },
        });
        if (!res.ok) {
          failed.push(i);
          setItems((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, status: "error", note: res.error ?? "נכשל" } : it)),
          );
          continue;
        }
        if (res.duplicateId) {
          duplicates++;
          setItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? { ...it, status: "duplicate", note: `כבר קיים בספרייה: "${res.duplicateTitle}"` }
                : it,
            ),
          );
        } else {
          ok++;
          setItems((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, status: "done", note: "נשמר בספרייה" } : it)),
          );
        }
      } catch (e) {
        failed.push(i);
        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "error", note: e instanceof Error ? e.message : "נכשל" } : it,
          ),
        );
      }
    }
    setRunning(false);
    setCurrentName(null);
    onComplete?.(ok);
    if (failed.length === 0) {
      toast.success(`יובאו ${ok} קבצים מ-Google Drive${duplicates ? ` · ${duplicates} כבר קיימים` : ""}`);
    } else {
      toast.error(`${failed.length} קבצים נכשלו — לא עצר את שאר הייבוא`);
    }
  };

  const retryFailed = () => {
    const failedFiles = items
      .filter((it) => it.status === "error")
      .map((it) => it.file);
    if (failedFiles.length > 0) void runImport(failedFiles);
  };

  return (
    <div className="space-y-3">
      {/* פירורי לחם */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        {path.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1">
            {i > 0 && <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
            <button
              type="button"
              onClick={() => goTo(i)}
              disabled={i === path.length - 1}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition ${
                i === path.length - 1 ? "font-semibold text-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {i === 0 && <Folder className="h-3.5 w-3.5" aria-hidden="true" />}
              {p.name}
            </button>
          </span>
        ))}
      </div>

      {running && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-amber" aria-hidden="true" />
          מייבא: <span className="font-medium">{currentName ?? "..."}</span>
        </div>
      )}

      {/* רשימת תיקיות */}
      {!running && (folders.length > 0 || loadError) && (
        <div className="rounded-xl border">
          {loadError ? (
            <div className="flex items-center gap-2 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> {loadError}
            </div>
          ) : (
            <ul className="divide-y">
              {folders.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => openFolder(f)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-muted/50"
                  >
                    <FolderOpen className="h-4 w-4 text-amber" aria-hidden="true" /> {f.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* קבצים בתיקייה הנוכחית */}
      {!running && (
        <div className="rounded-xl border">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> טוען תיקייה...
            </div>
          ) : files.length === 0 && !loadError ? (
            <p className="p-4 text-sm text-muted-foreground">התיקייה ריקה.</p>
          ) : (
            <ul className="max-h-60 divide-y overflow-y-auto">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <File className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{targetName(f)}</span>
                    {isGoogleCloudFile(f.mimeType) && (
                      <Badge variant="secondary" className="shrink-0">ייצוא</Badge>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* מצב ייבוא לכל קובץ */}
      {items.length > 0 && !loading && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            התקדמות הייבוא · {items.filter((it) => it.status === "done" || it.status === "duplicate").length} מתוך {items.length}
          </p>
          <ul className="max-h-56 space-y-1 overflow-y-auto pr-1 text-sm">
            {items.map((it, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  {it.status === "importing" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber" aria-hidden="true" />}
                  {it.status === "done" && <span className="shrink-0 text-emerald-600">✓</span>}
                  {it.status === "duplicate" && <span className="shrink-0 text-sky-600">↺</span>}
                  {it.status === "error" && <span className="shrink-0 text-destructive">✕</span>}
                  {it.status === "pending" && <span className="shrink-0 text-muted-foreground">·</span>}
                  <span className="truncate">{it.targetName}</span>
                </span>
                {it.note && <span className="shrink-0 text-xs text-muted-foreground">{it.note}</span>}
              </li>
            ))}
          </ul>
          {items.some((it) => it.status === "error") && !running && (
            <Button variant="outline" size="sm" onClick={retryFailed}>
              נסה שוב את הכשלים
            </Button>
          )}
        </div>
      )}

      {/* פעולות */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={running}>
          סגור
        </Button>
        <Button disabled={running || loading || !!loadError} onClick={() => void runImport(files)}>
          {running ? (
            <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FolderOpen className="ms-1 h-4 w-4" aria-hidden="true" />
          )}
          ייבא הכל מכאן ({files.length})
        </Button>
      </div>
    </div>
  );
}
