import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const exportClassGrades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("grades")
      .select("id,class_id,student_id,subject,value,max_value,date,notes,created_at")
      .eq("class_id", data.classId)
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const exportClassAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("attendance")
      .select("id,class_id,student_id,date,status,notes")
      .eq("class_id", data.classId)
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const exportResourcesMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("teaching_resources")
      .select("id,title,description,subject,grade_level,resource_type,tags,ai_generated,topic_id,created_at,updated_at")
      .eq("owner_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });