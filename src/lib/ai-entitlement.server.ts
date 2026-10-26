import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Selected AI actions must validate the existing trial window before spending credits. */
export async function requireActiveAITrial(supabase: SupabaseClient<Database>, userId: string) {
  const { data: profile, error } = await supabase.from("profiles")
    .select("trial_started_at,trial_ends_at").eq("id", userId).maybeSingle();
  if (error || !profile) throw new Error("בדיקת תקופת הניסיון נכשלה.");

  // Preserve the existing lazy-start behavior for legacy accounts with no trial yet.
  if (!profile.trial_ends_at) {
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + 30 * 86_400_000);
    const { error: startError } = await supabase.from("profiles").update({
      trial_started_at: startedAt.toISOString(), trial_ends_at: endsAt.toISOString(),
    }).eq("id", userId).is("trial_ends_at", null);
    if (startError) throw new Error("הפעלת תקופת הניסיון נכשלה.");
    const { data: current, error: readError } = await supabase.from("profiles")
      .select("trial_ends_at").eq("id", userId).maybeSingle();
    if (readError || !current?.trial_ends_at || !(Date.parse(current.trial_ends_at) > Date.now())) {
      throw new Error("תקופת הניסיון הסתיימה. ניתן לבקש הארכה מהמנהלים.");
    }
    return;
  }
  if (!(Date.parse(profile.trial_ends_at) > Date.now())) {
    throw new Error("תקופת הניסיון הסתיימה. ניתן לבקש הארכה מהמנהלים.");
  }
}