import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * מעקב יומי לכיתה: שעות היום, דירוג לכל תלמיד בכל שעה,
 * נוכחות, חוסרים, אירועים חריגים ובונוסים.
 * הכל ליום אחד, עם בדיקת בעלות על הכיתה בכל קריאה.
 */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");
const level = z.number().int().min(1).max(3);

export type DaySlot = { id: string; label: string; order_index: number; rated: boolean };
export type DayRating = {
  student_id: string;
  slot_id: string;
  readiness: number;
  listening: number;
  behavior: number;
  work_done: number;
};
export type DayEventKind = "missing_writing" | "missing_books" | "exceptional";
export type DayEvent = { id: string; student_id: string; kind: DayEventKind; note: string };
export type DayAttendance = { student_id: string; status: string };
export type DayBonus = { id: string; student_id: string; points: number; note: string };
export type DayData = {
  slots: DaySlot[];
  ratings: DayRating[];
  events: DayEvent[];
  attendance: DayAttendance[];
  bonuses: DayBonus[];
};

/** סדר היום ההתחלתי. נוצר פעם אחת לכל כיתה, ואפשר לשנות אותו אחר כך. */
const DEFAULT_SLOTS: { label: string; rated: boolean }[] = [
  { label: "נוכחות", rated: false },
  { label: "תפילה", rated: true },
  { label: "שיעור 1", rated: true },
  { label: "ארוחת בוקר", rated: false },
  { label: "שיעור 2", rated: true },
  { label: "ארוחת צהריים", rated: false },
  { label: "שיעור 3", rated: true },
  { label: "שיעור הרמת כיסא", rated: true },
];

async function ownedClass(supabase: any, classId: string, userId: string) {
  const { data, error } = await supabase
    .from("classes")
    .select("id,owner_id")
    .eq("id", classId)
    .maybeSingle();
  if (error) { console.error("[DB Error]", error); throw new Error("בדיקת ההרשאות נכשלה."); }
  if (!data || data.owner_id !== userId) throw new Error("הכיתה לא נמצאה");
}

async function loadSlots(supabase: any, classId: string): Promise<DaySlot[]> {
  const { data, error } = await supabase
    .from("class_day_slots")
    .select("id,label,order_index,rated")
    .eq("class_id", classId)
    .eq("active", true)
    .order("order_index", { ascending: true });
  if (error) { console.error("[DB Error]", error); throw new Error("טעינת סדר היום נכשלה."); }
  return (data ?? []) as DaySlot[];
}

/** כל נתוני היום: שעות, דירוגים, נוכחות, אירועים ובונוסים. */
export const getDayData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid(), date: isoDate }).parse(d))
  .handler(async ({ data, context }): Promise<DayData> => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);

    let slots = await loadSlots(supabase, data.classId);
    if (slots.length === 0) {
      const { error } = await supabase.from("class_day_slots").insert(
        DEFAULT_SLOTS.map((s, i) => ({
          class_id: data.classId,
          label: s.label,
          rated: s.rated,
          order_index: i + 1,
        })),
      );
      if (error) { console.error("[DB Error]", error); throw new Error("יצירת סדר היום נכשלה."); }
      slots = await loadSlots(supabase, data.classId);
    }

    const [ratings, events, att, bonus] = await Promise.all([
      supabase
        .from("session_ratings")
        .select("student_id,slot_id,readiness,listening,behavior,work_done")
        .eq("class_id", data.classId)
        .eq("date", data.date),
      supabase
        .from("daily_student_events")
        .select("id,student_id,kind,note")
        .eq("class_id", data.classId)
        .eq("date", data.date)
        .order("created_at", { ascending: true }),
      supabase
        .from("attendance")
        .select("student_id,status")
        .eq("class_id", data.classId)
        .eq("date", data.date),
      supabase
        .from("behavior_points")
        .select("id,student_id,points,note")
        .eq("class_id", data.classId)
        .eq("date", data.date)
        .eq("category", "bonus")
        .order("created_at", { ascending: true }),
    ]);
    for (const r of [ratings, events, att, bonus]) {
      if (r.error) { console.error("[DB Error]", r.error); throw new Error("טעינת נתוני היום נכשלה."); }
    }

    return {
      slots,
      ratings: (ratings.data ?? []) as DayRating[],
      events: ((events.data ?? []) as any[]).map((e) => ({
        id: e.id as string,
        student_id: e.student_id as string,
        kind: e.kind as DayEventKind,
        note: (e.note ?? "") as string,
      })),
      attendance: (att.data ?? []) as DayAttendance[],
      bonuses: ((bonus.data ?? []) as any[]).map((b) => ({
        id: b.id as string,
        student_id: b.student_id as string,
        points: Number(b.points) || 0,
        note: (b.note ?? "") as string,
      })),
    };
  });

/** שמירת דירוגים לשעה אחת או יותר. כתיבה חוזרת מעדכנת את אותה שורה. */
export const saveDayRatings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        date: isoDate,
        rows: z
          .array(
            z.object({
              studentId: z.string().uuid(),
              slotId: z.string().uuid(),
              readiness: level,
              listening: level,
              behavior: level,
              workDone: level,
            }),
          )
          .min(1)
          .max(600),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);

    const [stu, slt] = await Promise.all([
      supabase.from("students").select("id").eq("class_id", data.classId),
      supabase.from("class_day_slots").select("id").eq("class_id", data.classId),
    ]);
    if (stu.error || slt.error) {
      console.error("[DB Error]", stu.error ?? slt.error);
      throw new Error("בדיקת הנתונים נכשלה.");
    }
    const studentIds = new Set((stu.data ?? []).map((s: any) => s.id as string));
    const slotIds = new Set((slt.data ?? []).map((s: any) => s.id as string));
    if (data.rows.some((r) => !studentIds.has(r.studentId) || !slotIds.has(r.slotId))) {
      throw new Error("נתונים לא תקינים");
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("session_ratings").upsert(
      data.rows.map((r) => ({
        class_id: data.classId,
        student_id: r.studentId,
        slot_id: r.slotId,
        date: data.date,
        readiness: r.readiness,
        listening: r.listening,
        behavior: r.behavior,
        work_done: r.workDone,
        updated_at: now,
      })),
      { onConflict: "student_id,date,slot_id" },
    );
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת הדירוגים נכשלה."); }
    return { ok: true, saved: data.rows.length };
  });

/** שמירת נוכחות לכמה תלמידים ביום אחד. */
export const saveDayAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        date: isoDate,
        rows: z
          .array(
            z.object({
              studentId: z.string().uuid(),
              status: z.enum(["present", "absent", "late", "excused"]),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);

    const { data: stu, error: sErr } = await supabase
      .from("students")
      .select("id")
      .eq("class_id", data.classId);
    if (sErr) { console.error("[DB Error]", sErr); throw new Error("בדיקת הנתונים נכשלה."); }
    const studentIds = new Set((stu ?? []).map((s: any) => s.id as string));
    if (data.rows.some((r) => !studentIds.has(r.studentId))) throw new Error("נתונים לא תקינים");

    const { error } = await supabase.from("attendance").upsert(
      data.rows.map((r) => ({
        class_id: data.classId,
        student_id: r.studentId,
        date: data.date,
        status: r.status,
      })),
      { onConflict: "student_id,date" },
    );
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת הנוכחות נכשלה."); }
    return { ok: true, saved: data.rows.length };
  });

async function assertStudentInClass(supabase: any, classId: string, studentId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .eq("class_id", classId)
    .maybeSingle();
  if (error) { console.error("[DB Error]", error); throw new Error("בדיקת הנתונים נכשלה."); }
  if (!data) throw new Error("התלמיד לא נמצא");
}

/** חוסר (כלי כתיבה, ספרים) או אירוע חריג לתלמיד ביום. */
export const addDayEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        date: isoDate,
        studentId: z.string().uuid(),
        kind: z.enum(["missing_writing", "missing_books", "exceptional"]),
        note: z.string().trim().max(500).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    await assertStudentInClass(supabase, data.classId, data.studentId);
    const { error } = await supabase.from("daily_student_events").insert({
      class_id: data.classId,
      student_id: data.studentId,
      date: data.date,
      kind: data.kind,
      note: data.note,
    });
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת האירוע נכשלה."); }
    return { ok: true };
  });

export const deleteDayEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    const { error } = await supabase
      .from("daily_student_events")
      .delete()
      .eq("id", data.id)
      .eq("class_id", data.classId);
    if (error) { console.error("[DB Error]", error); throw new Error("מחיקת האירוע נכשלה."); }
    return { ok: true };
  });

/** בונוס מיוחד: נשמר בטבלת נקודות ההתנהגות הקיימת, כדי שיופיע גם בציונים ובדוחות. */
export const addDayBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        date: isoDate,
        studentId: z.string().uuid(),
        points: z.number().int().min(1).max(20).default(1),
        note: z.string().trim().max(300).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    await assertStudentInClass(supabase, data.classId, data.studentId);
    const { error } = await supabase.from("behavior_points").insert({
      class_id: data.classId,
      student_id: data.studentId,
      category: "bonus",
      points: data.points,
      note: data.note,
      date: data.date,
    });
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת הבונוס נכשלה."); }
    return { ok: true };
  });

export const deleteDayBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid(), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    const { error } = await supabase
      .from("behavior_points")
      .delete()
      .eq("id", data.id)
      .eq("class_id", data.classId)
      .eq("category", "bonus");
    if (error) { console.error("[DB Error]", error); throw new Error("מחיקת הבונוס נכשלה."); }
    return { ok: true };
  });
