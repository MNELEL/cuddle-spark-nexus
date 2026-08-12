import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** OCR + סיווג של חומר קיים בספרייה (לפי דרישה מהמסך). */
export const analyzeExistingResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), force: z.boolean().default(false) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { understandResource } = await import("./resource-understanding.server");
    return understandResource(context.supabase, context.userId, data.id, data.force);
  });

/** מספר הפעמים שכל חומר שימש בכיתות — לצורך מיון לפי פופולריות. */
export const getResourceUsageCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, number>> => {
    const { data, error } = await context.supabase
      .from("class_resource_usage")
      .select("resource_id");
    if (error) return {};
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { resource_id: string }[]) {
      counts[row.resource_id] = (counts[row.resource_id] ?? 0) + 1;
    }
    return counts;
  });
