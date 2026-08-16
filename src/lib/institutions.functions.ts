import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AUDIT_SOURCE_INSTITUTIONS, AUDIT_SOURCE_ROLES, AUDIT_SOURCE_STUDENT_PROFILES } from "@/lib/audit-sources";

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

const attachClassesSchema = z.object({
  user_id: z.string().uuid(),
  institution_id: z.string().uuid(),
  dry_run: z.boolean().optional(),
});

/**
 * Links the teacher's existing active classes to an institution.
 * With `dry_run` it only reports how many classes would be affected.
 */
export const attachTeacherClassesToInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => attachClassesSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await verifyAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: classes, error } = await supabaseAdmin
      .from("classes")
      .select("id, name, status, institution_id")
      .eq("owner_id", data.user_id);
    if (error) throw new Error(error.message);

    const pending = (classes ?? []).filter((c) => c.institution_id !== data.institution_id);
    const archived = pending.filter((c) => c.status === "archived");
    const attachable = pending.filter((c) => c.status !== "archived");

    if (data.dry_run) {
      return { attached: 0, attachable: attachable.length, skippedArchived: archived.length };
    }
    if (attachable.length === 0) {
      return { attached: 0, attachable: 0, skippedArchived: archived.length };
    }

    const { error: updateError } = await supabaseAdmin
      .from("classes")
      .update({ institution_id: data.institution_id, updated_at: new Date().toISOString() })
      .in("id", attachable.map((c) => c.id));
    if (updateError) throw new Error(updateError.message);

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo(`שויכו ${attachable.length} כיתות למוסד`, {
      source: AUDIT_SOURCE_INSTITUTIONS,
      userId,
      context: {
        action: "institution.attach_classes",
        institution_id: data.institution_id,
        teacher_id: data.user_id,
        class_ids: attachable.map((c) => c.id),
        skipped_archived: archived.length,
      },
    });

    return {
      attached: attachable.length,
      attachable: attachable.length,
      skippedArchived: archived.length,
    };
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
      .in("source", [AUDIT_SOURCE_INSTITUTIONS, AUDIT_SOURCE_ROLES, AUDIT_SOURCE_STUDENT_PROFILES])
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

const deleteInstitutionSchema = z.object({
  institution_id: z.string().uuid(),
});

/**
 * Deletes an institution. Blocked while classes are still attached so no
 * teacher loses data by accident; role assignments are detached automatically.
 */
export const deleteInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteInstitutionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await verifyAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inst, error: instError } = await supabaseAdmin
      .from("institutions")
      .select("id, name")
      .eq("id", data.institution_id)
      .maybeSingle();
    if (instError) throw new Error(instError.message);
    if (!inst) throw new Error("המוסד לא נמצא");

    const { count: classCount, error: classError } = await supabaseAdmin
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", data.institution_id);
    if (classError) throw new Error(classError.message);
    if ((classCount ?? 0) > 0) {
      throw new Error(
        `לא ניתן למחוק את המוסד: משויכות אליו ${classCount} כיתות. נתק אותן קודם בטבלת שיוכי הכיתות.`,
      );
    }

    const { error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("institution_id", data.institution_id);
    if (rolesError) throw new Error(rolesError.message);

    const { error: deleteError } = await supabaseAdmin
      .from("institutions")
      .delete()
      .eq("id", data.institution_id);
    if (deleteError) throw new Error(deleteError.message);

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo(`נמחק מוסד: ${inst.name}`, {
      source: AUDIT_SOURCE_INSTITUTIONS,
      userId,
      context: { action: "institution.delete", institution_id: inst.id, name: inst.name },
    });

    return { ok: true, name: inst.name };
  });
