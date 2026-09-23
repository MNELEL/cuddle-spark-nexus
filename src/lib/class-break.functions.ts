/**
 * חופשה בכיתה של המלמד המחובר — מתוך מסך הסקירה ("ממתין לאישור").
 *
 * החופשה נרשמת ב-academic_calendar_overrides, ולכן היא מופיעה מיד בלוח השנה
 * של הכיתה, בלוח היומי, בדוח התיעוד היומי ובדוח הפגישות של המוסד. אם הוזן
 * תאריך-החלוף, הוא מוחל על התלמידים בכיתה (מעבירי שנה).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");

const schema = z
  .object({
    classId: z.string().uuid(),
    startDate: dateStr,
    endDate: dateStr,
    label: z.string().trim().min(2, "הוסף תיאור לחופשה").max(200),
    type: z
      .enum(["institution_break", "unexpected_closure", "holiday"])
      .default("institution_break"),
    rolloverDate: dateStr.nullable().optional(),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה",
    path: ["endDate"],
  });

export const addClassBreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: cls, error: cErr } = await supabase
      .from("classes")
      .select("id,status,name")
      .eq("id", data.classId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (cErr) {
      console.error("[DB Error]", cErr);
      throw new Error("הפעולה נכשלה. נסה שוב.");
    }
    if (!cls) throw new Error("אין הרשאה לכיתה זו");
    if (cls.status === "archived") throw new Error("הכיתה בארכיון — החזר אותה לפעילות כדי לערוך");

    const { error } = await supabase.from("academic_calendar_overrides").insert({
      class_id: data.classId,
      start_date: data.startDate,
      end_date: data.endDate,
      type: data.type,
      label: data.label,
    });
    if (error) {
      console.error("[DB Error]", error);
      throw new Error("שמירת החופשה נכשלה");
    }

    let rolloverStudents = 0;
    if (data.rolloverDate) {
      const { data: updated, error: uErr } = await supabase
        .from("students")
        .update({ start_date: data.rolloverDate })
        .eq("class_id", data.classId)
        .select("id");
      if (uErr) {
        console.error("[DB Error]", uErr);
        throw new Error("עדכון תאריך-החלוף נכשל");
      }
      rolloverStudents = (updated ?? []).length;
    }

    return { ok: true as const, className: cls.name, rolloverStudents };
  });
