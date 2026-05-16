import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: groups, error } = await context.supabase
      .from("groups").select("*").eq("class_id", data.classId).order("name");
    if (error) throw new Error(error.message);
    const { data: memberships, error: e2 } = await context.supabase
      .from("student_groups").select("*")
      .in("group_id", (groups ?? []).map((g) => g.id).length ? (groups ?? []).map((g) => g.id) : ["00000000-0000-0000-0000-000000000000"]);
    if (e2) throw new Error(e2.message);
    return { groups: groups ?? [], memberships: memberships ?? [] };
  });

export const upsertGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    class_id: z.string().uuid(),
    name: z.string().min(1).max(60),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("groups").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("groups").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("student_groups").delete().eq("group_id", data.id);
    const { error } = await context.supabase.from("groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setStudentGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    student_id: z.string().uuid(),
    group_ids: z.array(z.string().uuid()),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("student_groups").delete().eq("student_id", data.student_id);
    if (data.group_ids.length) {
      const rows = data.group_ids.map((gid) => ({ student_id: data.student_id, group_id: gid }));
      const { error } = await context.supabase.from("student_groups").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });