import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TopicRow = {
  id: string;
  owner_id: string;
  name: string;
  parent_id: string | null;
  color: string;
  created_at: string;
};

export const listTopics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TopicRow[]> => {
    const { data, error } = await context.supabase
      .from("topics")
      .select("*")
      .eq("owner_id", context.userId)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as TopicRow[];
  });

export const upsertTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(80),
    parent_id: z.string().uuid().nullable().optional(),
    color: z.string().max(20).optional().default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("topics").update(rest).eq("id", id).eq("owner_id", context.userId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("topics")
      .insert({ ...data, owner_id: context.userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("topics").delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setResourceTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    resource_id: z.string().uuid(),
    topic_id: z.string().uuid().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("teaching_resources")
      .update({ topic_id: data.topic_id })
      .eq("id", data.resource_id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Build tree (roots + children map) from a flat list. */
export function buildTopicTree(rows: TopicRow[]) {
  const byParent = new Map<string | null, TopicRow[]>();
  for (const t of rows) {
    const key = t.parent_id ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }
  return byParent;
}