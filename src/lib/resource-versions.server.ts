import type { SupabaseClient } from "@supabase/supabase-js";

/** מקור השינוי שנרשם בגרסה. */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type VersionSource = "manual" | "ai" | "upload" | "restore";

export type ResourceSnapshot = {
  title: string;
  description: string;
  subject: string;
  grade_level: string;
  resource_type: string;
  content: { [key: string]: Json };
  tags: string[];
  file_path: string | null;
  mime_type: string | null;
  difficulty: string;
};

const SNAPSHOT_KEYS = [
  "title", "description", "subject", "grade_level", "resource_type",
  "content", "tags", "file_path", "mime_type", "difficulty",
] as const;

export function toSnapshot(row: Record<string, unknown>): ResourceSnapshot {
  const out: Record<string, unknown> = {};
  for (const k of SNAPSHOT_KEYS) out[k] = row[k] ?? (k === "tags" ? [] : k === "content" ? {} : null);
  return out as ResourceSnapshot;
}

/**
 * שומר "תצלום" של החומר כגרסה. נכשל בשקט (log בלבד) כדי שלא לשבור שמירה רגילה.
 */
export async function recordResourceVersion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  ownerId: string,
  resourceId: string,
  source: VersionSource,
): Promise<void> {
  try {
    const { data: row } = await supabase
      .from("teaching_resources").select("*").eq("id", resourceId).maybeSingle();
    if (!row) return;
    const { error } = await supabase.from("resource_versions").insert({
      resource_id: resourceId,
      owner_id: ownerId,
      snapshot: toSnapshot(row as Record<string, unknown>),
      source,
    } as never);
    if (error) console.error("[resource_versions]", error);
  } catch (e) {
    console.error("[resource_versions]", e);
  }
}
