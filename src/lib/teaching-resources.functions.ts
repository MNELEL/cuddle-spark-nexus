import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recomputeStyleProfileFor, buildStyleContextString } from "./teacher-style.functions";

const uuid = z.string().uuid();

export const RESOURCE_TYPES = [
  "worksheet", "question_bank", "riddle", "story", "song",
  "game", "visual_aid", "lesson_plan", "activity", "other",
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  worksheet: "דף עבודה",
  question_bank: "מאגר שאלות",
  riddle: "חידה",
  story: "סיפור / משל",
  song: "שיר / ניגון",
  game: "משחק לימודי",
  visual_aid: "עזר חזותי",
  lesson_plan: "מערך שיעור",
  activity: "פעילות כיתתית",
  other: "אחר",
};

export type ResourceContent = {
  /** Free-form text body (markdown-ish). */
  body?: string;
  /** For worksheet / question_bank / riddle. */
  questions?: { q: string; a?: string }[];
  /** Optional bullet list (e.g. steps for activity / lesson plan). */
  steps?: string[];
  /** Optional materials needed (game / activity / visual_aid). */
  materials?: string[];
};

export type ResourceRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  subject: string;
  grade_level: string;
  resource_type: ResourceType;
  content: ResourceContent;
  file_path: string | null;
  mime_type: string | null;
  tags: string[];
  ai_generated: boolean;
  source_prompt: string;
  created_at: string;
  updated_at: string;
};

/* ----------------------------- list / read ----------------------------- */

export const listResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      search: z.string().max(120).optional(),
      resource_type: z.enum(RESOURCE_TYPES).optional(),
      subject: z.string().max(80).optional(),
      grade_level: z.string().max(40).optional(),
      tag: z.string().max(40).optional(),
      collection_id: uuid.optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ResourceRow[]> => {
    let ids: string[] | null = null;
    if (data.collection_id) {
      const r = await context.supabase
        .from("resource_collection_items")
        .select("resource_id")
        .eq("collection_id", data.collection_id);
      ids = ((r.data ?? []) as { resource_id: string }[]).map((x) => x.resource_id);
      if (ids.length === 0) return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = context.supabase.from("teaching_resources").select("*");
    if (data.resource_type) q = q.eq("resource_type", data.resource_type);
    if (data.subject) q = q.eq("subject", data.subject);
    if (data.grade_level) q = q.eq("grade_level", data.grade_level);
    if (data.tag) q = q.contains("tags", [data.tag]);
    if (ids) q = q.in("id", ids);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ");
      q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    }
    const { data: rows, error } = await q.order("updated_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return (rows ?? []) as ResourceRow[];
  });

export const getResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<ResourceRow | null> => {
    const { data: row, error } = await context.supabase
      .from("teaching_resources").select("*").eq("id", data.id).maybeSingle() as unknown as { data: ResourceRow | null; error: { message: string } | null };
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return row;
  });

/* ----------------------------- question bank ----------------------------- */

export type QuestionItem = {
  resource_id: string;
  resource_title: string;
  resource_type: ResourceType;
  subject: string;
  grade_level: string;
  tags: string[];
  index: number;
  q: string;
  a: string;
  updated_at: string;
};

export const listResourceQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      search: z.string().max(120).optional(),
      resource_type: z.enum(RESOURCE_TYPES).optional(),
      subject: z.string().max(80).optional(),
      grade_level: z.string().max(40).optional(),
      tag: z.string().max(40).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<QuestionItem[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = context.supabase
      .from("teaching_resources")
      .select("id,title,resource_type,subject,grade_level,tags,content,updated_at");
    if (data.resource_type) q = q.eq("resource_type", data.resource_type);
    if (data.subject) q = q.eq("subject", data.subject);
    if (data.grade_level) q = q.eq("grade_level", data.grade_level);
    if (data.tag) q = q.contains("tags", [data.tag]);
    const { data: rows, error } = await q.order("updated_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    const s = (data.search ?? "").trim().toLowerCase();
    const out: QuestionItem[] = [];
    for (const r of (rows ?? []) as Array<{
      id: string; title: string; resource_type: ResourceType; subject: string;
      grade_level: string; tags: string[] | null; content: ResourceContent | null; updated_at: string;
    }>) {
      const qs = r.content?.questions ?? [];
      qs.forEach((qq, i) => {
        if (!qq?.q) return;
        if (s && !`${qq.q} ${qq.a ?? ""}`.toLowerCase().includes(s)) return;
        out.push({
          resource_id: r.id,
          resource_title: r.title,
          resource_type: r.resource_type,
          subject: r.subject ?? "",
          grade_level: r.grade_level ?? "",
          tags: r.tags ?? [],
          index: i,
          q: qq.q,
          a: qq.a ?? "",
          updated_at: r.updated_at,
        });
      });
    }
    return out;
  });

/* ----------------------------- write ----------------------------- */

const contentSchema = z.object({
  body: z.string().max(20000).optional(),
  questions: z.array(z.object({ q: z.string().min(1).max(500), a: z.string().max(2000).optional() })).max(50).optional(),
  steps: z.array(z.string().min(1).max(500)).max(50).optional(),
  materials: z.array(z.string().min(1).max(200)).max(30).optional(),
}).partial();

export const upsertResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: uuid.optional(),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).default(""),
    subject: z.string().max(80).default(""),
    grade_level: z.string().max(40).default(""),
    resource_type: z.enum(RESOURCE_TYPES).default("worksheet"),
    content: contentSchema.default({}),
    tags: z.array(z.string().min(1).max(40)).max(20).default([]),
    file_path: z.string().max(500).nullable().optional(),
    mime_type: z.string().max(120).nullable().optional(),
    ai_generated: z.boolean().default(false),
    source_prompt: z.string().max(4000).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("teaching_resources").update(rest as never).eq("id", id);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
      void recomputeStyleProfileFor(context.supabase, context.userId).catch((e) => console.error("[Style trigger]", e));
      return { id };
    }
    const insertRow = { ...data, owner_id: context.userId } as never;
    const { data: ins, error } = await context.supabase
      .from("teaching_resources").insert(insertRow).select("id").single() as unknown as { data: { id: string } | null; error: { message: string } | null };
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    void recomputeStyleProfileFor(context.supabase, context.userId).catch((e) => console.error("[Style trigger]", e));
    return { id: ins!.id };
  });

export const deleteResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, file_path: z.string().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.file_path) {
      await context.supabase.storage.from("teaching-resources").remove([data.file_path]);
    }
    const { error } = await context.supabase.from("teaching_resources").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

export const getResourceSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ file_path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("teaching-resources").createSignedUrl(data.file_path, 60 * 10);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { url: signed.signedUrl };
  });

/* ----------------------------- collections ----------------------------- */

export const listCollections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("resource_collections").select("*").order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return data ?? [];
  });

export const upsertCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: uuid.optional(),
    name: z.string().min(1).max(120),
    description: z.string().max(1000).default(""),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f59e0b"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await context.supabase.from("resource_collections").update(rest).eq("id", id);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
      return { id };
    }
    const { data: ins, error } = await context.supabase
      .from("resource_collections").insert({ ...data, owner_id: context.userId } as never)
      .select("id").single() as unknown as { data: { id: string } | null; error: { message: string } | null };
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { id: ins!.id };
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("resource_collections").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

export const toggleCollectionItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    collection_id: uuid, resource_id: uuid, include: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.include) {
      const { error } = await context.supabase
        .from("resource_collection_items")
        .upsert({ collection_id: data.collection_id, resource_id: data.resource_id } as never);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    } else {
      const { error } = await context.supabase
        .from("resource_collection_items").delete()
        .eq("collection_id", data.collection_id).eq("resource_id", data.resource_id);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    }
    return { ok: true };
  });

/* ----------------------------- usage ----------------------------- */

export const logResourceUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    resource_id: uuid, class_id: uuid, notes: z.string().max(1000).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("class_resource_usage").insert(data as never);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    void recomputeStyleProfileFor(context.supabase, context.userId).catch((e) => console.error("[Style trigger]", e));
    return { ok: true };
  });

/* ----------------------------- AI generation ----------------------------- */

export const generateResourceWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    prompt: z.string().min(5).max(2000),
    resource_type: z.enum(RESOURCE_TYPES).default("worksheet"),
    subject: z.string().max(80).default(""),
    grade_level: z.string().max(40).default(""),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{
    title: string; description: string; tags: string[]; content: ResourceContent;
  }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("חסר LOVABLE_API_KEY");

    const typeLabel = RESOURCE_TYPE_LABELS[data.resource_type];

    const styleCtx = await buildStyleContextString(context.supabase, context.userId);

    const system = `אתה עוזר של רב/מלמד בתלמוד תורה / חיידר חרדי. אתה מייצר חומרי הוראה ועזרים לכיתה בעברית טהורה ומכובדת.
השתמש במונחים: "הרב", "המלמד", "התלמידים", "הורי הבית" (לא "מורה", לא "ילדים", לא "סטודנטים").
מקצועות קודש: גמרא, משנה, חומש, נביא, הלכה, מוסר, תפילה, פרשת שבוע.
סוג החומר המבוקש: ${typeLabel}${data.subject ? ` במקצוע ${data.subject}` : ""}${data.grade_level ? ` לכיתה ${data.grade_level}` : ""}.${styleCtx}

החזר אך ורק JSON תקין במבנה הבא — בלי טקסט נוסף:
{
  "title": "כותרת קצרה ומכובדת",
  "description": "1-2 משפטים שמסבירים מה החומר כולל",
  "tags": ["תגית1", "תגית2"],
  "content": {
    "body": "טקסט פתיחה / הוראות / הסבר (אופציונלי)",
    "questions": [{"q": "שאלה", "a": "תשובה (אופציונלי)"}],
    "steps": ["שלב 1", "שלב 2"],
    "materials": ["חומר נדרש 1"]
  }
}

כללים לפי סוג החומר:
- worksheet / question_bank: מלא questions (3-10 שאלות) + body עם הוראות.
- riddle: מלא questions עם שאלה אחת ותשובה.
- story: מלא body עם הסיפור / המשל המלא.
- song: מלא body עם מילות השיר.
- game / activity: מלא steps + materials.
- visual_aid: מלא body עם תיאור העזר ו-materials.
- lesson_plan: מלא body (מטרות) + steps (מהלך השיעור).
השתמש בשדות הרלוונטיים בלבד — אל תכלול שדות ריקים מיותרים.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: data.prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (resp.status === 429) throw new Error("חרגת ממכסת בקשות AI. נסה שוב בעוד דקה.");
    if (resp.status === 402) throw new Error("נגמרו קרדיטים ב-Lovable AI.");
    if (!resp.ok) {
      console.error("[AI Gateway Error]", resp.status, await resp.text().catch(() => ""));
      throw new Error("הפעולה נכשלה. נסה שוב.");
    }
    const j = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = j.choices?.[0]?.message?.content ?? "{}";
    let parsed: { title?: string; description?: string; tags?: unknown; content?: ResourceContent } = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }

    return {
      title: String(parsed.title ?? "חומר הוראה חדש").slice(0, 200),
      description: String(parsed.description ?? "").slice(0, 2000),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((t) => String(t).slice(0, 40)).slice(0, 20) : [],
      content: parsed.content ?? {},
    };
  });