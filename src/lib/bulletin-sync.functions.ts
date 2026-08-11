import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildStyleContextString } from "./teacher-style.functions";
import { callLovableAI } from "./ai-gateway.server";

const uuid = z.string().uuid();

/** תוויות עבריות למקצועות ההספק — משמשות גם בפרומפט וגם בכותרת החומר. */
const SCHEDULE_SUBJECTS = {
  gemara: { label: "גמרא", fields: [["daf", "דף"], ["topic", "נושא"]] },
  mishna: { label: "משנה", fields: [["masechet", "מסכת"], ["perek", "פרק"]] },
  torah: { label: "חומש", fields: [["parasha", "פרשה"], ["pasuk_range", "פסוקים"]] },
  navi: { label: "נביא", fields: [["sefer", "ספר"], ["perek", "פרק"]] },
  halacha: { label: "הלכה", fields: [["siman", "סימן"], ["seif", "סעיף"]] },
} as const;

type ScheduleKey = keyof typeof SCHEDULE_SUBJECTS;

function describeSchedule(schedule: unknown, only?: ScheduleKey): string[] {
  const s = (schedule ?? {}) as Record<string, Record<string, string> | undefined>;
  const keys = (only ? [only] : (Object.keys(SCHEDULE_SUBJECTS) as ScheduleKey[]));
  const out: string[] = [];
  for (const k of keys) {
    const def = SCHEDULE_SUBJECTS[k];
    const row = s[k];
    if (!row) continue;
    const parts = def.fields
      .map(([field, label]) => {
        const v = (row[field] ?? "").trim();
        return v ? `${label}: ${v}` : "";
      })
      .filter(Boolean);
    if (parts.length) out.push(`${def.label} — ${parts.join(", ")}`);
  }
  return out;
}

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

/**
 * חומרים שנוצרו אוטומטית מתוך ההספק הלימודי של העלון, לפי מקצוע —
 * מאפשר לרב לוודא את הקישור לעלון ולפתוח את החומר לעריכה.
 */
export const listScheduleResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bulletin_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: links } = await context.supabase
      .from("bulletin_resources").select("resource_id").eq("bulletin_id", data.bulletin_id);
    const ids = ((links ?? []) as { resource_id: string }[]).map((l) => l.resource_id);
    if (!ids.length) return [];
    const { data: rows, error } = await context.supabase
      .from("teaching_resources")
      .select("id,title,subject,resource_type,tags,updated_at")
      .in("id", ids)
      .contains("tags", ["הספק-לימודי"])
      .order("updated_at", { ascending: false });
    if (error) { console.error("[DB]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    const list = (rows ?? []) as unknown as Array<{
      id: string; title: string; subject: string; resource_type: string; tags: string[]; updated_at: string;
    }>;
    return list.map((r) => {
      // המקצוע נשמר גם בעמודת subject וגם בתגיות — נגזור את מפתח ההספק ממנו.
      const key = (Object.keys(SCHEDULE_SUBJECTS) as ScheduleKey[])
        .find((k) => SCHEDULE_SUBJECTS[k].label === r.subject || r.tags?.includes(SCHEDULE_SUBJECTS[k].label));
      return { ...r, schedule_key: key ?? null, linked: true };
    });
  });

/** Generate a question bank resource for the week's study points. */
export const generateQuizFromBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bulletin_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: b } = await context.supabase
      .from("weekly_bulletins").select("title,study_points,digest_summary,start_date,end_date,class_id")
      .eq("id", data.bulletin_id).maybeSingle();
    if (!b) throw new Error("העלון לא נמצא");
    const bul = b as { title: string; study_points: string[]; digest_summary: string;
      start_date: string; end_date: string; class_id: string };

    const styleCtx = await buildStyleContextString(context.supabase, context.userId);
    const system = `אתה עוזר של רב/מלמד בתלמוד תורה. צור מבחן חזרה על החומר שנלמד השבוע.
השאלות חייבות להיות מבוססות אך ורק על נקודות הלימוד שנמסרו (study_points) ועל סיכום השבוע.
כתוב בעברית מכובדת לציבור החרדי. החזר אך ורק JSON תקין:
{"title":"","description":"","questions":[{"q":"","a":""}]}
8-12 שאלות עם תשובות.${styleCtx}`;

    const user = `כותרת העלון: ${bul.title}\nסיכום השבוע:\n${bul.digest_summary}\nנקודות לימוד:\n${(bul.study_points ?? []).map((p, i) => `${i + 1}. ${p}`).join("\n")}`;

    const rawContent = await callLovableAI({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      jsonResponse: true,
    });
    let parsed: { title?: string; description?: string; questions?: { q?: string; a?: string }[] } = {};
    try { parsed = JSON.parse(rawContent || "{}"); } catch { /* */ }

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

/** מחזיר את השאלות של חומר קיים בספרייה, מנורמלות לייבוא לעלון. */
export const listQuestionsFromResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ resource_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("teaching_resources")
      .select("id,title,resource_type,subject,content")
      .eq("id", data.resource_id)
      .maybeSingle();
    if (error) { console.error("[DB]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!row) return { id: data.resource_id, title: "", questions: [] as { question: string; answer: string }[] };
    const r = row as unknown as {
      id: string; title: string; resource_type: string; subject: string | null;
      content: { questions?: { q?: unknown; a?: unknown }[] } | null;
    };
    const questions = (r.content?.questions ?? [])
      .filter((q) => q && typeof q.q === "string" && String(q.q).trim())
      .map((q) => ({ question: String(q.q).slice(0, 500), answer: q.a ? String(q.a).slice(0, 1000) : "" }));
    return { id: r.id, title: r.title, questions };
  });

/**
 * Generates a question-sheet resource from the bulletin's structured study
 * schedule (optionally focused on a single subject), then links it to the bulletin.
 */
export const generateQuizFromSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      bulletin_id: uuid,
      subject: z.enum(["gemara", "mishna", "torah", "navi", "halacha"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: b } = await context.supabase
      .from("weekly_bulletins")
      .select("title,digest_summary,study_schedule,torah_dvar_title,torah_dvar_body,start_date,end_date")
      .eq("id", data.bulletin_id).maybeSingle();
    if (!b) throw new Error("העלון לא נמצא");
    const bul = b as unknown as {
      title: string; digest_summary: string; study_schedule: unknown;
      torah_dvar_title: string; torah_dvar_body: string; start_date: string; end_date: string;
    };

    const scheduleLines = describeSchedule(bul.study_schedule, data.subject);
    if (scheduleLines.length === 0) {
      throw new Error("אין תוכן בהספק הלימודי — מלא את שדות המקצוע ושמור את העלון");
    }
    const subjectLabel = data.subject ? SCHEDULE_SUBJECTS[data.subject].label : "";

    const styleCtx = await buildStyleContextString(context.supabase, context.userId);
    const system = `אתה עוזר של רב/מלמד בתלמוד תורה. צור דף שאלות חזרה על ההספק הלימודי שנמסר.
השאלות חייבות להתבסס אך ורק על ההספק שנמסר (מקצוע, דף/מסכת/פרשה/סימן) ועל תוכן העלון.
${subjectLabel ? `התמקד במקצוע: ${subjectLabel}.` : "כלול שאלות מכל המקצועות שנמסרו."}
כתוב בעברית מכובדת לציבור החרדי. החזר אך ורק JSON תקין:
{"title":"","description":"","questions":[{"q":"","a":""}]}
8-12 שאלות עם תשובות.${styleCtx}`;

    const user = [
      `כותרת העלון: ${bul.title}`,
      `הספק לימודי:\n${scheduleLines.map((l, i) => `${i + 1}. ${l}`).join("\n")}`,
      bul.torah_dvar_title || bul.torah_dvar_body
        ? `דבר תורה: ${bul.torah_dvar_title}\n${bul.torah_dvar_body}`.slice(0, 3000)
        : "",
      bul.digest_summary ? `סיכום השבוע:\n${bul.digest_summary}` : "",
    ].filter(Boolean).join("\n\n");

    const rawContent = await callLovableAI({
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      jsonResponse: true,
    });
    let parsed: { title?: string; description?: string; questions?: { q?: string; a?: string }[] } = {};
    try { parsed = JSON.parse(rawContent || "{}"); } catch { /* */ }

    const content = {
      body: scheduleLines.join("\n"),
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
      const v = await embedText([parsed.title ?? "", ...scheduleLines, ...content.questions.map((q) => q.q)].join("\n"));
      if (v) embeddingSql = toPgVector(v);
    } catch { /* */ }

    const fallbackTitle = subjectLabel
      ? `דף שאלות ${subjectLabel} — ${bul.title}`
      : `דף שאלות מההספק — ${bul.title}`;
    const insertRow: Record<string, unknown> = {
      owner_id: context.userId,
      title: String(parsed.title ?? fallbackTitle).slice(0, 200),
      description: String(parsed.description ?? `נוצר אוטומטית מההספק הלימודי של העלון`).slice(0, 2000),
      tags: ["auto-from-bulletin", "הספק-לימודי", ...(subjectLabel ? [subjectLabel] : [])],
      subject: subjectLabel,
      grade_level: "",
      resource_type: "question_bank",
      content, ai_generated: true,
      source_prompt: `מקור: הספק לימודי בעלון ${bul.title} (${bul.start_date}—${bul.end_date})`,
    };
    if (embeddingSql) insertRow.embedding = embeddingSql;

    const { data: ins, error } = await context.supabase
      .from("teaching_resources").insert(insertRow as never).select("id").single();
    if (error) { console.error("[DB]", error); throw new Error("שגיאה בשמירה"); }
    const resourceId = (ins as { id: string }).id;

    await context.supabase.from("bulletin_resources").upsert({
      bulletin_id: data.bulletin_id, resource_id: resourceId, owner_id: context.userId,
    } as never, { onConflict: "bulletin_id,resource_id" });

    return { id: resourceId };
  });