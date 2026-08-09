import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { roleSchema } from "@/lib/user-roles.functions";
import { AUDIT_SOURCE_ROLES } from "@/lib/audit-sources";

const submitSchema = z.object({
  requested_role: roleSchema.default("teacher"),
  institution_name: z.string().trim().max(120).optional(),
  message: z.string().trim().max(500).optional(),
});

export const submitAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    const { data: pending } = await supabase
      .from("access_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();
    if (pending) return { ok: false as const, message: "כבר קיימת בקשה ממתינה לטיפול" };

    const { error } = await supabase.from("access_requests").insert({
      user_id: userId,
      email: (claims as { email?: string } | null)?.email ?? null,
      requested_role: data.requested_role,
      institution_name: data.institution_name ?? null,
      message: data.message ?? null,
    });
    if (error) throw new Error(error.message);

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo(`בקשת הרשאה חדשה (${data.requested_role})`, {
      source: AUDIT_SOURCE_ROLES,
      userId,
      context: { action: "access_request.create", requested_role: data.requested_role },
    });

    return { ok: true as const, message: "הבקשה נשלחה למנהל המערכת" };
  });

export const myAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("access_requests")
      .select("id, requested_role, institution_name, message, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Admins and principals may review the queue (enforced by RLS as well). */
export const listAccessRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "principal"]);
    if (rolesError) throw new Error(rolesError.message);
    if ((roles ?? []).length === 0) throw new Error("אין הרשאה לצפות בבקשות הרשאה");

    const { data, error } = await supabase
      .from("access_requests")
      .select("id, user_id, email, requested_role, institution_name, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const resolveSchema = z.object({
  request_id: z.string().uuid(),
  status: z.enum(["approved", "denied"]),
});

export const resolveAccessRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resolveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: adminRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!adminRole) throw new Error("אין הרשאות מנהל");

    const { error } = await supabase
      .from("access_requests")
      .update({ status: data.status, reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.request_id);
    if (error) throw new Error(error.message);

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo(`בקשת הרשאה ${data.status === "approved" ? "אושרה" : "נדחתה"}`, {
      source: AUDIT_SOURCE_ROLES,
      userId,
      context: { action: "access_request.resolve", request_id: data.request_id, status: data.status },
    });

    return { ok: true as const };
  });
