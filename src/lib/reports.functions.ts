import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClassReport = {
  class: { id: string; name: string };
  range: { from: string; to: string };
  students: Array<{
    id: string;
    name: string;
    grades: Array<{ subject: string; value: number; max_value: number; date: string; notes: string | null }>;
    attendance: { present: number; absent: number; late: number; excused: number };
    behavior: { positive: number; negative: number; total: number };
    discipline: Array<{ date: string; type: string; category: string; severity: number; description: string }>;
    avgPct: number | null;
  }>;
};

export const buildClassReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ClassReport> => {
    const { supabase } = context;
    const [cls, students, grades, attendance, behavior, discipline] = await Promise.all([
      supabase.from("classes").select("id,name").eq("id", data.classId).single(),
      supabase.from("students").select("id,name").eq("class_id", data.classId).order("name"),
      supabase.from("grades").select("student_id,subject,value,max_value,date,notes")
        .eq("class_id", data.classId).gte("date", data.from).lte("date", data.to),
      supabase.from("attendance").select("student_id,status,date")
        .eq("class_id", data.classId).gte("date", data.from).lte("date", data.to),
      supabase.from("behavior_points").select("student_id,points,category,date")
        .eq("class_id", data.classId).gte("date", data.from).lte("date", data.to),
      supabase.from("discipline_events").select("student_id,date,type,category,severity,description")
        .eq("class_id", data.classId).gte("date", data.from).lte("date", data.to),
    ]);

    if (cls.error) throw new Error("שגיאה בטעינת הכיתה");
    if (students.error) throw new Error("שגיאה בטעינת התלמידים");

    const studentsOut = (students.data ?? []).map((s) => {
      const sg = (grades.data ?? []).filter((g) => g.student_id === s.id);
      const sa = (attendance.data ?? []).filter((a) => a.student_id === s.id);
      const sb = (behavior.data ?? []).filter((b) => b.student_id === s.id);
      const sd = (discipline.data ?? []).filter((d) => d.student_id === s.id);
      const att = { present: 0, absent: 0, late: 0, excused: 0 };
      for (const a of sa) (att as Record<string, number>)[a.status] = ((att as Record<string, number>)[a.status] ?? 0) + 1;
      const beh = sb.reduce(
        (acc, b) => {
          const p = Number(b.points);
          if (p >= 0) acc.positive += p; else acc.negative += -p;
          acc.total += p;
          return acc;
        },
        { positive: 0, negative: 0, total: 0 },
      );
      const totals = sg.reduce(
        (acc, g) => {
          const max = Number(g.max_value) || 100;
          acc.t += (Number(g.value) / max) * 100;
          acc.n += 1;
          return acc;
        },
        { t: 0, n: 0 },
      );
      return {
        id: s.id,
        name: s.name,
        grades: sg.map((g) => ({
          subject: g.subject ?? "",
          value: Number(g.value),
          max_value: Number(g.max_value),
          date: g.date,
          notes: g.notes ?? null,
        })),
        attendance: att,
        behavior: beh,
        discipline: sd.map((e) => ({
          date: e.date,
          type: e.type,
          category: e.category,
          severity: Number(e.severity),
          description: e.description ?? "",
        })),
        avgPct: totals.n ? totals.t / totals.n : null,
      };
    });

    return {
      class: { id: cls.data!.id, name: cls.data!.name },
      range: { from: data.from, to: data.to },
      students: studentsOut,
    };
  });