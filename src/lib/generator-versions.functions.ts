import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GeneratorKind = "summary" | "tasks";

export type GeneratorVersion = {
  id: string;
  kind: GeneratorKind;
  title: string;
  body: string;
  params: Record<string, unknown>;
  resource_id: string | null;
  created_at: string;
};

const rowToVersion = (r: Record<string, unknown>): GeneratorVersion => ({
  id: String(r["id"]),
  kind: (r["kind"] as GeneratorKind) ?? "summary",
  title: (r["title"] as string) ?? "",
  body: (r["body"] as string) ?? "",
  params: (r["params"] as Record<string, unknown>) ?? {},
  resource_id: (r["resource_id"] as string | null) ?? null,
  created_at: String(r["created_at"]),
});

/** Version history for a generator, newest first, with optional free-text search. */
export const listGeneratorVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    kind: z.enum(["summary", "tasks"]),
    search: z.string().max(200).default(""),
    limit: z.number().int().min(1).max(100).default(50),
  }).parse(d))
  .handler(async ({ data, context }): Promise<GeneratorVersion[]> => {
    let q = context.supabase
      .from("generator_versions")
      .select("id,kind,title,body,params,resource_id,created_at")
      .eq("owner_id", context.userId)
      .eq("kind", data.kind)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    const term = data.search.trim();
    if (term) {
      const safe = term.replace(/[%,]/g, " ");
      q = q.or(`title.ilike.%${safe}%,body.ilike.%${safe}%`);
    }

    const { data: rows, error } = await q;
    if (error) { console.error("[generator-versions]", error); throw new Error("טעינת ההיסטוריה נכשלה"); }
    return (rows ?? []).map((r) => rowToVersion(r as Record<string, unknown>));
  });

/** Stores a new version of a generated summary / task sheet. */
export const saveGeneratorVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    kind: z.enum(["summary", "tasks"]),
    title: z.string().max(200).default(""),
    body: z.string().max(60_000).default(""),
    params: z.record(z.string(), z.unknown()).default({}),
    resourceId: z.string().uuid().nullish(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<GeneratorVersion> => {
    const { data: row, error } = await context.supabase
      .from("generator_versions")
      .insert({
        owner_id: context.userId,
        kind: data.kind,
        title: data.title,
        body: data.body,
        params: data.params,
        resource_id: data.resourceId ?? null,
      } as never)
      .select("id,kind,title,body,params,resource_id,created_at")
      .single();
    if (error || !row) { console.error("[generator-versions]", error); throw new Error("שמירת הגרסה נכשלה"); }
    return rowToVersion(row as Record<string, unknown>);
  });

/** Overwrites the text of an existing version (after editing a restored version). */
export const updateGeneratorVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    title: z.string().max(200).optional(),
    body: z.string().max(60_000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.body !== undefined) patch["body"] = data.body;
    const { error } = await context.supabase
      .from("generator_versions")
      .update(patch as never)
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) { console.error("[generator-versions]", error); throw new Error("עדכון הגרסה נכשל"); }
    return { ok: true };
  });

export const deleteGeneratorVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("generator_versions")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) { console.error("[generator-versions]", error); throw new Error("מחיקת הגרסה נכשלה"); }
    return { ok: true };
  });
