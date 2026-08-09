import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CUSTOM_SOUND_BUCKET = "custom-sounds";
/** Prefix that marks a sound id as an uploaded file rather than a built-in recipe. */
export const CUSTOM_SOUND_PREFIX = "custom:";

export type CustomSound = {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  file_size: number | null;
};

export const listCustomSounds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CustomSound[]> => {
    const { data, error } = await context.supabase
      .from("custom_sounds")
      .select("id, name, storage_path, mime_type, file_size")
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת הצלילים האישיים נכשלה"); }
    return data ?? [];
  });

export const createCustomSound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    name: z.string().trim().min(1, "יש להזין שם לצליל").max(80),
    storage_path: z.string().min(1).max(500),
    mime_type: z.string().max(120).default("audio/mpeg"),
    file_size: z.number().int().nonnegative().max(10 * 1024 * 1024, "הקובץ גדול מ-10MB").nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.storage_path.startsWith(`${context.userId}/`)) {
      throw new Error("נתיב הקובץ אינו תקין");
    }
    const { data: row, error } = await context.supabase
      .from("custom_sounds")
      .insert({ ...data, owner_id: context.userId })
      .select("id")
      .single();
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת הצליל נכשלה"); }
    return { id: row.id as string };
  });

export const renameCustomSound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("custom_sounds").update({ name: data.name }).eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("עדכון השם נכשל"); }
    return { ok: true };
  });

export const deleteCustomSound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("custom_sounds").select("storage_path").eq("id", data.id).maybeSingle();
    if (row?.storage_path) {
      await context.supabase.storage.from(CUSTOM_SOUND_BUCKET).remove([row.storage_path]);
    }
    const { error } = await context.supabase.from("custom_sounds").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("מחיקת הצליל נכשלה"); }
    return { ok: true };
  });

/** Short-lived playback URL for an uploaded sound. */
export const getCustomSoundUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storage_path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from(CUSTOM_SOUND_BUCKET)
      .createSignedUrl(data.storage_path, 60 * 60);
    if (error || !signed) { console.error("[Storage Error]", error); throw new Error("יצירת קישור לצליל נכשלה"); }
    return { url: signed.signedUrl };
  });
