/**
 * תיעוד יומי ידני לכיתה (daily_summaries) — רשומה אחת לכל כיתה ותאריך.
 * התאריך נקבע לפי הלוח העברי הפעיל במסך, ונשמר כתאריך ISO כמקור אמת יחיד.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");

async function assertOwnClass(
  supabase: { from: (t: string) => any }, // eslint-disable-line @typescript-eslint/no-explicit-any
  classId: string,
) {
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .maybeSingle();
  if (error) {
    console.error("[DB Error]", error);
    throw new Error("הפעולה נכשלה. נסה שוב.");
  }
  if (!data) throw new Error("הכיתה לא נמצאה");
}

export const getDailyLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid(), date: isoDate }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("daily_summaries")
      .select("id,date,notes,created_at")
      .eq("class_id", data.classId)
      .eq("date", data.date)
      .maybeSingle();
    if (error) {
      console.error("[DB Error]", error);
      throw new Error("טעינת התיעוד היומי נכשלה");
    }
    return row ?? null;
  });

export const saveDailyLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        date: isoDate,
        notes: z.string().max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwnClass(context.supabase, data.classId);

    const { data: existing, error: findErr } = await context.supabase
      .from("daily_summaries")
      .select("id,notes")
      .eq("class_id", data.classId)
      .eq("date", data.date)
      .maybeSingle();
    if (findErr) {
      console.error("[DB Error]", findErr);
      throw new Error("הפעולה נכשלה. נסה שוב.");
    }

    const writeHistory = async (previous: string | null) => {
      if ((previous ?? "") === data.notes) return;
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("app_logs").insert({
          level: "info",
          source: AUDIT_SOURCE_DAILY_LOG,
          message: previous ? "עריכת תיעוד יומי" : "יצירת תיעוד יומי",
          user_id: context.userId,
          context: {
            class_id: data.classId,
            date: data.date,
            previous_notes: previous ?? null,
            new_notes: data.notes,
          },
        });
      } catch (e) {
        console.error("[daily-log audit]", e);
      }
    };

    if (existing) {
      const { error } = await context.supabase
        .from("daily_summaries")
        .update({ notes: data.notes })
        .eq("id", existing.id);
      if (error) {
        console.error("[DB Error]", error);
        throw new Error("שמירת התיעוד נכשלה");
      }
      await writeHistory((existing.notes as string | null) ?? null);
      return { ok: true as const, id: existing.id as string, created: false };
    }

    const { data: inserted, error } = await context.supabase
      .from("daily_summaries")
      .insert({
        class_id: data.classId,
        date: data.date,
        notes: data.notes,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[DB Error]", error);
      throw new Error("שמירת התיעוד נכשלה");
    }
    await writeHistory(null);
    return { ok: true as const, id: inserted.id as string, created: true };
  });

export type DailyLogHistoryEntry = {
  id: string;
  created_at: string;
  date: string;
  action: "created" | "updated";
  previous_notes: string | null;
  new_notes: string;
  author: string;
};

/** היסטוריית השינויים של התיעוד היומי (לכיתה, ואופציונלית לתאריך יחיד). */
export const listDailyLogHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        date: isoDate.nullable().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<DailyLogHistoryEntry[]> => {
    await assertOwnClass(context.supabase, data.classId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("app_logs")
      .select("id,message,context,user_id,created_at")
      .eq("source", AUDIT_SOURCE_DAILY_LOG)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      console.error("[DB Error]", error);
      throw new Error("טעינת היסטוריית התיעוד נכשלה");
    }

    const scoped = (rows ?? [])
      .map((r) => ({ row: r, ctx: (r.context ?? {}) as Record<string, unknown> }))
      .filter(({ ctx }) => ctx["class_id"] === data.classId)
      .filter(({ ctx }) => !data.date || ctx["date"] === data.date)
      .slice(0, data.limit);

    const ids = Array.from(
      new Set(scoped.map(({ row }) => row.user_id).filter((v): v is string => typeof v === "string")),
    );
    const names: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id,display_name")
        .in("id", ids);
      for (const p of profiles ?? []) names[p.id] = p.display_name ?? "";
    }

    return scoped.map(({ row, ctx }) => ({
      id: row.id,
      created_at: row.created_at,
      date: String(ctx["date"] ?? ""),
      action: ctx["previous_notes"] ? ("updated" as const) : ("created" as const),
      previous_notes: (ctx["previous_notes"] as string | null) ?? null,
      new_notes: String(ctx["new_notes"] ?? ""),
      author: (row.user_id && names[row.user_id]) || "מלמד",
    }));
  });

export const listDailyLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ classId: z.string().uuid(), from: isoDate, to: isoDate }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("daily_summaries")
      .select("id,date,notes")
      .eq("class_id", data.classId)
      .gte("date", data.from)
      .lte("date", data.to)
      .order("date", { ascending: false });
    if (error) {
      console.error("[DB Error]", error);
      throw new Error("טעינת התיעוד היומי נכשלה");
    }
    return rows ?? [];
  });
