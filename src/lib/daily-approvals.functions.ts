import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AUDIT_SOURCE_STUDENT_DAILY } from "./audit-sources";

/**
 * אישור המלמד לתיעוד היומי של תלמיד: סימון שהתיעוד ליום הזה נבדק ואושר,
 * עם שם המאשר והערה. האישור נספר בדוח התיעוד היומי.
 */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");

export type DailyApproval = {
  id: string;
  student_id: string;
  date: string;
  approver_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

async function ownedStudent(supabase: any, studentId: string, userId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("id,class_id,classes!inner(owner_id)")
    .eq("id", studentId)
    .maybeSingle();
  if (error) {
    console.error("[DB Error]", error);
    throw new Error("בדיקת ההרשאות נכשלה.");
  }
  if (!data || data.classes?.owner_id !== userId) throw new Error("התלמיד לא נמצא");
  return data.class_id as string;
}

/** האישור הקיים לתלמיד ביום מסוים (אם יש). */
export const getDailyApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid(), date: isoDate }).parse(d))
  .handler(async ({ data, context }): Promise<DailyApproval | null> => {
    const supabase = context.supabase as any;
    await ownedStudent(supabase, data.studentId, context.userId);
    const { data: row, error } = await supabase
      .from("daily_log_approvals")
      .select("id,student_id,date,approver_name,notes,created_at,updated_at")
      .eq("student_id", data.studentId)
      .eq("date", data.date)
      .maybeSingle();
    if (error) {
      console.error("[DB Error]", error);
      throw new Error("טעינת האישור נכשלה.");
    }
    return row ? ({ ...row, date: String(row.date).slice(0, 10) } as DailyApproval) : null;
  });

/** שמירת אישור המלמד לתיעוד היומי (אישור אחד לתלמיד לכל יום). */
export const saveDailyApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        studentId: z.string().uuid(),
        date: isoDate,
        approverName: z.string().trim().max(120).default(""),
        notes: z.string().trim().max(1000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const userId = context.userId;
    const classId = await ownedStudent(supabase, data.studentId, userId);

    const { error } = await supabase.from("daily_log_approvals").upsert(
      {
        owner_id: userId,
        class_id: classId,
        student_id: data.studentId,
        date: data.date,
        approver_name: data.approverName,
        notes: data.notes,
      },
      { onConflict: "student_id,date" },
    );
    if (error) {
      console.error("[DB Error]", error);
      throw new Error("שמירת האישור נכשלה.");
    }

    await supabase.from("app_logs").insert({
      user_id: userId,
      source: AUDIT_SOURCE_STUDENT_DAILY,
      level: "info",
      message: `אישור תיעוד יומי (${data.date})${data.approverName ? ` על ידי ${data.approverName}` : ""}`,
      context: { student_id: data.studentId, class_id: classId, date: data.date, approval: true },
    });

    return { ok: true };
  });

/** ביטול אישור התיעוד היומי. */
export const removeDailyApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid(), date: isoDate }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const userId = context.userId;
    const classId = await ownedStudent(supabase, data.studentId, userId);
    const { error } = await supabase
      .from("daily_log_approvals")
      .delete()
      .eq("student_id", data.studentId)
      .eq("date", data.date);
    if (error) {
      console.error("[DB Error]", error);
      throw new Error("ביטול האישור נכשל.");
    }
    await supabase.from("app_logs").insert({
      user_id: userId,
      source: AUDIT_SOURCE_STUDENT_DAILY,
      level: "info",
      message: `אישור התיעוד היומי בוטל (${data.date})`,
      context: { student_id: data.studentId, class_id: classId, date: data.date, approval: false },
    });
    return { ok: true };
  });
