import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type UserTrialRow = {
  userId: string;
  email: string | null;
  displayName: string;
  startedAt: string | null;
  endsAt: string | null;
  active: boolean;
  daysLeft: number;
};

export async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("אין הרשאות מנהל מערכת");
}

/** Admin/principal check for read-only views of the pending queue. */
export async function assertManager(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "principal"]);
  if (error) throw new Error(error.message);
  if ((data ?? []).length === 0) throw new Error("אין הרשאה לצפות בבקשות ההארכה");
}

function derive(endsAt: string | null) {
  if (!endsAt) return { active: false, daysLeft: 0 };
  const ms = new Date(endsAt).getTime() - Date.now();
  return { active: ms > 0, daysLeft: Math.max(0, Math.ceil(ms / 86_400_000)) };
}

/** Admin-only: all users with their trial/approval window. */
export async function listUserTrialsImpl(supabase: SupabaseClient<Database>, userId: string): Promise<UserTrialRow[]> {
  await assertAdmin(supabase, userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) throw new Error(usersError.message);

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id, trial_started_at, trial_ends_at");
  if (profilesError) throw new Error(profilesError.message);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (users.users ?? []).map((u) => {
    const p = byId.get(u.id);
    const endsAt = p?.trial_ends_at ?? null;
    return {
      userId: u.id,
      email: u.email ?? null,
      displayName: (u.user_metadata?.display_name as string | undefined) ?? u.email?.split("@")[0] ?? "",
      startedAt: p?.trial_started_at ?? null,
      endsAt,
      ...derive(endsAt),
    };
  });
}

/** Admin-only: extend (approve) a user's access window by N days from now. */
export async function extendUserTrialImpl(
  supabase: SupabaseClient<Database>,
  adminId: string,
  targetUserId: string,
  days: number
): Promise<{ endsAt: string }> {
  await assertAdmin(supabase, adminId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profile, error: readError } = await supabaseAdmin
    .from("profiles")
    .select("trial_started_at, trial_ends_at")
    .eq("id", targetUserId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const current = profile?.trial_ends_at ? new Date(profile.trial_ends_at).getTime() : 0;
  const base = Math.max(current, Date.now());
  const endsAt = new Date(base + days * 86_400_000).toISOString();

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      trial_ends_at: endsAt,
      trial_started_at: profile?.trial_started_at ?? new Date().toISOString(),
    })
    .eq("id", targetUserId);
  if (error) throw new Error(error.message);
  return { endsAt };
}

export type PendingTrialRequest = {
  id: string;
  userId: string;
  email: string | null;
  displayName: string;
  institutionName: string | null;
  message: string | null;
  requestedDays: number;
  createdAt: string;
  endsAt: string | null;
  active: boolean;
  daysLeft: number;
};

/** Admins and principals: the open extension requests, enriched with each user's trial state. */
export async function listPendingTrialRequestsImpl(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<PendingTrialRequest[]> {
  await assertManager(supabase, userId);

  const { data: requests, error } = await supabase
    .from("trial_extension_requests")
    .select("id, user_id, email, institution_name, message, requested_days, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  if ((requests ?? []).length === 0) return [];

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids = (requests ?? []).map((r) => r.user_id);
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, trial_ends_at")
    .in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (requests ?? []).map((r) => {
    const p = byId.get(r.user_id);
    const endsAt = p?.trial_ends_at ?? null;
    return {
      id: r.id,
      userId: r.user_id,
      email: r.email,
      displayName: p?.display_name ?? r.email?.split("@")[0] ?? "",
      institutionName: r.institution_name,
      message: r.message,
      requestedDays: r.requested_days,
      createdAt: r.created_at,
      endsAt,
      ...derive(endsAt),
    };
  });
}

/** Admin-only: approve (and extend) or reject a pending request in one action. */
export async function reviewTrialRequestImpl(
  supabase: SupabaseClient<Database>,
  adminId: string,
  input: { requestId: string; decision: "approve" | "reject"; days?: number; note?: string }
): Promise<{ ok: true; endsAt: string | null }> {
  await assertAdmin(supabase, adminId);

  const { data: request, error: readError } = await supabase
    .from("trial_extension_requests")
    .select("id, user_id, status, requested_days")
    .eq("id", input.requestId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!request) throw new Error("הבקשה לא נמצאה");
  if (request.status !== "pending") throw new Error("הבקשה כבר טופלה");

  let endsAt: string | null = null;
  const days = input.days ?? request.requested_days;

  if (input.decision === "approve") {
    const result = await extendUserTrialImpl(supabase, adminId, request.user_id, days);
    endsAt = result.endsAt;
  }

  const { error: updateError } = await supabase
    .from("trial_extension_requests")
    .update({
      status: input.decision === "approve" ? "approved" : "rejected",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      granted_days: input.decision === "approve" ? days : null,
      review_note: input.note ?? null,
    })
    .eq("id", request.id);
  if (updateError) throw new Error(updateError.message);

  return { ok: true as const, endsAt };
}
