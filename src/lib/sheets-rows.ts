/**
 * בניית טבלת הציונים לייצוא ל-Google Sheets — לוגיקה טהורה (ללא רשת/שרת),
 * כדי שאותה טבלה תהיה ניתנת לבדיקה ולשימוש חוזר.
 */
import {
  subjectAverages,
  weightedAverage,
  weightFor,
  type GradeLike,
  type WeightLike,
} from "./grade-weighting";

export type SheetStudent = {
  id: string;
  name: string;
  grades: GradeLike[];
};

export type SheetInput = {
  className: string;
  from: string;
  to: string;
  students: SheetStudent[];
  weights: WeightLike[];
};

const fmt = (n: number | null) => (n === null ? "" : String(Math.round(n * 10) / 10));

/** כל המקצועות שיש בהם ציונים, בסדר עברי יציב. */
export function collectSubjects(students: SheetStudent[]): string[] {
  const set = new Set<string>();
  for (const s of students) {
    for (const a of subjectAverages(s.grades)) set.add(a.subject);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "he"));
}

/**
 * שורות הגיליון: כותרת מידע, שורת עמודות, שורה לכל תלמיד, ושורת ממוצע כיתה.
 * כל התאים מוחזרים כמחרוזות — Google Sheets ממיר מספרים לבד (USER_ENTERED).
 */
export function buildGradesSheetValues(input: SheetInput): string[][] {
  const subjects = collectSubjects(input.students);
  const rows: string[][] = [];

  rows.push([`דוח ציונים — ${input.className}`]);
  rows.push([`תקופה: ${input.from} עד ${input.to}`, `הופק: ${new Date().toISOString().slice(0, 10)}`]);
  rows.push([]);

  rows.push([
    "תלמיד",
    ...subjects.map((s) => `${s} (%)`),
    "ממוצע משוקלל (%)",
    "ממוצע פשוט (%)",
    "מספר ציונים",
  ]);

  for (const st of input.students) {
    const bySubject = new Map(subjectAverages(st.grades).map((a) => [a.subject, a]));
    const w = weightedAverage(st.grades, input.weights);
    rows.push([
      st.name,
      ...subjects.map((s) => fmt(bySubject.get(s)?.pct ?? null)),
      fmt(w.value),
      fmt(w.unweighted),
      String(st.grades.length),
    ]);
  }

  const allGrades = input.students.flatMap((s) => s.grades);
  const classAvg = weightedAverage(allGrades, input.weights);
  rows.push([]);
  rows.push([
    "ממוצע כיתה",
    ...subjects.map(() => ""),
    fmt(classAvg.value),
    fmt(classAvg.unweighted),
    String(allGrades.length),
  ]);

  rows.push([]);
  rows.push(["משקלי מקצועות:", ...subjects.map((s) => `${s}=${weightFor(s, input.weights)}`)]);

  // כל השורות מיושרות לרוחב הרחב ביותר — טווח הכתיבה חייב להכיל כל שורה
  const width = rows.reduce((m, r) => Math.max(m, r.length), 1);
  return rows.map((r) => [...r, ...Array.from({ length: width - r.length }, () => "")]);
}
