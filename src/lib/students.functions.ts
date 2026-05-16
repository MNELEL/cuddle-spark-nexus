import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { smartAssign, type ScoringStudent, type ScoringRelation } from "@/lib/seating-logic";

const heightEnum = z.enum(["low", "mid", "high"]);
const rowEnum = z.enum(["front", "mid", "back", "any"]);

export const listStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("students")
      .select("*")
      .eq("class_id", data.classId)
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      class_id: z.string().uuid(),
      name: z.string().min(1).max(100),
      notes: z.string().max(2000).optional().default(""),
      height: heightEnum.default("mid"),
      row_pref: rowEnum.default("any"),
      corner_pref: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("students").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("students").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("students").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// seating
export const setSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      class_id: z.string().uuid(),
      student_id: z.string().uuid(),
      seat_row: z.number().int().min(0).nullable(),
      seat_col: z.number().int().min(0).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // if target seat occupied by another student, swap
    if (data.seat_row !== null && data.seat_col !== null) {
      const { data: occupant } = await context.supabase
        .from("students")
        .select("id, seat_row, seat_col")
        .eq("class_id", data.class_id)
        .eq("seat_row", data.seat_row)
        .eq("seat_col", data.seat_col)
        .maybeSingle();

      const { data: mover } = await context.supabase
        .from("students")
        .select("seat_row, seat_col")
        .eq("id", data.student_id)
        .single();

      if (occupant && occupant.id !== data.student_id) {
        // clear both first to avoid unique conflict
        await context.supabase.from("students").update({ seat_row: null, seat_col: null }).eq("id", occupant.id);
        await context.supabase.from("students").update({ seat_row: null, seat_col: null }).eq("id", data.student_id);
        await context.supabase.from("students")
          .update({ seat_row: mover?.seat_row ?? null, seat_col: mover?.seat_col ?? null })
          .eq("id", occupant.id);
      }
    }
    const { error } = await context.supabase
      .from("students")
      .update({ seat_row: data.seat_row, seat_col: data.seat_col })
      .eq("id", data.student_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleSeatLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), locked: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("students").update({ seat_locked: data.locked }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearAllSeats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ class_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("students")
      .update({ seat_row: null, seat_col: null })
      .eq("class_id", data.class_id)
      .eq("seat_locked", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleHiddenSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      class_id: z.string().uuid(),
      row: z.number().int().min(0),
      col: z.number().int().min(0),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: cls, error: e1 } = await context.supabase
      .from("classes").select("hidden_seats").eq("id", data.class_id).single();
    if (e1) throw new Error(e1.message);
    const key = `${data.row}:${data.col}`;
    const list: string[] = Array.isArray(cls?.hidden_seats) ? (cls!.hidden_seats as string[]) : [];
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    // if hiding, evict any occupant
    if (!list.includes(key)) {
      await context.supabase.from("students")
        .update({ seat_row: null, seat_col: null })
        .eq("class_id", data.class_id).eq("seat_row", data.row).eq("seat_col", data.col);
    }
    const { error } = await context.supabase.from("classes")
      .update({ hidden_seats: next }).eq("id", data.class_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const smartSortSeats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ class_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cls, error: e1 } = await context.supabase
      .from("classes").select("grid_rows, grid_cols, hidden_seats").eq("id", data.class_id).single();
    if (e1) throw new Error(e1.message);
    const { data: students, error: e2 } = await context.supabase
      .from("students").select("*").eq("class_id", data.class_id);
    if (e2) throw new Error(e2.message);
    const { data: relations, error: e3 } = await context.supabase
      .from("student_relations").select("student_a, student_b, kind").eq("class_id", data.class_id);
    if (e3) throw new Error(e3.message);

    const hidden = new Set<string>(Array.isArray(cls.hidden_seats) ? (cls.hidden_seats as string[]) : []);
    const assign = smartAssign(
      (students ?? []) as unknown as ScoringStudent[],
      (relations ?? []) as unknown as ScoringRelation[],
      cls.grid_rows, cls.grid_cols, hidden,
    );
    // clear movable first to avoid unique conflict
    const movableIds = (students ?? []).filter((s) => !s.seat_locked).map((s) => s.id);
    if (movableIds.length) {
      await context.supabase.from("students")
        .update({ seat_row: null, seat_col: null })
        .in("id", movableIds);
    }
    // assign
    for (const [sid, pos] of assign.entries()) {
      await context.supabase.from("students")
        .update({ seat_row: pos?.row ?? null, seat_col: pos?.col ?? null })
        .eq("id", sid);
    }
    return { ok: true };
  });

// relations
const kindEnum = z.enum(["friend", "avoid", "distance"]);

export const listRelations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("student_relations")
      .select("*")
      .eq("class_id", data.classId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createRelation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      class_id: z.string().uuid(),
      student_a: z.string().uuid(),
      student_b: z.string().uuid(),
      kind: kindEnum,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.student_a === data.student_b) throw new Error("יש לבחור שני תלמידים שונים");
    const { error } = await context.supabase.from("student_relations").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRelation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("student_relations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });