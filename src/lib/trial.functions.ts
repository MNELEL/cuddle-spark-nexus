import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TRIAL_DAYS = 30;

export type TrialStatus = {
  registered: boolean;
  active: boolean;
  startedAt: string | null;
  endsAt: string | null;
  daysLeft: number;
};

function build(startedAt: string | null, endsAt: string | null): TrialStatus {
  if (!endsAt) {
    return { registered: true, active: false, startedAt, endsAt: null, daysLeft: 0 };
  }
  const ms = new Date(endsAt).getTime() - Date.now();
  return {
    registered: true,
    active: ms > 0,
    startedAt,
    endsAt,
    daysLeft: Math.max(0, Math.ceil(ms / 86_400_000)),
  };
}

/** Reads (and lazily starts) the free-month trial for the signed-in user. */
export const getMyTrialStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrialStatus> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("trial_started_at, trial_ends_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error("טעינת מצב תקופת הניסיון נכשלה");

    if (data?.trial_ends_at) return build(data.trial_started_at, data.trial_ends_at);

    // No trial recorded yet (e.g. profile created before trials existed) — start it now.
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + TRIAL_DAYS * 86_400_000);
    const { error: upsertError } = await supabase
      .from("profiles")
      .update({ trial_started_at: startedAt.toISOString(), trial_ends_at: endsAt.toISOString() })
      .eq("id", userId);
    if (upsertError) throw new Error("הפעלת תקופת הניסיון נכשלה");
    return build(startedAt.toISOString(), endsAt.toISOString());
  });
