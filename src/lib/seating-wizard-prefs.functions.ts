import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WizardPrefs = {
  weight_academic: number;
  weight_behavioral: number;
  weight_social: number;
  balance_height: boolean;
};

const DEFAULT_PREFS: WizardPrefs = {
  weight_academic: 25,
  weight_behavioral: 25,
  weight_social: 25,
  balance_height: true,
};

export const getPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WizardPrefs> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("seating_wizard_prefs")
      .select("weight_academic, weight_behavioral, weight_social, balance_height")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return data ?? DEFAULT_PREFS;
  });

export const savePrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      weight_academic: z.number().int().min(0).max(100),
      weight_behavioral: z.number().int().min(0).max(100),
      weight_social: z.number().int().min(0).max(100),
      balance_height: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("seating_wizard_prefs")
      .upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });
