import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

export type IngestAiSettings = {
  topic_confidence_threshold: number;
  collection_confidence_threshold: number;
};

export type IngestAiSuggestionLog = {
  id: string;
  resource_title: string;
  suggested_topic_id: string | null;
  suggested_topic_name: string;
  topic_confidence: number;
  confidence_threshold: number;
  suggested_collection_ids: string[];
  final_topic_id: string | null;
  final_collection_ids: string[];
  topic_changed: boolean;
  collections_changed: boolean;
  created_at: string;
};

export const getIngestAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IngestAiSettings> => {
    const { data } = await context.supabase
      .from("ingest_ai_settings")
      .select("topic_confidence_threshold, collection_confidence_threshold")
      .eq("user_id", context.userId)
      .maybeSingle();
    const row = data as IngestAiSettings | null;
    return {
      topic_confidence_threshold: Number(row?.topic_confidence_threshold ?? DEFAULT_CONFIDENCE_THRESHOLD),
      collection_confidence_threshold: Number(row?.collection_confidence_threshold ?? DEFAULT_CONFIDENCE_THRESHOLD),
    };
  });

export const updateIngestAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    topic_confidence_threshold: z.number().min(0).max(1),
    collection_confidence_threshold: z.number().min(0).max(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ingest_ai_settings")
      .upsert({
        user_id: context.userId,
        topic_confidence_threshold: data.topic_confidence_threshold,
        collection_confidence_threshold: data.collection_confidence_threshold,
      } as never, { onConflict: "user_id" });
    if (error) { console.error("[DB]", error); throw new Error("הפעולה נכשלה."); }
    return { ok: true };
  });

export const listIngestAiSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(50).default(20) }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<IngestAiSuggestionLog[]> => {
    const { data: rows, error } = await context.supabase
      .from("ingest_ai_suggestions")
      .select("id, resource_title, suggested_topic_id, suggested_topic_name, topic_confidence, confidence_threshold, suggested_collection_ids, final_topic_id, final_collection_ids, topic_changed, collections_changed, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) { console.error("[DB]", error); throw new Error("הפעולה נכשלה."); }
    return (rows ?? []) as unknown as IngestAiSuggestionLog[];
  });
