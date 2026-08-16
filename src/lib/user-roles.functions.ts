import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AUDIT_SOURCE_ROLES } from "@/lib/audit-sources";

export const roleSchema = z.enum(["admin", "principal", "teacher", "secretary"]);
export type Role = z.infer<typeof roleSchema>;

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

export type SystemAdmin = {
  id: string;
  email: string | null;
  displayName: string;
  assignedAt: string;
  isMe: boolean;
};

/**
 * Who currently holds the `admin` role, and when it was granted.
 * Readable by any signed-in user: everyone needs to know whom to ask for
 * approval. Only name/email/date are exposed.
 */
export const listSystemAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemAdmin[]> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    if (!roles || roles.length === 0) return [];

    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersError) throw new Error(usersError.message);

    const byId = new Map((users.users ?? []).map((u) => [u.id, u]));

    return roles.map((r) => {
      const u = byId.get(r.user_id);
      return {
        id: r.user_id,
        email: u?.email ?? null,
        displayName:
          (u?.user_metadata?.["display_name"] as string | undefined) ??
          u?.email?.split("@")[0] ??
          "משתמש",
        assignedAt: r.created_at,
        isMe: r.user_id === userId,
      };
    });
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

    // הגנת idempotency: לחיצה כפולה או שתי בקשות מקבילות לא ייצרו שיוך כפול
    const existingQuery = supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", data.user_id)
      .eq("role", data.role);
    const { data: existing, error: existingError } = await (
      data.institution_id
        ? existingQuery.eq("institution_id", data.institution_id)
        : existingQuery.is("institution_id", null)
    ).limit(1).maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      return { ok: true, already: true as const };
    }

    const { error } = await supabase
      .from("user_roles")
      .insert({
        user_id: data.user_id,
        role: data.role,
        institution_id: data.institution_id ?? null,
      })
      .select()
      .single();
    if (error) {
      // 23505 = הפרת אילוץ ייחודיות — ריצה מקבילית שהקדימה אותנו; זהו מצב תקין
      if (error.code === "23505") return { ok: true, already: true as const };
      throw new Error(error.message);
    }

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo(`הוקצה תפקיד ${data.role} למשתמש ${data.user_id}`, {
      source: AUDIT_SOURCE_ROLES,
      userId,
      context: {
        action: "role.assign",
        target_user_id: data.user_id,
        role: data.role,
        institution_id: data.institution_id ?? null,
      },
    });

    return { ok: true, already: false as const };
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

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo(`הוסר תפקיד (${data.role_id})`, {
      source: AUDIT_SOURCE_ROLES,
      userId,
      context: { action: "role.remove", role_id: data.role_id },
    });

    return { ok: true };
  });

export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: existingAdmin } = await supabase
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .single();
    if (existingAdmin) {
      return { ok: false, message: "כבר קיים מנהל במערכת" };
    }

    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { ok: true, message: "נוצר מנהל מערכת ראשון" };
  });

/**
 * Server-side gate for the user-management screen.
 * Both admins and institution principals may open it; write actions on roles
 * stay admin-only (see `verifyAdmin`).
 */
export const canManageUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "principal"]);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r) => r.role);
    return {
      isAdmin: roles.includes("admin"),
      isPrincipal: roles.includes("principal"),
      canManage: roles.length > 0,
    };
  });
