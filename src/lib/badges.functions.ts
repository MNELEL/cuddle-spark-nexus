import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BADGE_CATEGORIES, type BadgeRow, type BadgeAwardRow, type BadgeIdea } from "./badge-options";

export const listBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<BadgeRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("badges").select("*").eq("class_id", data.classId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("טעינת התגים נכשלה");
    return (rows ?? []) as BadgeRow[];
  });

export const upsertBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    classId: z.string().uuid(),
    name: z.string().min(1).max(120),
    description: z.string().max(600).default(""),
    icon: z.string().max(40).default("award"),
    color: z.string().max(40).default("amber"),
    criteria: z.string().max(600).default(""),
    points_reward: z.number().int().min(0).max(1000).default(0),
    active: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { id, classId, ...rest } = data;
    if (id) {
      const { error } = await context.supabase.from("badges").update(rest).eq("id", id);
      if (error) throw new Error("עדכון התג נכשל");
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("badges").insert({ ...rest, class_id: classId }).select("id").single();
    if (error) throw new Error("יצירת התג נכשלה");
    return { id: row.id as string };
  });

export const deleteBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("badges").delete().eq("id", data.id);
    if (error) throw new Error("מחיקת התג נכשלה");
    return { ok: true };
  });

export const listBadgeAwards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<BadgeAwardRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("student_badges")
      .select("id, badge_id, student_id, note, awarded_at")
      .eq("class_id", data.classId)
      .order("awarded_at", { ascending: false })
      .limit(400);
    if (error) throw new Error("טעינת הענקות התגים נכשלה");
    return (rows ?? []) as BadgeAwardRow[];
  });

/** Awards a badge to selected students, or to the whole class at once. */
export const awardBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    classId: z.string().uuid(),
    badgeId: z.string().uuid(),
    studentIds: z.array(z.string().uuid()).max(200).default([]),
    wholeClass: z.boolean().default(false),
    note: z.string().max(300).default(""),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ awarded: number }> => {
    let ids = data.studentIds;
    if (data.wholeClass) {
      const { data: students, error } = await context.supabase
        .from("students").select("id").eq("class_id", data.classId);
      if (error) throw new Error("טעינת התלמידים נכשלה");
      ids = ((students ?? []) as { id: string }[]).map((s) => s.id);
    }
    if (ids.length === 0) throw new Error("בחר לפחות תלמיד אחד");

    const { error } = await context.supabase.from("student_badges").insert(
      ids.map((studentId) => ({
        class_id: data.classId,
        student_id: studentId,
        badge_id: data.badgeId,
        note: data.note,
      })),
    );
    if (error) throw new Error("הענקת התג נכשלה");
    return { awarded: ids.length };
  });

export const removeBadgeAward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("student_badges").delete().eq("id", data.id);
    if (error) throw new Error("ביטול ההענקה נכשל");
    return { ok: true };
  });

/** AI badge ideas for a chosen chinuch category. */
export const suggestBadgeIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    category: z.enum(BADGE_CATEGORIES),
    count: z.number().int().min(1).max(6).default(4),
  }).parse(d))
  .handler(async ({ data }): Promise<{ ideas: BadgeIdea[] }> => {
    const { fetchBadgeIdeas } = await import("./badges.server");
    return { ideas: await fetchBadgeIdeas(data.category, data.count) };
  });
