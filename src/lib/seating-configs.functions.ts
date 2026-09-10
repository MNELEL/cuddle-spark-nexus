import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeViolations,
  scoreAssignment,
  smartAssign,
  type ScoringStudent,
  type ScoringRelation,
} from "@/lib/seating-logic";

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
      .from("seating_configs").select("id, name, created_at, score, violation_count").eq("class_id", data.classId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
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
      .select("id, seat_row, seat_col, seat_locked, height, row_pref, corner_pref").eq("class_id", data.class_id);
    if (e2) throw new Error(e2.message);
    const { data: relations, error: e3 } = await context.supabase.from("student_relations")
      .select("student_a, student_b, kind").eq("class_id", data.class_id);
    if (e3) throw new Error(e3.message);
    const scoringStudents = (students ?? []) as unknown as ScoringStudent[];
    const scoringRelations = (relations ?? []) as unknown as ScoringRelation[];
    const violations = computeViolations(scoringStudents, scoringRelations, cls.grid_rows, cls.grid_cols);
    const score = scoreAssignment(scoringStudents, scoringRelations, cls.grid_rows, cls.grid_cols);
    const snapshot: SeatSnapshot = {
      grid_rows: cls.grid_rows, grid_cols: cls.grid_cols,
      hidden_seats: Array.isArray(cls.hidden_seats) ? (cls.hidden_seats as string[]) : [],
      seats: (students ?? []).map((s) => ({
        student_id: s.id, seat_row: s.seat_row, seat_col: s.seat_col, seat_locked: s.seat_locked,
      })),
    };
    const { error } = await context.supabase.from("seating_configs")
      .insert({ class_id: data.class_id, name: data.name, snapshot, score, violation_count: violations.length });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

export const loadConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cfg, error } = await context.supabase.from("seating_configs")
      .select("class_id, snapshot").eq("id", data.id).single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
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
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
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
      birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    })).min(1).max(500),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const rows = data.students.map((s) => ({ class_id: data.class_id, ...s }));
    const { error } = await context.supabase.from("students").insert(rows);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true, count: rows.length };
  });
export const generateSeatingCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    classId: z.string().uuid(),
    count: z.number().int().min(1).max(5).default(3),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cls, error: e1 } = await context.supabase.from("classes")
      .select("grid_rows, grid_cols, hidden_seats, room_objects").eq("id", data.classId).single();
    if (e1) throw new Error(e1.message);
    const { data: students, error: e2 } = await context.supabase.from("students")
      .select("id, seat_row, seat_col, seat_locked, height, row_pref, corner_pref").eq("class_id", data.classId);
    if (e2) throw new Error(e2.message);
    const { data: relations, error: e3 } = await context.supabase.from("student_relations")
      .select("student_a, student_b, kind").eq("class_id", data.classId);
    if (e3) throw new Error(e3.message);

    const hidden = new Set<string>(Array.isArray(cls.hidden_seats) ? (cls.hidden_seats as string[]) : []);
    const objects = Array.isArray((cls as { room_objects?: unknown }).room_objects)
      ? ((cls as { room_objects?: unknown }).room_objects as Array<{ row?: number; col?: number; span?: number }>)
      : [];
    for (const o of objects) {
      if (typeof o?.row === "number" && typeof o?.col === "number") {
        const span = typeof o.span === "number" && o.span > 1 ? o.span : 1;
        for (let i = 0; i < span; i++) hidden.add(`${o.row}:${o.col + i}`);
      }
    }

    const base = (students ?? []) as unknown as ScoringStudent[];
    const scoringRelations = (relations ?? []) as unknown as ScoringRelation[];
    const created: Array<{ id: string; name: string; score: number; violation_count: number }> = [];

    for (let i = 0; i < data.count; i++) {
      const assign = smartAssign(base, scoringRelations, cls.grid_rows, cls.grid_cols, hidden);
      const projected: ScoringStudent[] = base.map((s) => {
        if (!assign.has(s.id)) return { ...s };
        const pos = assign.get(s.id) ?? null;
        return { ...s, seat_row: pos?.row ?? null, seat_col: pos?.col ?? null };
      });
      const violations = computeViolations(projected, scoringRelations, cls.grid_rows, cls.grid_cols);
      const score = scoreAssignment(projected, scoringRelations, cls.grid_rows, cls.grid_cols);
      const snapshot: SeatSnapshot = {
        grid_rows: cls.grid_rows,
        grid_cols: cls.grid_cols,
        hidden_seats: Array.isArray(cls.hidden_seats) ? (cls.hidden_seats as string[]) : [],
        seats: projected.map((s) => ({
          student_id: s.id, seat_row: s.seat_row, seat_col: s.seat_col, seat_locked: s.seat_locked,
        })),
      };
      const name = `הצעה אוטומטית ${i + 1}`;
      const { data: row, error } = await context.supabase.from("seating_configs")
        .insert({ class_id: data.classId, name, snapshot, score, violation_count: violations.length })
        .select("id, name, score, violation_count").single();
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
      created.push({
        id: row.id, name: row.name,
        score: row.score ?? score, violation_count: row.violation_count ?? violations.length,
      });
    }
    return created;
  });

/** פרטי תצורה שמורה — שם הכיתה, המקומות והתלמידים — לצורך הפקת PDF. */
export const getConfigDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cfg, error } = await context.supabase.from("seating_configs")
      .select("id, name, created_at, score, violation_count, class_id, snapshot").eq("id", data.id).single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    const snap = cfg.snapshot as unknown as SeatSnapshot;
    const { data: cls } = await context.supabase.from("classes")
      .select("name, room_objects").eq("id", cfg.class_id).single();
    const { data: students } = await context.supabase.from("students")
      .select("id, name").eq("class_id", cfg.class_id);
    const nameById = new Map((students ?? []).map((s) => [s.id, s.name as string]));
    const objects = Array.isArray((cls as { room_objects?: unknown } | null)?.room_objects)
      ? ((cls as { room_objects?: unknown }).room_objects as Array<{ row?: number; col?: number; label?: string; span?: number }>)
      : [];
    return {
      id: cfg.id,
      name: cfg.name,
      created_at: cfg.created_at,
      score: cfg.score,
      violation_count: cfg.violation_count,
      className: (cls as { name?: string } | null)?.name ?? "",
      grid: { rows: snap.grid_rows, cols: snap.grid_cols },
      hidden_seats: snap.hidden_seats ?? [],
      seats: snap.seats
        .filter((s) => s.seat_row !== null && s.seat_col !== null)
        .map((s) => ({
          student: nameById.get(s.student_id) ?? "—",
          row: (s.seat_row ?? 0) + 1,
          col: (s.seat_col ?? 0) + 1,
          locked: s.seat_locked,
        }))
        .sort((a, b) => a.row - b.row || a.col - b.col),
      objects: objects.map((o) => ({
        label: o.label ?? "פריט",
        row: (o.row ?? 0) + 1,
        col: (o.col ?? 0) + 1,
        span: o.span ?? 1,
      })),
    };
  });
