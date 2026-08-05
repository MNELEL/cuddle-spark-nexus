import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AUDIT_SOURCE_INSTITUTIONS, AUDIT_SOURCE_ROLES } from "@/lib/audit-sources";

type InstitutionScope = { institutionId: string; role: "admin" | "principal" };

/**
 * Derives the caller's institution from their own roles (never from client input).
 * Returns null when the caller has no institution-scoped principal/admin role.
 */
async function resolveScope(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<InstitutionScope | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, institution_id")
    .eq("user_id", userId);
  if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

  const rows = (data ?? []).filter(
    (r) => r.institution_id && (r.role === "principal" || r.role === "admin"),
  );
  const preferred = rows.find((r) => r.role === "principal") ?? rows[0];
  if (!preferred?.institution_id) return null;
  return {
    institutionId: preferred.institution_id,
    role: preferred.role as "admin" | "principal",
  };
}

async function requireScope(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<InstitutionScope> {
  const scope = await resolveScope(supabase, userId);
  if (!scope) throw new Error("אין לך הרשאת מנהל מוסד");
  return scope;
}

/** Null when the caller isn't an institution principal/admin — used for routing hints. */
export const getMyInstitution = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const scope = await resolveScope(supabase, userId);
    if (!scope) return null;

    const { data, error } = await supabase
      .from("institutions")
      .select("id, name")
      .eq("id", scope.institutionId)
      .maybeSingle();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!data) return null;

    return { id: data.id, name: data.name, role: scope.role };
  });

export const getInstitutionOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const scope = await requireScope(supabase, userId);

    // RLS: institution principals/admins can read their institution's classes.
    const { data: classes, error } = await supabase
      .from("classes")
      .select("id, status, owner_id")
      .eq("institution_id", scope.institutionId);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const rows = classes ?? [];
    const ids = rows.map((c) => c.id);
    let students = 0;
    if (ids.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count, error: cErr } = await supabaseAdmin
        .from("students")
        .select("id", { count: "exact", head: true })
        .in("class_id", ids);
      if (cErr) { console.error("[DB Error]", cErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
      students = count ?? 0;
    }

    return {
      activeClasses: rows.filter((c) => c.status !== "archived").length,
      archivedClasses: rows.filter((c) => c.status === "archived").length,
      students,
      teachers: new Set(rows.map((c) => c.owner_id)).size,
    };
  });

export const listMyInstitutionClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const scope = await requireScope(supabase, userId);

    const { data: classes, error } = await supabase
      .from("classes")
      .select("id, name, academic_year, status, owner_id")
      .eq("institution_id", scope.institutionId)
      .order("name", { ascending: true });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const rows = classes ?? [];
    const ids = rows.map((c) => c.id);
    const counts: Record<string, number> = {};
    const teacherNames: Record<string, string> = {};

    if (ids.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: students, error: sErr } = await supabaseAdmin
        .from("students")
        .select("id, class_id")
        .in("class_id", ids);
      if (sErr) { console.error("[DB Error]", sErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
      for (const s of students ?? []) counts[s.class_id] = (counts[s.class_id] ?? 0) + 1;

      const ownerIds = Array.from(new Set(rows.map((c) => c.owner_id)));
      // Display names only — no emails or other account PII.
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", ownerIds);
      if (pErr) { console.error("[DB Error]", pErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
      for (const p of profiles ?? []) teacherNames[p.id] = p.display_name ?? "";
    }

    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      academicYear: c.academic_year,
      status: (c.status ?? "active") as string,
      studentCount: counts[c.id] ?? 0,
      teacherName: teacherNames[c.owner_id] ?? "—",
    }));
  });

export const listMyInstitutionAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const scope = await requireScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("app_logs")
      .select("id, message, context, source, created_at")
      .in("source", [AUDIT_SOURCE_INSTITUTIONS, AUDIT_SOURCE_ROLES])
      .contains("context", { institution_id: scope.institutionId })
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    return (data ?? []).map((row) => {
      const ctx = (row.context ?? {}) as Record<string, unknown>;
      return {
        id: row.id,
        message: row.message,
        action: typeof ctx["action"] === "string" ? (ctx["action"] as string) : "",
        createdAt: row.created_at,
      };
    });
  });