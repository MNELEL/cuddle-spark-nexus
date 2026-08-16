import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WeeklyDayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type WeeklyLesson = {
  id: string;
  class_id: string;
  week_start: string;
  day_key: WeeklyDayKey;
  hour: number;
  /** 0 / 15 / 30 / 45 — quarter-hour resolution within `hour`. */
  minute: number;
  duration: number;
  title: string;
  subject: string | null;
  notes: string | null;
  library_item_id: string | null;
};

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dayKey = z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
const minuteVal = z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(45)]);

export const listWeeklyLessons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      weekStart: dateStr,
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<WeeklyLesson[]> => {
    const { data: rows, error } = await context.supabase
      .from("weekly_lessons")
      .select("id,class_id,week_start,day_key,hour,minute,duration,title,subject,notes,library_item_id")
      .eq("class_id", data.classId)
      .eq("week_start", data.weekStart)
      .order("hour", { ascending: true })
      .order("minute", { ascending: true });
    if (error) {
      console.error("[weekly_lessons list]", error);
      throw new Error("טעינת הלוח השבועי נכשלה.");
    }
    return (rows ?? []) as WeeklyLesson[];
  });

export const upsertWeeklyLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      classId: z.string().uuid(),
      weekStart: dateStr,
      dayKey,
      hour: z.number().int().min(6).max(22),
      minute: minuteVal.default(0),
      duration: z.union([z.literal(1), z.literal(2)]).default(1),
      title: z.string().min(1).max(200),
      subject: z.string().max(100).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
      libraryItemId: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      class_id: data.classId,
      week_start: data.weekStart,
      day_key: data.dayKey,
      hour: data.hour,
      minute: data.minute,
      duration: data.duration,
      title: data.title.trim(),
      subject: data.subject?.trim() || null,
      notes: data.notes ?? null,
      library_item_id: data.libraryItemId ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("weekly_lessons")
        .update(payload)
        .eq("id", data.id);
      if (error) {
        console.error("[weekly_lessons update]", error);
        if (error.code === "23505") throw new Error("יש כבר שיעור בשעה הזו — ערוך או מחק אותו קודם.");
        throw new Error("עדכון השיעור נכשל.");
      }
      return { ok: true as const, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("weekly_lessons").insert(payload).select("id").single();
    if (error || !row) {
      console.error("[weekly_lessons insert]", error);
      if (error?.code === "23505") throw new Error("יש כבר שיעור בשעה הזו — ערוך או מחק אותו קודם.");
      throw new Error("הוספת השיעור נכשלה.");
    }
    return { ok: true as const, id: row.id };
  });

/**
 * Moves an existing lesson to a new day/hour — used by the drag-and-drop
 * grid. A thin wrapper around a partial update rather than reusing
 * upsertWeeklyLesson, so the client only needs to send the fields that
 * actually change on a drag (not the full lesson payload).
 */
export const moveWeeklyLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      dayKey,
      hour: z.number().int().min(6).max(22),
      minute: minuteVal.default(0),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("weekly_lessons")
      .update({ day_key: data.dayKey, hour: data.hour, minute: data.minute })
      .eq("id", data.id);
    if (error) {
      console.error("[weekly_lessons move]", error);
      if (error.code === "23505") throw new Error("יש כבר שיעור בשעה הזו — בחר משבצת אחרת.");
      throw new Error("העברת השיעור נכשלה.");
    }
    return { ok: true as const };
  });

export const deleteWeeklyLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("weekly_lessons").delete().eq("id", data.id);
    if (error) {
      console.error("[weekly_lessons delete]", error);
      throw new Error("מחיקת השיעור נכשלה.");
    }
    return { ok: true as const };
  });
