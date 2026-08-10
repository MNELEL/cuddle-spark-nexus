import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AUDIT_SOURCE_STUDENT_PROFILES } from "@/lib/audit-sources";

const uuid = z.string().uuid();

export const SENSITIVE_FLAGS = [
  "diagnosis",
  "allergy",
  "learning_disability",
  "aide",
  "family",
  "incident",
  "other",
] as const;

export type SensitiveFlag = (typeof SENSITIVE_FLAGS)[number];

export const sensitiveFlagLabel: Record<SensitiveFlag, string> = {
  diagnosis: "אבחון",
  allergy: "אלרגיה",
  learning_disability: "לקות למידה",
  aide: "סייע",
  family: "מצב משפחתי",
  incident: "תקרית חריגה",
  other: "אחר",
};

/** Single sensitive-info + teaching-guidance record for a student (1:1). */
export const getStudentProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("student_profiles")
      .select("*")
      .eq("student_id", data.studentId)
      .maybeSingle();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return row ?? null;
  });

export const upsertStudentProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    student_id: uuid,
    class_id: uuid,
    sensitive_flags: z.array(z.enum(SENSITIVE_FLAGS)).max(10).default([]),
    sensitive_notes: z.string().max(4000).default(""),
    teaching_style_notes: z.string().max(4000).default(""),
    handoff_notes: z.string().max(4000).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("student_profiles")
      .upsert(
        { ...data, updated_by: context.userId, updated_at: new Date().toISOString() },
        { onConflict: "student_id" },
      );
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת הפרופיל נכשלה. נסה שוב."); }

    // Audit trail: writes to sensitive data are logged, reads are not.
    const { data: cls } = await context.supabase
      .from("classes")
      .select("institution_id")
      .eq("id", data.class_id)
      .maybeSingle();
    const { logInfo } = await import("@/lib/logger.server");
    await logInfo("עודכן מידע רגיש לתלמיד", {
      source: AUDIT_SOURCE_STUDENT_PROFILES,
      userId: context.userId,
      context: {
        action: "student_profile.update",
        student_id: data.student_id,
        class_id: data.class_id,
        institution_id: cls?.institution_id ?? null,
        flag_count: data.sensitive_flags.length,
      },
    });
    return { ok: true };
  });

/** All profiles of a class — used for the rollover preview and the handoff report. */
export const listClassProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid, forHandoffReport: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("student_profiles")
      .select("*, students(name)")
      .eq("class_id", data.classId);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    // Producing the handoff document exports sensitive data — worth an audit row.
    if (data.forHandoffReport) {
      const { data: cls } = await context.supabase
        .from("classes")
        .select("institution_id")
        .eq("id", data.classId)
        .maybeSingle();
      const { logInfo } = await import("@/lib/logger.server");
      await logInfo("הופק מסמך מסירה עם מידע רגיש", {
        source: AUDIT_SOURCE_STUDENT_PROFILES,
        userId: context.userId,
        context: {
          action: "student_profile.handoff_report",
          class_id: data.classId,
          institution_id: cls?.institution_id ?? null,
          profile_count: (rows ?? []).length,
        },
      });
    }

    return (rows ?? []).map((r) => ({
      student_id: r.student_id,
      student_name: (r as { students?: { name: string } | null }).students?.name ?? "",
      sensitive_flags: (r.sensitive_flags ?? []) as string[],
      sensitive_notes: r.sensitive_notes ?? "",
      teaching_style_notes: r.teaching_style_notes ?? "",
      handoff_notes: r.handoff_notes ?? "",
      updated_at: r.updated_at,
    }));
  });