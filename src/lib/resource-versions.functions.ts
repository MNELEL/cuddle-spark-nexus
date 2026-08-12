import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordResourceVersion, type ResourceSnapshot, type VersionSource } from "./resource-versions.server";

const uuid = z.string().uuid();

export type ResourceVersionRow = {
  id: string;
  resource_id: string;
  owner_id: string;
  snapshot: ResourceSnapshot;
  source: VersionSource;
  created_at: string;
};

export const VERSION_SOURCE_LABELS: Record<VersionSource, string> = {
  manual: "עריכה ידנית",
  ai: "יצירה עם AI",
  upload: "העלאת קובץ",
  restore: "שחזור גרסה",
};

export const listResourceVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ resource_id: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<ResourceVersionRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("resource_versions")
      .select("*")
      .eq("resource_id", data.resource_id)
      .order("created_at", { ascending: false })
      .limit(50) as unknown as { data: ResourceVersionRow[] | null; error: { message: string } | null };
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return rows ?? [];
  });

export const restoreResourceVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ version_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ver, error } = await context.supabase
      .from("resource_versions").select("*").eq("id", data.version_id).maybeSingle() as unknown as {
        data: ResourceVersionRow | null; error: { message: string } | null;
      };
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!ver) throw new Error("הגרסה לא נמצאה");

    // שומרים קודם את המצב הנוכחי, כדי שאפשר יהיה לחזור אחורה גם מהשחזור
    await recordResourceVersion(context.supabase, context.userId, ver.resource_id, "restore");

    const { error: upErr } = await context.supabase
      .from("teaching_resources")
      .update(ver.snapshot as never)
      .eq("id", ver.resource_id);
    if (upErr) { console.error("[DB Error]", upErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { resource_id: ver.resource_id };
  });
