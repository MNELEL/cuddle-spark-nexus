import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AUDIT_SOURCE_INSTITUTIONS, AUDIT_SOURCE_ROLES } from "@/lib/audit-sources";

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

export const listInstitutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // RLS decides visibility: members see their own institution, admins see all.
    const { data, error } = await supabase
      .from("institutions")
      .select("id, name, created_at")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const createInstitutionSchema = z.object({
  name: z.string().trim().min(2, "שם קצר מדי").max(120, "שם ארוך מדי"),
});

export const createInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInstitutionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await verifyAdmin(supabase, userId);

    const { data: created, error } = await supabase
      .from("institutions")
      .insert({ name: data.name })
      .select("id, name, created_at")
      .single();
    if (error) throw new Error(error.message);

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo(`נוצר מוסד חדש: ${created.name}`, {
      source: AUDIT_SOURCE_INSTITUTIONS,
      userId,
      context: { action: "institution.create", institution_id: created.id, name: created.name },
    });

    return created;
  });

const listInstitutionClassesSchema = z.object({
  institution_id: z.string().uuid(),
});

export const listInstitutionClasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listInstitutionClassesSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await verifyAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: classes, error } = await supabaseAdmin
      .from("classes")
      .select("id, name, academic_year, status, created_at")
      .eq("institution_id", data.institution_id)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (classes ?? []).map((c) => c.id);
    const counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: students, error: studentsError } = await supabaseAdmin
        .from("students")
        .select("id, class_id")
        .in("class_id", ids);
      if (studentsError) throw new Error(studentsError.message);
      for (const s of students ?? []) {
        counts[s.class_id] = (counts[s.class_id] ?? 0) + 1;
      }
    }

    return (classes ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      academicYear: c.academic_year,
      status: c.status,
      studentCount: counts[c.id] ?? 0,
    }));
  });

export const listRoleAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await verifyAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("app_logs")
      .select("id, level, message, context, source, created_at")
      .in("source", [AUDIT_SOURCE_INSTITUTIONS, AUDIT_SOURCE_ROLES])
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const ctx = (row.context ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        message: row.message,
        action: typeof ctx["action"] === "string" ? (ctx["action"] as string) : "",
        source: row.source ?? "",
        createdAt: row.created_at,
      };
    });
  });
