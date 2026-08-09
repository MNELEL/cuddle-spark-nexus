import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logInfo } from "@/lib/logger.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { previousGradeName, defaultAcademicYear } from "@/lib/year-rollover";

const ARCHIVED_MSG = "הכיתה בארכיון — החזר אותה לפעילות כדי לערוך";

/** Throws a readable Hebrew error when the class is archived (read-only). */
async function assertClassEditable(supabase: SupabaseClient<Database>, classId: string) {
  const { data, error } = await supabase
    .from("classes")
    .select("status")
    .eq("id", classId)
    .maybeSingle();
  if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
  if (data?.status === "archived") throw new Error(ARCHIVED_MSG);
}

async function resolveInstitutionId(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("institution_id")
    .eq("user_id", userId)
    .not("institution_id", "is", null)
    .limit(1);
  return data?.[0]?.institution_id ?? null;
}

export const listClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("classes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return data ?? [];
  });

export const createClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().min(1).max(100),
      academic_year: z.string().trim().max(30).optional(),
      parent_class_id: z.string().uuid().nullable().optional(),
      copy_student_ids: z.array(z.string().uuid()).max(300).optional(),
      archive_parent: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const institutionId = await resolveInstitutionId(supabase, userId);

    type ParentInfo = {
      id: string; grid_cols: number; grid_rows: number;
      hidden_seats: unknown; room_objects: unknown;
    };
    let parent: ParentInfo | null = null;
    if (data.parent_class_id) {
      const { data: p, error: pe } = await supabase
        .from("classes")
        .select("id, grid_cols, grid_rows, hidden_seats, room_objects")
        .eq("id", data.parent_class_id)
        .maybeSingle();
      if (pe) { console.error("[DB Error]", pe); throw new Error("הפעולה נכשלה. נסה שוב."); }
      if (!p) throw new Error("הכיתה הקודמת לא נמצאה");
      parent = p as ParentInfo;
    }

    const { data: row, error } = await supabase
      .from("classes")
      .insert({
        name: data.name,
        owner_id: userId,
        academic_year: data.academic_year?.trim() || defaultAcademicYear(),
        institution_id: institutionId,
        parent_class_id: data.parent_class_id ?? null,
        ...(parent
          ? {
              grid_cols: parent.grid_cols,
              grid_rows: parent.grid_rows,
              hidden_seats: parent.hidden_seats as never,
              room_objects: parent.room_objects as never,
            }
          : {}),
      })
      .select()
      .single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    let copiedStudents = 0;
    if (parent && data.copy_student_ids && data.copy_student_ids.length > 0) {
      const { data: src, error: se } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", parent.id)
        .in("id", data.copy_student_ids);
      if (se) { console.error("[DB Error]", se); throw new Error("הפעולה נכשלה. נסה שוב."); }

      const rows = (src ?? []).map((s) => ({
        class_id: row.id,
        name: s.name,
        gender: s.gender,
        height: s.height,
        row_pref: s.row_pref,
        corner_pref: s.corner_pref,
        national_id: s.national_id,
        birth_date: s.birth_date,
        address: s.address,
        father_name: s.father_name,
        father_id: s.father_id,
        father_phone: s.father_phone,
        mother_name: s.mother_name,
        mother_id: s.mother_id,
        mother_phone: s.mother_phone,
        has_special_accommodation: s.has_special_accommodation,
        accommodation_note: s.accommodation_note,
      }));

      if (rows.length > 0) {
        const { data: inserted, error: ie } = await supabase
          .from("students")
          .insert(rows)
          .select("id, name");
        if (ie) { console.error("[DB Error]", ie); throw new Error("העברת התלמידים נכשלה. נסה שוב."); }
        copiedStudents = inserted?.length ?? 0;

        const byName = new Map<string, string>();
        for (const r of inserted ?? []) if (!byName.has(r.name)) byName.set(r.name, r.id);
        const idMap = new Map<string, string>();
        for (const s of src ?? []) {
          const nid = byName.get(s.name);
          if (nid) idMap.set(s.id, nid);
        }

        const { data: rels } = await supabase
          .from("student_relations")
          .select("student_a, student_b, kind")
          .eq("class_id", parent.id);
        const relRows = (rels ?? [])
          .filter((r) => idMap.has(r.student_a) && idMap.has(r.student_b))
          .map((r) => ({
            class_id: row.id,
            student_a: idMap.get(r.student_a)!,
            student_b: idMap.get(r.student_b)!,
            kind: r.kind,
          }));
        if (relRows.length > 0) {
          const { error: re } = await supabase.from("student_relations").insert(relRows);
          if (re) console.error("[DB Error]", re);
        }

        // Sensitive info + teaching guidance must travel with the student to the
        // new class — part of the same rollover flow, failures are surfaced.
        const { data: profiles, error: pe } = await supabase
          .from("student_profiles")
          .select("student_id, sensitive_flags, sensitive_notes, teaching_style_notes, handoff_notes")
          .eq("class_id", parent.id);
        if (pe) { console.error("[DB Error]", pe); throw new Error("העברת פרופילי התלמידים נכשלה. נסה שוב."); }
        const profileRows = (profiles ?? [])
          .filter((p) => idMap.has(p.student_id))
          .map((p) => ({
            student_id: idMap.get(p.student_id)!,
            class_id: row.id,
            sensitive_flags: p.sensitive_flags ?? [],
            sensitive_notes: p.sensitive_notes ?? "",
            teaching_style_notes: p.teaching_style_notes ?? "",
            handoff_notes: p.handoff_notes ?? "",
          }));
        if (profileRows.length > 0) {
          const { error: pie } = await supabase
            .from("student_profiles")
            .upsert(profileRows, { onConflict: "student_id" });
          if (pie) { console.error("[DB Error]", pie); throw new Error("העברת פרופילי התלמידים נכשלה. נסה שוב."); }
        }
      }
    }

    if (parent && data.archive_parent) {
      const { error: ae } = await supabase
        .from("classes")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", parent.id);
      if (ae) console.error("[DB Error]", ae);
    }

    await logInfo(parent ? "מעבר שנה: נוצרה כיתה חדשה" : "כיתה חדשה נוצרה", {
      source: "year_rollover",
      userId,
      context: {
        newClassId: row.id,
        newClassName: row.name,
        parentClassId: data.parent_class_id ?? null,
        copiedStudents,
        archivedParent: !!(parent && data.archive_parent),
      },
    });

    return { ...row, copiedStudents };
  });

/** Suggests a previous-year class to link to, by consecutive Hebrew grade letters. */
export const suggestParentClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("classes")
      .select("id, name, academic_year, status, created_at")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const candidates = (rows ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      academicYear: c.academic_year,
      status: c.status,
    }));

    const prevName = previousGradeName(data.name.trim());
    const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
    const suggested = prevName
      ? candidates.find((c) => norm(c.name) === norm(prevName)) ?? null
      : null;

    return { suggested, suggestedName: prevName, candidates };
  });

/** Students of a source class, for the rollover copy step. */
export const listRolloverStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("students")
      .select("id, name")
      .eq("class_id", data.classId)
      .order("name");
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const { data: profiles } = await context.supabase
      .from("student_profiles")
      .select("student_id, sensitive_flags, sensitive_notes, teaching_style_notes, handoff_notes")
      .eq("class_id", data.classId);
    const byStudent = new Map((profiles ?? []).map((p) => [p.student_id, p]));

    return (rows ?? []).map((s) => {
      const p = byStudent.get(s.id);
      return {
        id: s.id,
        name: s.name,
        hasSensitive: !!p && ((p.sensitive_flags?.length ?? 0) > 0 || !!p.sensitive_notes),
        hasGuidance: !!p && (!!p.teaching_style_notes || !!p.handoff_notes),
      };
    });
  });

/** Previous / next classes in the same year-rollover chain. */
export const getClassChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: cls, error } = await supabase
      .from("classes")
      .select("id, parent_class_id")
      .eq("id", data.classId)
      .maybeSingle();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    let previous: { id: string; name: string; academicYear: string | null } | null = null;
    if (cls?.parent_class_id) {
      const { data: p } = await supabase
        .from("classes")
        .select("id, name, academic_year")
        .eq("id", cls.parent_class_id)
        .maybeSingle();
      if (p) previous = { id: p.id, name: p.name, academicYear: p.academic_year };
    }

    const { data: kids } = await supabase
      .from("classes")
      .select("id, name, academic_year")
      .eq("parent_class_id", data.classId)
      .order("created_at", { ascending: false });

    return {
      previous,
      next: (kids ?? []).map((k) => ({ id: k.id, name: k.name, academicYear: k.academic_year })),
    };
  });

export const getClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("classes")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return row;
  });

export const ROOM_OBJECT_TYPES = [
  "board", "teacher_desk", "cabinet", "reading_corner", "door", "window",
] as const;
export type RoomObjectType = typeof ROOM_OBJECT_TYPES[number];
export type RoomObject = {
  id: string;
  type: RoomObjectType;
  row: number;
  col: number;
  span?: number;
  label?: string;
};

const roomObjectSchema = z.object({
  id: z.string().min(1).max(60),
  type: z.enum(ROOM_OBJECT_TYPES),
  row: z.number().int().min(0).max(30),
  col: z.number().int().min(0).max(30),
  span: z.number().int().min(1).max(6).optional(),
  label: z.string().max(60).optional(),
});

export const updateClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      grid_cols: z.number().int().min(1).max(20).optional(),
      grid_rows: z.number().int().min(1).max(20).optional(),
      academic_year: z.string().trim().max(30).optional(),
      teacher_name: z.string().trim().max(80).optional(),
      room_objects: z.array(roomObjectSchema).max(60).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    await assertClassEditable(context.supabase, id);
    const { error } = await context.supabase
      .from("classes")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

export const deleteClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertClassEditable(context.supabase, data.id);
    const { error } = await context.supabase.from("classes").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

export const setClassStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["active", "archived"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Read the owner before the update so we know whether someone else (e.g. an
    // institution admin) archived this class and the owner must be notified.
    const { data: before } = await context.supabase
      .from("classes")
      .select("owner_id, name")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await context.supabase
      .from("classes")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (data.status === "archived") {
      if (before?.owner_id && before.owner_id !== context.userId) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: ne } = await supabaseAdmin.from("class_notifications").insert({
          class_id: data.id,
          class_name: before.name,
          recipient_id: before.owner_id,
          type: "class_archived",
        });
        if (ne) console.error("[Notify Error]", ne);
      }
      await logInfo("כיתה הועברה לארכיון", {
        source: "year_rollover",
        userId: context.userId,
        context: { classId: data.id },
      });
    }
    return { ok: true };
  });