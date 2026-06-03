import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ---------------- Campaigns ---------------- */

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("campaigns").select("*").eq("class_id", data.classId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return rows ?? [];
  });

export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      classId: z.string().uuid(),
      name: z.string().min(1).max(120),
      description: z.string().max(2000).default(""),
      prize: z.string().max(200).default(""),
      target_points: z.number().int().min(1).max(100000),
      start_date: DateStr,
      end_date: DateStr,
      active: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const row = {
      class_id: data.classId,
      name: data.name,
      description: data.description,
      prize: data.prize,
      target_points: data.target_points,
      start_date: data.start_date,
      end_date: data.end_date,
      active: data.active,
    };
    if (data.id) {
      const { error } = await context.supabase.from("campaigns").update(row).eq("id", data.id);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("campaigns").insert(row).select("id").single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { id: ins!.id };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("campaigns").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

/* ---------------- Rewards catalog ---------------- */

export const listRewards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rewards").select("*").eq("class_id", data.classId).order("points_cost");
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return rows ?? [];
  });

export const upsertReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      classId: z.string().uuid(),
      name: z.string().min(1).max(120),
      description: z.string().max(1000).default(""),
      points_cost: z.number().int().min(1).max(100000),
      stock: z.number().int().min(0).max(100000).nullable().optional(),
      active: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const row = {
      class_id: data.classId,
      name: data.name,
      description: data.description,
      points_cost: data.points_cost,
      stock: data.stock ?? null,
      active: data.active,
    };
    if (data.id) {
      const { error } = await context.supabase.from("rewards").update(row).eq("id", data.id);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("rewards").insert(row).select("id").single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { id: ins!.id };
  });

export const deleteReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("rewards").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

/* ---------------- Redemptions ---------------- */

export const listRedemptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("reward_redemptions").select("*").eq("class_id", data.classId)
      .order("date", { ascending: false }).limit(200);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return rows ?? [];
  });

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      studentId: z.string().uuid(),
      rewardId: z.string().uuid().optional(),
      campaignId: z.string().uuid().optional(),
      prize_name: z.string().max(200),
      points_spent: z.number().int().min(0).max(100000),
      notes: z.string().max(500).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ins, error } = await context.supabase
      .from("reward_redemptions").insert({
        class_id: data.classId,
        student_id: data.studentId,
        reward_id: data.rewardId ?? null,
        campaign_id: data.campaignId ?? null,
        prize_name: data.prize_name,
        points_spent: data.points_spent,
        notes: data.notes,
      }).select("id").single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { id: ins!.id };
  });

export const deleteRedemption = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reward_redemptions").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

/* ---------------- Leaderboard ---------------- */

export type LeaderRow = {
  student_id: string;
  name: string;
  earned: number;
  spent: number;
  net: number;
};

export const getLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      startDate: DateStr.optional(),
      endDate: DateStr.optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<LeaderRow[]> => {
    const { supabase } = context;

    let bq = supabase.from("behavior_points").select("student_id,points,date").eq("class_id", data.classId);
    if (data.startDate) bq = bq.gte("date", data.startDate);
    if (data.endDate) bq = bq.lte("date", data.endDate);

    let rq = supabase.from("reward_redemptions").select("student_id,points_spent,date").eq("class_id", data.classId);
    if (data.startDate) rq = rq.gte("date", data.startDate);
    if (data.endDate) rq = rq.lte("date", data.endDate);

    const [{ data: students, error: se }, { data: beh, error: be }, { data: red, error: re }] =
      await Promise.all([
        supabase.from("students").select("id,name").eq("class_id", data.classId),
        bq,
        rq,
      ]);
    if (se) throw new Error(se.message);
    if (be) throw new Error(be.message);
    if (re) throw new Error(re.message);

    const map = new Map<string, LeaderRow>();
    for (const s of students ?? []) {
      map.set(s.id, { student_id: s.id, name: s.name, earned: 0, spent: 0, net: 0 });
    }
    for (const b of beh ?? []) {
      const r = map.get(b.student_id);
      if (r) r.earned += Number(b.points ?? 0);
    }
    for (const r0 of red ?? []) {
      const r = map.get(r0.student_id);
      if (r) r.spent += Number(r0.points_spent ?? 0);
    }
    for (const r of map.values()) r.net = r.earned - r.spent;
    return [...map.values()].sort((a, b) => b.net - a.net);
  });