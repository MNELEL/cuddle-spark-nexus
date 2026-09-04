/**
 * דוח תיעוד יומי לכיתה: לכל יום בטווח (הטווח נגזר מהלוח העברי בצד הלקוח)
 * מוחזרים התיעוד היומי, סיכום נוכחות, ממוצע ציונים ומספר התובנות.
 * התאריכים נשמרים ונשלחים כ-ISO — מקור אמת יחיד; התווית העברית נגזרת בתצוגה.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");

export type DailyReportDay = {
  date: string;
  notes: string | null;
  attendance: { present: number; absent: number; late: number; excused: number; total: number };
  grades: { count: number; avgPct: number | null };
  insights: { total: number; high: number; medium: number; low: number };
};

export type DailyReport = {
  class: { id: string; name: string };
  range: { from: string; to: string };
  studentCount: number;
  days: DailyReportDay[];
};

const emptyDay = (date: string): DailyReportDay => ({
  date,
  notes: null,
  attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
  grades: { count: 0, avgPct: null },
  insights: { total: 0, high: 0, medium: 0, low: 0 },
});

export const getDailyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ classId: z.string().uuid(), from: isoDate, to: isoDate }).parse(d),
  )
  .handler(async ({ data, context }): Promise<DailyReport> => {
    const { supabase } = context;
    const { data: cls, error: cErr } = await supabase
      .from("classes")
      .select("id,name")
      .eq("id", data.classId)
      .maybeSingle();
    if (cErr) {
      console.error("[DB Error]", cErr);
      throw new Error("הפעולה נכשלה. נסה שוב.");
    }
    if (!cls) throw new Error("הכיתה לא נמצאה");

    const [logs, attendance, grades, insights, students] = await Promise.all([
      supabase
        .from("daily_summaries")
        .select("date,notes")
        .eq("class_id", data.classId)
        .gte("date", data.from)
        .lte("date", data.to),
      supabase
        .from("attendance")
        .select("date,status")
        .eq("class_id", data.classId)
        .gte("date", data.from)
        .lte("date", data.to),
      supabase
        .from("grades")
        .select("date,value,max_value")
        .eq("class_id", data.classId)
        .gte("date", data.from)
        .lte("date", data.to),
      supabase
        .from("orchestrator_insights")
        .select("created_at,severity")
        .eq("class_id", data.classId)
        .gte("created_at", `${data.from}T00:00:00Z`)
        .lte("created_at", `${data.to}T23:59:59Z`),
      supabase.from("students").select("id").eq("class_id", data.classId),
    ]);
    for (const r of [logs, attendance, grades, insights, students]) {
      if (r.error) {
        console.error("[DB Error]", r.error);
        throw new Error("טעינת הדוח נכשלה");
      }
    }

    const byDate = new Map<string, DailyReportDay>();
    const at = (date: string) => {
      let d = byDate.get(date);
      if (!d) {
        d = emptyDay(date);
        byDate.set(date, d);
      }
      return d;
    };

    for (const l of logs.data ?? []) at(l.date).notes = l.notes ?? null;

    for (const a of attendance.data ?? []) {
      const d = at(a.date).attendance;
      const key = a.status as keyof typeof d;
      if (key in d && key !== "total") d[key] += 1;
      d.total += 1;
    }

    const gradeSums = new Map<string, { t: number; n: number }>();
    for (const g of grades.data ?? []) {
      const max = Number(g.max_value) || 100;
      const acc = gradeSums.get(g.date) ?? { t: 0, n: 0 };
      acc.t += (Number(g.value) / max) * 100;
      acc.n += 1;
      gradeSums.set(g.date, acc);
    }
    for (const [date, acc] of gradeSums) {
      at(date).grades = { count: acc.n, avgPct: acc.n ? acc.t / acc.n : null };
    }

    for (const i of insights.data ?? []) {
      const date = String(i.created_at).slice(0, 10);
      const d = at(date).insights;
      d.total += 1;
      const sev = i.severity as "high" | "medium" | "low";
      if (sev === "high" || sev === "medium" || sev === "low") d[sev] += 1;
    }

    return {
      class: { id: cls.id, name: cls.name },
      range: { from: data.from, to: data.to },
      studentCount: (students.data ?? []).length,
      days: Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1)),
    };
  });
