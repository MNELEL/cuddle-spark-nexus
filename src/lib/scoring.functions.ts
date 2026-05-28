import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Fetches lightweight rows used by the client-side score engine.
 * Returns only the columns needed to compute scores — keeps payload small.
 */
export const listClassScoreInputs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { classId } = data;
    const [g, a, b] = await Promise.all([
      context.supabase.from("grades").select("student_id,value,max_value").eq("class_id", classId),
      context.supabase.from("attendance").select("student_id,status").eq("class_id", classId),
      context.supabase.from("behavior_points").select("student_id,points").eq("class_id", classId),
    ]);
    if (g.error) throw new Error(g.error.message);
    if (a.error) throw new Error(a.error.message);
    if (b.error) throw new Error(b.error.message);
    return {
      grades: g.data ?? [],
      attendance: a.data ?? [],
      behavior: b.data ?? [],
    };
  });