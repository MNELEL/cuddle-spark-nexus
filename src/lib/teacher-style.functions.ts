import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StyleProfile = {
  user_id: string;
  preferred_subjects: Record<string, number>;
  preferred_resource_types: Record<string, number>;
  avg_questions_per_worksheet: number;
  avg_question_length: number;
  tone_keywords: string[];
  writing_style_sample: string;
  weekly_pace: Record<string, number>;
  resource_count: number;
  last_ai_summary: string;
  last_updated_at: string;
};

export const getStyleProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StyleProfile | null> => {
    const { data } = await context.supabase
      .from("teacher_style_profile").select("*").eq("user_id", context.userId).maybeSingle();
    return data as unknown as StyleProfile | null;
  });

/** Internal: recompute style profile for a user. Reusable from other server fns (triggers). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recomputeStyleProfileFor(supabase: SupabaseClient<any, any, any>, userId: string) {
  const { data: rows } = await supabase
      .from("teaching_resources")
      .select("title,description,subject,resource_type,content,created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (rows ?? []) as { title: string; description: string; subject: string;
      resource_type: string; content: { body?: string; questions?: { q: string }[] }; created_at: string }[];
    if (list.length === 0) return { ok: true, count: 0 };

    const subjects: Record<string, number> = {};
    const types: Record<string, number> = {};
    let totalQuestions = 0;
    let totalQLen = 0;
    let qCount = 0;
    const wordCounter: Record<string, number> = {};
    const stopWords = new Set(["של","על","את","עם","אל","לא","כי","אם","מה","זה","זאת","הוא","היא","הם","הן","אני","אתה","אנחנו","שלי","שלך","אבל","גם","רק","יותר","כל","יש","אין","היה","היתה","להיות","ל","ב","ה","ו","מ","ש","כ","-","–"]);
    const paceByWeek: Record<string, number> = {};

    for (const r of list) {
      if (r.subject) subjects[r.subject] = (subjects[r.subject] ?? 0) + 1;
      types[r.resource_type] = (types[r.resource_type] ?? 0) + 1;
      const qs = r.content?.questions ?? [];
      if (qs.length) {
        totalQuestions += qs.length;
        qCount++;
        for (const q of qs) totalQLen += (q.q ?? "").length;
      }
      const text = `${r.title} ${r.description}`.toLowerCase();
      for (const w of text.split(/[\s.,;:?!()"'\u05be\u05c0\u05c3״׳]+/)) {
        if (w.length < 3 || stopWords.has(w)) continue;
        wordCounter[w] = (wordCounter[w] ?? 0) + 1;
      }
      const week = r.created_at.slice(0, 10).split("-").slice(0, 2).join("-");
      paceByWeek[week] = (paceByWeek[week] ?? 0) + 1;
    }

    const tone_keywords = Object.entries(wordCounter)
      .sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);
    const writing_style_sample = list.slice(0, 3).map((r) =>
      `${r.title}${r.description ? ` — ${r.description}` : ""}`,
    ).join("\n");

    const upsertRow = {
      user_id: userId,
      preferred_subjects: subjects,
      preferred_resource_types: types,
      avg_questions_per_worksheet: qCount ? totalQuestions / qCount : 0,
      avg_question_length: totalQuestions ? totalQLen / totalQuestions : 0,
      tone_keywords,
      writing_style_sample,
      weekly_pace: paceByWeek,
      resource_count: list.length,
      last_updated_at: new Date().toISOString(),
    };
  const { error } = await supabase
      .from("teacher_style_profile")
      .upsert(upsertRow as never, { onConflict: "user_id" });
    if (error) { console.error("[Style DB Error]", error); }
    return { ok: true, count: list.length };
}

/** Recompute the style profile from all the user's resources. Runs cheaply (no AI). */
export const recomputeStyleProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => recomputeStyleProfileFor(context.supabase, context.userId));

/** Recommend resources for the current user. Combines style + recency. */
export const getPersonalRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(20).default(6) }).parse(d))
  .handler(async ({ data, context }) => {
    // Strategy: take the most recent resource's embedding, find similar via match_resources.
    // Falls back to "most-used resource types" when no embeddings exist.
    const { data: recent } = await context.supabase
      .from("teaching_resources")
      .select("id,embedding")
      .eq("owner_id", context.userId)
      .not("embedding", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const recentRow = recent as { id: string; embedding: unknown } | null;
    if (recentRow?.embedding) {
      // Use admin to call SECURITY DEFINER match function
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: matches, error } = await supabaseAdmin.rpc("match_resources", {
        query_embedding: recentRow.embedding as unknown as string,
        owner: context.userId,
        match_count: data.limit,
        exclude_id: recentRow.id,
      });
      if (error) { console.error("[Match RPC]", error); }
      const ids = ((matches ?? []) as { id: string }[]).map((m) => m.id);
      if (ids.length) {
        const { data: rows } = await context.supabase
          .from("teaching_resources").select("*").in("id", ids);
        return (rows ?? []) as unknown as Array<{ id: string; title: string; resource_type: string; subject: string; description: string }>;
      }
    }
    // Fallback: recent items
    const { data: fallback } = await context.supabase
      .from("teaching_resources").select("*")
      .eq("owner_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    return (fallback ?? []) as unknown as Array<{ id: string; title: string; resource_type: string; subject: string; description: string }>;
  });