/**
 * סיגנלים של "נתונים חסרים" ברמת הכיתה — לוגיקה טהורה,
 * בלי גישה לשרת, כדי שאפשר לכסות אותה בבדיקות אוטומטיות.
 */

export type Severity = "medium" | "high";

/** מספר ימים בלי רישום נוכחות שמייצר התראה. */
export const ATTENDANCE_GAP_DAYS = 3;
/** מעל זה ההתראה נחשבת חמורה. */
export const ATTENDANCE_GAP_HIGH = 7;
/** מספר ימים בלי רישום ציונים שמייצר התראה. */
export const GRADES_GAP_DAYS = 14;
/** מעל זה ההתראה נחשבת חמורה. */
export const GRADES_GAP_HIGH = 30;
/** מספר ימים בלי עלון שבועי שפורסם שמייצר התראה. */
export const BULLETIN_GAP_DAYS = 10;
/** מעל זה ההתראה נחשבת חמורה. */
export const BULLETIN_GAP_HIGH = 21;

export type DataGap = {
  severity: Severity;
  /** מספר ימים מאז הרישום האחרון. null כשאין רישום בכלל. */
  days: number | null;
  lastDate: string | null;
};

/** מספר ימים שלמים בין תאריך (YYYY-MM-DD) לתאריך ההתייחסות. */
export function daysSince(date: string, today: string): number {
  const a = Date.parse(`${date}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** התאריך המקסימלי ברשימה, או null כשהרשימה ריקה. */
export function latestDate(dates: string[]): string | null {
  const valid = dates.filter((d) => typeof d === "string" && d.length >= 10);
  if (valid.length === 0) return null;
  return valid.reduce((max, d) => (d > max ? d : max));
}

/**
 * בודק פער רישום כללי: מתי היה הרישום האחרון, ומה החומרה.
 * כשאין רישום בכלל — התראה חמורה עם days=null.
 */
export function evaluateGap(
  dates: string[],
  today: string,
  threshold: number,
  highThreshold: number,
): DataGap | null {
  const last = latestDate(dates);
  if (!last) return { severity: "high", days: null, lastDate: null };
  const days = daysSince(last, today);
  if (days < threshold) return null;
  return { severity: days >= highThreshold ? "high" : "medium", days, lastDate: last };
}

export function evaluateAttendanceGap(dates: string[], today: string): DataGap | null {
  return evaluateGap(dates, today, ATTENDANCE_GAP_DAYS, ATTENDANCE_GAP_HIGH);
}

export function evaluateGradesGap(dates: string[], today: string): DataGap | null {
  return evaluateGap(dates, today, GRADES_GAP_DAYS, GRADES_GAP_HIGH);
}

export function evaluateBulletinGap(dates: string[], today: string): DataGap | null {
  return evaluateGap(dates, today, BULLETIN_GAP_DAYS, BULLETIN_GAP_HIGH);
}

/** תיאור בעברית של פער רישום. label לדוגמה: "נוכחות". */
export function describeGap(gap: DataGap, label: string): string {
  if (gap.days === null) return `לא נמצא שום רישום ${label} בכיתה הזו בתקופה שנסרקה.`;
  return `הרישום האחרון של ${label} היה לפני ${gap.days} ימים (${gap.lastDate}).`;
}
