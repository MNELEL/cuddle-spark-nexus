/**
 * זיהוי ירידה בציונים של תלמיד — לוגיקה טהורה, בלי גישה לשרת,
 * כדי שאפשר לכסות אותה בבדיקות אוטומטיות.
 *
 * הציון מנורמל לאחוזים: value / max_value * 100.
 */

export type GradeRecord = { value: number; max_value: number | null; date: string };

/** מינימום ציונים בחלון הקצר כדי שהשוואה תהיה משמעותית. */
export const MIN_RECENT_GRADES = 2;
/** ירידה מינימלית בנקודות אחוז שמייצרת התראה. */
export const GRADE_DECLINE_THRESHOLD = 10;
/** מעל הירידה הזו ההתראה נחשבת חמורה. */
export const GRADE_HIGH_SEVERITY = 20;

export type GradeDecline = {
  severity: "medium" | "high";
  recentAvg: number;
  baseAvg: number;
  dropPoints: number;
  recentCount: number;
  baseCount: number;
};

/** ממוצע באחוזים של רשימת ציונים. null כשאין ציונים תקינים. */
export function gradeAverage(rows: GradeRecord[]): number | null {
  const pct = rows
    .map((r) => {
      const max = r.max_value && r.max_value > 0 ? r.max_value : 100;
      return (r.value / max) * 100;
    })
    .filter((n) => Number.isFinite(n));
  if (pct.length === 0) return null;
  return pct.reduce((a, b) => a + b, 0) / pct.length;
}

/**
 * מחזיר תיאור ירידה כשהתנאים מתקיימים, ואחרת null.
 * recent = החלון הקצר · base = חלון הבסיס שלפניו.
 */
export function evaluateGradeDecline(
  recent: GradeRecord[],
  base: GradeRecord[],
): GradeDecline | null {
  if (recent.length < MIN_RECENT_GRADES) return null;
  const recentAvg = gradeAverage(recent);
  const baseAvg = gradeAverage(base);
  if (recentAvg === null || baseAvg === null) return null;

  const drop = baseAvg - recentAvg;
  if (drop < GRADE_DECLINE_THRESHOLD) return null;

  return {
    severity: drop > GRADE_HIGH_SEVERITY ? "high" : "medium",
    recentAvg: Math.round(recentAvg),
    baseAvg: Math.round(baseAvg),
    dropPoints: Math.round(drop),
    recentCount: recent.length,
    baseCount: base.length,
  };
}

/** תיאור בעברית של ירידת הציונים, לשימוש בכרטיס התובנה. */
export function describeGradeDecline(d: GradeDecline): string {
  return (
    `הממוצע ירד מ-${d.baseAvg}% ל-${d.recentAvg}% (ירידה של ${d.dropPoints} נקודות אחוז), ` +
    `על בסיס ${d.recentCount} ציונים אחרונים מול ${d.baseCount} ציונים קודמים.`
  );
}
