import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const categoryEnum = z.enum(["participation", "seating", "helpfulness", "academic", "other"]);

export const listReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("reminders").select("*").eq("class_id", data.classId)
      .order("completed").order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    class_id: z.string().uuid(),
    student_id: z.string().uuid(),
    title: z.string().min(1).max(160),
    description: z.string().max(2000).optional().default(""),
    due_date: z.string().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("reminders").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("reminders").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const toggleReminderDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), completed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reminders").update({ completed: data.completed }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reminders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBehaviorPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("behavior_points").select("*").eq("class_id", data.classId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addBehaviorPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    class_id: z.string().uuid(),
    student_id: z.string().uuid(),
    category: categoryEnum,
    points: z.number().int().min(-50).max(50),
    note: z.string().max(500).optional().default(""),
    date: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("behavior_points").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBehaviorPoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("behavior_points").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });