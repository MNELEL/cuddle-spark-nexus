import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TypesSchema = z.object({
  lessons: z.boolean(),
  assignments: z.boolean(),
  messages: z.boolean(),
});
export type ReminderTypes = z.infer<typeof TypesSchema>;

export type ReminderPreferences = {
  user_id: string;
  types_enabled: ReminderTypes;
  lead_time_minutes: number;
};

const DEFAULT_TYPES: ReminderTypes = { lessons: true, assignments: true, messages: true };

export const getReminderPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReminderPreferences> => {
    const { data } = await context.supabase
      .from("reminder_preferences")
      .select("user_id,types_enabled,lead_time_minutes")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!data) {
      return { user_id: context.userId, types_enabled: DEFAULT_TYPES, lead_time_minutes: 30 };
    }
    return data as ReminderPreferences;
  });

export const saveReminderPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    types_enabled: TypesSchema,
    lead_time_minutes: z.number().int().min(0).max(1440),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("reminder_preferences")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) { console.error("[DB Error]", error); throw new Error("שמירה נכשלה"); }

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo("העדפות תזכורות עודכנו", {
      source: "settings_update",
      userId: context.userId,
      context: {
        tab: "reminders",
        fields: ["types_enabled", "lead_time_minutes"],
        enabledTypes: Object.entries(data.types_enabled)
          .filter(([, on]) => on)
          .map(([k]) => k),
        lead_time_minutes: data.lead_time_minutes,
      },
    });
    return { ok: true };
  });