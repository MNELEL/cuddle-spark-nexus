import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { trialExtensionSchema, trialRequestSchema, trialReviewSchema } from "@/lib/trial-schema";
import { AUDIT_SOURCE_TRIALS } from "@/lib/audit-sources";

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

/** The signed-in user asks a manager to extend their access. */
export const requestTrialExtension = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => trialRequestSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase, userId, claims } = context;

    const { data: pending } = await supabase
      .from("trial_extension_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (pending) return { ok: false as const, message: "כבר קיימת בקשה ממתינה לאישור" };

    const { error } = await supabase.from("trial_extension_requests").insert({
      user_id: userId,
      email: (claims as { email?: string } | null)?.email ?? null,
      institution_name: data.institution_name ?? null,
      message: data.message ?? null,
      requested_days: data.requested_days,
    });
    if (error) throw new Error(error.message);

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo("בקשת הארכת תקופת ניסיון חדשה", {
      source: AUDIT_SOURCE_TRIALS,
      userId,
      context: { action: "trial_request.create", requested_days: data.requested_days },
    });

    return { ok: true as const, message: "הבקשה נשלחה למנהל המערכת" };
  });

/** The signed-in user's own extension requests (latest first). */
export const myTrialExtensionRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("trial_extension_requests")
      .select("id, status, requested_days, granted_days, review_note, created_at, reviewed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Admins and principals: the open queue of extension requests. */
export const listPendingTrialRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listPendingTrialRequestsImpl } = await import("@/lib/trial-admin.server");
    return listPendingTrialRequestsImpl(context.supabase, context.userId);
  });

/** Admin-only: approve (extending the trial) or reject a pending request. */
export const reviewTrialRequest = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => trialReviewSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { reviewTrialRequestImpl } = await import("@/lib/trial-admin.server");
    const result = await reviewTrialRequestImpl(context.supabase, context.userId, data);

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo(
      data.decision === "approve" ? "בקשת הארכת ניסיון אושרה" : "בקשת הארכת ניסיון נדחתה",
      {
        source: AUDIT_SOURCE_TRIALS,
        userId: context.userId,
        context: { action: "trial_request.review", request_id: data.requestId, decision: data.decision, days: data.days ?? null },
      }
    );

    return result;
  });
