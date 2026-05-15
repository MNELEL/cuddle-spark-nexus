import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const heightEnum = z.enum(["low", "mid", "high"]);
const rowEnum = z.enum(["front", "mid", "back", "any"]);

export const listStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("students")
      .select("*")
      .eq("class_id", data.classId)
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      class_id: z.string().uuid(),
      name: z.string().min(1).max(100),
      notes: z.string().max(2000).optional().default(""),
      height: heightEnum.default("mid"),
      row_pref: rowEnum.default("any"),
      corner_pref: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("students").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("students").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("students").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// relations
const kindEnum = z.enum(["friend", "avoid", "distance"]);

export const listRelations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("student_relations")
      .select("*")
      .eq("class_id", data.classId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createRelation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      class_id: z.string().uuid(),
      student_a: z.string().uuid(),
      student_b: z.string().uuid(),
      kind: kindEnum,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.student_a === data.student_b) throw new Error("יש לבחור שני תלמידים שונים");
    const { error } = await context.supabase.from("student_relations").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRelation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("student_relations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });