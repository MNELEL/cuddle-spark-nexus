/**
 * גישה ל-Google Drive דרך ה-gateway של המחברים — תבנית זהה לקוד Google Sheets
 * הקיים (src/lib/sheets-export.server.ts). הרשאות נקראות מ-process.env בלבד
 * בתוך ה-handler, לעולם לא נחשפות לדפדפן.
 */

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string | null;
  modifiedTime?: string | null;
};

export type DriveFolderListing = {
  files: DriveFile[];
  folders: DriveFile[];
  error?: string;
};

/** גוגל Docs/Sheets/Slides הם מסמכי cloud ללא תוכן בינארי ישיר — מייצאים אותם. */
const GOOGLE_EXPORT: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": { mime: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.presentation": { mime: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.spreadsheet": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
};

/** פיצול תגובת files.list לתיקיות וקבצים + מפת MIME של Google ליעד הייצוא. */
export function partitionDriveFiles(
  raw: Array<{ id: string; name: string; mimeType: string; size?: string | null; modifiedTime?: string | null }> = [],
): DriveFolderListing {
  const folders: DriveFile[] = [];
  const files: DriveFile[] = [];
  for (const f of raw) {
    const item: DriveFile = {
      id: f.id,
      name: f.name ?? "",
      mimeType: f.mimeType ?? "",
      size: f.size ?? null,
      modifiedTime: f.modifiedTime ?? null,
    };
    if (f.mimeType === "application/vnd.google-apps.folder") folders.push(item);
    else files.push(item);
  }
  // תיקיות קודם, אחר כך קבצים — במיון אלפביתי ליציבות
  folders.sort((a, b) => a.name.localeCompare(b.name, "he"));
  files.sort((a, b) => a.name.localeCompare(b.name, "he"));
  return { files, folders };
}

/** השם שיישמר בספרייה, כולל סיומת מתאימה לקבצי Google שמייצאים. */
export function driveFileName(f: DriveFile): string {
  const exportTarget = GOOGLE_EXPORT[f.mimeType];
  if (exportTarget) {
    const base = f.name.replace(/\.[^.]+$/, "") || "מסמך";
    return `${base}.${exportTarget.ext}`;
  }
  return f.name || "file";
}

/** ה-MIME הסופי אחרי ייצוא (או ה-MIME המקורי לקובץ רגיל). */
export function driveFileMime(f: DriveFile): string {
  return GOOGLE_EXPORT[f.mimeType]?.mime ?? f.mimeType ?? "";
}

export function isGoogleCloudFile(mimeType: string): boolean {
  return mimeType.startsWith("application/vnd.google-apps.") && mimeType !== "application/vnd.google-apps.folder";
}

type DriveGateway = {
  base: string;
  headers: Record<string, string>;
};

function openGateway(): DriveGateway {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !connectionKey) throw new Error("חיבור Google Drive אינו מוגדר במערכת");
  return {
    base: "https://connector-gateway.lovable.dev/google_drive/drive/v3",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      "Content-Type": "application/json",
    },
  };
}

/** רשימת קבצים ותיקיות בתוך תיקייה — 'root' הוא תיקיית הבסיס. */
export async function driveListFolder(folderId: string): Promise<DriveFolderListing> {
  const gw = openGateway();
  const query = `'${folderId}' in parents and trashed=false`;
  const url = `${gw.base}/files?q=${encodeURIComponent(query)}&pageSize=1000&fields=files(id,name,mimeType,size,modifiedTime)`;
  const res = await fetch(url, { method: "GET", headers: gw.headers });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[Drive list ${res.status}]`, text);
    if (res.status === 401 || res.status === 403) return { files: [], folders: [], error: "אין הרשאה ל-Google Drive. יש לחבר מחדש את החיבור." };
    return { files: [], folders: [], error: "טעינת התיקייה מ-Google Drive נכשלה." };
  }
  let json: { files?: unknown };
  try {
    json = JSON.parse(text);
  } catch {
    return { files: [], folders: [], error: "תגובה לא תקינה מ-Google Drive." };
  }
  return partitionDriveFiles((json.files ?? []) as DriveFolderListing["files"]);
}

/** הורדת תוכן קובץ (או ייצוא של מסמך Google) — מחזיר את הבייטים + שם + MIME. */
export async function driveDownloadFile(f: DriveFile): Promise<{ bytes: ArrayBuffer; name: string; mime: string }> {
  const gw = openGateway();
  const target = GOOGLE_EXPORT[f.mimeType];
  let url: string;
  if (target) {
    url = `${gw.base}/files/${f.id}/export?mimeType=${encodeURIComponent(target.mime)}`;
  } else {
    url = `${gw.base}/files/${f.id}?alt=media`;
  }
  const res = await fetch(url, { method: "GET", headers: gw.headers });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[Drive download ${res.status}]`, text);
    throw new Error(`הורדת "${f.name}" מ-Google Drive נכשלה.`);
  }
  return {
    bytes: await res.arrayBuffer(),
    name: driveFileName(f),
    mime: driveFileMime(f),
  };
}
