import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AUDIT_SOURCE_STUDENT_DAILY } from "./audit-sources";

/**
 * ייבוא תיעוד יומי מקובץ Excel לתוך התיעוד של הכיתה:
 * נוכחות, ציון והערת תיעוד לכל תלמיד, לפי התאריך שבשורה.
 * ההתאמה לתלמיד נעשית לפי השם (התאמה מדויקת, ואם אין — התחלה/הכלה חד-משמעית).
 */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");

const rowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  date: isoDate,
  status: z.enum(["present", "absent", "late", "excused"]).nullable().default(null),
  grade: z.number().min(0).max(100).nullable().default(null),
  subject: z.string().trim().max(60).default(""),
  note: z.string().trim().max(2000).default(""),
});

export type DailyLogImportResult = {
  imported: number;
  attendance: number;
  grades: number;
  notes: number;
  unmatched: string[];
};

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export const importDailyLogRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        rows: z.array(rowSchema).min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<DailyLogImportResult> => {
    const supabase = context.supabase as any;

    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id,owner_id,status")
      .eq("id", data.classId)
      .maybeSingle();
    if (clsErr) { console.error("[DB Error]", clsErr); throw new Error("בדיקת ההרשאות נכשלה."); }
    if (!cls || cls.owner_id !== context.userId) throw new Error("הכיתה לא נמצאה");
    if (cls.status === "archived") throw new Error("הכיתה בארכיון — לא ניתן להוסיף תיעוד.");

    const { data: students, error: stErr } = await supabase
      .from("students")
      .select("id,name")
      .eq("class_id", data.classId);
    if (stErr) { console.error("[DB Error]", stErr); throw new Error("טעינת התלמידים נכשלה."); }

    const byName = new Map<string, string>();
    for (const s of (students ?? []) as { id: string; name: string }[]) {
      byName.set(normalize(s.name), s.id);
    }
    const matchStudent = (raw: string): string | null => {
      const n = normalize(raw);
      const exact = byName.get(n);
      if (exact) return exact;
      const partial = Array.from(byName.entries()).filter(
        ([name]) => name.includes(n) || n.includes(name),
      );
      return partial.length === 1 ? partial[0]![1] : null;
    };

    const result: DailyLogImportResult = {
      imported: 0, attendance: 0, grades: 0, notes: 0, unmatched: [],
    };

    for (const row of data.rows) {
      const studentId = matchStudent(row.name);
      if (!studentId) {
        if (!result.unmatched.includes(row.name)) result.unmatched.push(row.name);
        continue;
      }

      if (row.status) {
        const { error } = await supabase.from("attendance").upsert(
          { class_id: data.classId, student_id: studentId, date: row.date, status: row.status, notes: "" },
          { onConflict: "student_id,date" },
        );
        if (error) { console.error("[DB Error]", error); throw new Error("שמירת הנוכחות נכשלה."); }
        result.attendance++;
      }

      if (row.grade !== null) {
        const { error } = await supabase.from("grades").insert({
          class_id: data.classId,
          student_id: studentId,
          subject: row.subject || "כללי",
          value: row.grade,
          max_value: 100,
          date: row.date,
          notes: "",
        });
        if (error) { console.error("[DB Error]", error); throw new Error("שמירת הציון נכשלה."); }
        result.grades++;
      }

      if (row.note) {
        const { error } = await supabase.from("orchestrator_insights").insert({
          owner_id: context.userId,
          class_id: data.classId,
          student_id: studentId,
          insight_type: "manual",
          insight_date: row.date,
          severity: "low",
          title: "תיעוד מקובץ Excel",
          description: row.note,
        });
        if (error) { console.error("[DB Error]", error); throw new Error("שמירת התיעוד נכשלה."); }
        result.notes++;
      }

      result.imported++;
    }

    if (result.imported > 0) {
      await supabase.from("app_logs").insert({
        user_id: context.userId,
        source: AUDIT_SOURCE_STUDENT_DAILY,
        level: "info",
        message:
          `ייבוא תיעוד יומי מקובץ: ${result.imported} תלמידים · נוכחות ${result.attendance} · ` +
          `ציונים ${result.grades} · תיעוד ${result.notes}`,
        context: { class_id: data.classId, unmatched: result.unmatched.length },
      });
    }

    return result;
  });
