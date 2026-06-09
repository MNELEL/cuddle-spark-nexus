import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

/** Suggest resources matching a bulletin (by embedding of study_points). */
export const suggestResourcesForBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bulletin_id: uuid, limit: z.number().int().min(1).max(20).default(6) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: b } = await context.supabase
      .from("weekly_bulletins").select("study_points,title,embedding").eq("id", data.bulletin_id).maybeSingle();
    if (!b) return [];
    const row = b as { study_points: string[]; title: string; embedding: unknown };

    let emb: unknown = row.embedding;
    if (!emb) {
      // Compute on demand
      const { embedText, toPgVector } = await import("./embeddings.server");
      const v = await embedText([row.title, ...(row.study_points ?? [])].join("\n"));
      if (v) {
        emb = toPgVector(v);
        await context.supabase.from("weekly_bulletins")
          .update({ embedding: emb } as never).eq("id", data.bulletin_id);
      }
    }
    if (!emb) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: matches } = await supabaseAdmin.rpc("match_resources", {
      query_embedding: emb as unknown as string,
      owner: context.userId,
      match_count: data.limit,
      exclude_id: null,
    });
    const ids = ((matches ?? []) as { id: string; similarity: number }[]);
    if (!ids.length) return [];
    const { data: rows } = await context.supabase
      .from("teaching_resources").select("*").in("id", ids.map((x) => x.id));
    const byId = new Map((rows ?? []).map((r) => [(r as { id: string }).id, r]));
    return ids.map((m) => ({ ...(byId.get(m.id) as object | undefined), similarity: m.similarity }))
      .filter((x) => x && (x as { id?: string }).id) as unknown as Array<{ id: string; title: string; resource_type: string; subject: string; description: string; similarity: number }>;
  });

/** Link a resource to a bulletin (used during a given week). */
export const linkResourceToBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bulletin_id: uuid, resource_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bulletin_resources")
      .upsert({ bulletin_id: data.bulletin_id, resource_id: data.resource_id, owner_id: context.userId } as never,
        { onConflict: "bulletin_id,resource_id" });
    if (error) { console.error("[DB]", error); throw new Error("הפעולה נכשלה"); }
    return { ok: true };
  });

export const listBulletinResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bulletin_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: links } = await context.supabase
      .from("bulletin_resources").select("resource_id").eq("bulletin_id", data.bulletin_id);
    const ids = ((links ?? []) as { resource_id: string }[]).map((l) => l.resource_id);
    if (!ids.length) return [];
    const { data: rows } = await context.supabase
      .from("teaching_resources").select("*").in("id", ids);
    return (rows ?? []) as unknown as Array<{ id: string; title: string; resource_type: string; subject: string; description: string }>;
  });

/** Generate a question bank resource for the week's study points. */
export const generateQuizFromBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bulletin_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("חסר LOVABLE_API_KEY");

    const { data: b } = await context.supabase
      .from("weekly_bulletins").select("title,study_points,digest_summary,start_date,end_date,class_id")
      .eq("id", data.bulletin_id).maybeSingle();
    if (!b) throw new Error("העלון לא נמצא");
    const bul = b as { title: string; study_points: string[]; digest_summary: string;
      start_date: string; end_date: string; class_id: string };

    const system = `אתה עוזר של רב/מלמד בתלמוד תורה. צור מבחן חזרה על החומר שנלמד השבוע.
השאלות חייבות להיות מבוססות אך ורק על נקודות הלימוד שנמסרו (study_points) ועל סיכום השבוע.
כתוב בעברית מכובדת לציבור החרדי. החזר אך ורק JSON תקין:
{"title":"","description":"","questions":[{"q":"","a":""}]}
8-12 שאלות עם תשובות.`;

    const user = `כותרת העלון: ${bul.title}\nסיכום השבוע:\n${bul.digest_summary}\nנקודות לימוד:\n${(bul.study_points ?? []).map((p, i) => `${i + 1}. ${p}`).join("\n")}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (resp.status === 429) throw new Error("חרגת ממכסת AI.");
    if (resp.status === 402) throw new Error("נגמרו קרדיטים.");
    if (!resp.ok) {
      console.error("[AI]", resp.status, await resp.text().catch(() => ""));
      throw new Error("היצירה נכשלה.");
    }
    const j = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    let parsed: { title?: string; description?: string; questions?: { q?: string; a?: string }[] } = {};
    try { parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}"); } catch { /* */ }

    const content = {
      body: bul.digest_summary.slice(0, 2000),
      questions: Array.isArray(parsed.questions)
        ? parsed.questions.filter((q) => q?.q).map((q) => ({
            q: String(q.q).slice(0, 500),
            a: q.a ? String(q.a).slice(0, 2000) : undefined,
          })).slice(0, 30)
        : [],
    };

    let embeddingSql: string | null = null;
    try {
      const { embedText, toPgVector } = await import("./embeddings.server");
      const v = await embedText([parsed.title ?? "", ...content.questions.map((q) => q.q)].join("\n"));
      if (v) embeddingSql = toPgVector(v);
    } catch { /* */ }

    const insertRow: Record<string, unknown> = {
      owner_id: context.userId,
      title: String(parsed.title ?? `מבחן חזרה — ${bul.title}`).slice(0, 200),
      description: String(parsed.description ?? "מבחן שנוצר אוטומטית מנקודות הלימוד של השבוע").slice(0, 2000),
      tags: ["auto-from-bulletin", "מבחן-חזרה"],
      subject: "", grade_level: "",
      resource_type: "question_bank",
      content, ai_generated: true,
      source_prompt: `מקור: עלון ${bul.title} (${bul.start_date}—${bul.end_date})`,
    };
    if (embeddingSql) insertRow.embedding = embeddingSql;

    const { data: ins, error } = await context.supabase
      .from("teaching_resources").insert(insertRow as never).select("id").single();
    if (error) { console.error("[DB]", error); throw new Error("שגיאה בשמירה"); }
    const resourceId = (ins as { id: string }).id;

    // Link to bulletin
    await context.supabase.from("bulletin_resources").upsert({
      bulletin_id: data.bulletin_id, resource_id: resourceId, owner_id: context.userId,
    } as never, { onConflict: "bulletin_id,resource_id" });

    return { id: resourceId };
  });