/**
 * סיגנלים של התנהגות ומשמעת — לוגיקה טהורה, בלי גישה לשרת,
 * כדי שאפשר לכסות אותה בבדיקות אוטומטיות.
 */

export type BehaviorRecord = { points: number; date: string };

/** מינימום רשומות בחלון הקצר כדי שהשוואה תהיה משמעותית. */
export const MIN_RECENT_BEHAVIOR = 2;
/** ירידה מינימלית בממוצע הנקודות לרשומה שמייצרת התראה. */
export const BEHAVIOR_DECLINE_THRESHOLD = 1.5;
/** מעל הירידה הזו ההתראה נחשבת חמורה. */
export const BEHAVIOR_HIGH_SEVERITY = 3;

export type BehaviorDecline = {
  severity: "medium" | "high";
  recentAvg: number;
  baseAvg: number;
  drop: number;
  recentCount: number;
  baseCount: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** ממוצע נקודות התנהגות לרשומה. null כשאין רשומות. */
export function behaviorAverage(rows: BehaviorRecord[]): number | null {
  const nums = rows.map((r) => r.points).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** ירידה בממוצע נקודות ההתנהגות בין החלון הקצר לחלון הבסיס. */
export function evaluateBehaviorDecline(
  recent: BehaviorRecord[],
  base: BehaviorRecord[],
): BehaviorDecline | null {
  if (recent.length < MIN_RECENT_BEHAVIOR) return null;
  const recentAvg = behaviorAverage(recent);
  const baseAvg = behaviorAverage(base);
  if (recentAvg === null || baseAvg === null) return null;

  const drop = baseAvg - recentAvg;
  if (drop < BEHAVIOR_DECLINE_THRESHOLD) return null;

  return {
    severity: drop > BEHAVIOR_HIGH_SEVERITY ? "high" : "medium",
    recentAvg: round1(recentAvg),
    baseAvg: round1(baseAvg),
    drop: round1(drop),
    recentCount: recent.length,
    baseCount: base.length,
  };
}

/** תיאור בעברית של ירידת ההתנהגות. */
export function describeBehaviorDecline(d: BehaviorDecline): string {
  return (
    `ממוצע נקודות ההתנהגות ירד מ-${d.baseAvg} ל-${d.recentAvg} לרישום ` +
    `(ירידה של ${d.drop} נקודות, על בסיס ${d.recentCount} רישומים אחרונים מול ${d.baseCount} קודמים).`
  );
}

/* -------- ריבוי אירועי משמעת -------- */

/** מספר אירועי משמעת בחלון שמייצר התראה. */
export const DISCIPLINE_SPIKE_THRESHOLD = 2;
/** מעל זה ההתראה נחשבת חמורה. */
export const DISCIPLINE_SPIKE_HIGH = 4;

export type DisciplineRecord = { date: string; severity?: number | null; type?: string | null };

export type DisciplineSpike = {
  severity: "medium" | "high";
  count: number;
  firstDate: string;
  lastDate: string;
};

/**
 * מזהה ריבוי אירועי משמעת שליליים בחלון שנמסר (הקריאה מסננת לפי תאריך).
 * רשומות מסוג "positive" לא נחשבות.
 */
export function evaluateDisciplineSpike(rows: DisciplineRecord[]): DisciplineSpike | null {
  const negative = rows.filter((r) => r.type !== "positive");
  if (negative.length < DISCIPLINE_SPIKE_THRESHOLD) return null;
  const sorted = [...negative].sort((a, b) => a.date.localeCompare(b.date));
  const severeCount = negative.filter((r) => (r.severity ?? 0) >= 3).length;
  const isHigh = negative.length >= DISCIPLINE_SPIKE_HIGH || severeCount >= 2;
  return {
    severity: isHigh ? "high" : "medium",
    count: negative.length,
    firstDate: sorted[0]!.date,
    lastDate: sorted[sorted.length - 1]!.date,
  };
}

/** תיאור בעברית של ריבוי אירועי המשמעת. */
export function describeDisciplineSpike(s: DisciplineSpike): string {
  return `${s.count} אירועי משמעת בשבועיים האחרונים (${s.firstDate} עד ${s.lastDate}).`;
}
