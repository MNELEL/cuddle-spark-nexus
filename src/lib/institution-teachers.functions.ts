import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type InstitutionScope = { institutionId: string; role: "admin" | "principal" };

/** Derives the caller's institution from their own roles (never from client input). */
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
  return { institutionId: preferred.institution_id, role: preferred.role as "admin" | "principal" };
}

async function requireScope(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<InstitutionScope> {
  const scope = await resolveScope(supabase, userId);
  if (!scope) throw new Error("אין לך הרשאת מנהל מוסד");
  return scope;
}

export type InstitutionTeacher = {
  userId: string;
  name: string;
  classCount: number;
  studentCount: number;
  teachingNotes: string;
  style: {
    preferredSubjects: string[];
    resourceCount: number;
    lastAiSummary: string;
    lastUpdatedAt: string | null;
  } | null;
};

export const listInstitutionTeachers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InstitutionTeacher[]> => {
    const { supabase, userId } = context;
    const scope = await requireScope(supabase, userId);

    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("user_id, teaching_notes")
      .eq("institution_id", scope.institutionId)
      .eq("role", "teacher");
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const teacherIds = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (teacherIds.length === 0) return [];

    const notesByUser: Record<string, string> = {};
    for (const r of roles ?? []) notesByUser[r.user_id] = r.teaching_notes ?? "";

    // Privileged reads only after the caller's institution role is verified.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Display names only — no emails or other account PII.
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .in("id", teacherIds);
    if (pErr) { console.error("[DB Error]", pErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
    const names: Record<string, string> = {};
    for (const p of profiles ?? []) names[p.id] = p.display_name ?? "";

    const { data: classes, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id, owner_id")
      .in("owner_id", teacherIds);
    if (cErr) { console.error("[DB Error]", cErr); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const classOwner: Record<string, string> = {};
    const classCounts: Record<string, number> = {};
    for (const c of classes ?? []) {
      classOwner[c.id] = c.owner_id;
      classCounts[c.owner_id] = (classCounts[c.owner_id] ?? 0) + 1;
    }

    const studentCounts: Record<string, number> = {};
    const classIds = Object.keys(classOwner);
    if (classIds.length > 0) {
      const { data: students, error: sErr } = await supabaseAdmin
        .from("students")
        .select("id, class_id")
        .in("class_id", classIds);
      if (sErr) { console.error("[DB Error]", sErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
      for (const s of students ?? []) {
        const owner = classOwner[s.class_id];
        if (owner) studentCounts[owner] = (studentCounts[owner] ?? 0) + 1;
      }
    }

    const { data: styles, error: stErr } = await supabaseAdmin
      .from("teacher_style_profile")
      .select("user_id, preferred_subjects, resource_count, last_ai_summary, last_updated_at")
      .in("user_id", teacherIds);
    if (stErr) { console.error("[DB Error]", stErr); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const styleByUser: Record<string, InstitutionTeacher["style"]> = {};
    for (const s of styles ?? []) {
      const raw = s.preferred_subjects;
      let subjects: string[] = [];
      if (Array.isArray(raw)) subjects = raw.filter((v): v is string => typeof v === "string");
      else if (raw && typeof raw === "object") subjects = Object.keys(raw as Record<string, unknown>);
      styleByUser[s.user_id] = {
        preferredSubjects: subjects.slice(0, 8),
        resourceCount: s.resource_count ?? 0,
        lastAiSummary: s.last_ai_summary ?? "",
        lastUpdatedAt: s.last_updated_at ?? null,
      };
    }

    return teacherIds
      .map((id) => ({
        userId: id,
        name: names[id] || "מלמד ללא שם",
        classCount: classCounts[id] ?? 0,
        studentCount: studentCounts[id] ?? 0,
        teachingNotes: notesByUser[id] ?? "",
        style: styleByUser[id] ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "he"));
  });

const inviteSchema = z.object({
  email: z.string().trim().min(1, "נדרשת כתובת מייל").email("כתובת מייל לא תקינה").max(255, "כתובת מייל ארוכה מדי"),
});

export const inviteTeacherToInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email);
    if (error) {
      console.error("[Auth Error]", error);
      const msg = (error.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        throw new Error("המשתמש כבר רשום - חפש אותו ברשימת המורים הקיימת");
      }
      throw new Error("שליחת ההזמנה נכשלה. נסה שוב.");
    }
    const newUserId = invited?.user?.id;
    if (!newUserId) throw new Error("שליחת ההזמנה נכשלה. נסה שוב.");

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "teacher", institution_id: scope.institutionId });
    if (rErr) {
      console.error("[DB Error]", rErr);
      if (rErr.code === "23505" || rErr.code === "23405" || (rErr.message ?? "").includes("duplicate")) {
        throw new Error("המשתמש כבר רשום - חפש אותו ברשימת המורים הקיימת");
      }
      throw new Error("שיוך המלמד למוסד נכשל. נסה שוב.");
    }

    return { ok: true as const, userId: newUserId };
  });

const removeSchema = z.object({ userId: z.string().uuid("מזהה משתמש לא תקין") });

export const removeTeacherFromInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => removeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Only the institution role row is removed — the account and its classes stay intact.
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("institution_id", scope.institutionId)
      .eq("role", "teacher");
    if (error) { console.error("[DB Error]", error); throw new Error("הסרת המלמד נכשלה. נסה שוב."); }

    return { ok: true as const };
  });

/** Institution-scoped admin gate: only a system admin may edit teacher records. */
async function requireAdminScope(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<InstitutionScope> {
  const scope = await requireScope(supabase, userId);
  if (scope.role !== "admin") throw new Error("רק מנהל מערכת יכול לערוך מלמדים");
  return scope;
}

const notesSchema = z.object({
  teacherId: z.string().uuid("מזהה משתמש לא תקין"),
  notes: z.string().max(2000, "ההערה ארוכה מדי"),
});

/** Free-text teaching style / notes kept per teacher on their institution role row. */
export const updateTeacherNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => notesSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireAdminScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .update({ teaching_notes: data.notes.trim() || null })
      .eq("user_id", data.teacherId)
      .eq("institution_id", scope.institutionId);
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת ההערות נכשלה. נסה שוב."); }
    return { ok: true as const };
  });

export type TeacherClassRow = {
  id: string;
  name: string;
  status: string;
  teacherId: string;
  teacherName: string;
};

/** Every class of the caller's institution, with its current teacher. */
export const listInstitutionClassAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeacherClassRow[]> => {
    const { supabase, userId } = context;
    const scope = await requireScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: classes, error } = await supabaseAdmin
      .from("classes")
      .select("id, name, status, owner_id")
      .eq("institution_id", scope.institutionId)
      .order("name", { ascending: true });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const rows = classes ?? [];
    const ownerIds = Array.from(new Set(rows.map((c) => c.owner_id)));
    const names: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from("profiles").select("id, display_name").in("id", ownerIds);
      if (pErr) { console.error("[DB Error]", pErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
      for (const p of profiles ?? []) names[p.id] = p.display_name ?? "";
    }

    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status ?? "active",
      teacherId: c.owner_id,
      teacherName: names[c.owner_id] || "מלמד ללא שם",
    }));
  });

const assignSchema = z.object({
  classId: z.string().uuid("מזהה כיתה לא תקין"),
  teacherId: z.string().uuid("מזהה מלמד לא תקין"),
});

/** Moves a class of this institution to another teacher of the same institution. */
export const assignClassToTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assignSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireAdminScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cls, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id, institution_id, status")
      .eq("id", data.classId)
      .maybeSingle();
    if (cErr) { console.error("[DB Error]", cErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!cls || cls.institution_id !== scope.institutionId) throw new Error("הכיתה אינה משויכת למוסד שלך");
    if (cls.status === "archived") throw new Error("כיתה בארכיון היא לקריאה בלבד");

    const { data: role, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.teacherId)
      .eq("institution_id", scope.institutionId)
      .limit(1)
      .maybeSingle();
    if (rErr) { console.error("[DB Error]", rErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!role) throw new Error("המלמד אינו משויך למוסד שלך");

    const { error } = await supabaseAdmin
      .from("classes")
      .update({ owner_id: data.teacherId })
      .eq("id", data.classId);
    if (error) { console.error("[DB Error]", error); throw new Error("שיוך הכיתה נכשל. נסה שוב."); }
    return { ok: true as const };
  });

/** Removes a class from the institution without touching its data or owner. */
export const detachClassFromMyInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ classId: z.string().uuid("מזהה כיתה לא תקין") }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireAdminScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("classes")
      .update({ institution_id: null })
      .eq("id", data.classId)
      .eq("institution_id", scope.institutionId);
    if (error) { console.error("[DB Error]", error); throw new Error("הסרת הכיתה מהמוסד נכשלה. נסה שוב."); }
    return { ok: true as const };
  });
