import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SoundPreference = {
  event_key: string;
  sound_id: string;
  enabled: boolean;
  volume: number;
};

/** All event→sound mappings of the signed-in הרב. */
export const listSoundPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SoundPreference[]> => {
    const { data, error } = await context.supabase
      .from("sound_preferences")
      .select("event_key, sound_id, enabled, volume");
    if (error) throw new Error("טעינת העדפות הצלילים נכשלה");
    return (data ?? []).map((r) => ({
      event_key: r.event_key,
      sound_id: r.sound_id,
      enabled: r.enabled,
      volume: Number(r.volume),
    }));
  });

/** Saves (upserts) a single event→sound mapping. */
export const saveSoundPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    event_key: z.string().min(1).max(60),
    sound_id: z.string().min(1).max(60),
    enabled: z.boolean().default(true),
    volume: z.number().min(0).max(1).default(0.6),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sound_preferences")
      .upsert({ ...data, owner_id: context.userId }, { onConflict: "owner_id,event_key" });
    if (error) throw new Error("שמירת העדפת הצליל נכשלה");
    return { ok: true };
  });
