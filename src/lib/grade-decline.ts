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

/* ===================== תובנות ציונים מתקדמות ===================== */

/** ממוצע גבוה שממנו מתחילים לחשוד בכשל חד-פעמי. */
export const STRONG_AVERAGE = 85;
/** ציון שמתחתיו נחשב כשל. */
export const FAILING_SCORE = 60;
/** פער מינימלי מול ממוצע הכיתה שמייצר התראה. */
export const CLASS_GAP_THRESHOLD = 15;

export type GradeOutlier = {
  severity: "medium" | "high";
  score: number;
  average: number;
  date: string;
};

/** מנרמל ציון לאחוזים. */
export function gradePercent(row: GradeRecord): number {
  const max = row.max_value && row.max_value > 0 ? row.max_value : 100;
  return (row.value / max) * 100;
}

/**
 * תלמיד חזק שנפל במבחן בודד: ממוצע כללי גבוה (ללא הציון החריג),
 * אך הציון האחרון נכשל. מזהה "נכון ל-90 אך נפסל במבחן".
 */
export function evaluateGradeOutlier(rows: GradeRecord[]): GradeOutlier | null {
  if (rows.length < 3) return null;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1]!;
  const lastPct = gradePercent(last);
  if (lastPct >= FAILING_SCORE) return null;

  const others = sorted.slice(0, -1);
  const avg = gradeAverage(others);
  if (avg === null || avg < STRONG_AVERAGE) return null;

  return {
    severity: avg - lastPct > 35 ? "high" : "medium",
    score: Math.round(lastPct),
    average: Math.round(avg),
    date: last.date,
  };
}

export function describeGradeOutlier(o: GradeOutlier): string {
  return (
    `הממוצע הכללי הוא ${o.average}%, אך במבחן האחרון הציון היה ${o.score}% בלבד. ` +
    `ייתכן קושי נקודתי בחומר או קשיים ביום המבחן.`
  );
}

export type ClassGap = {
  severity: "medium" | "high";
  studentAvg: number;
  classAvg: number;
  gapPoints: number;
};

/** תלמיד שהממוצע שלו נמוך משמעותית מממוצע הכיתה באותה תקופה. */
export function evaluateBelowClassAverage(
  studentRows: GradeRecord[],
  classRows: GradeRecord[],
): ClassGap | null {
  if (studentRows.length < MIN_RECENT_GRADES) return null;
  const studentAvg = gradeAverage(studentRows);
  const classAvg = gradeAverage(classRows);
  if (studentAvg === null || classAvg === null) return null;

  const gap = classAvg - studentAvg;
  if (gap < CLASS_GAP_THRESHOLD) return null;

  return {
    severity: gap > 25 ? "high" : "medium",
    studentAvg: Math.round(studentAvg),
    classAvg: Math.round(classAvg),
    gapPoints: Math.round(gap),
  };
}

export function describeBelowClassAverage(g: ClassGap): string {
  return (
    `הממוצע שלו ${g.studentAvg}% מול ממוצע כיתתי ${g.classAvg}% — ` +
    `פער של ${g.gapPoints} נקודות אחוז.`
  );
}
