/**
 * שקלול ציונים — לוגיקה טהורה (ללא React / Supabase), משותפת לשרת וללקוח.
 *
 * הנוסחה: קודם ממוצע פנימי לכל מקצוע (sum(value)/sum(max)*100), ואז שקלול
 * בין המקצועות: sum(subjAvg_i * w_i) / sum(w_i), רק על מקצועות שיש בהם ציונים.
 * מקצוע ללא שורת משקל מקבל משקל 1 — כך שכשאין משקלים בכלל התוצאה מתלכדת
 * מתמטית עם ממוצע פשוט של ממוצעי המקצועות.
 */

export type GradeLike = {
  student_id?: string;
  subject: string | null;
  value: number | string;
  max_value: number | string;
};

export type WeightLike = {
  id?: string;
  subject: string;
  weight: number | string;
};

export const DEFAULT_WEIGHT = 1;
export const MIN_WEIGHT = 0.1;
export const MAX_WEIGHT = 10;
export const UNKNOWN_SUBJECT = "כללי";

export type SubjectAverage = { subject: string; pct: number; count: number };

export type WeightedAverageResult = {
  /** הממוצע המשוקלל באחוזים, או null כשאין ציונים */
  value: number | null;
  /** ממוצע לא-משוקלל של ממוצעי המקצועות (להשוואה) */
  unweighted: number | null;
  contributions: Array<{
    subject: string;
    pct: number;
    weight: number;
    /** חלקו של המקצוע בממוצע הסופי (0-1) */
    share: number;
    count: number;
  }>;
};

function normSubject(subject: string | null | undefined): string {
  const s = (subject ?? "").trim();
  return s.length ? s : UNKNOWN_SUBJECT;
}

function num(v: number | string | null | undefined, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

/** מיפוי מקצוע → משקל, עם ברירת מחדל 1 וקיצוץ לטווח החוקי. */
export function weightMap(weights: WeightLike[] | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of weights ?? []) {
    const subject = normSubject(w.subject);
    const value = num(w.weight, DEFAULT_WEIGHT);
    if (!Number.isFinite(value) || value <= 0) continue;
    map.set(subject, Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, value)));
  }
  return map;
}

export function weightFor(subject: string | null | undefined, weights: WeightLike[] | Map<string, number> | null | undefined): number {
  const map = weights instanceof Map ? weights : weightMap(weights);
  return map.get(normSubject(subject)) ?? DEFAULT_WEIGHT;
}

/** ממוצע פנימי לכל מקצוע: sum(value) / sum(max_value) * 100 */
export function subjectAverages(grades: GradeLike[] | null | undefined): SubjectAverage[] {
  const acc = new Map<string, { sum: number; max: number; count: number }>();
  for (const g of grades ?? []) {
    const subject = normSubject(g.subject);
    const cur = acc.get(subject) ?? { sum: 0, max: 0, count: 0 };
    cur.sum += num(g.value, 0);
    cur.max += num(g.max_value, 100) || 100;
    cur.count += 1;
    acc.set(subject, cur);
  }
  return Array.from(acc.entries()).map(([subject, v]) => ({
    subject,
    pct: v.max > 0 ? (v.sum / v.max) * 100 : 0,
    count: v.count,
  }));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** ממוצע משוקלל בין-מקצועי. מחזיר null כשאין ציונים כלל. */
export function weightedAverage(
  grades: GradeLike[] | null | undefined,
  weights: WeightLike[] | Map<string, number> | null | undefined,
): WeightedAverageResult {
  const map = weights instanceof Map ? weights : weightMap(weights);
  const subjects = subjectAverages(grades);
  if (!subjects.length) return { value: null, unweighted: null, contributions: [] };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of subjects) {
    const w = map.get(s.subject) ?? DEFAULT_WEIGHT;
    weightedSum += s.pct * w;
    totalWeight += w;
  }

  const value = totalWeight > 0 ? weightedSum / totalWeight : null;
  const unweighted = subjects.reduce((sum, s) => sum + s.pct, 0) / subjects.length;

  const contributions = subjects
    .map((s) => {
      const w = map.get(s.subject) ?? DEFAULT_WEIGHT;
      return {
        subject: s.subject,
        pct: round1(s.pct),
        weight: w,
        share: totalWeight > 0 ? w / totalWeight : 0,
        count: s.count,
      };
    })
    .sort((a, b) => b.share - a.share || b.pct - a.pct);

  return {
    value: value === null ? null : round1(value),
    unweighted: round1(unweighted),
    contributions,
  };
}

/** ממוצע משוקלל לכל תלמיד (לפי grades[].student_id). */
export function weightedAverageByStudent(
  grades: GradeLike[] | null | undefined,
  weights: WeightLike[] | Map<string, number> | null | undefined,
): Map<string, number | null> {
  const map = weights instanceof Map ? weights : weightMap(weights);
  const byStudent = new Map<string, GradeLike[]>();
  for (const g of grades ?? []) {
    const sid = g.student_id;
    if (!sid) continue;
    const arr = byStudent.get(sid) ?? [];
    arr.push(g);
    byStudent.set(sid, arr);
  }
  const out = new Map<string, number | null>();
  for (const [sid, rows] of byStudent) out.set(sid, weightedAverage(rows, map).value);
  return out;
}

/** האם הוגדרו בפועל משקלים שאינם ברירת המחדל */
export function hasCustomWeights(weights: WeightLike[] | null | undefined): boolean {
  return (weights ?? []).some((w) => num(w.weight, DEFAULT_WEIGHT) !== DEFAULT_WEIGHT);
}