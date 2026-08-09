import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const themeSchema = z.enum([
  "modern",
  "conservative",
  "minimal",
  "kitsch",
  "mono",
  "classalign",
  "hakita-sheli",
]);

/** The theme saved on the account, or null when the user never saved one. */
export const getThemePreference = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ theme: string | null }> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("theme_preference")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { theme: data?.theme_preference ?? null };
  });

/** Saves the theme on the account so it follows the user across devices. */
export const saveThemePreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ theme: themeSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, theme_preference: data.theme }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
