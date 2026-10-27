import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addDaysIso, lessonDateIso, weekStartIso, type ScheduleClosure } from "@/lib/schedule-view";

/**
 * מקור אחד לקריאת מערכת השעות של כיתה בטווח תאריכים: שיעורים (weekly_lessons) וימים ללא לימודים.
 * כל המסכים שמציגים את המערכת קוראים דרך כאן, ולכן כולם רואים אותו דבר.
 */
export type ViewLesson = {
  id: string;
  date: string;
  day_key: string;
  hour: number;
  minute: number;
  duration: number;
  subject: string | null;
  title: string;
  notes: string | null;
};
export type ScheduleRange = { lessons: ViewLesson[]; closures: ScheduleClosure[] };

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");

export const getScheduleRange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ classId: z.string().uuid(), from: dateStr, to: dateStr })
      .refine((v) => v.from <= v.to && addDaysIso(v.from, 70) >= v.to, "טווח לא תקין")
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ScheduleRange> => {
    const supabase = context.supabase as any;

    const weekStarts: string[] = [];
    for (let w = weekStartIso(data.from); w <= data.to; w = addDaysIso(w, 7)) weekStarts.push(w);

    const [lessonsRes, closuresRes] = await Promise.all([
      supabase
        .from("weekly_lessons")
        .select("id,week_start,day_key,hour,minute,duration,subject,title,notes")
        .eq("class_id", data.classId)
        .in("week_start", weekStarts),
      supabase
        .from("academic_calendar_overrides")
        .select("start_date,end_date,type,label")
        .eq("class_id", data.classId)
        .lte("start_date", data.to)
        .gte("end_date", data.from),
    ]);
    if (lessonsRes.error || closuresRes.error) {
      console.error("[DB Error]", lessonsRes.error ?? closuresRes.error);
      throw new Error("טעינת מערכת השעות נכשלה.");
    }

    const lessons: ViewLesson[] = ((lessonsRes.data ?? []) as any[])
      .map((r) => ({
        id: r.id as string,
        date: lessonDateIso(r.week_start as string, r.day_key as string),
        day_key: r.day_key as string,
        hour: r.hour as number,
        minute: (r.minute ?? 0) as number,
        duration: (r.duration ?? 45) as number,
        subject: (r.subject ?? null) as string | null,
        title: (r.title ?? "") as string,
        notes: (r.notes ?? null) as string | null,
      }))
      .filter((l) => l.date >= data.from && l.date <= data.to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.minute - b.minute);

    return { lessons, closures: (closuresRes.data ?? []) as ScheduleClosure[] };
  });
