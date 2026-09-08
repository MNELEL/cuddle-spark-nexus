import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

const uuid = z.string().uuid();

export type LessonTranscript = {
  id: string;
  owner_id: string;
  class_id: string;
  title: string;
  audio_path: string | null;
  duration_seconds: number | null;
  transcript: string;
  summary: string;
  key_points: string[];
  status: "pending" | "transcribing" | "done" | "failed";
  error: string | null;
  /** שיוך לקבוצת חלקים כשהקלטה כבדה פוצלה אוטומטית. */
  part_group_id: string | null;
  part_index: number | null;
  part_total: number | null;
  created_at: string;
  updated_at: string;
};

const LESSON_COLUMNS =
  "id,owner_id,class_id,title,audio_path,duration_seconds,transcript,summary,key_points,status,error,part_group_id,part_index,part_total,created_at,updated_at";

export const listLessonTranscripts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<LessonTranscript[]> => {
    const { data: rows, error } = await context.supabase
      .from("lesson_transcripts")
      .select(LESSON_COLUMNS)
      .eq("class_id", data.classId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה."); }
    return (rows ?? []) as unknown as LessonTranscript[];
  });

export const getLessonTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<LessonTranscript | null> => {
    const { data: row, error } = await context.supabase
      .from("lesson_transcripts").select("*").eq("id", data.id).maybeSingle();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה."); }
    return row as unknown as LessonTranscript | null;
  });

export const createLessonRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    classId: uuid,
    title: z.string().min(1).max(200),
    audio_path: z.string().min(1).max(500),
    duration_seconds: z.number().int().min(0).max(60 * 60 * 6).optional(),
    part_group_id: uuid.optional(),
    part_index: z.number().int().min(1).max(200).optional(),
    part_total: z.number().int().min(1).max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      owner_id: context.userId,
      class_id: data.classId,
      title: data.title,
      audio_path: data.audio_path,
      duration_seconds: data.duration_seconds ?? null,
      status: "pending" as const,
      part_group_id: data.part_group_id ?? null,
      part_index: data.part_index ?? null,
      part_total: data.part_total ?? null,
    };
    const { data: ins, error } = await context.supabase
      .from("lesson_transcripts").insert(row as never).select("id").single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה."); }
    return { id: (ins as { id: string }).id };
  });


export const deleteLessonTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("lesson_transcripts").select("audio_path").eq("id", data.id).maybeSingle();
    const path = (row as { audio_path: string | null } | null)?.audio_path;
    if (path) await context.supabase.storage.from("lesson-recordings").remove([path]);
    const { error } = await context.supabase.from("lesson_transcripts").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה."); }
    return { ok: true };
  });

/** Generates a signed upload URL so the client can upload audio directly. */
export const getLessonUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    filename: z.string().min(1).max(120).regex(/^[a-zA-Z0-9._-]+$/),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const path = `${context.userId}/${Date.now()}-${data.filename}`;
    const { data: signed, error } = await context.supabase
      .storage.from("lesson-recordings").createSignedUploadUrl(path);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה."); }
    return { path: signed.path, token: signed.token };
  });

/** Runs transcription + summary + key points using Gemini multimodal. */
export const transcribeAndSummarize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("חסר LOVABLE_API_KEY");

    // Mark as transcribing
    await context.supabase.from("lesson_transcripts")
      .update({ status: "transcribing", error: null } as never).eq("id", data.id);

    const { data: lesson, error: lerr } = await context.supabase
      .from("lesson_transcripts").select("audio_path").eq("id", data.id).maybeSingle();
    if (lerr || !lesson) throw new Error("השיעור לא נמצא");
    const audioPath = (lesson as { audio_path: string | null }).audio_path;
    if (!audioPath) throw new Error("לא הועלה קובץ אודיו");

    // Download audio as base64
    const { data: file, error: derr } = await context.supabase
      .storage.from("lesson-recordings").download(audioPath);
    if (derr || !file) throw new Error("שגיאה בהורדת ההקלטה");
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length > 24 * 1024 * 1024) {
      await context.supabase.from("lesson_transcripts")
        .update({ status: "failed", error: "הקובץ גדול מ-24MB" } as never).eq("id", data.id);
      throw new Error("הקובץ גדול מ-24MB. חתוך לחלקים קטנים יותר.");
    }
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const mime = file.type || "audio/webm";

    const system = `אתה עוזר של רב/מלמד בתלמוד תורה. אתה מקבל הקלטה של שיעור בעברית וצריך:
1. לתמלל את ההקלטה תמלול מילולי ונאמן ככל האפשר (בעברית, ניקוד רק במקומות חיוניים).
2. לכתוב סיכום של 3-5 פסקאות שמתאר את הנאמר בפועל.
3. להפיק 5-10 נקודות מפתח (key_points) — דברים שנלמדו / חידושים / פסקי הלכה / מושגים מרכזיים שעלו בשיעור.

השתמש במונחים מתאימים לציבור החרדי: "הרב", "המלמד", "התלמידים".

החזר אך ורק JSON תקין:
{"transcript":"...","summary":"...","key_points":["נקודה 1","נקודה 2"]}`;

    let raw = "{}";
    try {
      raw = (await callLovableAI({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: system },
          { role: "user", content: [
            { type: "text", text: "תמלל וסכם את ההקלטה הבאה של השיעור:" },
            { type: "input_audio", input_audio: { data: b64, format: mime.includes("wav") ? "wav" : mime.includes("mp3") ? "mp3" : "webm" } },
          ] },
        ],
        jsonResponse: true,
      })) || "{}";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "התמלול נכשל";
      await context.supabase.from("lesson_transcripts")
        .update({ status: "failed", error: msg } as never).eq("id", data.id);
      throw e;
    }
    let parsed: { transcript?: string; summary?: string; key_points?: unknown } = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }

    const transcript = String(parsed.transcript ?? "").slice(0, 100000);
    const summary = String(parsed.summary ?? "").slice(0, 8000);
    const key_points = Array.isArray(parsed.key_points)
      ? parsed.key_points.map((p) => String(p).slice(0, 500)).slice(0, 20) : [];

    // Generate embedding for sync
    let embeddingSql: string | null = null;
    try {
      const { embedText, toPgVector } = await import("./embeddings.server");
      const v = await embedText([summary, ...key_points].join("\n"));
      if (v) embeddingSql = toPgVector(v);
    } catch (e) { console.error("[Embed Error]", e); }

    const upd: Record<string, unknown> = {
      status: "done", error: null, transcript, summary, key_points,
    };
    if (embeddingSql) upd.embedding = embeddingSql;

    const { error: uerr } = await context.supabase
      .from("lesson_transcripts").update(upd as never).eq("id", data.id);
    if (uerr) { console.error("[DB Error]", uerr); throw new Error("שגיאה בשמירת התמלול"); }

    return { ok: true, transcript, summary, key_points };
  });

/** Generate a teaching resource (worksheet/question_bank) from the transcript content. */
export const generateResourceFromTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    transcript_id: uuid,
    resource_type: z.enum(["worksheet", "question_bank", "riddle", "lesson_plan"]).default("worksheet"),
    extra_instructions: z.string().max(1000).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("חסר LOVABLE_API_KEY");

    const { data: lessonRow } = await context.supabase
      .from("lesson_transcripts").select("*").eq("id", data.transcript_id).maybeSingle();
    if (!lessonRow) throw new Error("השיעור לא נמצא");
    const lesson = lessonRow as unknown as LessonTranscript;
    if (!lesson.transcript) throw new Error("אין תמלול זמין עדיין");

    // Style profile context (optional)
    let styleCtx = "";
    try {
      const { data: prof } = await context.supabase
        .from("teacher_style_profile").select("last_ai_summary,writing_style_sample,tone_keywords")
        .eq("user_id", context.userId).maybeSingle();
      if (prof) {
        const p = prof as { last_ai_summary?: string; writing_style_sample?: string; tone_keywords?: string[] };
        const parts: string[] = [];
        if (p.last_ai_summary) parts.push(`סגנון המלמד: ${p.last_ai_summary}`);
        if (p.tone_keywords?.length) parts.push(`מילות מפתח אופייניות: ${p.tone_keywords.slice(0, 8).join(", ")}`);
        if (p.writing_style_sample) parts.push(`דוגמה לסגנון כתיבה אישי:\n${p.writing_style_sample.slice(0, 800)}`);
        if (parts.length) styleCtx = `\n\n=== סגנון אישי של המלמד (התאם את הסגנון לזה) ===\n${parts.join("\n")}\n=== סוף סגנון ===`;
      }
    } catch (e) { console.error("[Style ctx error]", e); }

    const typeLabel = {
      worksheet: "דף עבודה", question_bank: "מאגר שאלות",
      riddle: "חידה", lesson_plan: "מערך שיעור",
    }[data.resource_type];

    const system = `אתה עוזר של רב/מלמד בתלמוד תורה. צור ${typeLabel} שמבוסס אך ורק על התוכן שנמסר בשיעור שתמלולו מצורף.
חוקים קריטיים:
- כל שאלה / סעיף חייב להיות על דבר שנאמר בפועל בשיעור עצמו (לא ידע כללי, לא הכותרת).
- העדף ציטוטים ישירים מהתמלול ושאלות שמוודאות הבנה.
- כתוב בעברית מכובדת לציבור החרדי ("הרב", "המלמד", "התלמידים").${styleCtx}

הנחיות נוספות מהמלמד: ${data.extra_instructions || "(אין)"}

החזר אך ורק JSON תקין:
{"title":"","description":"","tags":["..."],"content":{"body":"הוראות פתיחה / הסבר","questions":[{"q":"שאלה על תוכן השיעור","a":"תשובה מהשיעור"}],"steps":[],"materials":[]}}`;

    const userContent = `סיכום השיעור:\n${lesson.summary}\n\nנקודות מפתח:\n${lesson.key_points.map((p, i) => `${i + 1}. ${p}`).join("\n")}\n\nתמלול מלא:\n${lesson.transcript.slice(0, 30000)}`;

    const raw = (await callLovableAI({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      jsonResponse: true,
    })) || "{}";
    let parsed: {
      title?: string; description?: string; tags?: unknown;
      content?: { body?: string; questions?: { q?: string; a?: string }[]; steps?: string[]; materials?: string[] };
    } = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }

    const title = String(parsed.title ?? `${typeLabel} מתוך השיעור`).slice(0, 200);
    const description = String(parsed.description ?? "").slice(0, 2000);
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t).slice(0, 40)).slice(0, 20) : [];
    const allTags = Array.from(new Set([...tags, "from-lesson"]));
    const c = parsed.content ?? {};
    const content = {
      body: c.body ? String(c.body).slice(0, 20000) : "",
      questions: Array.isArray(c.questions)
        ? c.questions.filter((q) => q && q.q).map((q) => ({
            q: String(q.q).slice(0, 500),
            a: q.a ? String(q.a).slice(0, 2000) : undefined,
          })).slice(0, 50)
        : [],
      steps: Array.isArray(c.steps) ? c.steps.map((s) => String(s).slice(0, 500)).slice(0, 50) : [],
      materials: Array.isArray(c.materials) ? c.materials.map((m) => String(m).slice(0, 200)).slice(0, 30) : [],
    };

    // embedding
    let embeddingSql: string | null = null;
    try {
      const { embedText, toPgVector } = await import("./embeddings.server");
      const v = await embedText([title, description, content.body, ...content.questions.map((q) => q.q)].join("\n"));
      if (v) embeddingSql = toPgVector(v);
    } catch (e) { console.error("[Embed Error]", e); }

    const insertRow: Record<string, unknown> = {
      owner_id: context.userId,
      title, description, tags: allTags,
      subject: "", grade_level: "",
      resource_type: data.resource_type,
      content, ai_generated: true,
      source_prompt: `מקור: שיעור מוקלט ${lesson.title}`,
      source_transcript_id: data.transcript_id,
    };
    if (embeddingSql) insertRow.embedding = embeddingSql;

    const { data: ins, error } = await context.supabase
      .from("teaching_resources").insert(insertRow as never).select("id").single();
    if (error) { console.error("[DB Error]", error); throw new Error("שגיאה בשמירת החומר"); }
    return { id: (ins as { id: string }).id };
  });
/**
 * מאחד את כל חלקי ההקלטה לסיכום אחד: סיכום כולל, נקודות מפתח,
 * וזיהוי מה נלמד בפועל — הבסיס לסנכרון עם ההספק והתכנית הלימודית.
 */
export const summarizeLessonParts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ part_group_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("lesson_transcripts")
      .select(LESSON_COLUMNS)
      .eq("part_group_id", data.part_group_id)
      .order("part_index", { ascending: true });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה."); }
    const parts = (rows ?? []) as unknown as LessonTranscript[];
    const ready = parts.filter((p) => p.status === "done" && p.transcript);
    if (ready.length === 0) throw new Error("אין עדיין חלקים מתומללים");

    const joined = ready
      .map((p) => `=== חלק ${p.part_index ?? 1} ===\n${p.transcript}`)
      .join("\n\n")
      .slice(0, 120000);

    const system = `אתה עוזר של רב/מלמד בתלמוד תורה. לפניך תמלול של שיעור אחד שפוצל לכמה חלקים.
כתוב סיכום אחד רציף של השיעור כולו (4-6 פסקאות), הפק 6-12 נקודות מפתח,
וכן רשימת נושאים שנלמדו בפועל (topics) — מסכת/דף/סוגיה/פרק/מושג לפי מה שנאמר.
כתוב בעברית לציבור החרדי ("הרב", "המלמד", "התלמידים").
החזר אך ורק JSON תקין:
{"summary":"...","key_points":["..."],"topics":["..."]}`;

    const raw = (await callLovableAI({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: system },
        { role: "user", content: joined },
      ],
      jsonResponse: true,
    })) || "{}";
    let parsed: { summary?: string; key_points?: unknown; topics?: unknown } = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }

    const summary = String(parsed.summary ?? "").slice(0, 8000);
    const key_points = Array.isArray(parsed.key_points)
      ? parsed.key_points.map((p) => String(p).slice(0, 500)).slice(0, 20) : [];
    const topics = Array.isArray(parsed.topics)
      ? parsed.topics.map((t) => String(t).slice(0, 200)).slice(0, 20) : [];

    const first = ready[0];
    if (first) {
      await context.supabase.from("lesson_transcripts")
        .update({ summary, key_points } as never).eq("id", first.id);
    }
    return { ok: true, summary, key_points, topics, parts: ready.length, class_id: first?.class_id ?? null };
  });

/**
 * מסנכרן את מה שנלמד בשיעור עם התכנית הלימודית וההספק:
 * מסמן יחידות לימוד שכוסו בפועל, ומייצר תובנה יומית על חוסר לימוד/פיגור בהספק.
 */
export const syncLessonToCurriculum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ transcript_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: lessonRow } = await context.supabase
      .from("lesson_transcripts").select("*").eq("id", data.transcript_id).maybeSingle();
    if (!lessonRow) throw new Error("השיעור לא נמצא");
    const lesson = lessonRow as unknown as LessonTranscript;
    if (!lesson.summary && !lesson.transcript) throw new Error("אין עדיין תוכן לסנכרון");

    const { data: unitRows } = await context.supabase
      .from("curriculum_units")
      .select("id,title,subject,status,order_index,estimated_lessons")
      .eq("class_id", lesson.class_id)
      .order("order_index", { ascending: true });
    const units = (unitRows ?? []) as {
      id: string; title: string; subject: string; status: string;
      order_index: number | null; estimated_lessons: number | null;
    }[];

    const haystack = `${lesson.summary}\n${(lesson.key_points ?? []).join("\n")}\n${lesson.transcript}`;
    const norm = (s: string) => s.replace(/[״"׳'.,־-]/g, " ").replace(/\s+/g, " ").trim();
    const hay = norm(haystack);
    const covered = units.filter((u) => {
      const words = norm(u.title).split(" ").filter((w) => w.length >= 3);
      if (words.length === 0) return false;
      const hits = words.filter((w) => hay.includes(w)).length;
      return hits / words.length >= 0.6;
    });

    const today = new Date().toISOString().slice(0, 10);
    for (const u of covered) {
      if (u.status === "done") continue;
      await context.supabase.from("curriculum_units")
        .update({ status: "done", completed_at: today } as never).eq("id", u.id);
    }

    const pending = units.filter((u) => u.status !== "done" && !covered.some((c) => c.id === u.id));
    const nextUnit = pending[0];
    const gapTitles = pending.slice(0, 5).map((u) => u.title);

    const description = units.length === 0
      ? `השיעור "${lesson.title}" תומלל וסוכם, אך לא מוגדרת עדיין תכנית לימודית לכיתה — לכן אין למול מה למדוד את ההספק.`
      : `בשיעור "${lesson.title}" כוסו ${covered.length} יחידות לימוד. נותרו ${pending.length} יחידות שלא נלמדו עדיין` +
        (gapTitles.length ? `: ${gapTitles.join(", ")}.` : ".");

    const insight = {
      owner_id: context.userId,
      class_id: lesson.class_id,
      student_id: null,
      insight_type: "lesson_coverage",
      severity: pending.length > 5 ? "medium" : "low",
      title: `הספק ותוכן שנלמד — ${lesson.title}`,
      description,
      suggested_action: nextUnit ? `להמשיך ביחידה הבאה: ${nextUnit.title}` : null,
      action_link: `/class/${lesson.class_id}`,
      insight_date: today,
    };
    const { error: insErr } = await context.supabase
      .from("orchestrator_insights").insert(insight as never);
    if (insErr) console.error("[DB Error]", insErr);

    return {
      ok: true,
      covered: covered.map((u) => u.title),
      pending: gapTitles,
      next_unit: nextUnit?.title ?? null,
    };
  });
