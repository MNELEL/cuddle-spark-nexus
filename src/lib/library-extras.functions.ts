import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  RESOURCE_TYPES, DIFFICULTIES,
  type ResourceRow, type ResourceContent,
} from "./teaching-resources.functions";

const uuid = z.string().uuid();

/** עריכה ידנית של הסיווג והתגיות שה-AI קבע. */
export const patchResourceClassification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: uuid,
      subject: z.string().max(80),
      grade_level: z.string().max(40),
      resource_type: z.enum(RESOURCE_TYPES),
      difficulty: z.enum(DIFFICULTIES),
      description: z.string().max(2000),
      tags: z.array(z.string().min(1).max(40)).max(25),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { recordResourceVersion } = await import("./resource-versions.server");
    await recordResourceVersion(context.supabase, context.userId, id, "manual");
    const { error } = await context.supabase
      .from("teaching_resources")
      .update({ ...patch, tags: [...new Set(patch.tags)] } as never)
      .eq("id", id);
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת הסיווג נכשלה"); }
    return { ok: true };
  });

/** תיקון ידני של הטקסט שחולץ ב-OCR + אינדוקס מחדש לחיפוש. */
export const updateResourceOcrText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: uuid, original_text: z.string().max(200000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("teaching_resources").select("content").eq("id", data.id).maybeSingle();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    const content = ((row as { content: ResourceContent } | null)?.content ?? {}) as ResourceContent;
    const { recordResourceVersion } = await import("./resource-versions.server");
    await recordResourceVersion(context.supabase, context.userId, data.id, "manual");
    const nextContent: ResourceContent = {
      ...content,
      original_text: data.original_text,
      ai_understanding: {
        ...(content.ai_understanding ?? {}),
        ocr_reviewed: true,
        ocr_reviewed_at: new Date().toISOString(),
      },
    };
    const { error: upErr } = await context.supabase
      .from("teaching_resources").update({ content: nextContent } as never).eq("id", data.id);
    if (upErr) { console.error("[DB Error]", upErr); throw new Error("שמירת הטקסט נכשלה"); }
    if (data.original_text.trim()) {
      const { indexResourceChunks } = await import("./resource-chunks.server");
      await indexResourceChunks(context.supabase, context.userId, data.id, data.original_text);
    }
    return { ok: true, chars: data.original_text.length };
  });

export type SimilarResource = {
  id: string;
  title: string;
  resource_type: string;
  subject: string;
  grade_level: string;
  similarity: number;
  summary: string;
};

/** "חומרים דומים" — לפי הטקסט שחולץ וההקשרים שה-AI זיהה. */
export const getSimilarResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: uuid, limit: z.number().int().min(1).max(12).default(6) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<SimilarResource[]> => {
    const { data: row } = await context.supabase
      .from("teaching_resources")
      .select("id,title,tags,subject,content,embedding")
      .eq("id", data.id)
      .maybeSingle();
    const base = row as (Partial<ResourceRow> & { embedding: unknown }) | null;
    if (!base) return [];

    let vec = (base.embedding ?? null) as string | null;
    if (!vec) {
      const c = (base.content ?? {}) as ResourceContent;
      const seed = [
        base.title ?? "",
        base.subject ?? "",
        (base.tags ?? []).join(", "),
        c.ai_understanding?.summary ?? "",
        (c.ai_understanding?.contexts ?? []).join(", "),
        (c.original_text ?? c.body ?? "").slice(0, 4000),
      ].filter(Boolean).join("\n");
      if (!seed.trim()) return [];
      const { embedText, toPgVector } = await import("./embeddings.server");
      const emb = await embedText(seed);
      if (!emb) return [];
      vec = toPgVector(emb);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: matches, error } = await supabaseAdmin.rpc("match_resources", {
      query_embedding: vec as unknown as string,
      owner: context.userId,
      match_count: data.limit,
      exclude_id: data.id,
    });
    if (error) { console.error("[match_resources]", error); return []; }
    const scored = (matches ?? []) as { id: string; similarity: number }[];
    if (scored.length === 0) return [];

    const { data: rows } = await context.supabase
      .from("teaching_resources")
      .select("id,title,resource_type,subject,grade_level,content")
      .in("id", scored.map((m) => m.id));
    const byId = new Map(
      ((rows ?? []) as Array<{
        id: string; title: string; resource_type: string; subject: string;
        grade_level: string; content: ResourceContent | null;
      }>).map((r) => [r.id, r]),
    );
    return scored
      .map((m) => {
        const r = byId.get(m.id);
        if (!r) return null;
        return {
          id: r.id,
          title: r.title,
          resource_type: r.resource_type,
          subject: r.subject ?? "",
          grade_level: r.grade_level ?? "",
          similarity: m.similarity,
          summary: r.content?.ai_understanding?.summary ?? "",
        } as SimilarResource;
      })
      .filter((x): x is SimilarResource => x !== null);
  });

/** רישום חומר חדש לספרייה מקובץ שהועלה מהדפדפן (העלאה מרובה). */
export const createUploadedResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      title: z.string().min(1).max(200),
      file_path: z.string().min(1).max(500),
      mime_type: z.string().max(120).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ins, error } = await context.supabase
      .from("teaching_resources")
      .insert({
        owner_id: context.userId,
        title: data.title,
        file_path: data.file_path,
        mime_type: data.mime_type || null,
        resource_type: "other",
        content: { source_kind: "upload" },
        source_prompt: "מקור: העלאה מרובה לספרייה",
      } as never)
      .select("id")
      .single();
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת החומר נכשלה"); }
    return { id: (ins as { id: string }).id };
  });

/** קישורים חתומים להורדה מרוכזת (הדפדפן אורז ל-ZIP). */
export const getResourceDownloadLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(uuid).min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("teaching_resources")
      .select("id,title,file_path,content")
      .in("id", data.ids);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    const out: { id: string; title: string; file_name: string; url: string | null; text: string }[] = [];
    for (const r of (rows ?? []) as Array<{
      id: string; title: string; file_path: string | null; content: ResourceContent | null;
    }>) {
      let url: string | null = null;
      if (r.file_path) {
        const signed = await context.supabase.storage
          .from("teaching-resources").createSignedUrl(r.file_path, 60 * 10);
        url = signed.data?.signedUrl ?? null;
      }
      const name = (r.file_path?.split("/").pop() ?? `${r.title}.txt`).slice(-100);
      out.push({
        id: r.id,
        title: r.title,
        file_name: name,
        url,
        text: url ? "" : (r.content?.original_text ?? r.content?.body ?? ""),
      });
    }
    return out;
  });