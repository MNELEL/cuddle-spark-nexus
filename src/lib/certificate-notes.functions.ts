import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CertificateNoteRow = {
  student_id: string;
  period_key: string;
  teacher_note: string;
  principal_note: string;
};

/** Loads all saved notes for a class + period. */
export const listCertificateNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        periodKey: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<CertificateNoteRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("certificate_notes")
      .select("student_id,period_key,teacher_note,principal_note")
      .eq("class_id", data.classId)
      .eq("period_key", data.periodKey);
    if (error) {
      console.error("[certificate_notes list]", error);
      throw new Error("טעינת ההערות נכשלה.");
    }
    return (rows ?? []) as CertificateNoteRow[];
  });

/** Upserts a single student's note row for a given period. */
export const upsertCertificateNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        studentId: z.string().uuid(),
        periodKey: z.string().min(1).max(120),
        teacherNote: z.string().max(4000).default(""),
        principalNote: z.string().max(4000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("certificate_notes")
      .upsert(
        {
          class_id: data.classId,
          student_id: data.studentId,
          period_key: data.periodKey,
          teacher_note: data.teacherNote,
          principal_note: data.principalNote,
        },
        { onConflict: "student_id,period_key" },
      );
    if (error) {
      console.error("[certificate_notes upsert]", error);
      throw new Error("שמירת ההערות נכשלה.");
    }
    return { ok: true as const };
  });