import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SavedSubject = { subject: string; label: string; note: string };
export type SavedConduct = { key: string; label: string };

export type CertificateNoteRow = {
  student_id: string;
  period_key: string;
  teacher_note: string;
  principal_note: string;
  subjects: SavedSubject[] | null;
  conducts: SavedConduct[] | null;
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
      .select("student_id,period_key,teacher_note,principal_note,subjects,conducts")
      .eq("class_id", data.classId)
      .eq("period_key", data.periodKey);
    if (error) {
      console.error("[certificate_notes list]", error);
      throw new Error("טעינת ההערות נכשלה.");
    }
    return (rows ?? []) as unknown as CertificateNoteRow[];
  });

const subjectSchema = z.object({
  subject: z.string().max(120),
  label: z.string().max(80),
  note: z.string().max(400).default(""),
});
const conductSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().max(80),
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
        subjects: z.array(subjectSchema).max(40).nullable().optional(),
        conducts: z.array(conductSchema).min(1).max(20).nullable().optional(),
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
          ...(data.subjects !== undefined ? { subjects: data.subjects } : {}),
          ...(data.conducts !== undefined ? { conducts: data.conducts } : {}),
        },
        { onConflict: "student_id,period_key" },
      );
    if (error) {
      console.error("[certificate_notes upsert]", error);
      throw new Error("שמירת ההערות נכשלה.");
    }
    return { ok: true as const };
  });