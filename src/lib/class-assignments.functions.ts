import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AUDIT_SOURCE_INSTITUTIONS } from "@/lib/audit-sources";

const FAIL = "הפעולה נכשלה. נסה שוב.";
const ARCHIVED_MSG = "הכיתה בארכיון — החזר אותה לפעילות כדי לערוך";

export type ClassLibraryLink = {
  connected: boolean;
  lessonCount: number;
  bulletinCount: number;
};

export type ClassAssignmentRow = {
  id: string;
  name: string;
  academicYear: string | null;
  status: string;
  institutionId: string | null;
  institutionName: string | null;
  teacherId: string;
  teacherName: string;
  isMine: boolean;
  library: ClassLibraryLink;
};

type Scope =
  | { kind: "admin" }
  | { kind: "principal"; institutionId: string }
  | { kind: "teacher" };

/** Derives the caller's management scope from their own role rows only. */
async function resolveScope(supabase: SupabaseClient<Database>, userId: string): Promise<Scope> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, institution_id")
    .eq("user_id", userId);
  if (error) { console.error("[DB Error]", error); throw new Error(FAIL); }
  const rows = data ?? [];
  if (rows.some((r) => r.role === "admin" && !r.institution_id)) return { kind: "admin" };
  const managed = rows.find(
    (r) => r.institution_id && (r.role === "principal" || r.role === "admin"),
  );
  if (managed?.institution_id) return { kind: "principal", institutionId: managed.institution_id };
  return { kind: "teacher" };
}

async function libraryLinks(
  supabase: SupabaseClient<Database>,
  classIds: string[],
): Promise<Record<string, ClassLibraryLink>> {
  const out: Record<string, ClassLibraryLink> = {};
  for (const id of classIds) out[id] = { connected: false, lessonCount: 0, bulletinCount: 0 };
  if (classIds.length === 0) return out;

  const { data: lessons } = await supabase
    .from("weekly_lessons")
    .select("class_id, library_item_id")
    .in("class_id", classIds)
    .not("library_item_id", "is", null);
  for (const l of lessons ?? []) {
    const entry = out[l.class_id];
    if (entry) entry.lessonCount += 1;
  }

  const { data: bulletins } = await supabase
    .from("weekly_bulletins")
    .select("id, class_id")
    .in("class_id", classIds);
  const bulletinIds = (bulletins ?? []).map((b) => b.id);
  if (bulletinIds.length > 0) {
    const { data: links } = await supabase
      .from("bulletin_resources")
      .select("bulletin_id")
      .in("bulletin_id", bulletinIds);
    const classOfBulletin = new Map((bulletins ?? []).map((b) => [b.id, b.class_id]));
    const counted = new Set<string>();
    for (const link of links ?? []) {
      if (counted.has(link.bulletin_id)) continue;
      counted.add(link.bulletin_id);
      const classId = classOfBulletin.get(link.bulletin_id);
      const entry = classId ? out[classId] : undefined;
      if (entry) entry.bulletinCount += 1;
    }
  }

  for (const id of classIds) {
    const entry = out[id]!;
    entry.connected = entry.lessonCount > 0 || entry.bulletinCount > 0;
  }
  return out;
}

/** Library connection status for one class (lessons or bulletins referencing library items). */
export const getClassLibraryLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClassLibraryLink> => {
    const links = await libraryLinks(context.supabase, [data.classId]);
    return links[data.classId] ?? { connected: false, lessonCount: 0, bulletinCount: 0 };
  });

/** Class -> institution / teacher / library assignments, scoped to what the caller may see. */
export const listClassAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const scope = await resolveScope(supabase, userId);

    type Row = {
      id: string; name: string; academic_year: string | null; status: string;
      institution_id: string | null; owner_id: string;
    };
    const select = "id, name, academic_year, status, institution_id, owner_id";
    let rows: Row[] = [];

    if (scope.kind === "teacher") {
      const { data, error } = await supabase
        .from("classes").select(select).eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (error) { console.error("[DB Error]", error); throw new Error(FAIL); }
      rows = (data ?? []) as Row[];
    } else {
      // Privileged read only after the caller's management role is verified.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      let query = supabaseAdmin.from("classes").select(select).order("created_at", { ascending: false });
      if (scope.kind === "principal") query = query.eq("institution_id", scope.institutionId);
      const { data, error } = await query;
      if (error) { console.error("[DB Error]", error); throw new Error(FAIL); }
      rows = (data ?? []) as Row[];
    }

    const names: Record<string, string> = {};
    const institutionNames: Record<string, string> = {};
    if (rows.length > 0) {
      if (scope.kind === "teacher") {
        names[userId] = "אני";
      } else {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id)));
        const { data: profiles } = await supabaseAdmin
          .from("profiles").select("id, display_name").in("id", ownerIds);
        for (const p of profiles ?? []) names[p.id] = p.display_name ?? "";
        const instIds = Array.from(
          new Set(rows.map((r) => r.institution_id).filter((v): v is string => !!v)),
        );
        if (instIds.length > 0) {
          const { data: insts } = await supabaseAdmin
            .from("institutions").select("id, name").in("id", instIds);
          for (const i of insts ?? []) institutionNames[i.id] = i.name;
        }
      }
    }

    const links = await libraryLinks(supabase, rows.map((r) => r.id));

    const list: ClassAssignmentRow[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      academicYear: r.academic_year,
      status: r.status,
      institutionId: r.institution_id,
      institutionName: r.institution_id ? institutionNames[r.institution_id] ?? "מוסד" : null,
      teacherId: r.owner_id,
      teacherName: names[r.owner_id] || (r.owner_id === userId ? "אני" : "מלמד ללא שם"),
      isMine: r.owner_id === userId,
      library: links[r.id] ?? { connected: false, lessonCount: 0, bulletinCount: 0 },
    }));

    return { canManage: scope.kind !== "teacher", scope: scope.kind, classes: list };
  });

async function requireManager(supabase: SupabaseClient<Database>, userId: string, classId: string) {
  const scope = await resolveScope(supabase, userId);
  if (scope.kind === "teacher") throw new Error("אין לך הרשאה לשנות שיוך של כיתה");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cls, error } = await supabaseAdmin
    .from("classes")
    .select("id, status, institution_id, owner_id, name")
    .eq("id", classId)
    .maybeSingle();
  if (error) { console.error("[DB Error]", error); throw new Error(FAIL); }
  if (!cls) throw new Error("הכיתה לא נמצאה");
  if (cls.status === "archived") throw new Error(ARCHIVED_MSG);
  if (scope.kind === "principal" && cls.institution_id !== scope.institutionId) {
    throw new Error("הכיתה אינה משויכת למוסד שלך");
  }
  return { scope, cls, supabaseAdmin };
}

/** Clears the class -> institution link. */
export const detachClassInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { cls, supabaseAdmin } = await requireManager(supabase, userId, data.classId);

    const { error } = await supabaseAdmin
      .from("classes")
      .update({ institution_id: null, updated_at: new Date().toISOString() })
      .eq("id", data.classId);
    if (error) { console.error("[DB Error]", error); throw new Error(FAIL); }

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo(`כיתה נותקה ממוסד: ${cls.name}`, {
      source: AUDIT_SOURCE_INSTITUTIONS,
      userId,
      context: { action: "class.detach_institution", class_id: data.classId, previous_institution_id: cls.institution_id },
    });
    return { ok: true };
  });

/** Reassigns a class to another institution and/or another teacher (owner). */
export const reassignClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      institutionId: z.string().uuid().nullable().optional(),
      teacherId: z.string().uuid().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { scope, cls, supabaseAdmin } = await requireManager(supabase, userId, data.classId);

    const targetInstitution =
      data.institutionId === undefined ? cls.institution_id : data.institutionId;

    if (scope.kind === "principal" && targetInstitution !== scope.institutionId) {
      throw new Error("מנהל מוסד יכול לשייך כיתות למוסד שלו בלבד");
    }

    if (data.teacherId && data.teacherId !== cls.owner_id) {
      if (!targetInstitution) throw new Error("כדי להעביר בעלות יש לשייך את הכיתה למוסד");
      const { data: role, error: rErr } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", data.teacherId)
        .eq("institution_id", targetInstitution)
        .limit(1);
      if (rErr) { console.error("[DB Error]", rErr); throw new Error(FAIL); }
      if ((role ?? []).length === 0) throw new Error("המלמד הנבחר אינו משויך למוסד זה");
    }

    const { error } = await supabaseAdmin
      .from("classes")
      .update({
        institution_id: targetInstitution,
        ...(data.teacherId ? { owner_id: data.teacherId } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.classId);
    if (error) { console.error("[DB Error]", error); throw new Error(FAIL); }

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo(`שיוך כיתה עודכן: ${cls.name}`, {
      source: AUDIT_SOURCE_INSTITUTIONS,
      userId,
      context: {
        action: "class.reassign",
        class_id: data.classId,
        institution_id: targetInstitution,
        owner_id: data.teacherId ?? cls.owner_id,
        previous_institution_id: cls.institution_id,
        previous_owner_id: cls.owner_id,
      },
    });
    return { ok: true };
  });

/** Teachers assignable to a class: members of the target institution. */
export const listAssignableTeachers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ institutionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await resolveScope(supabase, userId);
    if (scope.kind === "teacher") throw new Error("אין לך הרשאה לצפות ברשימת המלמדים");
    if (scope.kind === "principal" && scope.institutionId !== data.institutionId) {
      throw new Error("אין לך הרשאה למוסד זה");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("institution_id", data.institutionId);
    if (error) { console.error("[DB Error]", error); throw new Error(FAIL); }

    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, display_name").in("id", ids);
    return (profiles ?? [])
      .map((p) => ({ id: p.id, name: p.display_name || "מלמד ללא שם" }))
      .sort((a, b) => a.name.localeCompare(b.name, "he"));
  });
