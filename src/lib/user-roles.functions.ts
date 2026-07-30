import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const roleSchema = z.enum(["admin", "principal", "teacher", "secretary"]);
type Role = z.infer<typeof roleSchema>;

async function verifyAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("אין הרשאות מנהל");
}

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role, institution_id")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ role: r.role, institutionId: r.institution_id }));
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
  });

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await verifyAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw new Error(usersError.message);

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, institution_id, created_at, updated_at");
    if (rolesError) throw new Error(rolesError.message);

    const rolesByUser = (roles ?? []).reduce<Record<string, typeof roles>>((acc, r) => {
      if (!acc[r.user_id]) acc[r.user_id] = [];
      acc[r.user_id].push(r);
      return acc;
    }, {});

    return (users.users ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      displayName: (u.user_metadata?.display_name as string | undefined) ?? u.email?.split("@")[0] ?? "",
      roles: rolesByUser[u.id] ?? [],
      createdAt: u.created_at,
    }));
  });

const assignRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: roleSchema,
  institution_id: z.string().uuid().optional(),
});

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assignRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await verifyAdmin(supabase, userId);

    const { error } = await supabase
      .from("user_roles")
      .insert({
        user_id: data.user_id,
        role: data.role as Role,
        institution_id: data.institution_id ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const removeRoleSchema = z.object({
  role_id: z.string().uuid(),
});

export const removeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => removeRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await verifyAdmin(supabase, userId);

    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", data.role_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
