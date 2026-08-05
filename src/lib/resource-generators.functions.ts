import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { STUDENT_LEVELS, SUMMARY_SCOPES, TASK_KINDS } from "./generator-options";

/** Generates a Hebrew summary of a library resource, adapted to the students' level. */
export const generateResourceSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    resourceId: z.string().uuid(),
    level: z.enum(STUDENT_LEVELS).default("average"),
    scope: z.enum(SUMMARY_SCOPES).default("medium"),
    notes: z.string().max(500).default(""),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    const { loadResourceContext, buildSummary } = await import("./resource-generators.server");
    const ctx = await loadResourceContext(context.supabase, data.resourceId);
    return {
      text: await buildSummary({
        source: ctx.text, level: data.level, scope: data.scope, notes: data.notes,
      }),
    };
  });

/** Generates Hebrew assignments from a library resource or from a free topic. */
export const generateResourceTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    resourceId: z.string().uuid().optional(),
    topic: z.string().max(300).default(""),
    level: z.enum(STUDENT_LEVELS).default("average"),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    kind: z.enum(TASK_KINDS).default("questions"),
    count: z.number().int().min(1).max(30).default(8),
    notes: z.string().max(500).default(""),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ text: string }> => {
    if (!data.resourceId && !data.topic.trim()) {
      throw new Error("בחר חומר מהספרייה או הזן נושא חופשי");
    }
    const { loadResourceContext, buildTasks } = await import("./resource-generators.server");
    const source = data.resourceId
      ? (await loadResourceContext(context.supabase, data.resourceId)).text
      : `נושא חופשי: ${data.topic}`;
    return {
      text: await buildTasks({
        source,
        level: data.level,
        difficulty: data.difficulty,
        kind: data.kind,
        count: data.count,
        notes: data.notes,
      }),
    };
  });
