import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const publishableKey =
  process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

/** True when the environment has everything needed to run DB-backed tests. */
export const hasTestEnv = Boolean(url && serviceKey && publishableKey);

function requireEnv() {
  if (!hasTestEnv) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_PUBLISHABLE_KEY for tests",
    );
  }
  return { url: url!, serviceKey: serviceKey!, publishableKey: publishableKey! };
}

/** Service-role client: bypasses RLS. Used only for fixtures and cleanup. */
export function adminClient(): SupabaseClient<Database> {
  const env = requireEnv();
  return createClient<Database>(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type TestUser = {
  id: string;
  email: string;
  /** Publishable-key client signed in as this user — RLS applies. */
  client: SupabaseClient<Database>;
};

/** Creates a confirmed throwaway auth user and returns an authenticated client. */
export async function createTestUser(label: string): Promise<TestUser> {
  const env = requireEnv();
  const admin = adminClient();
  const email = `vitest-${label}-${crypto.randomUUID()}@example.test`;
  const password = `Pw-${crypto.randomUUID()}`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const client = createClient<Database>(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;

  return { id: data.user.id, email, client };
}

/** Deletes the throwaway user (cascades their owned rows). Never throws. */
export async function deleteTestUser(user: TestUser | null | undefined) {
  if (!user) return;
  try {
    await user.client.auth.signOut();
  } catch {
    /* ignore */
  }
  try {
    await adminClient().auth.admin.deleteUser(user.id);
  } catch (e) {
    console.warn("[test cleanup] deleteUser failed", e);
  }
}

/** Creates a class owned by the given test user and returns its row. */
export async function createClassFor(user: TestUser, name: string) {
  const { data, error } = await user.client
    .from("classes")
    .insert({ name, owner_id: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}