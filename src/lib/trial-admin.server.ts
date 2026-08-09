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

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("אין הרשאות מנהל מערכת");
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
