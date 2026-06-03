import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export type QuizQuestion = { question: string; answer: string };
export type BulletinDraft = {
  title: string;
  digest_summary: string;
  study_points: string[];
  recap_questions: QuizQuestion[];
  weekly_riddle: string;
  weekly_riddle_answer: string;
  activities: string[];
};

export type StoredBulletin = BulletinDraft & {
  id: string;
  class_id: string;
  start_date: string;
  end_date: string;
  notes: string;
  created_at: string;
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

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("חסר LOVABLE_API_KEY");

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

החזר אך ורק JSON תקין בפורמט הזה:
{"title":"","digest_summary":"","study_points":[],"recap_questions":[{"question":"","answer":""}],"weekly_riddle":"","weekly_riddle_answer":"","activities":[]}`;

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
          { role: "user", content: `נתוני הכיתה (JSON):\n${ctx}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) throw new Error("חרגת ממכסת בקשות AI. נסה שוב בעוד דקה.");
    if (resp.status === 402) throw new Error("נגמרו קרדיטים ב-Lovable AI.");
    if (!resp.ok) throw new Error(`שגיאת AI: ${resp.status}`);

    const j = await resp.json() as { choices?: { message?: { content?: string } }[] };
    const raw = j.choices?.[0]?.message?.content ?? "{}";
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
      digest_summary: z.string(),
      study_points: z.array(z.string()),
      recap_questions: z.array(z.object({ question: z.string(), answer: z.string() })),
      weekly_riddle: z.string(),
      weekly_riddle_answer: z.string(),
      activities: z.array(z.string()),
      notes: z.string().default(""),
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
    };
    if (data.id) {
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