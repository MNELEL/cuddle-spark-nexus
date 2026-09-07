/**
 * הערת המלמד הכלל-כיתתית במסך הסיכום היומי (daily_summaries) — רשומה אחת לכל כיתה ותאריך.
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

export const getDailySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid(), date: isoDate }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnClass(context.supabase, data.classId);
    const { data: row, error } = await context.supabase
      .from("daily_summaries")
      .select("notes")
      .eq("class_id", data.classId)
      .eq("date", data.date)
      .maybeSingle();
    if (error) {
      console.error("[DB Error]", error);
      throw new Error("טעינת ההערה נכשלה");
    }
    return (row?.notes as string | null) ?? "";
  });

export const saveDailySummary = createServerFn({ method: "POST" })
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
    const notes = data.notes.trim();

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

    // הערה ריקה — מוחקים את הרשומה אם קיימת, ולא יוצרים רשומה ריקה
    if (!notes) {
      if (existing) {
        const { error } = await context.supabase
          .from("daily_summaries")
          .delete()
          .eq("id", existing.id);
        if (error) {
          console.error("[DB Error]", error);
          throw new Error("מחיקת ההערה נכשלה");
        }
      }
      return { ok: true as const, saved: false };
    }

    if (existing) {
      const { error } = await context.supabase
        .from("daily_summaries")
        .update({ notes })
        .eq("id", existing.id);
      if (error) {
        console.error("[DB Error]", error);
        throw new Error("שמירת ההערה נכשלה");
      }
      return { ok: true as const, saved: true };
    }

    const { error } = await context.supabase.from("daily_summaries").insert({
      class_id: data.classId,
      date: data.date,
      notes,
      created_by: context.userId,
    });
    if (error) {
      console.error("[DB Error]", error);
      throw new Error("שמירת ההערה נכשלה");
    }
    return { ok: true as const, saved: true };
  });
