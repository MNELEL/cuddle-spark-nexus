import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildRotation } from "@/lib/duty-rotation";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();

export type DutyType = {
  id: string;
  class_id: string;
  name: string;
  icon: string;
  order_index: number;
  active: boolean;
};

export type DutyAssignment = {
  id: string;
  class_id: string;
  duty_type_id: string;
  student_id: string | null;
  date: string;
  source: "auto" | "manual";
  done: boolean;
  notes: string | null;
};

export const listDutyTypes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<DutyType[]> => {
    const { data: rows, error } = await context.supabase
      .from("class_duty_types")
      .select("id,class_id,name,icon,order_index,active")
      .eq("class_id", data.classId)
      .order("order_index", { ascending: true });
    if (error) {
      console.error("[duty types list]", error);
      throw new Error("טעינת סוגי התורנות נכשלה.");
    }
    return (rows ?? []) as DutyType[];
  });

export const upsertDutyType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.optional(),
        classId: uuid,
        name: z.string().min(1).max(80),
        icon: z.string().max(40).default("star"),
        orderIndex: z.number().int().min(0).max(99).default(0),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      class_id: data.classId,
      name: data.name.trim(),
      icon: data.icon,
      order_index: data.orderIndex,
      active: data.active,
    };
    const q = data.id
      ? context.supabase.from("class_duty_types").update(payload).eq("id", data.id)
      : context.supabase.from("class_duty_types").insert(payload);
    const { error } = await q;
    if (error) {
      console.error("[duty type upsert]", error);
      throw new Error("שמירת סוג התורנות נכשלה.");
    }
    return { ok: true as const };
  });

export const deleteDutyType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("class_duty_types").delete().eq("id", data.id);
    if (error) {
      console.error("[duty type delete]", error);
      throw new Error("מחיקת סוג התורנות נכשלה.");
    }
    return { ok: true as const };
  });

export const listDutyAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid, from: dateStr, to: dateStr }).parse(d))
  .handler(async ({ data, context }): Promise<DutyAssignment[]> => {
    const { data: rows, error } = await context.supabase
      .from("class_duty_assignments")
      .select("id,class_id,duty_type_id,student_id,date,source,done,notes")
      .eq("class_id", data.classId)
      .gte("date", data.from)
      .lte("date", data.to)
      .order("date", { ascending: true });
    if (error) {
      console.error("[duty assignments list]", error);
      throw new Error("טעינת התורנויות נכשלה.");
    }
    return (rows ?? []) as DutyAssignment[];
  });

/** Manual assignment / replacement for a single duty on a single date. */
export const setDutyAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: uuid,
        dutyTypeId: uuid,
        date: dateStr,
        studentId: uuid.nullable(),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("class_duty_assignments").upsert(
      {
        class_id: data.classId,
        duty_type_id: data.dutyTypeId,
        date: data.date,
        student_id: data.studentId,
        source: "manual",
        notes: data.notes ?? null,
      },
      { onConflict: "duty_type_id,date" },
    );
    if (error) {
      console.error("[duty set]", error);
      throw new Error("שיבוץ התורנות נכשל.");
    }
    return { ok: true as const };
  });

export const setDutyDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, done: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("class_duty_assignments")
      .update({ done: data.done })
      .eq("id", data.id);
    if (error) {
      console.error("[duty done]", error);
      throw new Error("עדכון ביצוע התורנות נכשל.");
    }
    return { ok: true as const };
  });

/**
 * Fills a date range with a fair rotation for every active duty type.
 * `dates` comes from the client, which already removed holidays / closures /
 * non-teaching days, so the rotation never lands on a day off.
 * Existing manual assignments are preserved.
 */
export const generateDutyRotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: uuid,
        dates: z.array(dateStr).min(1).max(400),
        overwriteAuto: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const [{ data: types, error: tErr }, { data: students, error: sErr }] = await Promise.all([
      context.supabase
        .from("class_duty_types")
        .select("id,order_index")
        .eq("class_id", data.classId)
        .eq("active", true)
        .order("order_index", { ascending: true }),
      context.supabase.from("students").select("id,name").eq("class_id", data.classId).order("name"),
    ]);
    if (tErr || sErr) {
      console.error("[duty rotation read]", tErr ?? sErr);
      throw new Error("טעינת הנתונים לשיבוץ נכשלה.");
    }
    if (!types?.length) throw new Error("אין סוגי תורנות פעילים — הוסיפו תורנות תחילה.");
    if (!students?.length) throw new Error("אין תלמידים בכיתה לשיבוץ תורנויות.");

    const studentIds = students.map((s) => s.id);
    const dates = [...new Set(data.dates)].sort();

    const { data: existing, error: exErr } = await context.supabase
      .from("class_duty_assignments")
      .select("id,duty_type_id,date,source")
      .eq("class_id", data.classId)
      .gte("date", dates[0]!)
      .lte("date", dates[dates.length - 1]!);
    if (exErr) {
      console.error("[duty rotation existing]", exErr);
      throw new Error("טעינת שיבוצים קיימים נכשלה.");
    }
    const manual = new Set((existing ?? []).filter((r) => r.source === "manual").map((r) => `${r.duty_type_id}|${r.date}`));

    if (data.overwriteAuto) {
      const autoIds = (existing ?? []).filter((r) => r.source === "auto").map((r) => r.id);
      if (autoIds.length) {
        const { error: delErr } = await context.supabase.from("class_duty_assignments").delete().in("id", autoIds);
        if (delErr) {
          console.error("[duty rotation clear]", delErr);
          throw new Error("ניקוי שיבוצים אוטומטיים נכשל.");
        }
      }
    }

    const rows: { class_id: string; duty_type_id: string; date: string; student_id: string | null; source: string }[] = [];
    types.forEach((t, idx) => {
      for (const slot of buildRotation({ studentIds, dates, offset: idx })) {
        if (manual.has(`${t.id}|${slot.date}`)) continue;
        rows.push({
          class_id: data.classId,
          duty_type_id: t.id,
          date: slot.date,
          student_id: slot.studentId,
          source: "auto",
        });
      }
    });
    if (!rows.length) return { ok: true as const, inserted: 0 };
    const { error } = await context.supabase
      .from("class_duty_assignments")
      .upsert(rows, { onConflict: "duty_type_id,date" });
    if (error) {
      console.error("[duty rotation insert]", error);
      throw new Error("יצירת סבב התורנויות נכשלה.");
    }
    return { ok: true as const, inserted: rows.length };
  });
