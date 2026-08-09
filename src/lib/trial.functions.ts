import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { trialExtensionSchema } from "@/lib/trial-schema";

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

/** Admin-only: list every user's approval / trial window. */
export const listUserTrials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listUserTrialsImpl } = await import("@/lib/trial-admin.server");
    return listUserTrialsImpl(context.supabase, context.userId);
  });

/** Admin-only: approve / extend a user's access window. */
export const extendUserTrial = createServerFn({ method: "POST" })
  .inputValidator((data: { userId: string; days: number }) =>
    trialExtensionSchema.parse(data)
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { extendUserTrialImpl } = await import("@/lib/trial-admin.server");
    return extendUserTrialImpl(context.supabase, context.userId, data.userId, data.days);
  });
