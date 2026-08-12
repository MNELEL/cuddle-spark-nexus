/**
 * ולידציית קבצים אחת לכל המערכת.
 * כל נקודת העלאה (ingest, ספרייה, ציונים, תעודות) משתמשת באותן רשימות MIME
 * ובאותן הודעות שגיאה בעברית, כדי שלא ייווצר פער בין ה-accept של הדפדפן
 * לבין הבדיקה בקוד.
 */

/** גודל מקסימלי ברירת מחדל, מסונכרן עם המגבלה בצד השרת */
export const MAX_UPLOAD_MB = 20;

const IMAGE = ["image/*"];
const AUDIO = ["audio/*"];
const VIDEO = ["video/*"];
const PDF = ["application/pdf", ".pdf"];
const TEXT = ["text/plain", "text/markdown", ".txt", ".md", ".rtf", "application/rtf", "text/rtf"];
const CSV = ["text/csv", "application/csv", ".csv"];
const EXCEL = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls",
  ".xlsx",
];
const WORD = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc",
  ".docx",
];
const SLIDES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".ppt",
  ".pptx",
];

const join = (...groups: string[][]) => Array.from(new Set(groups.flat())).join(",");

/** רשימת תלמידים: תמונה/PDF/גיליון/טקסט */
export const ACCEPT_ROSTER = join(IMAGE, PDF, CSV, EXCEL, TEXT);
/** חומר לימוד: תמונה/PDF/טקסט/Word/גיליון/מצגת */
export const ACCEPT_RESOURCE = join(IMAGE, PDF, TEXT, WORD, EXCEL, SLIDES);
/** הקלטת שיעור */
export const ACCEPT_AUDIO = join(AUDIO);
/** תמונות בלבד (ייבוא ציונים, לוגו בתעודות) */
export const ACCEPT_IMAGE = join(IMAGE);
/** כל סוגי הקבצים שהספרייה מקבלת */
export const ACCEPT_LIBRARY_ALL = join(IMAGE, AUDIO, VIDEO, PDF, TEXT, WORD, EXCEL, SLIDES);
/** העלאה חכמה ב-/ingest: ה-AI מזהה לבד אם זו רשימה או חומר לימוד */
export const ACCEPT_SMART = join(IMAGE, PDF, TEXT, WORD, EXCEL, CSV, SLIDES);
/** ייבוא/ייצוא רשימות: Excel ו-CSV */
export const ACCEPT_SPREADSHEET = join(EXCEL, CSV);
/** לוגו מוסד — PNG/JPEG בלבד */
export const ACCEPT_LOGO = "image/png,image/jpeg,.png,.jpg,.jpeg";
/** גודל מקסימלי ללוגו (KB) */
export const MAX_LOGO_KB = 500;

/** סינון לפי קבוצה בממשק ההעלאה של הספרייה */
export const LIBRARY_KIND_ACCEPT = {
  pdf: join(PDF),
  word: join(WORD, TEXT),
  audio: join(AUDIO),
  record: join(AUDIO),
  video: join(VIDEO),
  slides: join(SLIDES),
  image: join(IMAGE),
  other: ACCEPT_LIBRARY_ALL,
} as const;

export type LibraryKindId = keyof typeof LIBRARY_KIND_ACCEPT;

/** תיאור קריא בעברית של הסוגים שמותר להעלות, לשימוש בהודעות שגיאה */
export function describeAccept(accept: string): string {
  const rules = accept.toLowerCase();
  const parts: string[] = [];
  if (rules.includes("image/")) parts.push("תמונה");
  if (rules.includes("application/pdf") || rules.includes(".pdf")) parts.push("PDF");
  if (rules.includes("wordprocessingml") || rules.includes("msword")) parts.push("Word");
  if (rules.includes("spreadsheetml") || rules.includes(".xlsx") || rules.includes(".csv")) parts.push("גיליון (Excel/CSV)");
  if (rules.includes("presentationml") || rules.includes(".pptx")) parts.push("מצגת");
  if (rules.includes(".txt") || rules.includes("text/plain")) parts.push("טקסט");
  if (rules.includes("audio/")) parts.push("אודיו");
  if (rules.includes("video/")) parts.push("סרטון");
  return parts.join(", ");
}

export type UploadValidation = { ok: true } | { ok: false; message: string };

/** בודק סוג וגודל של קובץ בודד ומחזיר הודעת שגיאה בעברית */
export function validateUploadFile(
  file: File,
  accept: string,
  maxSizeMb: number = MAX_UPLOAD_MB,
): UploadValidation {
  if (file.size === 0) {
    return { ok: false, message: `הקובץ "${file.name}" ריק — בחר קובץ אחר` };
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return { ok: false, message: `הקובץ "${file.name}" במשקל ${sizeMb}MB — המקסימום הוא ${maxSizeMb}MB` };
  }
  const rules = accept.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (rules.length === 0) return { ok: true };
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  const ok = rules.some((r) => {
    if (r === "*/*" || r === "*") return true;
    if (r.startsWith(".")) return name.endsWith(r);
    if (r.endsWith("/*")) return type.startsWith(r.slice(0, -1));
    return type === r;
  });
  if (ok) return { ok: true };
  const allowed = describeAccept(accept);
  return {
    ok: false,
    message: allowed
      ? `סוג הקובץ "${file.name}" אינו נתמך. אפשר להעלות: ${allowed}`
      : `סוג הקובץ "${file.name}" אינו נתמך`,
  };
}
