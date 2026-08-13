/**
 * יומן העלאות מקומי לספרייה.
 * כל העלאה (בודדת או מרובה) נרשמת עם סטטוס, גודל, סוג והודעת שגיאה,
 * כדי שאפשר יהיה לראות מה עלה, מה נכשל, ולהוריד מחדש קבצים שהצליחו.
 * נשמר במכשיר (localStorage) — ללא שינוי בבסיס הנתונים.
 */

export type UploadLogStatus = "success" | "error";

export type UploadLogEntry = {
  id: string;
  at: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  status: UploadLogStatus;
  error?: string;
  resourceId?: string;
  filePath?: string;
};

const KEY = "library-upload-log:v1";
const MAX_ENTRIES = 200;

function read(): UploadLogEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as UploadLogEntry[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: UploadLogEntry[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    /* אחסון מלא — היומן אינו קריטי */
  }
}

export function listUploadLog(): UploadLogEntry[] {
  return read().sort((a, b) => b.at.localeCompare(a.at));
}

export function recordUpload(entry: Omit<UploadLogEntry, "id" | "at">): UploadLogEntry {
  const full: UploadLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  write([full, ...read()]);
  return full;
}

export function clearUploadLog() {
  write([]);
}

export function removeUploadLogEntry(id: string) {
  write(read().filter((e) => e.id !== id));
}

/** תיאור גודל קריא בעברית */
export function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
