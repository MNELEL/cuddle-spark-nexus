import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Returns per-student subject averages, behavior points, and attendance
 * counts within a date window — used by the certificate generator.
 */
export const getCertificateData = createServerFn({ method: "POST" })
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
  .handler(async ({ data, context }) => {
    const { classId, from, to } = data;
    const [students, grades, behavior, attendance] = await Promise.all([
      context.supabase.from("students").select("id,name").eq("class_id", classId).order("name"),
      context.supabase
        .from("grades")
        .select("student_id,subject,value,max_value,date")
        .eq("class_id", classId)
        .gte("date", from)
        .lte("date", to),
      context.supabase
        .from("behavior_points")
        .select("student_id,points,created_at")
        .eq("class_id", classId)
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59"),
      context.supabase
        .from("attendance")
        .select("student_id,status,date")
        .eq("class_id", classId)
        .gte("date", from)
        .lte("date", to),
    ]);
    for (const r of [students, grades, behavior, attendance]) {
      if (r.error) {
        console.error("[DB Error]", r.error);
        throw new Error("הפעולה נכשלה. נסה שוב.");
      }
    }
    return {
      students: students.data ?? [],
      grades: grades.data ?? [],
      behavior: behavior.data ?? [],
      attendance: attendance.data ?? [],
    };
  });