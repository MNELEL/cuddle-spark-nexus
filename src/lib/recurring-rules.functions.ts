import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RecurringRule } from "@/lib/recurring-rules";

const uuid = z.string().uuid();
const SELECT = "id,class_id,kind,day_key,effect,hour,minute,label,active";

export const listRecurringRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<RecurringRule[]> => {
    const { data: rows, error } = await context.supabase
      .from("recurring_schedule_rules")
      .select(SELECT)
      .eq("class_id", data.classId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[recurring rules list]", error);
      throw new Error("טעינת הכללים הקבועים נכשלה.");
    }
    return (rows ?? []) as RecurringRule[];
  });

export const upsertRecurringRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.optional(),
        classId: uuid,
        kind: z.enum(["weekly_day", "rosh_chodesh"]),
        dayKey: z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]).nullable().optional(),
        effect: z.enum(["early_end", "late_start", "no_school"]),
        hour: z.number().int().min(0).max(23).nullable().optional(),
        minute: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(45)]).default(0),
        label: z.string().max(200).nullable().optional(),
        active: z.boolean().default(true),
      })
      .refine((v) => v.kind !== "weekly_day" || !!v.dayKey, { message: "בכלל שבועי חובה לבחור יום" })
      .refine((v) => v.effect === "no_school" || v.hour != null, { message: "חובה לבחור שעה" })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      class_id: data.classId,
      kind: data.kind,
      day_key: data.kind === "weekly_day" ? (data.dayKey ?? null) : null,
      effect: data.effect,
      hour: data.effect === "no_school" ? null : (data.hour ?? null),
      minute: data.effect === "no_school" ? 0 : data.minute,
      label: data.label?.trim() || null,
      active: data.active,
    };
    const q = data.id
      ? context.supabase.from("recurring_schedule_rules").update(payload).eq("id", data.id)
      : context.supabase.from("recurring_schedule_rules").insert(payload);
    const { error } = await q;
    if (error) {
      console.error("[recurring rules upsert]", error);
      throw new Error("שמירת הכלל הקבוע נכשלה.");
    }
    return { ok: true as const };
  });

export const deleteRecurringRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("recurring_schedule_rules").delete().eq("id", data.id);
    if (error) {
      console.error("[recurring rules delete]", error);
      throw new Error("מחיקת הכלל הקבוע נכשלה.");
    }
    return { ok: true as const };
  });