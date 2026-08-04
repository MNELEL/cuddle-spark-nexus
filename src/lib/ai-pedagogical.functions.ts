import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";
import { weightedAverage, hasCustomWeights, DEFAULT_WEIGHT } from "./grade-weighting";

export type SubjectStat = {
  subject: string;
  avgPercent: number;
  count: number;
};

export type BehaviorCategoryStat = {
  category: string;
  positive: number;
  negative: number;
  total: number;
};

export type DisciplineCategoryStat = {
  category: string;
  count: number;
  avgSeverity: number;
};

export type PedagogicalReport = {
  className: string;
  range: { from: string; to: string };
  studentCount: number;
  overallAvgPercent: number | null;
  /** ממוצע משוקלל לפי משקלי המקצועות של הכיתה (null כשאין ציונים) */
  weightedAvgPercent: number | null;
  /** האם הוגדרו משקלים שאינם ברירת מחדל */
  hasCustomWeights: boolean;
  subjects: SubjectStat[];
  subjectWeights: Array<{ subject: string; weight: number }>;
  strongSubjects: string[];
  weakSubjects: string[];
  highlightSubjects: string[]; // הלכה / דקדוק / חשבון if present
  behaviorCategories: BehaviorCategoryStat[];
  disciplineCategories: DisciplineCategoryStat[];
  attendance: { present: number; absent: number; late: number; excused: number };
  trend: Array<{ weekStart: string; positive: number; negative: number; discipline: number }>;
  aiAnalysis: string;
};

const HIGHLIGHT = ["הלכה", "דקדוק", "חשבון"];

function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay(); // 0 Sun
  const diff = day; // week starts Sunday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export const buildPedagogicalReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<PedagogicalReport> => {
    const { classId, from, to } = data;
    const { supabase } = context;

    const [cls, students, grades, behavior, discipline, attendance, weights] = await Promise.all([
      supabase.from("classes").select("id,name").eq("id", classId).single(),
      supabase.from("students").select("id").eq("class_id", classId),
      supabase.from("grades").select("subject,value,max_value,date")
        .eq("class_id", classId).gte("date", from).lte("date", to),
      supabase.from("behavior_points").select("points,category,date")
        .eq("class_id", classId).gte("date", from).lte("date", to),
      supabase.from("discipline_events").select("category,severity,date,type")
        .eq("class_id", classId).gte("date", from).lte("date", to),
      supabase.from("attendance").select("status,date")
        .eq("class_id", classId).gte("date", from).lte("date", to),
      supabase.from("grade_weights").select("subject,weight").eq("class_id", classId),
    ]);

    if (cls.error || !cls.data) throw new Error("שגיאה בטעינת הכיתה.");

    // Subject aggregates
    const bySubject = new Map<string, { sum: number; max: number; count: number }>();
    for (const g of grades.data ?? []) {
      const key = (g.subject || "כללי").trim();
      const cur = bySubject.get(key) ?? { sum: 0, max: 0, count: 0 };
      cur.sum += Number(g.value) || 0;
      cur.max += Number(g.max_value) || 100;
      cur.count += 1;
      bySubject.set(key, cur);
    }
    const subjects: SubjectStat[] = Array.from(bySubject.entries())
      .map(([subject, v]) => ({
        subject,
        avgPercent: v.max > 0 ? Math.round((v.sum / v.max) * 1000) / 10 : 0,
        count: v.count,
      }))
      .sort((a, b) => b.avgPercent - a.avgPercent);

    const overallAvgPercent = subjects.length
      ? Math.round((subjects.reduce((s, x) => s + x.avgPercent, 0) / subjects.length) * 10) / 10
      : null;
    const strongSubjects = subjects.filter((s) => s.avgPercent >= 85).map((s) => s.subject);
    const weakSubjects = subjects.filter((s) => s.avgPercent > 0 && s.avgPercent < 70).map((s) => s.subject);
    const highlightSubjects = subjects.filter((s) => HIGHLIGHT.includes(s.subject)).map((s) => s.subject);

    // ממוצע משוקלל — תוספת בלבד, אינו מחליף את overallAvgPercent או את הניתוח האיכותני.
    const weightRows = (weights.data ?? []).map((w) => ({ subject: w.subject, weight: Number(w.weight) }));
    const weightedResult = weightedAverage(grades.data ?? [], weightRows);
    const weightedAvgPercent = weightedResult.value;
    const customWeights = hasCustomWeights(weightRows);
    const subjectWeights = subjects.map((s) => ({
      subject: s.subject,
      weight: weightRows.find((w) => w.subject === s.subject)?.weight ?? DEFAULT_WEIGHT,
    }));

    // Behavior categories
    const behMap = new Map<string, { positive: number; negative: number; total: number }>();
    for (const b of behavior.data ?? []) {
      const key = (b.category || "כללי").trim();
      const p = Number(b.points) || 0;
      const cur = behMap.get(key) ?? { positive: 0, negative: 0, total: 0 };
      if (p >= 0) cur.positive += p; else cur.negative += -p;
      cur.total += p;
      behMap.set(key, cur);
    }
    const behaviorCategories: BehaviorCategoryStat[] = Array.from(behMap.entries())
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => (b.positive + b.negative) - (a.positive + a.negative));

    // Discipline categories
    const dispMap = new Map<string, { count: number; sevSum: number }>();
    for (const e of discipline.data ?? []) {
      const key = (e.category || "כללי").trim();
      const cur = dispMap.get(key) ?? { count: 0, sevSum: 0 };
      cur.count += 1;
      cur.sevSum += Number(e.severity) || 0;
      dispMap.set(key, cur);
    }
    const disciplineCategories: DisciplineCategoryStat[] = Array.from(dispMap.entries())
      .map(([category, v]) => ({
        category,
        count: v.count,
        avgSeverity: v.count ? Math.round((v.sevSum / v.count) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Attendance
    const att = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const a of attendance.data ?? []) {
      const s = a.status as keyof typeof att;
      if (s in att) att[s]++;
    }

    // Weekly trend (behavior + discipline)
    const trendMap = new Map<string, { positive: number; negative: number; discipline: number }>();
    for (const b of behavior.data ?? []) {
      if (!b.date) continue;
      const w = weekStart(b.date);
      const cur = trendMap.get(w) ?? { positive: 0, negative: 0, discipline: 0 };
      const p = Number(b.points) || 0;
      if (p >= 0) cur.positive += p; else cur.negative += -p;
      trendMap.set(w, cur);
    }
    for (const e of discipline.data ?? []) {
      if (!e.date) continue;
      const w = weekStart(e.date);
      const cur = trendMap.get(w) ?? { positive: 0, negative: 0, discipline: 0 };
      cur.discipline += 1;
      trendMap.set(w, cur);
    }
    const trend = Array.from(trendMap.entries())
      .map(([weekStart, v]) => ({ weekStart, ...v }))
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

    // Compact AI prompt payload
    const compact = {
      className: cls.data.name,
      studentCount: (students.data ?? []).length,
      range: { from, to },
      overallAvgPercent,
      weightedAvgPercent,
      weightsApplied: customWeights,
      subjectWeights: customWeights ? subjectWeights : undefined,
      subjects: subjects.map((s) => ({ subject: s.subject, avg: s.avgPercent, n: s.count })),
      strongSubjects,
      weakSubjects,
      highlightSubjects,
      behaviorTop: behaviorCategories.slice(0, 6),
      disciplineTop: disciplineCategories.slice(0, 6),
      attendance: att,
      trendWeeks: trend.length,
    };

    const system = `אתה יועץ פדגוגי לתלמוד תורה / חיידר / ישיבה בעברית.
נתוני הכיתה מסוכמים (לא גולמיים). נתח בקצרה ובמדויק:
1) אקלים כיתתי — מה עולה מההתנהגות והמשמעת (קטגוריות מובילות, מגמות).
2) הישגים לימודיים — מקצועות חזקים וחלשים, דגש מיוחד אם מופיעים "הלכה" / "דקדוק" / "חשבון".
אם קיים weightedAvgPercent ו-weightsApplied=true — התייחס אליו כממוצע הכיתה הקובע (המלמד הגדיר משקל שונה למקצועות), אך אל תשנה את הניתוח האיכותני בגללו.
3) תובנות פדגוגיות קונקרטיות (3-5 סעיפים) לשיפור אקלים ולחיזוק המקצועות החלשים.
טון: "הרב", "המלמד", "התלמידים". ללא סופרלטיבים, ללא המצאת נתונים.
החזר טקסט עברי (Markdown קל: כותרות ורשימות), 220-350 מילים. אל תחזיר JSON.`;

    let aiAnalysis = "";
    try {
      aiAnalysis = await callLovableAI({
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(compact) },
        ],
      });
    } catch (e) {
      console.error("[pedagogical AI]", e);
      aiAnalysis = "ניתוח ה-AI אינו זמין כרגע. נסה שוב מאוחר יותר.";
    }

    return {
      className: cls.data.name,
      range: { from, to },
      studentCount: (students.data ?? []).length,
      overallAvgPercent,
      weightedAvgPercent,
      hasCustomWeights: customWeights,
      subjects,
      subjectWeights,
      strongSubjects,
      weakSubjects,
      highlightSubjects,
      behaviorCategories,
      disciplineCategories,
      attendance: att,
      trend,
      aiAnalysis: aiAnalysis.slice(0, 6000),
    };
  });