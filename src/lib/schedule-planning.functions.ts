import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dayKey = z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
const uuid = z.string().uuid();

export type SchedDayKey = z.infer<typeof dayKey>;

export type ScheduleSettings = {
  class_id: string;
  start_hour: number;
  end_hour: number;
  active_days: string[];
  year_start_date: string | null;
  year_end_date: string | null;
};

export type TemplateSlot = {
  id: string;
  class_id: string;
  day_key: SchedDayKey;
  hour: number;
  duration: number;
  title: string;
  subject: string | null;
  notes: string | null;
  library_item_id: string | null;
};

export type ScheduleTask = {
  id: string;
  class_id: string;
  kind: "task" | "exam" | "pacing";
  title: string;
  subject: string | null;
  date: string;
  hour: number | null;
  notes: string | null;
  done: boolean;
  done_at: string | null;
  curriculum_unit_id: string | null;
};

export type CalendarOverride = {
  id: string;
  class_id: string;
  start_date: string;
  end_date: string;
  type: string;
  label: string | null;
};

export type SemesterTargetRow = {
  id: string;
  class_id: string;
  semester: "h1" | "h2";
  subject: string;
  target_units: number;
  notes: string | null;
};

export type WeekNote = {
  id: string;
  class_id: string;
  week_start: string;
  parasha_override: string | null;
  notes: string | null;
};

/* ------------------------------ settings ------------------------------ */

export const getScheduleSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<ScheduleSettings> => {
    const { data: row, error } = await context.supabase
      .from("class_schedule_settings")
      .select("class_id,start_hour,end_hour,active_days,year_start_date,year_end_date")
      .eq("class_id", data.classId)
      .maybeSingle();
    if (error) {
      console.error("[schedule settings get]", error);
      throw new Error("טעינת הגדרות הלוח נכשלה.");
    }
    return (
      (row as ScheduleSettings | null) ?? {
        class_id: data.classId,
        start_hour: 7,
        end_hour: 16,
        active_days: ["sun", "mon", "tue", "wed", "thu", "fri"],
        year_start_date: null,
        year_end_date: null,
      }
    );
  });

export const saveScheduleSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: uuid,
        startHour: z.number().int().min(6).max(22),
        endHour: z.number().int().min(6).max(23),
        activeDays: z.array(dayKey).min(1),
        yearStartDate: dateStr.nullable().optional(),
        yearEndDate: dateStr.nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("class_schedule_settings").upsert(
      {
        class_id: data.classId,
        start_hour: data.startHour,
        end_hour: Math.max(data.endHour, data.startHour + 1),
        active_days: data.activeDays,
        year_start_date: data.yearStartDate ?? null,
        year_end_date: data.yearEndDate ?? null,
      },
      { onConflict: "class_id" },
    );
    if (error) {
      console.error("[schedule settings save]", error);
      throw new Error("שמירת הגדרות הלוח נכשלה.");
    }
    return { ok: true as const };
  });

/* --------------------------- weekly template --------------------------- */

export const listTemplateSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<TemplateSlot[]> => {
    const { data: rows, error } = await context.supabase
      .from("schedule_template_slots")
      .select("id,class_id,day_key,hour,duration,title,subject,notes,library_item_id")
      .eq("class_id", data.classId)
      .order("hour", { ascending: true });
    if (error) {
      console.error("[template list]", error);
      throw new Error("טעינת המערכת הקבועה נכשלה.");
    }
    return (rows ?? []) as TemplateSlot[];
  });

export const upsertTemplateSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.optional(),
        classId: uuid,
        dayKey,
        hour: z.number().int().min(6).max(22),
        duration: z.number().int().min(1).max(4).default(1),
        title: z.string().min(1).max(200),
        subject: z.string().max(100).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        libraryItemId: uuid.nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      class_id: data.classId,
      day_key: data.dayKey,
      hour: data.hour,
      duration: data.duration,
      title: data.title.trim(),
      subject: data.subject?.trim() || null,
      notes: data.notes ?? null,
      library_item_id: data.libraryItemId ?? null,
    };
    const q = data.id
      ? context.supabase.from("schedule_template_slots").update(payload).eq("id", data.id)
      : context.supabase.from("schedule_template_slots").insert(payload);
    const { error } = await q;
    if (error) {
      console.error("[template upsert]", error);
      throw new Error("שמירת שיעור במערכת הקבועה נכשלה.");
    }
    return { ok: true as const };
  });

export const deleteTemplateSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("schedule_template_slots").delete().eq("id", data.id);
    if (error) {
      console.error("[template delete]", error);
      throw new Error("מחיקת השיעור מהמערכת נכשלה.");
    }
    return { ok: true as const };
  });

/**
 * Copies the recurring template into concrete weeks. `weekStarts` are the
 * Sundays to fill; days that fall inside a closure/holiday override are
 * skipped, and existing lessons in the same slot are left untouched unless
 * `replace` is set.
 */
export const applyTemplateToWeeks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: uuid,
        weekStarts: z.array(dateStr).min(1).max(60),
        skipDates: z.array(dateStr).max(400).default([]),
        replace: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: slots, error: slotErr } = await context.supabase
      .from("schedule_template_slots")
      .select("day_key,hour,duration,title,subject,notes,library_item_id")
      .eq("class_id", data.classId);
    if (slotErr) {
      console.error("[template apply read]", slotErr);
      throw new Error("טעינת המערכת הקבועה נכשלה.");
    }
    if (!slots?.length) throw new Error("המערכת הקבועה ריקה — הוסיפו שיעורים לפני ההחלה.");

    const dayIndex: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const skip = new Set(data.skipDates);
    const rows: Record<string, unknown>[] = [];

    for (const weekStart of data.weekStarts) {
      if (data.replace) {
        const { error: delErr } = await context.supabase
          .from("weekly_lessons")
          .delete()
          .eq("class_id", data.classId)
          .eq("week_start", weekStart);
        if (delErr) {
          console.error("[template apply clear]", delErr);
          throw new Error("ניקוי השבוע לפני ההחלה נכשל.");
        }
      }
      for (const s of slots) {
        const base = new Date(`${weekStart}T00:00:00`);
        base.setDate(base.getDate() + (dayIndex[s.day_key] ?? 0));
        const iso = base.toISOString().slice(0, 10);
        if (skip.has(iso)) continue;
        rows.push({
          class_id: data.classId,
          week_start: weekStart,
          day_key: s.day_key,
          hour: s.hour,
          duration: s.duration,
          title: s.title,
          subject: s.subject,
          notes: s.notes,
          library_item_id: s.library_item_id,
        });
      }
    }
    if (!rows.length) return { ok: true as const, inserted: 0 };
    const { error } = await context.supabase.from("weekly_lessons").insert(rows);
    if (error) {
      console.error("[template apply insert]", error);
      throw new Error("החלת המערכת על השבועות נכשלה.");
    }
    return { ok: true as const, inserted: rows.length };
  });

/* ------------------------ calendar overrides ------------------------ */

export const listCalendarOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<CalendarOverride[]> => {
    const { data: rows, error } = await context.supabase
      .from("academic_calendar_overrides")
      .select("id,class_id,start_date,end_date,type,label")
      .eq("class_id", data.classId)
      .order("start_date", { ascending: true });
    if (error) {
      console.error("[overrides list]", error);
      throw new Error("טעינת החופשות נכשלה.");
    }
    return (rows ?? []) as CalendarOverride[];
  });

export const upsertCalendarOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: uuid,
        items: z
          .array(
            z.object({
              startDate: dateStr,
              endDate: dateStr,
              type: z.enum([
                "institution_break",
                "unexpected_closure",
                "extra_session",
                "late_start",
                "early_end",
                "holiday",
              ]),
              label: z.string().max(200).nullable().optional(),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const rows = data.items.map((i) => ({
      class_id: data.classId,
      start_date: i.startDate,
      end_date: i.endDate,
      type: i.type,
      label: i.label ?? null,
    }));
    const { error } = await context.supabase.from("academic_calendar_overrides").insert(rows);
    if (error) {
      console.error("[overrides insert]", error);
      throw new Error("שמירת החופשות נכשלה.");
    }
    return { ok: true as const, inserted: rows.length };
  });

export const deleteCalendarOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("academic_calendar_overrides").delete().eq("id", data.id);
    if (error) {
      console.error("[overrides delete]", error);
      throw new Error("מחיקת החופשה נכשלה.");
    }
    return { ok: true as const };
  });

/* ------------------------- tasks / exams ------------------------- */

export const listScheduleTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid, from: dateStr, to: dateStr }).parse(d))
  .handler(async ({ data, context }): Promise<ScheduleTask[]> => {
    const { data: rows, error } = await context.supabase
      .from("schedule_tasks")
      .select("id,class_id,kind,title,subject,date,hour,notes,done,done_at,curriculum_unit_id")
      .eq("class_id", data.classId)
      .gte("date", data.from)
      .lte("date", data.to)
      .order("date", { ascending: true });
    if (error) {
      console.error("[tasks list]", error);
      throw new Error("טעינת המשימות נכשלה.");
    }
    return (rows ?? []) as ScheduleTask[];
  });

export const upsertScheduleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.optional(),
        classId: uuid,
        kind: z.enum(["task", "exam", "pacing"]).default("task"),
        title: z.string().min(1).max(200),
        subject: z.string().max(100).nullable().optional(),
        date: dateStr,
        hour: z.number().int().min(6).max(22).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      class_id: data.classId,
      kind: data.kind,
      title: data.title.trim(),
      subject: data.subject?.trim() || null,
      date: data.date,
      hour: data.hour ?? null,
      notes: data.notes ?? null,
    };
    const q = data.id
      ? context.supabase.from("schedule_tasks").update(payload).eq("id", data.id)
      : context.supabase.from("schedule_tasks").insert(payload);
    const { error } = await q;
    if (error) {
      console.error("[tasks upsert]", error);
      throw new Error("שמירת המשימה נכשלה.");
    }
    return { ok: true as const };
  });

export const setScheduleTaskDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, done: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("schedule_tasks")
      .update({ done: data.done, done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) {
      console.error("[tasks done]", error);
      throw new Error("עדכון סימון הביצוע נכשל.");
    }
    return { ok: true as const };
  });

export const deleteScheduleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("schedule_tasks").delete().eq("id", data.id);
    if (error) {
      console.error("[tasks delete]", error);
      throw new Error("מחיקת המשימה נכשלה.");
    }
    return { ok: true as const };
  });

/* ------------------------ semester targets ------------------------ */

export const listSemesterTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<SemesterTargetRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("semester_targets")
      .select("id,class_id,semester,subject,target_units,notes")
      .eq("class_id", data.classId)
      .order("subject", { ascending: true });
    if (error) {
      console.error("[targets list]", error);
      throw new Error("טעינת יעדי המחצית נכשלה.");
    }
    return (rows ?? []) as SemesterTargetRow[];
  });

export const upsertSemesterTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: uuid,
        semester: z.enum(["h1", "h2"]),
        subject: z.string().min(1).max(100),
        targetUnits: z.number().int().min(0).max(999),
        notes: z.string().max(1000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("semester_targets").upsert(
      {
        class_id: data.classId,
        semester: data.semester,
        subject: data.subject.trim(),
        target_units: data.targetUnits,
        notes: data.notes ?? null,
      },
      { onConflict: "class_id,semester,subject" },
    );
    if (error) {
      console.error("[targets upsert]", error);
      throw new Error("שמירת יעד המחצית נכשלה.");
    }
    return { ok: true as const };
  });

export const deleteSemesterTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("semester_targets").delete().eq("id", data.id);
    if (error) {
      console.error("[targets delete]", error);
      throw new Error("מחיקת יעד המחצית נכשלה.");
    }
    return { ok: true as const };
  });

/* --------------------------- week notes --------------------------- */

export const listWeekNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<WeekNote[]> => {
    const { data: rows, error } = await context.supabase
      .from("class_week_notes")
      .select("id,class_id,week_start,parasha_override,notes")
      .eq("class_id", data.classId);
    if (error) {
      console.error("[week notes list]", error);
      throw new Error("טעינת הערות השבוע נכשלה.");
    }
    return (rows ?? []) as WeekNote[];
  });

export const saveWeekNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: uuid,
        weekStart: dateStr,
        parashaOverride: z.string().max(120).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("class_week_notes").upsert(
      {
        class_id: data.classId,
        week_start: data.weekStart,
        parasha_override: data.parashaOverride?.trim() || null,
        notes: data.notes ?? null,
      },
      { onConflict: "class_id,week_start" },
    );
    if (error) {
      console.error("[week notes save]", error);
      throw new Error("שמירת הערת השבוע נכשלה.");
    }
    return { ok: true as const };
  });
