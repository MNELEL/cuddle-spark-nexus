import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const statusEnum = z.enum(["present", "absent", "late", "excused"]);

/* -------- attendance -------- */

export const listAttendanceByDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    class_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("attendance").select("*")
      .eq("class_id", data.class_id).eq("date", data.date);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return rows ?? [];
  });

export const listAttendanceByStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ student_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("attendance").select("*")
      .eq("student_id", data.student_id).order("date", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return rows ?? [];
  });

export const upsertAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    class_id: z.string().uuid(),
    student_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: statusEnum,
    notes: z.string().max(500).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("attendance")
      .upsert(data, { onConflict: "student_id,date" });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

export const bulkMarkAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    class_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: statusEnum,
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: students, error: e1 } = await context.supabase
      .from("students").select("id").eq("class_id", data.class_id);
    if (e1) throw new Error(e1.message);
    const rows = (students ?? []).map((s) => ({
      class_id: data.class_id, student_id: s.id, date: data.date, status: data.status,
    }));
    if (!rows.length) return { ok: true };
    const { error } = await context.supabase.from("attendance")
      .upsert(rows, { onConflict: "student_id,date" });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

/* -------- grades -------- */

export const listGrades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("grades").select("*")
      .eq("class_id", data.classId).order("date", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return rows ?? [];
  });

export const upsertGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    class_id: z.string().uuid(),
    student_id: z.string().uuid(),
    subject: z.string().max(60).default(""),
    value: z.number(),
    max_value: z.number().positive().default(100),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().max(500).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("grades").update(rest).eq("id", id);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    } else {
      const { error } = await context.supabase.from("grades").insert(data);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    }
    return { ok: true };
  });

export const deleteGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("grades").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });