import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const KIND = z.enum(["roster", "resource", "lesson_audio"]);
export type IngestKind = z.infer<typeof KIND>;

export type IngestJob = {
  id: string;
  owner_id: string;
  class_id: string | null;
  kind: IngestKind;
  source_path: string;
  file_name: string;
  mime_type: string;
  status: "uploaded" | "analyzing" | "ready" | "committed" | "failed" | "canceled";
  extracted: RosterExtracted | ResourceExtracted | LessonExtracted | Record<string, never>;
  summary: string;
  error: string | null;
  created_at: string;
  updated_at: string;
  committed_at: string | null;
};

export type RosterStudentDraft = {
  name: string;
  national_id?: string;
  birth_date?: string; // YYYY-MM-DD
  address?: string;
  father_name?: string;
  father_id?: string;
  father_phone?: string;
  mother_name?: string;
  mother_id?: string;
  mother_phone?: string;
  include?: boolean;
};

export type RosterExtracted = { kind: "roster"; students: RosterStudentDraft[] };
export type ResourceExtracted = {
  kind: "resource";
  title: string;
  description: string;
  subject: string;
  grade_level: string;
  resource_type: string;
  tags: string[];
  body: string;
  questions: { q: string; a?: string }[];
};
export type LessonExtracted = {
  kind: "lesson_audio";
  title: string;
  transcript: string;
  summary: string;
  key_points: string[];
};

/* ------------------------ upload URL ------------------------ */

export const getIngestUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      filename: z.string().min(1).max(180).regex(/^[a-zA-Z0-9._\- ]+$/, "שם קובץ לא חוקי"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const safe = data.filename.replace(/\s+/g, "_");
    const path = `${context.userId}/${Date.now()}-${safe}`;
    const { data: signed, error } = await context.supabase.storage
      .from("ingest-staging").createSignedUploadUrl(path);
    if (error) { console.error("[Storage]", error); throw new Error("הפעולה נכשלה."); }
    return { path: signed.path, token: signed.token };
  });

/* ------------------------ create / list / delete ------------------------ */

export const createIngestJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      kind: KIND,
      source_path: z.string().min(1).max(500),
      file_name: z.string().min(1).max(200),
      mime_type: z.string().max(120).default(""),
      class_id: uuid.nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const row = {
      owner_id: context.userId,
      kind: data.kind,
      source_path: data.source_path,
      file_name: data.file_name,
      mime_type: data.mime_type,
      class_id: data.class_id ?? null,
      status: "uploaded" as const,
    };
    const { data: ins, error } = await context.supabase
      .from("ingest_jobs").insert(row as never).select("id").single();
    if (error) { console.error("[DB]", error); throw new Error("הפעולה נכשלה."); }
    return { id: (ins as { id: string }).id };
  });

export const listIngestJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IngestJob[]> => {
    const { data, error } = await context.supabase
      .from("ingest_jobs").select("*").order("created_at", { ascending: false }).limit(30);
    if (error) { console.error("[DB]", error); throw new Error("הפעולה נכשלה."); }
    return (data ?? []) as unknown as IngestJob[];
  });

export const getIngestJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<IngestJob | null> => {
    const { data: row, error } = await context.supabase
      .from("ingest_jobs").select("*").eq("id", data.id).maybeSingle();
    if (error) { console.error("[DB]", error); throw new Error("הפעולה נכשלה."); }
    return row as unknown as IngestJob | null;
  });

export const deleteIngestJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("ingest_jobs").select("source_path").eq("id", data.id).maybeSingle();
    const path = (row as { source_path: string } | null)?.source_path;
    if (path) await context.supabase.storage.from("ingest-staging").remove([path]);
    const { error } = await context.supabase.from("ingest_jobs").delete().eq("id", data.id);
    if (error) { console.error("[DB]", error); throw new Error("הפעולה נכשלה."); }
    return { ok: true };
  });

/* ------------------------ analyze ------------------------ */

async function callGateway(payload: unknown, apiKey: string) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(payload),
  });
  if (resp.status === 429) throw new Error("חרגת ממכסת AI. נסה שוב בעוד דקה.");
  if (resp.status === 402) throw new Error("נגמרו קרדיטים ב-Lovable AI.");
  if (!resp.ok) {
    console.error("[AI]", resp.status, await resp.text().catch(() => ""));
    throw new Error("הניתוח נכשל. נסה שוב.");
  }
  const j = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content ?? "{}";
}

function fileToBase64(buf: Uint8Array): string {
  let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

export const analyzeIngestJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("חסר LOVABLE_API_KEY");

    await context.supabase.from("ingest_jobs")
      .update({ status: "analyzing", error: null } as never).eq("id", data.id);

    const { data: jobRow } = await context.supabase
      .from("ingest_jobs").select("*").eq("id", data.id).maybeSingle();
    const job = jobRow as unknown as IngestJob | null;
    if (!job) throw new Error("המשימה לא נמצאה");

    try {
      const { data: file, error: derr } = await context.supabase
        .storage.from("ingest-staging").download(job.source_path);
      if (derr || !file) throw new Error("שגיאה בהורדת הקובץ");
      const buf = new Uint8Array(await file.arrayBuffer());
      if (buf.length > 20 * 1024 * 1024) throw new Error("הקובץ גדול מ-20MB.");
      const mime = file.type || job.mime_type || "application/octet-stream";
      const b64 = fileToBase64(buf);

      let extracted: RosterExtracted | ResourceExtracted | LessonExtracted;
      let summary = "";

      if (job.kind === "roster") {
        extracted = await analyzeRoster(b64, mime, apiKey);
        summary = `${extracted.students.length} תלמידים זוהו`;
      } else if (job.kind === "resource") {
        extracted = await analyzeResource(b64, mime, apiKey);
        summary = extracted.title || "חומר לימוד";
      } else {
        extracted = await analyzeLessonAudio(b64, mime, apiKey);
        summary = extracted.title || "הקלטת שיעור";
      }

      const { error } = await context.supabase.from("ingest_jobs")
        .update({ status: "ready", extracted: extracted as never, summary } as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, extracted, summary };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "שגיאה";
      await context.supabase.from("ingest_jobs")
        .update({ status: "failed", error: msg } as never).eq("id", data.id);
      throw e;
    }
  });

async function analyzeRoster(b64: string, mime: string, apiKey: string): Promise<RosterExtracted> {
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const system = `אתה עוזר של רב/מלמד בתלמוד תורה. מצורפת רשימת תלמידים (טבלה בעברית). חלץ את כל השורות בקפדנות.
כל טלפון יופיע במבנה 0XX-XXXXXXX או 05X-XXXXXXX. תעודות זהות באורך 8-9 ספרות.
שם משפחה + שם פרטי צריכים להתמזג לשדה name (למשל "אורדמן נתן").
תאריך לידה בפורמט YYYY-MM-DD (המר מ-DD.MM.YY עם שנת 20YY).

החזר JSON תקין בלבד:
{"students":[{"name":"","national_id":"","birth_date":"YYYY-MM-DD","address":"","father_name":"","father_id":"","father_phone":"","mother_name":"","mother_id":"","mother_phone":""}]}`;

  const userContent = isImage
    ? [
        { type: "text", text: "חלץ את כל התלמידים מהרשימה הבאה:" },
        { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
      ]
    : isPdf
    ? [
        { type: "text", text: "חלץ את כל התלמידים מהרשימה שבקובץ:" },
        { type: "file", file: { filename: "roster.pdf", file_data: `data:application/pdf;base64,${b64}` } },
      ]
    : [
        { type: "text", text: "חלץ את כל התלמידים מהטקסט הבא:" },
        { type: "text", text: safeText(b64) },
      ];

  const raw = await callGateway({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
  }, apiKey);

  let parsed: { students?: RosterStudentDraft[] } = {};
  try { parsed = JSON.parse(raw); } catch { /* ignore */ }
  const students = Array.isArray(parsed.students) ? parsed.students : [];
  const clean = students
    .filter((s) => s && typeof s.name === "string" && s.name.trim())
    .map((s) => ({
      name: String(s.name).slice(0, 100).trim(),
      national_id: cleanStr(s.national_id, 20),
      birth_date: normDate(s.birth_date),
      address: cleanStr(s.address, 200),
      father_name: cleanStr(s.father_name, 100),
      father_id: cleanStr(s.father_id, 20),
      father_phone: cleanPhone(s.father_phone),
      mother_name: cleanStr(s.mother_name, 100),
      mother_id: cleanStr(s.mother_id, 20),
      mother_phone: cleanPhone(s.mother_phone),
      include: true,
    }))
    .slice(0, 200);
  return { kind: "roster", students: clean };
}

function safeText(b64: string): string {
  try { return decodeURIComponent(escape(atob(b64))).slice(0, 60000); } catch { return atob(b64).slice(0, 60000); }
}
function cleanStr(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim(); return t ? t.slice(0, max) : undefined;
}
function cleanPhone(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/[^\d\-+]/g, "").trim(); return t ? t.slice(0, 20) : undefined;
}
function normDate(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, "0"), mo = m[2].padStart(2, "0");
    let y = m[3]; if (y.length === 2) y = (parseInt(y, 10) > 30 ? "19" : "20") + y;
    return `${y}-${mo}-${d}`;
  }
  return undefined;
}

async function analyzeResource(b64: string, mime: string, apiKey: string): Promise<ResourceExtracted> {
  const system = `אתה עוזר של רב/מלמד בתלמוד תורה חרדי. נתח את החומר המצורף וסווג אותו כחומר לימוד:
- זהה כותרת, תיאור קצר (1-2 משפטים), מקצוע (גמרא/משנה/חומש/נביא/הלכה/מוסר/תפילה/פרשת שבוע), כיתה (א-ח), סוג (worksheet/question_bank/riddle/story/song/game/visual_aid/lesson_plan/activity/other), תגיות.
- שכתב את התוכן כ-body מסודר וחלץ שאלות אם יש.
השתמש במונחים "הרב", "המלמד", "התלמידים".

החזר JSON תקין בלבד:
{"title":"","description":"","subject":"","grade_level":"","resource_type":"worksheet","tags":[],"body":"","questions":[{"q":"","a":""}]}`;

  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const userContent = isImage
    ? [{ type: "text", text: "נתח את החומר:" }, { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }]
    : isPdf
    ? [{ type: "text", text: "נתח את החומר:" }, { type: "file", file: { filename: "material.pdf", file_data: `data:application/pdf;base64,${b64}` } }]
    : [{ type: "text", text: "נתח את החומר הבא:\n\n" + safeText(b64) }];

  const raw = await callGateway({
    model: "google/gemini-2.5-flash",
    messages: [{ role: "system", content: system }, { role: "user", content: userContent }],
    response_format: { type: "json_object" },
  }, apiKey);

  let p: Partial<ResourceExtracted> = {};
  try { p = JSON.parse(raw); } catch { /* ignore */ }
  return {
    kind: "resource",
    title: String(p.title ?? "חומר לימוד").slice(0, 200),
    description: String(p.description ?? "").slice(0, 2000),
    subject: String(p.subject ?? "").slice(0, 80),
    grade_level: String(p.grade_level ?? "").slice(0, 40),
    resource_type: String(p.resource_type ?? "worksheet").slice(0, 40),
    tags: Array.isArray(p.tags) ? p.tags.map((t) => String(t).slice(0, 40)).slice(0, 20) : [],
    body: String(p.body ?? "").slice(0, 20000),
    questions: Array.isArray(p.questions)
      ? p.questions.filter((q) => q && q.q).map((q) => ({
          q: String(q.q).slice(0, 500),
          a: q.a ? String(q.a).slice(0, 2000) : undefined,
        })).slice(0, 50)
      : [],
  };
}

async function analyzeLessonAudio(b64: string, mime: string, apiKey: string): Promise<LessonExtracted> {
  const system = `אתה עוזר של רב/מלמד. תמלל את השיעור (עברית), הפק סיכום 3-5 פסקאות ו-5-10 נקודות מפתח.
החזר JSON: {"title":"כותרת קצרה","transcript":"...","summary":"...","key_points":["..."]}`;

  const format = mime.includes("mp3") ? "mp3" : mime.includes("wav") ? "wav" : mime.includes("m4a") || mime.includes("mp4") ? "m4a" : "webm";
  const raw = await callGateway({
    model: "google/gemini-2.5-pro",
    messages: [
      { role: "system", content: system },
      { role: "user", content: [
        { type: "text", text: "תמלל וסכם את השיעור המצורף:" },
        { type: "input_audio", input_audio: { data: b64, format } },
      ] },
    ],
    response_format: { type: "json_object" },
  }, apiKey);

  let p: Partial<LessonExtracted> = {};
  try { p = JSON.parse(raw); } catch { /* ignore */ }
  return {
    kind: "lesson_audio",
    title: String(p.title ?? "הקלטת שיעור").slice(0, 200),
    transcript: String(p.transcript ?? "").slice(0, 100000),
    summary: String(p.summary ?? "").slice(0, 8000),
    key_points: Array.isArray(p.key_points) ? p.key_points.map((k) => String(k).slice(0, 500)).slice(0, 20) : [],
  };
}

/* ------------------------ commit ------------------------ */

const rosterCommitSchema = z.object({
  jobId: uuid,
  class_id: uuid,
  students: z.array(z.object({
    name: z.string().min(1).max(100),
    national_id: z.string().max(20).optional().nullable(),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    address: z.string().max(200).optional().nullable(),
    father_name: z.string().max(100).optional().nullable(),
    father_id: z.string().max(20).optional().nullable(),
    father_phone: z.string().max(20).optional().nullable(),
    mother_name: z.string().max(100).optional().nullable(),
    mother_id: z.string().max(20).optional().nullable(),
    mother_phone: z.string().max(20).optional().nullable(),
  })).min(1).max(200),
});

export const commitRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => rosterCommitSchema.parse(d))
  .handler(async ({ data, context }) => {
    // verify ownership of class
    const { data: cls } = await context.supabase
      .from("classes").select("id").eq("id", data.class_id).eq("owner_id", context.userId).maybeSingle();
    if (!cls) throw new Error("הכיתה לא נמצאה");

    const rows = data.students.map((s) => ({
      class_id: data.class_id,
      name: s.name.trim(),
      national_id: s.national_id || null,
      birth_date: s.birth_date || null,
      address: s.address || null,
      father_name: s.father_name || null,
      father_id: s.father_id || null,
      father_phone: s.father_phone || null,
      mother_name: s.mother_name || null,
      mother_id: s.mother_id || null,
      mother_phone: s.mother_phone || null,
    }));
    const { error } = await context.supabase.from("students").insert(rows as never);
    if (error) { console.error("[DB]", error); throw new Error("הפעולה נכשלה."); }

    // cleanup
    await context.supabase.storage.from("ingest-staging")
      .remove([(await context.supabase.from("ingest_jobs").select("source_path").eq("id", data.jobId).maybeSingle()).data?.source_path ?? ""]).catch(() => {});
    await context.supabase.from("ingest_jobs")
      .update({ status: "committed", committed_at: new Date().toISOString() } as never)
      .eq("id", data.jobId);

    return { ok: true, inserted: rows.length };
  });

export const commitResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    jobId: uuid,
    title: z.string().min(1).max(200),
    description: z.string().max(2000).default(""),
    subject: z.string().max(80).default(""),
    grade_level: z.string().max(40).default(""),
    resource_type: z.string().max(40).default("worksheet"),
    tags: z.array(z.string().max(40)).max(20).default([]),
    body: z.string().max(20000).default(""),
    questions: z.array(z.object({ q: z.string().min(1).max(500), a: z.string().max(2000).optional() })).max(50).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const insertRow = {
      owner_id: context.userId,
      title: data.title,
      description: data.description,
      subject: data.subject,
      grade_level: data.grade_level,
      resource_type: data.resource_type,
      tags: data.tags,
      content: { body: data.body, questions: data.questions },
      ai_generated: true,
      source_prompt: "מקור: העלאה חכמה",
    };
    const { data: ins, error } = await context.supabase
      .from("teaching_resources").insert(insertRow as never).select("id").single();
    if (error) { console.error("[DB]", error); throw new Error("הפעולה נכשלה."); }

    await context.supabase.storage.from("ingest-staging")
      .remove([(await context.supabase.from("ingest_jobs").select("source_path").eq("id", data.jobId).maybeSingle()).data?.source_path ?? ""]).catch(() => {});
    await context.supabase.from("ingest_jobs")
      .update({ status: "committed", committed_at: new Date().toISOString() } as never)
      .eq("id", data.jobId);
    return { ok: true, id: (ins as { id: string }).id };
  });

export const commitLessonAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    jobId: uuid,
    class_id: uuid,
    title: z.string().min(1).max(200),
    transcript: z.string().max(100000).default(""),
    summary: z.string().max(8000).default(""),
    key_points: z.array(z.string().max(500)).max(20).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cls } = await context.supabase
      .from("classes").select("id").eq("id", data.class_id).eq("owner_id", context.userId).maybeSingle();
    if (!cls) throw new Error("הכיתה לא נמצאה");

    const { data: ins, error } = await context.supabase
      .from("lesson_transcripts").insert({
        owner_id: context.userId,
        class_id: data.class_id,
        title: data.title,
        audio_path: null,
        transcript: data.transcript,
        summary: data.summary,
        key_points: data.key_points,
        status: "done",
      } as never).select("id").single();
    if (error) { console.error("[DB]", error); throw new Error("הפעולה נכשלה."); }

    await context.supabase.storage.from("ingest-staging")
      .remove([(await context.supabase.from("ingest_jobs").select("source_path").eq("id", data.jobId).maybeSingle()).data?.source_path ?? ""]).catch(() => {});
    await context.supabase.from("ingest_jobs")
      .update({ status: "committed", committed_at: new Date().toISOString() } as never)
      .eq("id", data.jobId);
    return { ok: true, id: (ins as { id: string }).id };
  });