import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("classes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return data ?? [];
  });

export const createClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("classes")
      .insert({ name: data.name, owner_id: context.userId })
      .select()
      .single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return row;
  });

export const getClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("classes")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return row;
  });

export const ROOM_OBJECT_TYPES = [
  "board", "teacher_desk", "cabinet", "reading_corner", "door", "window",
] as const;
export type RoomObjectType = typeof ROOM_OBJECT_TYPES[number];
export type RoomObject = {
  id: string;
  type: RoomObjectType;
  row: number;
  col: number;
  span?: number;
  label?: string;
};

const roomObjectSchema = z.object({
  id: z.string().min(1).max(60),
  type: z.enum(ROOM_OBJECT_TYPES),
  row: z.number().int().min(0).max(30),
  col: z.number().int().min(0).max(30),
  span: z.number().int().min(1).max(6).optional(),
  label: z.string().max(60).optional(),
});

export const updateClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      grid_cols: z.number().int().min(1).max(20).optional(),
      grid_rows: z.number().int().min(1).max(20).optional(),
      room_objects: z.array(roomObjectSchema).max(60).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("classes")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

export const deleteClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("classes").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

export const setClassStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["active", "archived"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("classes")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });