import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { closureFor, closureText, dayKeyOfIso, hhmm, lessonName, weekStartIso } from "@/lib/schedule-view";

/**
 * מעקב יומי לכיתה: שעות היום, דירוג לכל תלמיד בכל שעה,
 * נוכחות, חוסרים, אירועים חריגים ובונוסים.
 * הכל ליום אחד, עם בדיקת בעלות על הכיתה בכל קריאה.
 */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");
const level = z.number().int().min(1).max(3);

/** קריטריון לדירוג בתוך שעה (עמודה): מפתח יציב ושם לתצוגה. */
export type DayCriterion = { key: string; label: string };
export type DaySlot = {
  id: string;
  label: string;
  order_index: number;
  rated: boolean;
  criteria: DayCriterion[];
  /** שעה שנגזרת ממערכת השעות: שם המקצוע. null בשעה ידנית */
  subject: string | null;
  /** שעות השיעורים של המקצוע ביום הזה, כמו "08:30, 10:15" */
  times?: string;
};
/** scores: מפתח קריטריון ← 1 חלש, 2 בינוני, 3 טוב */
export type DayRating = { student_id: string; slot_id: string; scores: Record<string, number> };
export type DayEventKind = "missing_writing" | "missing_books" | "exceptional";
export type DayEvent = { id: string; student_id: string; kind: DayEventKind; note: string };
export type DayAttendance = { student_id: string; status: string };
export type DayBonus = { id: string; student_id: string; points: number; note: string };
export type DayData = {
  /** timetable: העמודות לפי מערכת השעות של היום. manual: סדר היום הידני (כשאין מערכת ליום, או כשכבר דורגו בו) */
  mode: "timetable" | "manual";
  /** יום ללא לימודים לפי לוח השנה */
  closure: { label: string; type: string } | null;
  slots: DaySlot[];
  ratings: DayRating[];
  events: DayEvent[];
  attendance: DayAttendance[];
  bonuses: DayBonus[];
};

export const CRITERION_READINESS: DayCriterion = { key: "readiness", label: "מוכנות" };
export const CRITERION_LISTENING: DayCriterion = { key: "listening", label: "הקשבה" };
export const CRITERION_BEHAVIOR: DayCriterion = { key: "behavior", label: "התנהגות" };
export const CRITERION_WORK: DayCriterion = { key: "work_done", label: "עבודות" };
export const CRITERION_PRAYER: DayCriterion = { key: "prayer", label: "תפילה" };
/** עמודה בלי קטגוריות היא עמודה אחת עם ציון כולל, שנשמר תחת המפתח הזה. */
export const OVERALL_KEY = "overall";

/**
 * סדר היום ההתחלתי. נוצר פעם אחת לכל כיתה, ואפשר לשנות אותו מתוך המסך.
 * ברירת המחדל לשעה: ציון אחד (טוב, בינוני, חלש) בלי קטגוריות. פיצול לקטגוריות נעשה ב"עריכת עמודות".
 * תפילה: התנהגות ותפילה, לפי בקשת המשתמש.
 */
const DEFAULT_SLOTS: { label: string; rated: boolean; criteria: DayCriterion[] }[] = [
  { label: "נוכחות", rated: false, criteria: [] },
  { label: "תפילה", rated: true, criteria: [CRITERION_BEHAVIOR, CRITERION_PRAYER] },
  { label: "שיעור 1", rated: true, criteria: [] },
  { label: "ארוחת בוקר", rated: false, criteria: [] },
  { label: "שיעור 2", rated: true, criteria: [] },
  { label: "ארוחת צהריים", rated: false, criteria: [] },
  { label: "שיעור 3", rated: true, criteria: [] },
  { label: "שיעור הרמת כיסא", rated: true, criteria: [] },
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

async function loadSlots(supabase: any, classId: string, opts: { manualOnly?: boolean } = {}): Promise<DaySlot[]> {
  let q = supabase
    .from("class_day_slots")
    .select("id,label,order_index,rated,criteria,subject")
    .eq("class_id", classId)
    .eq("active", true);
  if (opts.manualOnly) q = q.is("subject", null);
  const { data, error } = await q.order("order_index", { ascending: true });
  if (error) { console.error("[DB Error]", error); throw new Error("טעינת סדר היום נכשלה."); }
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id as string,
    label: r.label as string,
    order_index: r.order_index as number,
    rated: Boolean(r.rated),
    criteria: Array.isArray(r.criteria) ? (r.criteria as DayCriterion[]) : [],
    subject: (r.subject ?? null) as string | null,
  }));
}

/**
 * כל נתוני היום: עמודות, דירוגים, נוכחות, אירועים ובונוסים.
 * העמודות נגזרות ממערכת השעות של היום (weekly_lessons), כך ששינוי במערכת מתעדכן כאן מעצמו.
 * ביום בלי שיעורים במערכת, או ביום שכבר דורג בעמודות הידניות הישנות, מוצג סדר היום הידני.
 */
export const getDayData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid(), date: isoDate }).parse(d))
  .handler(async ({ data, context }): Promise<DayData> => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);

    let manual = await loadSlots(supabase, data.classId, { manualOnly: true });
    if (manual.length === 0) {
      const { error } = await supabase.from("class_day_slots").insert(
        DEFAULT_SLOTS.map((s, i) => ({
          class_id: data.classId,
          label: s.label,
          rated: s.rated,
          criteria: s.criteria,
          order_index: i + 1,
        })),
      );
      if (error) { console.error("[DB Error]", error); throw new Error("יצירת סדר היום נכשלה."); }
      manual = await loadSlots(supabase, data.classId, { manualOnly: true });
    }

    const [ratings, events, att, bonus, lessonsRes, closuresRes] = await Promise.all([
      supabase
        .from("session_ratings")
        .select("student_id,slot_id,scores,readiness,listening,behavior,work_done")
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
      supabase
        .from("weekly_lessons")
        .select("subject,title,hour,minute")
        .eq("class_id", data.classId)
        .eq("week_start", weekStartIso(data.date))
        .eq("day_key", dayKeyOfIso(data.date)),
      supabase
        .from("academic_calendar_overrides")
        .select("start_date,end_date,type,label")
        .eq("class_id", data.classId)
        .lte("start_date", data.date)
        .gte("end_date", data.date),
    ]);
    for (const r of [ratings, events, att, bonus, lessonsRes, closuresRes]) {
      if (r.error) { console.error("[DB Error]", r.error); throw new Error("טעינת נתוני היום נכשלה."); }
    }

    const ratingRows = (ratings.data ?? []) as any[];
    const manualIds = new Set(manual.map((s) => s.id));
    const hasManualRatings = ratingRows.some((r) => manualIds.has(r.slot_id as string));

    // שיעורי היום לפי המערכת, בסדר שעות, מקובצים לפי מקצוע
    const lessons = ((lessonsRes.data ?? []) as any[])
      .map((l) => ({ name: lessonName({ subject: l.subject, title: l.title ?? "" }), hour: l.hour as number, minute: (l.minute ?? 0) as number }))
      .filter((l) => l.name)
      .sort((a, b) => a.hour - b.hour || a.minute - b.minute);
    const timetable = lessons.length > 0 && !hasManualRatings;

    let slots: DaySlot[] = manual;
    if (timetable) {
      const order: string[] = [];
      const timesBy = new Map<string, string[]>();
      for (const l of lessons) {
        if (!timesBy.has(l.name)) { timesBy.set(l.name, []); order.push(l.name); }
        timesBy.get(l.name)!.push(hhmm(l.hour, l.minute));
      }
      const loadSubjectRows = async () => {
        const { data: rows, error } = await supabase
          .from("class_day_slots")
          .select("id,label,order_index,rated,criteria,subject,active")
          .eq("class_id", data.classId)
          .not("subject", "is", null);
        if (error) { console.error("[DB Error]", error); throw new Error("טעינת העמודות נכשלה."); }
        return (rows ?? []) as any[];
      };
      let rows = await loadSubjectRows();
      const have = new Set(rows.map((r) => r.subject as string));
      const missing = order.filter((n) => !have.has(n));
      if (missing.length) {
        const base = Math.max(100, ...rows.map((r) => r.order_index as number)) + 1;
        const { error } = await supabase.from("class_day_slots").upsert(
          missing.map((name, i) => ({
            class_id: data.classId,
            label: name,
            rated: true,
            criteria: name.includes("תפילה") ? [CRITERION_BEHAVIOR, CRITERION_PRAYER] : [],
            order_index: base + i,
            subject: name,
          })),
          { onConflict: "class_id,subject", ignoreDuplicates: true },
        );
        if (error) { console.error("[DB Error]", error); throw new Error("יצירת העמודות נכשלה."); }
        rows = await loadSubjectRows();
      }
      const bySubject = new Map(rows.map((r) => [r.subject as string, r]));
      slots = order
        .map((name) => bySubject.get(name))
        .filter((r): r is any => !!r && r.active !== false)
        .map((r) => ({
          id: r.id as string,
          label: r.label as string,
          order_index: r.order_index as number,
          rated: Boolean(r.rated),
          criteria: Array.isArray(r.criteria) ? (r.criteria as DayCriterion[]) : [],
          subject: r.subject as string,
          times: (timesBy.get(r.subject as string) ?? []).join(", "),
        }));
    }

    const closure = closureFor(data.date, (closuresRes.data ?? []) as any[]);

    return {
      mode: timetable ? "timetable" : "manual",
      closure: closure ? { label: closureText(closure), type: closure.type } : null,
      slots,
      // שורות ישנות נשמרו בעמודות הקבועות; scores גובר עליהן כשהוא קיים
      ratings: ratingRows.map((r) => ({
        student_id: r.student_id as string,
        slot_id: r.slot_id as string,
        scores: {
          readiness: r.readiness,
          listening: r.listening,
          behavior: r.behavior,
          work_done: r.work_done,
          ...(r.scores ?? {}),
        } as Record<string, number>,
      })),
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
              scores: z.record(z.string().regex(/^[a-z0-9_]{1,40}$/), level),
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
      supabase.from("class_day_slots").select("id,criteria").eq("class_id", data.classId),
    ]);
    if (stu.error || slt.error) {
      console.error("[DB Error]", stu.error ?? slt.error);
      throw new Error("בדיקת הנתונים נכשלה.");
    }
    const studentIds = new Set((stu.data ?? []).map((s: any) => s.id as string));
    const keysBySlot = new Map<string, Set<string>>();
    for (const sl of (slt.data ?? []) as any[]) {
      const crit = ((sl.criteria ?? []) as DayCriterion[]).map((c) => c.key);
      // שעה בלי קטגוריות: מותר רק הציון הכולל
      keysBySlot.set(sl.id as string, new Set(crit.length ? crit : [OVERALL_KEY]));
    }
    for (const r of data.rows) {
      const allowed = keysBySlot.get(r.slotId);
      if (!studentIds.has(r.studentId) || !allowed) throw new Error("נתונים לא תקינים");
      if (Object.keys(r.scores).some((k) => !allowed.has(k))) throw new Error("נתונים לא תקינים");
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("session_ratings").upsert(
      data.rows.map((r) => ({
        class_id: data.classId,
        student_id: r.studentId,
        slot_id: r.slotId,
        date: data.date,
        scores: r.scores,
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

/* ---------- ניהול עמודות: שעות וקריטריונים ---------- */

const criterionSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{1,40}$/, "מפתח לא תקין"),
  label: z.string().trim().min(1, "יש להזין שם").max(24, "השם ארוך מדי"),
});
const MAX_SLOTS = 14;

/** יצירה (בלי slotId) או עדכון של שעה: שם, האם מדורגת, והקריטריונים שלה. */
export const saveDaySlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        slotId: z.string().uuid().optional(),
        label: z.string().trim().min(1, "יש להזין שם").max(30, "השם ארוך מדי"),
        rated: z.boolean(),
        criteria: z.array(criterionSchema).max(8, "אפשר עד 8 קריטריונים בשעה"),
      })
      .refine((v) => new Set(v.criteria.map((c) => c.key)).size === v.criteria.length, "קריטריון כפול")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    const criteria = data.rated ? data.criteria : [];

    if (data.slotId) {
      const { error } = await supabase
        .from("class_day_slots")
        .update({ label: data.label, rated: data.rated, criteria })
        .eq("id", data.slotId)
        .eq("class_id", data.classId);
      if (error) { console.error("[DB Error]", error); throw new Error("שמירת השעה נכשלה."); }
      return { ok: true };
    }

    const slots = await loadSlots(supabase, data.classId, { manualOnly: true });
    if (slots.length >= MAX_SLOTS) throw new Error(`אפשר עד ${MAX_SLOTS} שעות ביום`);
    const nextOrder = slots.reduce((m, s) => Math.max(m, s.order_index), 0) + 1;
    const { error } = await supabase.from("class_day_slots").insert({
      class_id: data.classId,
      label: data.label,
      rated: data.rated,
      criteria,
      order_index: nextOrder,
    });
    if (error) { console.error("[DB Error]", error); throw new Error("יצירת השעה נכשלה."); }
    return { ok: true };
  });

/** מחיקת שעה: העמודה מוסתרת, והדירוגים שנשמרו בעבר נשארים במסד. */
export const deleteDaySlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid(), slotId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    const { error } = await supabase
      .from("class_day_slots")
      .update({ active: false })
      .eq("id", data.slotId)
      .eq("class_id", data.classId);
    if (error) { console.error("[DB Error]", error); throw new Error("מחיקת השעה נכשלה."); }
    return { ok: true };
  });

/** הזזת שעה למעלה או למטה בסדר היום. */
export const moveDaySlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        slotId: z.string().uuid(),
        direction: z.enum(["up", "down"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    await ownedClass(supabase, data.classId, context.userId);
    const slots = await loadSlots(supabase, data.classId, { manualOnly: true });
    const i = slots.findIndex((s) => s.id === data.slotId);
    const j = data.direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= slots.length) return { ok: true };
    [slots[i], slots[j]] = [slots[j]!, slots[i]!];
    const results = await Promise.all(
      slots.map((s, idx) =>
        supabase.from("class_day_slots").update({ order_index: idx + 1 }).eq("id", s.id).eq("class_id", data.classId),
      ),
    );
    const failed = results.find((r: any) => r.error);
    if (failed) { console.error("[DB Error]", failed.error); throw new Error("שינוי הסדר נכשל."); }
    return { ok: true };
  });
