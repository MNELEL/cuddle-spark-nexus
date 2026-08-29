import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

const ParamValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const ASSISTANT_ACTION_KINDS = [
  "add_grade",
  "mark_attendance",
  "add_note",
  "add_behavior",
  "add_parent_call",
  "add_daily_update",
  "add_incident",
  "add_class_event",
  "add_announcement",
] as const;

const ActionSchema = z.object({
  kind: z.enum(ASSISTANT_ACTION_KINDS),
  summary: z.string().max(280),
  params: z.record(z.string(), ParamValue),
});
export type AssistantAction = z.infer<typeof ActionSchema>;
export type AssistantActionKind = AssistantAction["kind"];

/** כוונות שאינן קשורות לתלמיד ספציפי — לא נדרש student_id. */
const CLASS_LEVEL_KINDS = new Set<AssistantActionKind>([
  "add_daily_update",
  "add_announcement",
  "add_class_event",
]);

export type AssistantReply = {
  /** read = תשובה מיידית · write = פעולות לסקירה · clarify = נדרשת הבהרה */
  mode: "read" | "write" | "clarify";
  answer: string;
  actions: AssistantAction[];
  /** שאלת הבהרה ממוקדת אחת, כשהכוונה דו-משמעית. */
  clarify: string | null;
  /** אפשרויות מענה מהיר לשאלת ההבהרה. */
  clarifyOptions: string[];
  /** על מה התשובה מבוססת — מוצג מתחת לתשובת קריאה. */
  sources: string[];
  /** קישורים למסכים שבהם אפשר לאמת את המקורות. */
  sourceLinks: AssistantSourceLink[];
  /** רשימת תלמידי הכיתה, לעריכה מהירה של פעולות בכרטיס הסקירה. */
  students: { id: string; name: string }[];
};


function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Run an AI assistant query against a class context. */
export const assistantQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      text: z.string().min(2).max(2000),
      /** ההיסטוריה הקצרה של השיחה בפאנל, כדי שאפשר להמשיך "וגם לשמואל". */
      history: z
        .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
        .max(6)
        .optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<AssistantReply> => {
    const { supabase } = context;
    const since = new Date(); since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString().slice(0, 10);

    const [studentsRes, attRes, gradesRes, behRes, discRes, eventsRes, annRes] = await Promise.all([
      supabase.from("students").select("id,name,notes").eq("class_id", data.classId),
      supabase.from("attendance").select("student_id,date,status").eq("class_id", data.classId).gte("date", sinceIso),
      supabase.from("grades").select("student_id,subject,value,max_value,date").eq("class_id", data.classId).gte("date", sinceIso),
      supabase.from("behavior_points").select("student_id,category,points,date").eq("class_id", data.classId).gte("date", sinceIso),
      supabase.from("discipline_events").select("student_id,type,description,date").eq("class_id", data.classId).gte("date", sinceIso),
      supabase.from("class_events").select("title,type,date,notes,student_id").eq("class_id", data.classId).gte("date", sinceIso).order("date", { ascending: false }).limit(40),
      supabase.from("class_announcements").select("title,body,severity,created_at").eq("class_id", data.classId).order("created_at", { ascending: false }).limit(20),
    ]);
    const err = studentsRes.error || attRes.error || gradesRes.error || behRes.error || discRes.error;
    if (err) throw new Error(err.message);

    const students = studentsRes.data ?? [];
    if (students.length === 0) throw new Error("אין תלמידים בכיתה זו");

    const attendance = attRes.data ?? [];
    const grades = gradesRes.data ?? [];
    const behavior = behRes.data ?? [];
    const discipline = discRes.data ?? [];
    const events = eventsRes.data ?? [];
    const announcements = annRes.data ?? [];

    const ctxJson = JSON.stringify({
      today: todayIso(),
      students: students.map((s) => ({ id: s.id, name: s.name, notes: s.notes ?? "" })),
      attendance,
      grades,
      behavior,
      discipline,
      recent_events: events,
      recent_announcements: announcements,
    });

    const system = `אתה עוזר אישי של רב/מלמד בתלמוד תורה. השב בעברית קצר וברור.
הקלט: שאלה/בקשה חופשית של הרב + הקשר מלא של הכיתה ב-30 ימים האחרונים, כולל אירועי לוח והודעות/עדכונים אחרונים.
המטרה: או לענות מיד על שאלת קריאה, או להציע פעולות כתיבה לסקירה ואישור, או לשאול שאלת הבהרה אחת.

פעולות אפשריות (kind):
- add_grade: { student_id, subject, value, max_value (ברירת מחדל 100), notes?, date? }
- mark_attendance: { student_id, status: "present"|"absent"|"late"|"excused", date?, notes? }
- add_note: { student_id, description, type?: "positive"|"negative"|"neutral", category?: string }
- add_behavior: { student_id, points (1-5, שלילי = הורדה), category?: string, note? }
- add_parent_call: { student_id, summary, subject?, channel?: "phone"|"meeting"|"whatsapp"|"email", date? }
- add_incident: { student_id, description, severity: "low"|"medium"|"high", category?: string, date? } — אירוע חריג לתלמיד
- add_daily_update: { text, date? } — תיעוד/סיכום היום לכיתה כולה
- add_announcement: { title, body?, severity?: "info"|"warning"|"urgent" } — הודעת כיתה
- add_class_event: { title, type: "birthday"|"exam"|"trip"|"holiday"|"meeting"|"special_exam"|"celebration"|"other", date?, end_date?, notes?, student_id? } — אירוע בלוח

חוקים:
1. תמיד התאם שם תלמיד מהטקסט ל-student_id מהרשימה (זיהוי גם בשיבוש קל).
2. שאלה בלבד → mode="read", answer מפורט, actions=[], ו-sources: 2-4 פריטים קצרים בעברית שמפרטים על מה התשובה מבוססת (סוגי נתונים ושמות תלמידים ספציפיים).
3. בקשת פעולה → mode="write", answer קצר ("3 פעולות מחכות לאישור"), actions עם כל הפעולות. בקשה קבוצתית ("כל הכיתה נוכחת חוץ מיוסי") → צור פעולה נפרדת לכל תלמיד רלוונטי.
4. כוונה דו-משמעית (תאריך לא ברור, תלמיד לא ברור, לא ברור אם קריאה או כתיבה) → mode="clarify", clarify = שאלה אחת ממוקדת, clarifyOptions = 2-4 תשובות אפשריות קצרות, actions=[]. אל תנחש.
5. summary של כל פעולה = משפט אחד בעברית שהרב יבין מיד, כולל שם התלמיד והתאריך.
6. אל תמציא נתונים שאינם בהקשר.

החזר רק JSON: {"mode":"read|write|clarify","answer":"...","clarify":null,"clarifyOptions":[],"sources":[],"actions":[{"kind":"...","summary":"...","params":{...}}]}`;

    const historyText = (data.history ?? [])
      .map((m) => `${m.role === "user" ? "הרב" : "העוזר"}: ${m.content}`)
      .join("\n");

    const raw = (await callLovableAI({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `הקשר הכיתה (JSON):\n${ctxJson}\n${
            historyText ? `\nהמשך שיחה קודמת:\n${historyText}\n` : ""
          }\nבקשת הרב:\n${data.text}`,
        },
      ],
      jsonResponse: true,
    })) || "{}";
    let parsed: {
      mode?: string;
      answer?: string;
      clarify?: string | null;
      clarifyOptions?: unknown[];
      sources?: unknown[];
      actions?: unknown[];
    } = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }

    const actions: AssistantAction[] = [];
    for (const a of parsed.actions ?? []) {
      const r = ActionSchema.safeParse(a);
      if (r.success) actions.push(r.data);
    }

    const clarify = typeof parsed.clarify === "string" && parsed.clarify.trim()
      ? parsed.clarify.trim().slice(0, 300)
      : null;
    const clarifyOptions = (parsed.clarifyOptions ?? [])
      .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
      .slice(0, 4)
      .map((o) => o.trim().slice(0, 80));

    let mode: AssistantReply["mode"] =
      parsed.mode === "read" || parsed.mode === "write" || parsed.mode === "clarify"
        ? parsed.mode
        : actions.length > 0 ? "write" : "read";
    // עקביות: אין פעולות ואין שאלה → תשובת קריאה.
    if (mode === "clarify" && !clarify) mode = actions.length > 0 ? "write" : "read";
    if (mode === "write" && actions.length === 0) mode = clarify ? "clarify" : "read";

    const sources = (parsed.sources ?? [])
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, 6)
      .map((s) => s.trim().slice(0, 120));
    if (mode === "read" && sources.length === 0) {
      sources.push(
        `${students.length} תלמידים`,
        `${attendance.length} רישומי נוכחות`,
        `${grades.length} ציונים`,
        `${behavior.length + discipline.length} רישומי התנהגות`,
      );
    }

    return {
      mode,
      answer: parsed.answer ?? (clarify ? "" : "(אין תשובה)"),
      actions: mode === "clarify" ? [] : actions,
      clarify: mode === "clarify" ? clarify : null,
      clarifyOptions: mode === "clarify" ? clarifyOptions : [],
      sources,
    };
  });

/** Execute an action approved by the user. */
export const executeAssistantAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      action: ActionSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { kind, params } = data.action;

    const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    const safeDate = (v: unknown): string => {
      const r = dateSchema.safeParse(String(v ?? ""));
      return r.success ? r.data : todayIso();
    };
    const optionalDate = (v: unknown): string | null => {
      const r = dateSchema.safeParse(String(v ?? ""));
      return r.success ? r.data : null;
    };

    let sid = "";
    const rawSid = String(params.student_id ?? "");
    const sidParsed = z.string().uuid().safeParse(rawSid);
    if (!CLASS_LEVEL_KINDS.has(kind)) {
      if (!sidParsed.success) throw new Error("מזהה תלמיד לא תקין");
      sid = sidParsed.data;
    } else if (sidParsed.success) {
      sid = sidParsed.data;
    }

    if (sid) {
      // Verify the student belongs to the provided class
      const { data: studentRow, error: studentErr } = await supabase
        .from("students").select("id").eq("id", sid).eq("class_id", data.classId).maybeSingle();
      if (studentErr) { console.error("[DB Error]", studentErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
      if (!studentRow) throw new Error("התלמיד אינו שייך לכיתה זו");
    }

    if (kind === "add_grade") {
      const subject = String(params.subject ?? "").slice(0, 120);
      const value = Number(params.value ?? 0);
      const maxValue = Number(params.max_value ?? 100);
      if (!Number.isFinite(value) || !Number.isFinite(maxValue)) throw new Error("ערך ציון לא תקין");
      const { error } = await supabase.from("grades").insert({
        class_id: data.classId,
        student_id: sid,
        subject,
        value,
        max_value: maxValue,
        notes: String(params.notes ?? "").slice(0, 1000),
        date: safeDate(params.date),
      });
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    } else if (kind === "mark_attendance") {
      const statusParsed = z.enum(["present", "absent", "late", "excused"])
        .safeParse(String(params.status ?? "present"));
      if (!statusParsed.success) throw new Error("סטטוס נוכחות לא תקין");
      const { error } = await supabase.from("attendance").upsert({
        class_id: data.classId,
        student_id: sid,
        date: safeDate(params.date),
        status: statusParsed.data,
        notes: String(params.notes ?? "").slice(0, 1000),
      }, { onConflict: "student_id,date" });
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    } else if (kind === "add_note") {
      const typeParsed = z.enum(["positive", "negative", "neutral"])
        .safeParse(String(params.type ?? "neutral"));
      if (!typeParsed.success) throw new Error("סוג רישום לא תקין");
      const { error } = await supabase.from("discipline_events").insert({
        class_id: data.classId,
        student_id: sid,
        type: typeParsed.data,
        category: String(params.category ?? "note").slice(0, 80),
        description: String(params.description ?? "").slice(0, 2000),
        date: safeDate(params.date),
      });
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    } else if (kind === "add_incident") {
      const severityParsed = z.enum(["low", "medium", "high"])
        .safeParse(String(params.severity ?? "medium"));
      if (!severityParsed.success) throw new Error("דרגת חומרה לא תקינה");
      const severityHe = { low: "קלה", medium: "בינונית", high: "חמורה" }[severityParsed.data];
      const description = String(params.description ?? "").slice(0, 1900);
      if (!description.trim()) throw new Error("חסר תיאור לאירוע החריג");
      const { error } = await supabase.from("discipline_events").insert({
        class_id: data.classId,
        student_id: sid,
        type: "negative",
        category: String(params.category ?? "incident").slice(0, 80),
        description: `[אירוע חריג · חומרה ${severityHe}] ${description}`,
        date: safeDate(params.date),
      });
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    } else if (kind === "add_parent_call") {
      const channelParsed = z.enum(["phone", "meeting", "whatsapp", "email"])
        .safeParse(String(params.channel ?? "phone"));
      if (!channelParsed.success) throw new Error("ערוץ תקשורת לא תקין");
      const { error } = await supabase.from("parent_communications").insert({
        class_id: data.classId,
        student_id: sid,
        channel: channelParsed.data,
        subject: String(params.subject ?? "").slice(0, 200),
        summary: String(params.summary ?? "").slice(0, 2000),
        date: safeDate(params.date),
      });
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    } else if (kind === "add_daily_update") {
      const text = String(params.text ?? params.body ?? params.description ?? "").slice(0, 2000);
      if (!text.trim()) throw new Error("חסר תוכן לעדכון היומי");
      const { error } = await supabase.from("class_announcements").insert({
        class_id: data.classId,
        title: `עדכון יומי · ${safeDate(params.date)}`,
        body: text,
        severity: "info",
        active: true,
      });
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    } else if (kind === "add_announcement") {
      const title = String(params.title ?? "").slice(0, 200);
      if (!title.trim()) throw new Error("חסרה כותרת להודעה");
      const severityParsed = z.enum(["info", "warning", "urgent"])
        .safeParse(String(params.severity ?? "info"));
      const { error } = await supabase.from("class_announcements").insert({
        class_id: data.classId,
        title,
        body: String(params.body ?? "").slice(0, 2000) || null,
        severity: severityParsed.success ? severityParsed.data : "info",
        active: true,
      });
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    } else if (kind === "add_class_event") {
      const title = String(params.title ?? "").slice(0, 200);
      if (!title.trim()) throw new Error("חסרה כותרת לאירוע");
      const typeParsed = z
        .enum(["birthday", "exam", "trip", "holiday", "meeting", "special_exam", "celebration", "other"])
        .safeParse(String(params.type ?? "other"));
      if (!typeParsed.success) throw new Error("סוג אירוע לא תקין");
      const { error } = await supabase.from("class_events").insert({
        class_id: data.classId,
        title,
        type: typeParsed.data,
        date: safeDate(params.date),
        end_date: optionalDate(params.end_date),
        notes: String(params.notes ?? "").slice(0, 2000) || null,
        student_id: sid || null,
      });
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    }
    return { ok: true };
  });
