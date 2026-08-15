import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClassEventType = "birthday" | "exam" | "trip" | "holiday" | "meeting" | "special_exam" | "celebration" | "other";

export type ClassEvent = {
  id: string;
  class_id: string;
  title: string;
  type: ClassEventType;
  date: string;
  end_date: string | null;
  student_id: string | null;
  notes: string | null;
  color: string | null;
};

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listClassEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      from: dateStr,
      to: dateStr,
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ClassEvent[]> => {
    const { data: rows, error } = await context.supabase
      .from("class_events")
      .select("id,class_id,title,type,date,end_date,student_id,notes,color")
      .eq("class_id", data.classId)
      .gte("date", data.from)
      .lte("date", data.to)
      .order("date", { ascending: true });
    if (error) {
      console.error("[class_events list]", error);
      throw new Error("טעינת האירועים נכשלה.");
    }
    return (rows ?? []) as ClassEvent[];
  });

export const upsertClassEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      classId: z.string().uuid(),
      title: z.string().min(1).max(200),
      type: z.enum(["birthday", "exam", "trip", "holiday", "meeting", "special_exam", "celebration", "other"]),
      date: dateStr,
      endDate: dateStr.nullable().optional(),
      studentId: z.string().uuid().nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
      color: z.string().max(20).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload: any = {
      class_id: data.classId,
      title: data.title.trim(),
      type: data.type,
      date: data.date,
      end_date: data.endDate ?? null,
      student_id: data.studentId ?? null,
      notes: data.notes ?? null,
      color: data.color ?? null,
    };

    const translateError = (err: any): string | null => {
      const msg = String(err?.message ?? "");
      if (msg.includes("CLASS_ARCHIVED_READONLY")) {
        return "הכיתה בארכיון — החזר אותה לפעילות כדי להוסיף אירועים";
      }
      if (err?.code === "23502") {
        return "פג תוקף החיבור שלך — רענן את הדף והתחבר מחדש";
      }
      if (
        err?.code === "42501" ||
        msg.toLowerCase().includes("permission denied") ||
        msg.toLowerCase().includes("insufficient privilege")
      ) {
        return "אין לך הרשאה להוסיף אירוע לכיתה זו";
      }
      return null;
    };

    if (data.id) {
      const { error } = await context.supabase.from("class_events").update(payload).eq("id", data.id);
      if (error) {
        console.error("[class_events upsert]", error);
        throw new Error(translateError(error) ?? "עדכון האירוע נכשל.");
      }
      return { ok: true as const, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("class_events").insert(payload).select("id").single();
    if (error || !row) {
      console.error("[class_events upsert]", error);
      const fallback = error ? (translateError(error) ?? "יצירת האירוע נכשלה.") : "יצירת האירוע נכשלה.";
      throw new Error(fallback);
    }
    return { ok: true as const, id: row.id };
  });

export const deleteClassEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("class_events").delete().eq("id", data.id);
    if (error) throw new Error("מחיקת האירוע נכשלה.");
    return { ok: true as const };
  });
