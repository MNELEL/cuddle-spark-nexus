/**
 * דוח תיעוד יומי לכיתה: לכל יום בטווח (הטווח נגזר מהלוח העברי בצד הלקוח)
 * מוחזרים התיעוד היומי, סיכום נוכחות, ממוצע ציונים, מספר התובנות ומספר האישורים.
 * התאריכים נשמרים ונשלחים כ-ISO — מקור אמת יחיד; התווית העברית נגזרת בתצוגה.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AUDIT_SOURCE_STUDENT_DAILY } from "./audit-sources";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");

export type DailyReportDay = {
  date: string;
  notes: string | null;
  attendance: { present: number; absent: number; late: number; excused: number; total: number };
  grades: { count: number; avgPct: number | null };
  insights: { total: number; high: number; medium: number; low: number };
  approvals: number;
};

export type DailyReport = {
  class: { id: string; name: string };
  range: { from: string; to: string };
  studentCount: number;
  student: { id: string; name: string } | null;
  days: DailyReportDay[];
};

const emptyDay = (date: string): DailyReportDay => ({
  date,
  notes: null,
  attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
  grades: { count: 0, avgPct: null },
  insights: { total: 0, high: 0, medium: 0, low: 0 },
  approvals: 0,
});

const reportInput = z.object({
  classId: z.string().uuid(),
  from: isoDate,
  to: isoDate,
  /** סינון לתלמיד בודד — כשריק הדוח כלל־כיתתי. */
  studentId: z.string().uuid().nullable().optional(),
});

async function loadClass(supabase: any, classId: string) {
  const { data: cls, error } = await supabase
    .from("classes")
    .select("id,name")
    .eq("id", classId)
    .maybeSingle();
  if (error) {
    console.error("[DB Error]", error);
    throw new Error("הפעולה נכשלה. נסה שוב.");
  }
  if (!cls) throw new Error("הכיתה לא נמצאה");
  return cls as { id: string; name: string };
}

export const getDailyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => reportInput.parse(d))
  .handler(async ({ data, context }): Promise<DailyReport> => {
    const supabase = context.supabase as any;
    const cls = await loadClass(supabase, data.classId);
    const studentId = data.studentId ?? null;
    const scoped = <T extends { eq: (c: string, v: string) => T }>(q: T) =>
      studentId ? q.eq("student_id", studentId) : q;

    const [logs, attendance, grades, insights, students, approvals, student] = await Promise.all([
      studentId
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("daily_summaries")
            .select("date,notes")
            .eq("class_id", data.classId)
            .gte("date", data.from)
            .lte("date", data.to),
      scoped(
        supabase
          .from("attendance")
          .select("date,status")
          .eq("class_id", data.classId)
          .gte("date", data.from)
          .lte("date", data.to),
      ),
      scoped(
        supabase
          .from("grades")
          .select("date,value,max_value")
          .eq("class_id", data.classId)
          .gte("date", data.from)
          .lte("date", data.to),
      ),
      scoped(
        supabase
          .from("orchestrator_insights")
          .select("insight_date,severity")
          .eq("class_id", data.classId)
          .gte("insight_date", data.from)
          .lte("insight_date", data.to),
      ),
      supabase.from("students").select("id").eq("class_id", data.classId),
      scoped(
        supabase
          .from("daily_log_approvals")
          .select("date")
          .eq("class_id", data.classId)
          .gte("date", data.from)
          .lte("date", data.to),
      ),
      studentId
        ? supabase.from("students").select("id,name").eq("id", studentId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    for (const r of [logs, attendance, grades, insights, students, approvals, student]) {
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

    for (const l of (logs.data ?? []) as any[]) at(l.date).notes = l.notes ?? null;

    for (const a of (attendance.data ?? []) as any[]) {
      const d = at(a.date).attendance;
      const key = a.status as keyof typeof d;
      if (key in d && key !== "total") d[key] += 1;
      d.total += 1;
    }

    const gradeSums = new Map<string, { t: number; n: number }>();
    for (const g of (grades.data ?? []) as any[]) {
      const max = Number(g.max_value) || 100;
      const acc = gradeSums.get(g.date) ?? { t: 0, n: 0 };
      acc.t += (Number(g.value) / max) * 100;
      acc.n += 1;
      gradeSums.set(g.date, acc);
    }
    for (const [date, acc] of gradeSums) {
      at(date).grades = { count: acc.n, avgPct: acc.n ? acc.t / acc.n : null };
    }

    for (const i of (insights.data ?? []) as any[]) {
      const date = String(i.insight_date).slice(0, 10);
      const d = at(date).insights;
      d.total += 1;
      const sev = i.severity as "high" | "medium" | "low";
      if (sev === "high" || sev === "medium" || sev === "low") d[sev] += 1;
    }

    for (const a of (approvals.data ?? []) as any[]) {
      at(String(a.date).slice(0, 10)).approvals += 1;
    }

    return {
      class: { id: cls.id, name: cls.name },
      range: { from: data.from, to: data.to },
      studentCount: ((students.data ?? []) as any[]).length,
      student: student.data ? { id: student.data.id, name: student.data.name } : null,
      days: Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1)),
    };
  });

export type DailyReportDetails = {
  attendance: { date: string; student: string; status: string; notes: string }[];
  grades: { date: string; student: string; subject: string; value: number; max_value: number }[];
  insights: {
    date: string;
    student: string;
    severity: string;
    title: string;
    description: string;
  }[];
  approvals: { date: string; student: string; approver: string; notes: string }[];
  history: { date: string; message: string }[];
};

/** שורות מפורטות לייצוא Excel: נוכחות, ציונים, תובנות, אישורים והיסטוריית שינויים. */
export const getDailyReportDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => reportInput.parse(d))
  .handler(async ({ data, context }): Promise<DailyReportDetails> => {
    const supabase = context.supabase as any;
    await loadClass(supabase, data.classId);
    const studentId = data.studentId ?? null;
    const scoped = (q: any) => (studentId ? q.eq("student_id", studentId) : q);

    const [attendance, grades, insights, approvals, logs] = await Promise.all([
      scoped(
        supabase
          .from("attendance")
          .select("date,status,notes,students(name)")
          .eq("class_id", data.classId)
          .gte("date", data.from)
          .lte("date", data.to)
          .order("date", { ascending: false }),
      ),
      scoped(
        supabase
          .from("grades")
          .select("date,subject,value,max_value,students(name)")
          .eq("class_id", data.classId)
          .gte("date", data.from)
          .lte("date", data.to)
          .order("date", { ascending: false }),
      ),
      scoped(
        supabase
          .from("orchestrator_insights")
          .select("insight_date,severity,title,description,students(name)")
          .eq("class_id", data.classId)
          .gte("insight_date", data.from)
          .lte("insight_date", data.to)
          .order("insight_date", { ascending: false }),
      ),
      scoped(
        supabase
          .from("daily_log_approvals")
          .select("date,approver_name,notes,students(name)")
          .eq("class_id", data.classId)
          .gte("date", data.from)
          .lte("date", data.to)
          .order("date", { ascending: false }),
      ),
      supabase
        .from("app_logs")
        .select("created_at,message,context")
        .eq("source", AUDIT_SOURCE_STUDENT_DAILY)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    for (const r of [attendance, grades, insights, approvals, logs]) {
      if (r.error) {
        console.error("[DB Error]", r.error);
        throw new Error("טעינת פרטי הדוח נכשלה");
      }
    }

    return {
      attendance: ((attendance.data ?? []) as any[]).map((r) => ({
        date: String(r.date).slice(0, 10),
        student: r.students?.name ?? "",
        status: r.status,
        notes: r.notes ?? "",
      })),
      grades: ((grades.data ?? []) as any[]).map((r) => ({
        date: String(r.date).slice(0, 10),
        student: r.students?.name ?? "",
        subject: r.subject ?? "",
        value: Number(r.value),
        max_value: Number(r.max_value) || 100,
      })),
      insights: ((insights.data ?? []) as any[]).map((r) => ({
        date: String(r.insight_date).slice(0, 10),
        student: r.students?.name ?? "כלל־כיתתי",
        severity: r.severity,
        title: r.title,
        description: r.description ?? "",
      })),
      approvals: ((approvals.data ?? []) as any[]).map((r) => ({
        date: String(r.date).slice(0, 10),
        student: r.students?.name ?? "",
        approver: r.approver_name ?? "",
        notes: r.notes ?? "",
      })),
      history: ((logs.data ?? []) as any[])
        .filter((r) => {
          const ctx = r.context ?? {};
          if (ctx.class_id && ctx.class_id !== data.classId) return false;
          if (studentId && ctx.student_id && ctx.student_id !== studentId) return false;
          const d = typeof ctx.date === "string" ? ctx.date.slice(0, 10) : null;
          return !d || (d >= data.from && d <= data.to);
        })
        .map((r) => ({ date: r.created_at as string, message: r.message as string })),
    };
  });
