/**
 * עזרים משותפים לתצוגת מערכת השעות בכל המסכים. פונקציות טהורות, בלי גישה למסד.
 * שבוע מתחיל ביום ראשון, כמו ב-weekly_lessons.week_start.
 */
export type SchedDay = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export const DAY_KEYS: SchedDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const DAY_LABEL: Record<SchedDay, string> = {
  sun: "א׳", mon: "ב׳", tue: "ג׳", wed: "ד׳", thu: "ה׳", fri: "ו׳", sat: "שבת",
};

export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
export function parseIso(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}
export function addDaysIso(s: string, n: number): string {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
/** יום ראשון של השבוע שבו נמצא התאריך. */
export function weekStartIso(s: string): string {
  const d = parseIso(s);
  d.setDate(d.getDate() - d.getDay());
  return isoDate(d);
}
export function dayKeyOfIso(s: string): SchedDay {
  return DAY_KEYS[parseIso(s).getDay()]!;
}
/** התאריך של שיעור לפי תחילת השבוע והיום. */
export function lessonDateIso(weekStart: string, day: string): string {
  const i = DAY_KEYS.indexOf(day as SchedDay);
  return addDaysIso(weekStart, i < 0 ? 0 : i);
}
export function hhmm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export type ScheduleClosure = { start_date: string; end_date: string; type: string; label: string | null };

/** סוגי חריגים שאומרים "אין לימודים". שאר הסוגים (שעת התחלה/סיום, יום נוסף) משנים שעות בלבד. */
export const NO_SCHOOL_TYPES = ["institution_break", "unexpected_closure", "holiday"];
export const CLOSURE_LABEL: Record<string, string> = {
  institution_break: "חופשה",
  unexpected_closure: "סגירה",
  holiday: "חג",
};

export function closureFor(date: string, closures: ScheduleClosure[]): ScheduleClosure | null {
  return closures.find((c) => NO_SCHOOL_TYPES.includes(c.type) && c.start_date <= date && date <= c.end_date) ?? null;
}
export function closureText(c: ScheduleClosure): string {
  return c.label?.trim() || CLOSURE_LABEL[c.type] || "אין לימודים";
}
/** שם השיעור להצגה: מקצוע, ובהיעדרו הכותרת. */
export function lessonName(l: { subject: string | null; title: string }): string {
  return (l.subject ?? "").trim() || (l.title ?? "").trim();
}
