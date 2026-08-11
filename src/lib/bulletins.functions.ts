import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type QuizQuestion = { question: string; answer: string };

/** מקצועות ההספק השבועי — מפתחות קבועים עם שני שדות פירוט כל אחד. */
export type StudySchedule = {
  gemara?: { daf: string; topic: string };
  mishna?: { masechet: string; perek: string };
  torah?: { parasha: string; pasuk_range: string };
  navi?: { sefer: string; perek: string };
  halacha?: { siman: string; seif: string };
};

export type HonoredStudent = { name: string; type: "vort" | "mazal_tov" | "other"; note: string };
export type SpecialNotice = { title: string; body: string };

const txt = z.string().max(200).default("");
const StudyScheduleSchema = z.object({
  gemara: z.object({ daf: txt, topic: txt }).optional(),
  mishna: z.object({ masechet: txt, perek: txt }).optional(),
  torah: z.object({ parasha: txt, pasuk_range: txt }).optional(),
  navi: z.object({ sefer: txt, perek: txt }).optional(),
  halacha: z.object({ siman: txt, seif: txt }).optional(),
}).default({});

const HonoredSchema = z.array(z.object({
  name: z.string().max(200).default(""),
  type: z.enum(["vort", "mazal_tov", "other"]).default("other"),
  note: z.string().max(500).default(""),
})).max(40).default([]);

const NoticesSchema = z.array(z.object({
  title: z.string().max(200).default(""),
  body: z.string().max(2000).default(""),
})).max(20).default([]);

export type BulletinExtras = Pick<
  BulletinDraft,
  "torah_dvar_title" | "torah_dvar_body" | "study_schedule" | "honored_students" | "special_notices"
>;

/** ברירות מחדל לשדות התוכן המורחבים — שומר תאימות לעלונים ישנים ולתשובות AI חסרות. */
export function normalizeExtras(row: unknown): BulletinExtras {
  const r = (row ?? {}) as Record<string, unknown>;
  const honored = Array.isArray(r["honored_students"]) ? (r["honored_students"] as HonoredStudent[]) : [];
  const notices = Array.isArray(r["special_notices"]) ? (r["special_notices"] as SpecialNotice[]) : [];
  const sched = r["study_schedule"];
  return {
    torah_dvar_title: typeof r["torah_dvar_title"] === "string" ? (r["torah_dvar_title"] as string) : "",
    torah_dvar_body: typeof r["torah_dvar_body"] === "string" ? (r["torah_dvar_body"] as string) : "",
    study_schedule: (sched && typeof sched === "object" && !Array.isArray(sched) ? sched : {}) as StudySchedule,
    honored_students: honored
      .filter((h) => h && typeof h.name === "string" && h.name.trim())
      .map((h) => ({
        name: String(h.name),
        type: h.type === "vort" || h.type === "mazal_tov" ? h.type : "other",
        note: typeof h.note === "string" ? h.note : "",
      })),
    special_notices: notices
      .filter((n) => n && (n.title || n.body))
      .map((n) => ({
        title: typeof n.title === "string" ? n.title : "",
        body: typeof n.body === "string" ? n.body : "",
      })),
  };
}

export type BulletinDraft = {
  title: string;
  digest_summary: string;
  study_points: string[];
  recap_questions: QuizQuestion[];
  weekly_riddle: string;
  weekly_riddle_answer: string;
  activities: string[];
  torah_dvar_title: string;
  torah_dvar_body: string;
  study_schedule: StudySchedule;
  honored_students: HonoredStudent[];
  special_notices: SpecialNotice[];
};

export type StoredBulletin = BulletinDraft & {
  id: string;
  class_id: string;
  start_date: string;
  end_date: string;
  notes: string;
  created_at: string;
  status: "draft" | "published";
  published_at: string | null;
};

export type BulletinSnapshot = BulletinDraft & {
  notes: string;
  start_date: string;
  end_date: string;
};

export type BulletinVersion = {
  id: string;
  bulletin_id: string;
  snapshot: BulletinSnapshot;
  created_at: string;
  created_by: string | null;
};

/** List all bulletins of a class (most recent first). */
export const listBulletins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<StoredBulletin[]> => {
    const { data: rows, error } = await context.supabase
      .from("weekly_bulletins")
      .select("*")
      .eq("class_id", data.classId)
      .order("start_date", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return (rows ?? []) as unknown as StoredBulletin[];
  });

/** Generate a bulletin draft using Lovable AI from class activity in date range. */
export const generateBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      startDate: DateStr,
      endDate: DateStr,
      lessonNotes: z.string().max(8000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<BulletinDraft> => {
    const { supabase } = context;
    const [cls, students, grades, behavior, discipline] = await Promise.all([
      supabase.from("classes").select("id,name").eq("id", data.classId).single(),
      supabase.from("students").select("id,name").eq("class_id", data.classId),
      supabase.from("grades").select("subject,value,max_value,notes,date")
        .eq("class_id", data.classId).gte("date", data.startDate).lte("date", data.endDate),
      supabase.from("behavior_points").select("category,points,note,date")
        .eq("class_id", data.classId).gte("date", data.startDate).lte("date", data.endDate),
      supabase.from("discipline_events").select("type,category,description,date")
        .eq("class_id", data.classId).gte("date", data.startDate).lte("date", data.endDate),
    ]);
    if (cls.error) throw new Error("שגיאה בטעינת הכיתה");

    const ctx = JSON.stringify({
      class_name: cls.data?.name,
      range: { from: data.startDate, to: data.endDate },
      students_count: students.data?.length ?? 0,
      subjects: Array.from(new Set((grades.data ?? []).map((g) => g.subject))),
      grades_sample: (grades.data ?? []).slice(0, 50),
      behavior_sample: (behavior.data ?? []).slice(0, 30),
      discipline_sample: (discipline.data ?? []).slice(0, 20),
      lesson_notes: data.lessonNotes ?? "",
    });

    const system = `אתה עוזר של רב/מלמד בתלמוד תורה הכותב **עלון שבועי לבית הספר ולהורים**.
כתוב בעברית חיה, בגובה העיניים, מכובדת ומתאימה לציבור החרדי. השתמש במונחים: "הרב", "המלמד", "התלמידים", "הורי הבית" (לא "מורה", לא "ילדים").
מקצועות קודש: גמרא, משנה, חומש, נביא, הלכה, מוסר, תפילה, פרשת שבוע.

על בסיס הקלט (פעילות הכיתה ב-7 הימים האחרונים + הערות שיעור אופציונליות), הפק עלון שכולל:
- title: כותרת קצרה ומכובדת (לדוגמה: "עלון שבועי — פרשת תרומה תשפ\\"ה")
- digest_summary: 2-4 פסקאות שמסכמות את השבוע (מה למדו, הישגים בולטים, אווירה כללית — בלי לציין שמות פרטיים של תלמידים שליליים)
- study_points: מערך 4-6 נקודות לימוד שעלו השבוע (כל אחת משפט קצר)
- recap_questions: מערך 3-5 שאלות חזרה להורים לעבור עם הילד, כל אחת עם answer
- weekly_riddle: חידה תורנית אחת מהפרשה / מהש"ס
- weekly_riddle_answer: התשובה
- activities: מערך 2-4 פעילויות / יוזמות / מעלות שהיו השבוע
- torah_dvar_title: כותרת קצרה לדבר תורה מהפרשה
- torah_dvar_body: דבר תורה מורחב (2-4 פסקאות) מהפרשה או מהחומר הנלמד
- study_schedule: ההספק הלימודי לפי מקצוע, לפי המידע שבקלט בלבד (אם אין מידע — השאר מחרוזות ריקות, אל תמציא דפים או מסכתות)
- honored_students: השאר מערך ריק תמיד (שמות תלמידים מוזנים ידנית על ידי הרב)
- special_notices: השאר מערך ריק תמיד (הודעות מיוחדות מוזנות ידנית)

החזר אך ורק JSON תקין בפורמט הזה:
{"title":"","digest_summary":"","study_points":[],"recap_questions":[{"question":"","answer":""}],"weekly_riddle":"","weekly_riddle_answer":"","activities":[],"torah_dvar_title":"","torah_dvar_body":"","study_schedule":{"gemara":{"daf":"","topic":""},"mishna":{"masechet":"","perek":""},"torah":{"parasha":"","pasuk_range":""},"navi":{"sefer":"","perek":""},"halacha":{"siman":"","seif":""}},"honored_students":[],"special_notices":[]}`;

    const raw = (await callLovableAI({
      messages: [
        { role: "system", content: system },
        { role: "user", content: `נתוני הכיתה (JSON):\n${ctx}` },
      ],
      jsonResponse: true,
    })) || "{}";
    let parsed: Partial<BulletinDraft> = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }

    return {
      title: parsed.title ?? `עלון שבועי — ${data.startDate}`,
      digest_summary: parsed.digest_summary ?? "",
      study_points: Array.isArray(parsed.study_points) ? parsed.study_points.map(String) : [],
      recap_questions: Array.isArray(parsed.recap_questions)
        ? parsed.recap_questions
            .filter((q): q is QuizQuestion => !!q && typeof q.question === "string" && typeof q.answer === "string")
        : [],
      weekly_riddle: parsed.weekly_riddle ?? "",
      weekly_riddle_answer: parsed.weekly_riddle_answer ?? "",
      activities: Array.isArray(parsed.activities) ? parsed.activities.map(String) : [],
      ...normalizeExtras(parsed),
    };
  });

/** Save a bulletin (insert new or update existing). */
export const saveBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      classId: z.string().uuid(),
      startDate: DateStr,
      endDate: DateStr,
      title: z.string().max(280),
      digest_summary: z.string().max(20000),
      study_points: z.array(z.string().max(500)).max(20),
      recap_questions: z
        .array(z.object({ question: z.string().max(500), answer: z.string().max(1000) }))
        .max(20),
      weekly_riddle: z.string().max(2000),
      weekly_riddle_answer: z.string().max(2000),
      activities: z.array(z.string().max(500)).max(20),
      notes: z.string().max(5000).default(""),
      torah_dvar_title: z.string().max(280).default(""),
      torah_dvar_body: z.string().max(20000).default(""),
      study_schedule: StudyScheduleSchema,
      honored_students: HonoredSchema,
      special_notices: NoticesSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const row = {
      class_id: data.classId,
      title: data.title,
      start_date: data.startDate,
      end_date: data.endDate,
      digest_summary: data.digest_summary,
      study_points: data.study_points,
      recap_questions: data.recap_questions,
      weekly_riddle: data.weekly_riddle,
      weekly_riddle_answer: data.weekly_riddle_answer,
      activities: data.activities,
      notes: data.notes,
      torah_dvar_title: data.torah_dvar_title,
      torah_dvar_body: data.torah_dvar_body,
      study_schedule: data.study_schedule,
      honored_students: data.honored_students,
      special_notices: data.special_notices,
    };
    if (data.id) {
      // Published bulletins are locked: the teacher must unlock before editing.
      const { data: current, error: readErr } = await context.supabase
        .from("weekly_bulletins").select("status").eq("id", data.id).maybeSingle();
      if (readErr) { console.error("[DB Error]", readErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
      if ((current as { status?: string } | null)?.status === "published") {
        throw new Error("העלון פורסם ונעול לעריכה — שחרר נעילה כדי לערוך");
      }
      const { error } = await context.supabase.from("weekly_bulletins").update(row).eq("id", data.id);
      if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("weekly_bulletins").insert(row).select("id").single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { id: ins!.id };
  });

/** Delete a bulletin. */
export const deleteBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("weekly_bulletins").delete().eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

/** Publish a bulletin — locks it for editing. */
export const publishBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("weekly_bulletins")
      .update({ status: "published", published_at: new Date().toISOString() } as never)
      .eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

/** Unlock a published bulletin, snapshotting the current state into version history. */
export const unpublishBulletin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error: readErr } = await context.supabase
      .from("weekly_bulletins")
      .select("title,digest_summary,study_points,recap_questions,weekly_riddle,weekly_riddle_answer,activities,notes,start_date,end_date,torah_dvar_title,torah_dvar_body,study_schedule,honored_students,special_notices")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) { console.error("[DB Error]", readErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!row) throw new Error("העלון לא נמצא");

    const { error: insErr } = await context.supabase
      .from("weekly_bulletin_versions")
      .insert({ bulletin_id: data.id, snapshot: row as never, created_by: context.userId } as never);
    if (insErr) { console.error("[DB Error]", insErr); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const { error } = await context.supabase
      .from("weekly_bulletins")
      .update({ status: "draft" } as never)
      .eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

/** List saved version snapshots of a bulletin (newest first). */
export const listBulletinVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bulletinId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<BulletinVersion[]> => {
    const { data: rows, error } = await context.supabase
      .from("weekly_bulletin_versions")
      .select("*")
      .eq("bulletin_id", data.bulletinId)
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return (rows ?? []) as unknown as BulletinVersion[];
  });