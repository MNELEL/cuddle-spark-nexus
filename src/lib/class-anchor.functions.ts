import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClassAnchorRow = {
  id: string;
  name: string;
  status: string | null;
  students: number;
  attendance: number;
  grades: number;
  insights: number;
  approvals: number;
  notes: boolean;
};

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * סיכום התיעוד היומי לכל כיתה של המלמד המחובר בתאריך אחד:
 * נוכחות, ציונים, תובנות, אישורים והערה כלל-כיתתית.
 * RLS מגבילה כבר את השורות לכיתות של המשתמש.
 */
export const getClassAnchorSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }): Promise<ClassAnchorRow[]> => {
    const { date } = data;
    const { data: classes, error } = await context.supabase
      .from("classes")
      .select("id,name,status")
      .order("created_at", { ascending: false });
    if (error) throw new Error("טעינת הכיתות נכשלה.");
    const ids = (classes ?? []).map((c) => c.id);
    if (!ids.length) return [];

    const [students, attendance, grades, insights, approvals, summaries] = await Promise.all([
      context.supabase.from("students").select("id,class_id").in("class_id", ids),
      context.supabase.from("attendance").select("id,class_id").in("class_id", ids).eq("date", date),
      context.supabase.from("grades").select("id,class_id").in("class_id", ids).eq("date", date),
      context.supabase
        .from("orchestrator_insights")
        .select("id,class_id")
        .in("class_id", ids)
        .eq("insight_date", date),
      context.supabase.from("daily_log_approvals").select("id,class_id").in("class_id", ids).eq("date", date),
      context.supabase.from("daily_summaries").select("class_id").in("class_id", ids).eq("date", date),
    ]);

    const count = (rows: { class_id: string | null }[] | null | undefined, id: string) =>
      (rows ?? []).filter((r) => r.class_id === id).length;

    return (classes ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status ?? null,
      students: count(students.data, c.id),
      attendance: count(attendance.data, c.id),
      grades: count(grades.data, c.id),
      insights: count(insights.data, c.id),
      approvals: count(approvals.data, c.id),
      notes: count(summaries.data, c.id) > 0,
    }));
  });
