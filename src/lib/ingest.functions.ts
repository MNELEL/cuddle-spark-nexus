import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const KIND = z.enum(["roster", "resource", "lesson_audio", "auto"]);
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
  extracted: RosterExtracted | ResourceExtracted | LessonExtracted | AutoExtracted | Record<string, never>;
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
  confidence?: number; // 0..1 — how confident we are in this extracted row
};

export type RosterExtracted = { kind: "roster"; students: RosterStudentDraft[] };

export const ROSTER_TARGET_FIELDS = [
  "ignore", "name", "national_id", "birth_date", "address",
  "father_name", "father_id", "father_phone",
  "mother_name", "mother_id", "mother_phone",
] as const;
export type RosterTargetField = typeof ROSTER_TARGET_FIELDS[number];

export type RosterTabular = {
  headers: string[];
  rows: string[][];
  mapping: RosterTargetField[]; // one per header column
};

export type RosterExtractedWithTabular = RosterExtracted & { tabular?: RosterTabular };
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
  exam_questions: LessonExamQuestion[];
};

export type LessonExamQuestion = {
  q: string;
  a?: string;
  difficulty: "easy" | "medium" | "hard";
  topic?: string;
  confidence: number; // 0..1
  include?: boolean;
};

/* ------------------------ Auto (smart classification) ------------------------ */

export type AutoCategory = "grades" | "behavior" | "journal" | "parent_letter" | "resource" | "other";

export const AUTO_CATEGORY_LABEL: Record<AutoCategory, string> = {
  grades: "ציונים",
  behavior: "הערת התנהגות",
  journal: "יומן כיתה",
  parent_letter: "מכתב / שיחת הורים",
  resource: "חומר לימוד",
  other: "אחר",
};

export type AutoStudentMatch = { name: string; student_id: string | null; confidence: number };

export type AutoItem = {
  id: string;
  category: AutoCategory;
  student: AutoStudentMatch | null;
  // Category-specific fields (all optional so a single UI can render them)
  subject?: string;
  value?: number;
  max_value?: number;
  behavior_type?: "positive" | "negative" | "neutral";
  channel?: "phone" | "meeting" | "whatsapp" | "email";
  title?: string;
  description?: string;
  date?: string; // YYYY-MM-DD
  confidence: number; // 0..1
  include: boolean;
};

export type AutoExtracted = {
  kind: "auto";
  detected: AutoCategory;
  reasoning: string;
  items: AutoItem[];
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
        extracted = await analyzeRoster(b64, mime, job.file_name, apiKey);
        const tab = (extracted as RosterExtractedWithTabular).tabular;
        summary = tab
          ? `${extracted.students.length} שורות, ${tab.headers.length} עמודות — נדרשת סקירת מיפוי`
          : `${extracted.students.length} תלמידים זוהו`;
      } else if (job.kind === "resource") {
        extracted = await analyzeResource(b64, mime, apiKey);
        summary = extracted.title || "חומר לימוד";
      } else if (job.kind === "lesson_audio") {
        extracted = await analyzeLessonAudio(b64, mime, apiKey);
        summary = extracted.title || "הקלטת שיעור";
      } else {
        // auto — classify + extract, matching students in scope.
        const auto = await analyzeAuto(b64, mime, job.file_name, job.class_id, context.supabase, context.userId, apiKey);
        extracted = auto as unknown as ResourceExtracted; // stored as JSON; typed as AutoExtracted at read time
        const primary = AUTO_CATEGORY_LABEL[auto.detected] ?? "אחר";
        summary = `זוהה: ${primary} — ${auto.items.length} פריטים לסקירה`;
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

/* ------------------ retry a single lesson stage ------------------ */

export const retryLessonQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("חסר LOVABLE_API_KEY");

    const { data: jobRow } = await context.supabase
      .from("ingest_jobs").select("*").eq("id", data.id).maybeSingle();
    const job = jobRow as unknown as IngestJob | null;
    if (!job || job.kind !== "lesson_audio") throw new Error("המשימה לא נמצאה");
    const ex = job.extracted as LessonExtracted;
    if (!ex?.transcript || ex.transcript.length < 40) {
      throw new Error("אין תמלול מספק להפקת שאלות. הרץ ניתוח מחדש כדי לתמלל תחילה.");
    }
    const exam_questions = await generateExamQuestions(
      { title: ex.title, transcript: ex.transcript, summary: ex.summary, key_points: ex.key_points ?? [] },
      apiKey,
    );
    const next: LessonExtracted = { ...ex, exam_questions };
    const { error } = await context.supabase.from("ingest_jobs")
      .update({ extracted: next as never } as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, exam_questions };
  });

/* ------------------ regenerate summary + key_points from edited transcript ------------------ */

export const regenerateLessonSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: uuid,
      transcript: z.string().min(40).max(100000),
      title: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("חסר LOVABLE_API_KEY");

    const { data: jobRow } = await context.supabase
      .from("ingest_jobs").select("*").eq("id", data.id).maybeSingle();
    const job = jobRow as unknown as IngestJob | null;
    if (!job || job.kind !== "lesson_audio") throw new Error("המשימה לא נמצאה");
    const ex = job.extracted as LessonExtracted;

    const { summary, key_points, title } = await regenSummaryFromTranscript(
      { transcript: data.transcript, title: data.title || ex.title || "" },
      apiKey,
    );
    const next: LessonExtracted = {
      ...ex,
      title: title || ex.title,
      transcript: data.transcript,
      summary,
      key_points,
    };
    const { error } = await context.supabase.from("ingest_jobs")
      .update({ extracted: next as never } as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, summary, key_points, title: next.title };
  });

async function regenSummaryFromTranscript(
  ctx: { transcript: string; title: string },
  apiKey: string,
): Promise<{ summary: string; key_points: string[]; title: string }> {
  const system = `אתה עוזר של רב/מלמד בתלמוד תורה חרדי. לפניך תמלול שיעור לאחר עריכה ידנית.
כתוב:
1. title קצר (עד 8 מילים) המשקף את הנושא.
2. summary של 3–5 פסקאות המסביר את מהלך השיעור והרעיונות המרכזיים.
3. key_points — 6–10 נקודות מפתח, כל אחת משפט אחד ממוקד.
התבסס אך ורק על התוכן שבתמלול. אל תמציא עובדות. השתמש במונחים "הרב", "המלמד", "התלמידים".
החזר JSON בלבד: {"title":"","summary":"","key_points":["..."]}`;

  const raw = await callGateway({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: system },
      { role: "user", content: `כותרת מוצעת נוכחית: ${ctx.title || "(אין)"}\n\nתמלול (עד 40,000 תווים):\n${ctx.transcript.slice(0, 40000)}` },
    ],
    response_format: { type: "json_object" },
  }, apiKey);

  let p: { title?: string; summary?: string; key_points?: unknown[] } = {};
  try { p = JSON.parse(raw); } catch { /* ignore */ }
  return {
    title: String(p.title ?? ctx.title ?? "").slice(0, 200),
    summary: String(p.summary ?? "").slice(0, 8000),
    key_points: Array.isArray(p.key_points)
      ? p.key_points.map((k) => String(k).slice(0, 500)).filter(Boolean).slice(0, 20)
      : [],
  };
}

async function analyzeRoster(b64: string, mime: string, fileName: string, apiKey: string): Promise<RosterExtractedWithTabular> {
  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const lower = fileName.toLowerCase();
  const isXlsx = /\.(xlsx|xls|xlsm)$/.test(lower)
    || mime.includes("spreadsheetml") || mime.includes("ms-excel");
  const isCsv = /\.csv$/.test(lower) || mime === "text/csv";

  if (isXlsx || isCsv) {
    return await analyzeRosterTabular(b64, isXlsx ? "xlsx" : "csv", apiKey);
  }

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
    .map((s) => {
      const row: RosterStudentDraft = {
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
      };
      const confidence = scoreRosterRow(row);
      return { ...row, confidence, include: confidence >= 0.35 };
    })
    .slice(0, 200);
  return { kind: "roster", students: clean };
}

/** Heuristic confidence for a roster row: rewards name quality + populated,
 *  well-formed optional fields; penalises validation-obvious errors. */
function scoreRosterRow(r: RosterStudentDraft): number {
  const trim = (v?: string) => (v ?? "").trim();
  let score = 0;
  const name = trim(r.name);
  if (!name) return 0;
  score += name.length >= 3 && /\s/.test(name) ? 0.45 : 0.3; // full name >> single token

  const idRe = /^\d{5,9}$/;
  const phoneRe = /^0\d{8,9}$/;
  const optional: Array<[string | undefined, (v: string) => boolean, number]> = [
    [r.national_id, (v) => idRe.test(v.replace(/\D/g, "")), 0.1],
    [r.birth_date, (v) => /^\d{4}-\d{2}-\d{2}$/.test(v), 0.08],
    [r.address, (v) => v.length >= 4, 0.06],
    [r.father_name, (v) => v.length >= 2, 0.05],
    [r.mother_name, (v) => v.length >= 2, 0.05],
    [r.father_phone, (v) => phoneRe.test(v.replace(/\D/g, "")), 0.06],
    [r.mother_phone, (v) => phoneRe.test(v.replace(/\D/g, "")), 0.06],
    [r.father_id, (v) => idRe.test(v.replace(/\D/g, "")), 0.04],
    [r.mother_id, (v) => idRe.test(v.replace(/\D/g, "")), 0.04],
  ];
  for (const [val, ok, weight] of optional) {
    const v = trim(val);
    if (!v) continue;
    score += ok(v) ? weight : -weight * 0.6; // present-and-valid boosts, malformed slightly penalises
  }
  return Math.max(0, Math.min(1, score));
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

/* ------------------------ tabular (XLSX/CSV) roster ------------------------ */

async function parseTabular(b64: string, kind: "xlsx" | "csv"): Promise<{ headers: string[]; rows: string[][] }> {
  const XLSX = await import("xlsx");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const wb = kind === "csv"
    ? XLSX.read(new TextDecoder("utf-8").decode(bytes), { type: "string" })
    : XLSX.read(bytes, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
  const trimmed = aoa.map((r) => (r ?? []).map((c) => String(c ?? "").trim()));
  // Find first row that looks like a header (has ≥2 non-empty text cells).
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, trimmed.length); i++) {
    const nonEmpty = trimmed[i].filter(Boolean).length;
    if (nonEmpty >= 2) { headerIdx = i; break; }
  }
  const rawHeaders = trimmed[headerIdx] ?? [];
  const width = rawHeaders.length;
  const headers = rawHeaders.map((h, i) => h || `עמודה ${i + 1}`).slice(0, 40);
  const rows = trimmed.slice(headerIdx + 1)
    .map((r) => Array.from({ length: width }, (_, i) => String(r[i] ?? "")))
    .filter((r) => r.some((c) => c.trim().length > 0))
    .slice(0, 300);
  return { headers, rows };
}

async function suggestMapping(headers: string[], sampleRows: string[][], apiKey: string): Promise<RosterTargetField[]> {
  if (headers.length === 0) return [];
  const system = `אתה מנתח כותרות של רשימת תלמידים בעברית ומחזיר מיפוי לשדות היעד.
שדות אפשריים בלבד: ${ROSTER_TARGET_FIELDS.join(", ")}.
"ignore" עבור עמודה שאינה רלוונטית (מס' סידורי, ריק וכד'). "name" = שם התלמיד (מלא). דע להבדיל בין שם/ת.ז./טלפון של אב, אם והתלמיד עצמו.
החזר JSON תקין בלבד: {"mapping": ["name","national_id",...]} באורך זהה למספר העמודות.`;
  const preview = headers.map((h, i) => {
    const samples = sampleRows.slice(0, 4).map((r) => r[i] ?? "").filter(Boolean).slice(0, 3);
    return `${i + 1}. "${h}" — דוגמאות: ${samples.join(" | ") || "(ריק)"}`;
  }).join("\n");
  let mapping: RosterTargetField[] = headers.map(() => "ignore");
  try {
    const raw = await callGateway({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `עמודות (${headers.length}):\n${preview}` },
      ],
      response_format: { type: "json_object" },
    }, apiKey);
    const parsed = JSON.parse(raw) as { mapping?: unknown };
    const arr = Array.isArray(parsed.mapping) ? parsed.mapping : null;
    if (arr) {
      mapping = headers.map((_, i) => {
        const v = arr[i];
        return (ROSTER_TARGET_FIELDS as readonly string[]).includes(String(v))
          ? (v as RosterTargetField) : "ignore";
      });
    }
  } catch { /* ignore, fall back to heuristics below */ }
  // Heuristic fallback / augmentation by header text.
  mapping = mapping.map((m, i) => m !== "ignore" ? m : guessFieldFromHeader(headers[i]));
  return mapping;
}

function guessFieldFromHeader(h: string): RosterTargetField {
  const s = h.trim();
  if (!s) return "ignore";
  if (/ת\.?ז|תעודת\s*זהות|ID/i.test(s)) {
    if (/אב|אבא|father/i.test(s)) return "father_id";
    if (/אם|אמא|mother/i.test(s)) return "mother_id";
    return "national_id";
  }
  if (/טל|phone|נייד|פלאפון/i.test(s)) {
    if (/אב|אבא|father/i.test(s)) return "father_phone";
    if (/אם|אמא|mother/i.test(s)) return "mother_phone";
    return "father_phone";
  }
  if (/אב|אבא|father/i.test(s)) return "father_name";
  if (/אם|אמא|mother/i.test(s)) return "mother_name";
  if (/כתובת|רחוב|address/i.test(s)) return "address";
  if (/תאריך|לידה|birth/i.test(s)) return "birth_date";
  if (/שם|name/i.test(s)) return "name";
  return "ignore";
}

export function applyRosterMapping(headers: string[], rows: string[][], mapping: RosterTargetField[]): RosterStudentDraft[] {
  const idx: Partial<Record<Exclude<RosterTargetField, "ignore">, number[]>> = {};
  mapping.forEach((f, i) => {
    if (f === "ignore") return;
    (idx[f] ??= []).push(i);
  });
  const pick = (row: string[], f: Exclude<RosterTargetField, "ignore">): string => {
    const cols = idx[f];
    if (!cols) return "";
    for (const c of cols) { const v = (row[c] ?? "").trim(); if (v) return v; }
    return "";
  };
  return rows.map<RosterStudentDraft | null>((row) => {
    const name = pick(row, "name");
    if (!name) return null;
    const draft: RosterStudentDraft = {
      name: name.slice(0, 100),
      national_id: cleanStr(pick(row, "national_id"), 20),
      birth_date: normDate(pick(row, "birth_date")),
      address: cleanStr(pick(row, "address"), 200),
      father_name: cleanStr(pick(row, "father_name"), 100),
      father_id: cleanStr(pick(row, "father_id"), 20),
      father_phone: cleanPhone(pick(row, "father_phone")),
      mother_name: cleanStr(pick(row, "mother_name"), 100),
      mother_id: cleanStr(pick(row, "mother_id"), 20),
      mother_phone: cleanPhone(pick(row, "mother_phone")),
    };
    const confidence = scoreRosterRow(draft);
    return { ...draft, confidence, include: confidence >= 0.35 };
  }).filter((s): s is RosterStudentDraft => Boolean(s)).slice(0, 300);
}

async function analyzeRosterTabular(b64: string, kind: "xlsx" | "csv", apiKey: string): Promise<RosterExtractedWithTabular> {
  const { headers, rows } = await parseTabular(b64, kind);
  if (headers.length === 0) return { kind: "roster", students: [] };
  const mapping = await suggestMapping(headers, rows, apiKey);
  const students = applyRosterMapping(headers, rows, mapping);
  return { kind: "roster", students, tabular: { headers, rows, mapping } };
}

/* Remap tabular roster with a manually-adjusted mapping (called from the UI). */
export const remapRosterTabular = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: uuid,
    mapping: z.array(z.enum(ROSTER_TARGET_FIELDS)).min(1).max(40),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("ingest_jobs").select("extracted, kind, owner_id").eq("id", data.id).maybeSingle();
    const typed = row as unknown as { extracted: RosterExtractedWithTabular; owner_id: string } | null;
    if (!typed || typed.owner_id !== context.userId) throw new Error("המשימה לא נמצאה");
    const extracted = typed.extracted;
    const tab = extracted?.tabular;
    if (!tab) throw new Error("אין נתונים טבלאיים למיפוי");
    if (data.mapping.length !== tab.headers.length) throw new Error("אורך המיפוי לא תואם למספר העמודות");
    const students = applyRosterMapping(tab.headers, tab.rows, data.mapping);
    const next: RosterExtractedWithTabular = {
      kind: "roster",
      students,
      tabular: { ...tab, mapping: data.mapping },
    };
    const summary = `${students.length} שורות מופו — סקור ואשר`;
    const { error } = await context.supabase
      .from("ingest_jobs")
      .update({ extracted: next as never, summary } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, students, summary };
  });

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
  const format = mime.includes("mp3") ? "mp3"
    : mime.includes("wav") ? "wav"
    : mime.includes("m4a") || mime.includes("mp4") ? "m4a"
    : "webm";

  // Step 1 — transcribe + summarize + extract key points from the actual audio.
  const transcribeSystem = `אתה עוזר של רב/מלמד בתלמוד תורה חרדי. מצורפת הקלטת שיעור בעברית.
1. תמלל במדויק את דברי הרב (transcript) — שמור על ניקוד רק אם קיים, ללא הוספות שלך.
2. הצע כותרת תמציתית (title) של עד 8 מילים המשקפת את הנושא (למשל: "גמרא ברכות ב' – שיעור על ברכת אילנות").
3. כתוב סיכום (summary) של 3–5 פסקאות המסביר את מהלך השיעור והרעיונות המרכזיים בשפה של תלמוד תורה.
4. הפק 6–10 נקודות מפתח (key_points) — משפט אחד כל אחת, ממוקדות ומעשיות.
השתמש במונחים "הרב", "המלמד", "התלמידים". החזר JSON תקין בלבד לפי הסכימה:
{"title":"","transcript":"","summary":"","key_points":["..."]}`;

  const rawStep1 = await callGateway({
    model: "google/gemini-2.5-pro",
    messages: [
      { role: "system", content: transcribeSystem },
      { role: "user", content: [
        { type: "text", text: "תמלל, כותר, סכם והפק נקודות מפתח מהשיעור המצורף:" },
        { type: "input_audio", input_audio: { data: b64, format } },
      ] },
    ],
    response_format: { type: "json_object" },
  }, apiKey);

  let p: Partial<LessonExtracted> = {};
  try { p = JSON.parse(rawStep1); } catch { /* ignore */ }
  const title = String(p.title ?? "הקלטת שיעור").slice(0, 200);
  const transcript = String(p.transcript ?? "").slice(0, 100000);
  const summary = String(p.summary ?? "").slice(0, 8000);
  const key_points = Array.isArray(p.key_points)
    ? p.key_points.map((k) => String(k).slice(0, 500)).filter(Boolean).slice(0, 20)
    : [];

  // Step 2 — generate focused exam questions grounded in the transcript.
  const exam_questions = transcript.length >= 40
    ? await generateExamQuestions({ title, transcript, summary, key_points }, apiKey)
    : [];

  return {
    kind: "lesson_audio",
    title,
    transcript,
    summary,
    key_points,
    exam_questions,
  };
}

async function generateExamQuestions(
  ctx: { title: string; transcript: string; summary: string; key_points: string[] },
  apiKey: string,
): Promise<LessonExamQuestion[]> {
  const system = `אתה בונה מבחני בקיאות והבנה עבור תלמידי תלמוד תורה על סמך תמלול שיעור.
כללים קריטיים:
- כל שאלה חייבת להתבסס אך ורק על מה שנאמר בפועל בשיעור (בתמלול / בסיכום / בנקודות המפתח). אין להמציא עובדות.
- כתוב 8–12 שאלות ממוקדות בעברית, קצרות וברורות, שמכסות רעיונות שונים מהשיעור.
- לכל שאלה כלול תשובה קצרה מדויקת (a) המבוססת על התוכן.
- קבע רמת קושי (difficulty): "easy" לזיהוי/הגדרות, "medium" להבנה/הסבר, "hard" לניתוח/יישום.
- ציין נושא-משנה קצר (topic) של עד 4 מילים.
- ציין confidence בין 0 ל-1 — כמה השאלה מעוגנת בבירור בתמלול (1 = מופיע במפורש; 0.5 = הסקה סבירה).
השתמש במונחים "הרב", "המלמד", "התלמידים". החזר JSON תקין בלבד:
{"questions":[{"q":"","a":"","difficulty":"easy|medium|hard","topic":"","confidence":0.9}]}`;

  const userPayload = [
    `כותרת השיעור: ${ctx.title}`,
    `סיכום:\n${ctx.summary}`,
    `נקודות מפתח:\n- ${ctx.key_points.join("\n- ")}`,
    `תמלול (עד 12,000 תווים):\n${ctx.transcript.slice(0, 12000)}`,
  ].join("\n\n");

  const raw = await callGateway({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPayload },
    ],
    response_format: { type: "json_object" },
  }, apiKey);

  let parsed: { questions?: Partial<LessonExamQuestion>[] } = {};
  try { parsed = JSON.parse(raw); } catch { /* ignore */ }
  const items = Array.isArray(parsed.questions) ? parsed.questions : [];
  return items
    .filter((it) => it && typeof it.q === "string" && it.q.trim())
    .map<LessonExamQuestion>((it) => {
      const diff = it.difficulty === "easy" || it.difficulty === "medium" || it.difficulty === "hard"
        ? it.difficulty : "medium";
      const confRaw = typeof it.confidence === "number" ? it.confidence : 0.6;
      const confidence = Math.max(0, Math.min(1, confRaw));
      return {
        q: String(it.q).slice(0, 500).trim(),
        a: it.a ? String(it.a).slice(0, 2000).trim() : undefined,
        difficulty: diff,
        topic: it.topic ? String(it.topic).slice(0, 60).trim() : undefined,
        confidence,
        include: confidence >= 0.4,
      };
    })
    .slice(0, 20);
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
    exam_questions: z.array(z.object({
      q: z.string().min(1).max(500),
      a: z.string().max(2000).optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
      topic: z.string().max(60).optional(),
      confidence: z.number().min(0).max(1).default(0.6),
    })).max(20).default([]),
    save_as_resource: z.boolean().default(true),
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

    // If exam questions were kept, save them as a question-bank teaching resource.
    let questionBankId: string | null = null;
    if (data.save_as_resource && data.exam_questions.length > 0) {
      const { data: qb, error: qbErr } = await context.supabase
        .from("teaching_resources").insert({
          owner_id: context.userId,
          title: `שאלות מבחן — ${data.title}`,
          description: `הופק אוטומטית מהקלטת שיעור. ${data.exam_questions.length} שאלות.`,
          subject: "",
          grade_level: "",
          resource_type: "question_bank",
          tags: ["מהקלטה", "אוטומטי"],
          content: {
            source: "lesson_audio",
            lesson_transcript_id: (ins as { id: string }).id,
            questions: data.exam_questions.map((q) => ({
              q: q.q, a: q.a ?? "", difficulty: q.difficulty,
              topic: q.topic ?? "", confidence: q.confidence,
            })),
          },
          ai_generated: true,
          source_prompt: "מקור: הקלטת שיעור (העלאה חכמה)",
        } as never).select("id").single();
      if (qbErr) { console.error("[DB question_bank]", qbErr); }
      else questionBankId = (qb as { id: string }).id;
    }

    await context.supabase.storage.from("ingest-staging")
      .remove([(await context.supabase.from("ingest_jobs").select("source_path").eq("id", data.jobId).maybeSingle()).data?.source_path ?? ""]).catch(() => {});
    await context.supabase.from("ingest_jobs")
      .update({ status: "committed", committed_at: new Date().toISOString() } as never)
      .eq("id", data.jobId);
    return { ok: true, id: (ins as { id: string }).id, question_bank_id: questionBankId };
  });

/* ------------------------ auto (smart classify) ------------------------ */

type SupaLike = {
  from: (t: string) => { select: (c: string) => { eq: (col: string, v: string) => unknown } };
};

async function analyzeAuto(
  b64: string,
  mime: string,
  fileName: string,
  classId: string | null,
  supabase: SupaLike,
  ownerId: string,
  apiKey: string,
): Promise<AutoExtracted> {
  // Fetch candidate students (scoped to class if given, else all owner's classes).
  type StudentRow = { id: string; name: string; class_id: string };
  type ClassRow = { id: string; name: string };
  let students: StudentRow[] = [];
  let classes: ClassRow[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sbAny = supabase as any;
    if (classId) {
      const r = await sbAny.from("students").select("id,name,class_id").eq("class_id", classId);
      students = (r.data ?? []) as StudentRow[];
      const rc = await sbAny.from("classes").select("id,name").eq("id", classId);
      classes = (rc.data ?? []) as ClassRow[];
    } else {
      const rc = await sbAny.from("classes").select("id,name").eq("owner_id", ownerId);
      classes = (rc.data ?? []) as ClassRow[];
      if (classes.length) {
        const ids = classes.map((c) => c.id);
        const rs = await sbAny.from("students").select("id,name,class_id").in("class_id", ids);
        students = (rs.data ?? []) as StudentRow[];
      }
    }
  } catch { /* fall through with empty lists */ }

  const studentList = students.slice(0, 400).map((s) => `- ${s.name} [id:${s.id}]`).join("\n") || "(אין תלמידים)";
  const classList = classes.slice(0, 40).map((c) => `- ${c.name} [id:${c.id}]`).join("\n") || "(אין כיתות)";

  const system = `אתה עוזר של רב/מלמד בתלמוד תורה חרדי במערכת ClassAlign. קיבלת קובץ חופשי מהמלמד — צילום, PDF או טקסט — ועליך לזהות באיזה סוג תוכן מדובר ולחלץ פריטים מובנים.

קטגוריות אפשריות (בחר אחת ראשית ב-"detected"):
- grades — טבלת ציונים / מבחן / רשימת ציונים לתלמידים.
- behavior — הערות התנהגות (חיוביות/שליליות/ניטרליות) לתלמיד/ים ספציפיים.
- journal — יומן/רשימות כיתה כלליות ללא תלמיד ספציפי (סיכום יום, אירועים כלליים).
- parent_letter — מכתב/סיכום שיחה/הודעה שנשלחו או התקבלו מהורים לגבי תלמיד.
- resource — חומר לימוד, דף עבודה, מערך שיעור, חידה.
- other — כל דבר אחר.

התאם כל פריט לתלמיד מהרשימה כשמזוהה שם (גם בשיבוש קל / כינוי). אם אין התאמה — student_id=null.

שדות לכל פריט לפי הקטגוריה (השאר ריק/undefined מה שלא רלוונטי):
- grades: student_id, subject, value (מספר), max_value (100 אם לא צוין), notes, date (YYYY-MM-DD, ברירת מחדל היום).
- behavior: student_id, behavior_type ("positive"|"negative"|"neutral"), description, date.
- journal: description, date. student_id רק אם באמת מוזכר ספציפית.
- parent_letter: student_id, channel ("phone"|"meeting"|"whatsapp"|"email"), title (נושא), description (תמצית), date.
- resource: title, description.
- other: title, description.

לכל פריט קבע confidence (0..1) לפי בהירות הזיהוי. השתמש במונחים "הרב", "המלמד", "התלמידים".

החזר JSON תקין בלבד:
{"detected":"grades|behavior|journal|parent_letter|resource|other","reasoning":"...","items":[{"category":"grades","student_id":"uuid או null","student_name":"","subject":"","value":0,"max_value":100,"behavior_type":"","channel":"","title":"","description":"","date":"YYYY-MM-DD","confidence":0.0}]}`;

  const isImage = mime.startsWith("image/");
  const isPdf = mime === "application/pdf";
  const userContent = isImage
    ? [{ type: "text", text: "זהה, סווג וחלץ פריטים מהקובץ המצורף:" }, { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }]
    : isPdf
    ? [{ type: "text", text: "זהה, סווג וחלץ פריטים מהקובץ המצורף:" }, { type: "file", file: { filename: fileName || "file.pdf", file_data: `data:application/pdf;base64,${b64}` } }]
    : [{ type: "text", text: "זהה, סווג וחלץ פריטים מהטקסט הבא:\n\n" + safeText(b64) }];

  const raw = await callGateway({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: system },
      { role: "user", content: [
        { type: "text", text: `כיתות אפשריות:\n${classList}\n\nתלמידי הכיתה/ות:\n${studentList}` },
        ...userContent,
      ] },
    ],
    response_format: { type: "json_object" },
  }, apiKey);

  type RawItem = {
    category?: string; student_id?: string | null; student_name?: string;
    subject?: string; value?: unknown; max_value?: unknown;
    behavior_type?: string; channel?: string;
    title?: string; description?: string; date?: string; confidence?: unknown;
  };
  let p: { detected?: string; reasoning?: string; items?: RawItem[] } = {};
  try { p = JSON.parse(raw); } catch { /* ignore */ }

  const validCats: AutoCategory[] = ["grades", "behavior", "journal", "parent_letter", "resource", "other"];
  const detected = (validCats.includes(p.detected as AutoCategory) ? p.detected : "other") as AutoCategory;
  const studentById = new Map(students.map((s) => [s.id, s.name]));
  const nameToId = new Map(students.map((s) => [s.name.trim(), s.id]));

  const items: AutoItem[] = (p.items ?? []).map((it, i): AutoItem => {
    const cat = (validCats.includes(it.category as AutoCategory) ? it.category : detected) as AutoCategory;
    let sid: string | null = null;
    let sname = "";
    if (typeof it.student_id === "string" && studentById.has(it.student_id)) {
      sid = it.student_id;
      sname = studentById.get(sid) || "";
    } else if (typeof it.student_name === "string" && nameToId.has(it.student_name.trim())) {
      sname = it.student_name.trim();
      sid = nameToId.get(sname) || null;
    } else if (typeof it.student_name === "string") {
      sname = it.student_name.trim().slice(0, 100);
    }
    const conf = Math.max(0, Math.min(1, typeof it.confidence === "number" ? it.confidence : 0.6));
    const student: AutoStudentMatch | null = (sid || sname)
      ? { name: sname, student_id: sid, confidence: sid ? Math.max(conf, 0.9) : Math.min(conf, 0.5) }
      : null;
    const val = typeof it.value === "number" ? it.value : (typeof it.value === "string" ? parseFloat(it.value) : undefined);
    const maxv = typeof it.max_value === "number" ? it.max_value : (typeof it.max_value === "string" ? parseFloat(it.max_value) : undefined);
    const behavior_type: AutoItem["behavior_type"] | undefined =
      it.behavior_type === "positive" || it.behavior_type === "negative" || it.behavior_type === "neutral" ? it.behavior_type : undefined;
    const channel: AutoItem["channel"] | undefined =
      it.channel === "phone" || it.channel === "meeting" || it.channel === "whatsapp" || it.channel === "email" ? it.channel : undefined;
    return {
      id: `auto-${i}-${Math.random().toString(36).slice(2, 8)}`,
      category: cat,
      student,
      subject: cleanStr(it.subject, 80),
      value: Number.isFinite(val) ? val : undefined,
      max_value: Number.isFinite(maxv) ? maxv : (cat === "grades" ? 100 : undefined),
      behavior_type,
      channel,
      title: cleanStr(it.title, 200),
      description: cleanStr(it.description, 2000),
      date: normDate(it.date) ?? new Date().toISOString().slice(0, 10),
      confidence: conf,
      include: conf >= 0.4 && (cat === "journal" || cat === "resource" || cat === "other" || !!sid),
    };
  }).slice(0, 200);

  return {
    kind: "auto",
    detected,
    reasoning: String(p.reasoning ?? "").slice(0, 800),
    items,
  };
}

/* Commit auto items — routes each item to its appropriate table. */

const AutoItemSchema = z.object({
  id: z.string().max(60),
  category: z.enum(["grades", "behavior", "journal", "parent_letter", "resource", "other"]),
  student: z.object({
    name: z.string().max(100),
    student_id: z.string().uuid().nullable(),
    confidence: z.number().min(0).max(1),
  }).nullable(),
  subject: z.string().max(80).optional(),
  value: z.number().optional(),
  max_value: z.number().positive().optional(),
  behavior_type: z.enum(["positive", "negative", "neutral"]).optional(),
  channel: z.enum(["phone", "meeting", "whatsapp", "email"]).optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  confidence: z.number().min(0).max(1),
  include: z.boolean(),
});

export const commitAuto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    jobId: uuid,
    class_id: uuid.nullable().optional(),
    items: z.array(AutoItemSchema).min(1).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const results = { grades: 0, behavior: 0, journal: 0, parent_letter: 0, resource: 0, other: 0, skipped: 0 };

    // Fetch student -> class_id map for any student_ids referenced (RLS-scoped).
    const sids = Array.from(new Set(data.items
      .filter((i) => i.include && i.student?.student_id)
      .map((i) => i.student!.student_id!)));
    const studentClass = new Map<string, string>();
    if (sids.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = await (context.supabase as any).from("students").select("id,class_id").in("id", sids);
      for (const r of (q.data ?? []) as { id: string; class_id: string }[]) {
        studentClass.set(r.id, r.class_id);
      }
    }

    for (const it of data.items) {
      if (!it.include) { results.skipped++; continue; }
      const sid = it.student?.student_id ?? null;
      const cid = (sid && studentClass.get(sid)) || data.class_id || null;

      try {
        if (it.category === "grades") {
          if (!sid || !cid || typeof it.value !== "number") { results.skipped++; continue; }
          await context.supabase.from("grades").insert({
            class_id: cid, student_id: sid,
            subject: it.subject ?? "", value: it.value,
            max_value: it.max_value ?? 100,
            notes: it.description ?? "",
            date: it.date ?? today,
          } as never);
          results.grades++;
        } else if (it.category === "behavior") {
          if (!sid || !cid) { results.skipped++; continue; }
          await context.supabase.from("discipline_events").insert({
            class_id: cid, student_id: sid,
            type: it.behavior_type ?? "neutral",
            category: it.subject ?? "note",
            description: it.description ?? "",
            date: it.date ?? today,
          } as never);
          results.behavior++;
        } else if (it.category === "parent_letter") {
          if (!sid || !cid) { results.skipped++; continue; }
          await context.supabase.from("parent_communications").insert({
            class_id: cid, student_id: sid,
            channel: it.channel ?? "phone",
            subject: it.title ?? "",
            summary: it.description ?? "",
            date: it.date ?? today,
          } as never);
          results.parent_letter++;
        } else if (it.category === "journal") {
          // Attach journal to class — if we have a student, use them; else attach to first student of class as owner-only note.
          if (!cid) { results.skipped++; continue; }
          if (sid) {
            await context.supabase.from("discipline_events").insert({
              class_id: cid, student_id: sid,
              type: "neutral", category: "journal",
              description: it.description ?? "",
              date: it.date ?? today,
            } as never);
          } else {
            // No student — store as resource note tagged "יומן".
            await context.supabase.from("teaching_resources").insert({
              owner_id: context.userId,
              title: it.title || `יומן כיתה — ${it.date ?? today}`,
              description: it.description ?? "",
              subject: "", grade_level: "",
              resource_type: "other",
              tags: ["יומן"],
              content: { body: it.description ?? "", questions: [] },
              ai_generated: true,
              source_prompt: "מקור: העלאה חכמה (יומן)",
            } as never);
          }
          results.journal++;
        } else if (it.category === "resource") {
          await context.supabase.from("teaching_resources").insert({
            owner_id: context.userId,
            title: it.title || "חומר לימוד",
            description: it.description ?? "",
            subject: it.subject ?? "", grade_level: "",
            resource_type: "other",
            tags: [],
            content: { body: it.description ?? "", questions: [] },
            ai_generated: true,
            source_prompt: "מקור: העלאה חכמה",
          } as never);
          results.resource++;
        } else {
          // other — save as resource-note
          await context.supabase.from("teaching_resources").insert({
            owner_id: context.userId,
            title: it.title || "פריט מהעלאה חכמה",
            description: it.description ?? "",
            subject: "", grade_level: "",
            resource_type: "other",
            tags: ["אחר"],
            content: { body: it.description ?? "", questions: [] },
            ai_generated: true,
            source_prompt: "מקור: העלאה חכמה",
          } as never);
          results.other++;
        }
      } catch (e) {
        console.error("[commitAuto item]", e);
        results.skipped++;
      }
    }

    // cleanup staging + mark job committed
    const { data: jobRow } = await context.supabase
      .from("ingest_jobs").select("source_path").eq("id", data.jobId).maybeSingle();
    const path = (jobRow as { source_path: string } | null)?.source_path;
    if (path) await context.supabase.storage.from("ingest-staging").remove([path]).catch(() => {});
    await context.supabase.from("ingest_jobs")
      .update({ status: "committed", committed_at: new Date().toISOString() } as never)
      .eq("id", data.jobId);

    return { ok: true, results };
  });