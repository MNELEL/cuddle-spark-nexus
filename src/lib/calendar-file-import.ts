/**
 * קריאת תאריכי הלוח העברי מקובץ Excel של הכיתה: שם התלמיד,
 * תאריך תחילת הלימוד ("תאריך-החלוף") ותאריך הלידה — במקום הזנה ידנית.
 * הלוגיקה נפרדת מה-UI כדי שאפשר לבדוק אותה עם קובץ אמיתי.
 */
import { buildRosterStudents, guessMapping, parseRosterDate } from "./roster-import";

export type CalendarFileRow = {
  name: string;
  /** תאריך-החלוף (ISO) — היום שממנו מודדים. */
  start_date: string | null;
  birth_date: string | null;
};

/** ממיר שורות גולמיות של גיליון לשורות לוח (רק שורות עם תאריך אחד לפחות). */
export function readCalendarRows(rows: Record<string, unknown>[]): CalendarFileRow[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0] ?? {});
  const mapping = guessMapping(headers);
  const { students } = buildRosterStudents(rows, mapping);
  return students
    .map((s) => ({ name: s.name, start_date: s.start_date, birth_date: s.birth_date }))
    .filter((r) => r.start_date || r.birth_date);
}

/* ---------------- תיעוד יומי מתוך הקובץ (נוכחות, ציון והערה) ---------------- */

export type DailyLogFileRow = {
  name: string;
  /** התאריך שאליו משויך התיעוד (ISO). */
  date: string;
  status: "present" | "absent" | "late" | "excused" | null;
  grade: number | null;
  subject: string;
  note: string;
};

const STATUS_MAP: Record<string, DailyLogFileRow["status"]> = {
  present: "present", absent: "absent", late: "late", excused: "excused",
  "נוכח": "present", "נוכחת": "present", "הגיע": "present", "כן": "present", "v": "present",
  "נעדר": "absent", "חסר": "absent", "לא נוכח": "absent", "לא": "absent",
  "איחור": "late", "איחר": "late",
  "מאושר": "excused", "מוצדק": "excused",
};

/** מאתר עמודה לפי התאמה מדויקת ואז הכלה, בלי לתפוס עמודה שכבר שויכה. */
function findHeader(headers: string[], keys: string[], used: Set<string>): string | undefined {
  const free = headers.filter((h) => !used.has(h));
  const norm = (h: string) => h.trim().toLowerCase();
  const exact = free.find((h) => keys.some((k) => norm(h) === k));
  const hit = exact ?? free.find((h) => keys.some((k) => norm(h).includes(k)));
  if (hit) used.add(hit);
  return hit;
}

/**
 * קורא שורות תיעוד יומי מגיליון: שם התלמיד, תאריך, נוכחות, ציון והערת תיעוד.
 * שורה בלי שם, או בלי שום נתון תיעוד, מדולגת. תאריך חסר נופל לתאריך ברירת המחדל.
 */
export function readDailyLogRows(
  rows: Record<string, unknown>[],
  fallbackDate: string,
): DailyLogFileRow[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0] ?? {});
  const used = new Set<string>();
  const nameH = findHeader(headers, ["שם מלא", "שם התלמיד", "שם", "name", "student"], used);
  const dateH = findHeader(headers, ["תאריך תיעוד", "תאריך", "date"], used);
  const statusH = findHeader(headers, ["נוכחות", "סטטוס", "attendance", "status"], used);
  const gradeH = findHeader(headers, ["ציון", "grade", "score"], used);
  const subjectH = findHeader(headers, ["מקצוע", "נושא", "subject"], used);
  const noteH = findHeader(headers, ["תיעוד", "הערה", "הערות", "סיכום", "note", "comment"], used);
  if (!nameH) return [];


  const out: DailyLogFileRow[] = [];
  for (const row of rows) {
    const name = String(row[nameH] ?? "").trim();
    if (!name) continue;
    const date = (dateH ? parseRosterDate(row[dateH]) : null) ?? fallbackDate;
    const rawStatus = statusH ? String(row[statusH] ?? "").trim().toLowerCase() : "";
    const status = rawStatus ? (STATUS_MAP[rawStatus] ?? null) : null;
    const rawGrade = gradeH ? String(row[gradeH] ?? "").trim().replace("%", "") : "";
    const num = rawGrade ? Number(rawGrade) : NaN;
    const grade = Number.isFinite(num) && num >= 0 && num <= 100 ? num : null;
    const note = noteH ? String(row[noteH] ?? "").trim().slice(0, 2000) : "";
    if (!status && grade === null && !note) continue;
    out.push({
      name,
      date,
      status,
      grade,
      subject: subjectH ? String(row[subjectH] ?? "").trim().slice(0, 60) : "",
      note,
    });
  }
  return out;
}

