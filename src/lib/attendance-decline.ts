/**
 * זיהוי ירידת נוכחות של תלמיד — לוגיקה טהורה, בלי גישה לשרת,
 * כדי שאפשר לכסות אותה בבדיקות אוטומטיות.
 *
 * יחס נוכחות = (present + late) מתוך כל רשומות הנוכחות בחלון.
 */

export type AttendanceStatus = "present" | "absent" | "late" | "excused" | string;

/** מינימום ימי רישום בחלון הקצר כדי שהשוואה תהיה משמעותית. */
export const MIN_RECENT_RECORDS = 3;
/** ירידה מינימלית בנקודות אחוז שמייצרת התראה. */
export const DECLINE_THRESHOLD_POINTS = 25;
/** מעל הירידה הזו ההתראה נחשבת חמורה. */
export const HIGH_SEVERITY_POINTS = 50;

export type AttendanceDecline = {
  severity: "medium" | "high";
  /** אחוז נוכחות ב-7 הימים האחרונים, מעוגל. */
  recentPercent: number;
  /** אחוז נוכחות ב-30 הימים שלפניהם, מעוגל. */
  basePercent: number;
  /** גודל הירידה בנקודות אחוז, מעוגל. */
  dropPoints: number;
  recentCount: number;
  baseCount: number;
};

/** יחס נוכחות (0-1) של רשימת רשומות. null כשאין רשומות בכלל. */
export function attendanceRate(statuses: AttendanceStatus[]): number | null {
  if (statuses.length === 0) return null;
  const good = statuses.filter((s) => s === "present" || s === "late").length;
  return good / statuses.length;
}

/**
 * מחזיר תיאור ירידה כשהתנאים מתקיימים, ואחרת null.
 * recent = החלון הקצר (7 ימים) · base = חלון הבסיס (30 הימים שלפניו).
 */
export function evaluateAttendanceDecline(
  recent: AttendanceStatus[],
  base: AttendanceStatus[],
): AttendanceDecline | null {
  if (recent.length < MIN_RECENT_RECORDS) return null;
  const recentRate = attendanceRate(recent);
  const baseRate = attendanceRate(base);
  if (recentRate === null || baseRate === null) return null;

  const drop = (baseRate - recentRate) * 100;
  if (drop < DECLINE_THRESHOLD_POINTS) return null;

  return {
    severity: drop > HIGH_SEVERITY_POINTS ? "high" : "medium",
    recentPercent: Math.round(recentRate * 100),
    basePercent: Math.round(baseRate * 100),
    dropPoints: Math.round(drop),
    recentCount: recent.length,
    baseCount: base.length,
  };
}

/** תיאור בעברית של הירידה, לשימוש בכרטיס התובנה. */
export function describeDecline(d: AttendanceDecline): string {
  return (
    `הנוכחות ירדה מ-${d.basePercent}% ל-${d.recentPercent}% בשבוע האחרון ` +
    `(ירידה של ${d.dropPoints} נקודות אחוז, על בסיס ${d.recentCount} ימי רישום בשבוע האחרון ` +
    `ו-${d.baseCount} ימי רישום בחודש שלפניו).`
  );
}
