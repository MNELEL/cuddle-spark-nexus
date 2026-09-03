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
      .select("id")
      .eq("class_id", data.classId)
      .eq("date", data.date)
      .maybeSingle();
    if (findErr) {
      console.error("[DB Error]", findErr);
      throw new Error("הפעולה נכשלה. נסה שוב.");
    }

    if (existing) {
      const { error } = await context.supabase
        .from("daily_summaries")
        .update({ notes: data.notes })
        .eq("id", existing.id);
      if (error) {
        console.error("[DB Error]", error);
        throw new Error("שמירת התיעוד נכשלה");
      }
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
    return { ok: true as const, id: inserted.id as string, created: true };
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
