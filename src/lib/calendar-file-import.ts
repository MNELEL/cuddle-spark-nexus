/**
 * קריאת תאריכי הלוח העברי מקובץ Excel של הכיתה: שם התלמיד,
 * תאריך תחילת הלימוד ("תאריך-החלוף") ותאריך הלידה — במקום הזנה ידנית.
 * הלוגיקה נפרדת מה-UI כדי שאפשר לבדוק אותה עם קובץ אמיתי.
 */
import { buildRosterStudents, guessMapping } from "./roster-import";

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

/** קורא את הגיליון הראשון בחוברת עבודה של xlsx. */
export function readCalendarRowsFromWorkbook(wb: {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}): CalendarFileRow[] {
  const first = wb.SheetNames[0];
  if (!first) return [];
  // ייבוא דינמי נמנע כאן — הקורא מעביר חוברת שכבר נקראה.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const utils = (wb.__utils ?? null) as null;
  void utils;
  throw new Error("use readCalendarRows with sheet json");
}
