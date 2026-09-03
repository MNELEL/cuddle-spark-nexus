/**
 * ייצוא נתוני כיתה לפי טווח תאריכים (הטווחים נגזרים מהלוח העברי בצד הלקוח,
 * ונשמרים/נשלחים כתאריכי ISO — מקור אמת יחיד).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");

export type ClassRangeExport = {
  class: { id: string; name: string };
  range: { from: string; to: string };
  students: {
    id: string;
    name: string;
    first_name: string | null;
    last_name: string | null;
    birth_date: string | null;
    seat_row: number | null;
    seat_col: number | null;
    notes: string | null;
  }[];
  events: {
    id: string;
    date: string;
    end_date: string | null;
    title: string;
    type: string;
    notes: string | null;
    student_id: string | null;
  }[];
  dailyLogs: { id: string; date: string; notes: string | null }[];
  insights: {
    id: string;
    created_at: string;
    insight_type: string;
    severity: string;
    title: string;
    description: string;
    suggested_action: string | null;
    student_id: string | null;
    is_dismissed: boolean;
  }[];
};

export const getClassRangeExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ classId: z.string().uuid(), from: isoDate, to: isoDate }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ClassRangeExport> => {
    const { supabase } = context;
    const { data: cls, error: cErr } = await supabase
      .from("classes")
      .select("id,name")
      .eq("id", data.classId)
      .maybeSingle();
    if (cErr) { console.error("[DB Error]", cErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!cls) throw new Error("הכיתה לא נמצאה");

    const [students, events, logs, insights] = await Promise.all([
      supabase
        .from("students")
        .select("id,name,first_name,last_name,birth_date,seat_row,seat_col,notes")
        .eq("class_id", data.classId)
        .order("name"),
      supabase
        .from("class_events")
        .select("id,date,end_date,title,type,notes,student_id")
        .eq("class_id", data.classId)
        .gte("date", data.from)
        .lte("date", data.to)
        .order("date"),
      supabase
        .from("daily_summaries")
        .select("id,date,notes")
        .eq("class_id", data.classId)
        .gte("date", data.from)
        .lte("date", data.to)
        .order("date"),
      supabase
        .from("orchestrator_insights")
        .select("id,created_at,insight_type,severity,title,description,suggested_action,student_id,is_dismissed")
        .eq("class_id", data.classId)
        .gte("created_at", `${data.from}T00:00:00Z`)
        .lte("created_at", `${data.to}T23:59:59Z`)
        .order("created_at", { ascending: false }),
    ]);
    for (const r of [students, events, logs, insights]) {
      if (r.error) { console.error("[DB Error]", r.error); throw new Error("טעינת נתוני הכיתה נכשלה"); }
    }

    return {
      class: { id: cls.id, name: cls.name },
      range: { from: data.from, to: data.to },
      students: (students.data ?? []) as ClassRangeExport["students"],
      events: (events.data ?? []) as ClassRangeExport["events"],
      dailyLogs: (logs.data ?? []) as ClassRangeExport["dailyLogs"],
      insights: (insights.data ?? []) as ClassRangeExport["insights"],
    };
  });
