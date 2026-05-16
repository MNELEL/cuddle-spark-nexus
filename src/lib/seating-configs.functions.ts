import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SeatSnapshot = {
  grid_rows: number;
  grid_cols: number;
  hidden_seats: string[];
  seats: Array<{ student_id: string; seat_row: number | null; seat_col: number | null; seat_locked: boolean }>;
};

export const listConfigs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("seating_configs").select("id, name, created_at").eq("class_id", data.classId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    class_id: z.string().uuid(),
    name: z.string().min(1).max(80),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cls, error: e1 } = await context.supabase.from("classes")
      .select("grid_rows, grid_cols, hidden_seats").eq("id", data.class_id).single();
    if (e1) throw new Error(e1.message);
    const { data: students, error: e2 } = await context.supabase.from("students")
      .select("id, seat_row, seat_col, seat_locked").eq("class_id", data.class_id);
    if (e2) throw new Error(e2.message);
    const snapshot: SeatSnapshot = {
      grid_rows: cls.grid_rows, grid_cols: cls.grid_cols,
      hidden_seats: Array.isArray(cls.hidden_seats) ? (cls.hidden_seats as string[]) : [],
      seats: (students ?? []).map((s) => ({
        student_id: s.id, seat_row: s.seat_row, seat_col: s.seat_col, seat_locked: s.seat_locked,
      })),
    };
    const { error } = await context.supabase.from("seating_configs")
      .insert({ class_id: data.class_id, name: data.name, snapshot });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loadConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cfg, error } = await context.supabase.from("seating_configs")
      .select("class_id, snapshot").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const snap = cfg.snapshot as unknown as SeatSnapshot;
    await context.supabase.from("classes").update({
      grid_rows: snap.grid_rows, grid_cols: snap.grid_cols, hidden_seats: snap.hidden_seats,
    }).eq("id", cfg.class_id);
    // clear seats first
    const ids = snap.seats.map((s) => s.student_id);
    if (ids.length) {
      await context.supabase.from("students")
        .update({ seat_row: null, seat_col: null, seat_locked: false })
        .in("id", ids);
      for (const s of snap.seats) {
        await context.supabase.from("students")
          .update({ seat_row: s.seat_row, seat_col: s.seat_col, seat_locked: s.seat_locked })
          .eq("id", s.student_id);
      }
    }
    return { ok: true };
  });

export const deleteConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("seating_configs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const importStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    class_id: z.string().uuid(),
    students: z.array(z.object({
      name: z.string().min(1).max(100),
      height: z.enum(["low", "mid", "high"]).default("mid"),
      row_pref: z.enum(["front", "mid", "back", "any"]).default("any"),
      corner_pref: z.boolean().default(false),
      notes: z.string().max(2000).optional().default(""),
    })).min(1).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const rows = data.students.map((s) => ({ class_id: data.class_id, ...s }));
    const { error } = await context.supabase.from("students").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });