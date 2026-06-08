import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ParamValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const ActionSchema = z.object({
  kind: z.enum([
    "add_grade",
    "mark_attendance",
    "add_note",
    "add_behavior",
    "add_parent_call",
  ]),
  summary: z.string().max(280),
  params: z.record(z.string(), ParamValue),
});
export type AssistantAction = z.infer<typeof ActionSchema>;

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
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ answer: string; actions: AssistantAction[] }> => {
    const { supabase } = context;
    const since = new Date(); since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString().slice(0, 10);

    const [studentsRes, attRes, gradesRes, behRes, discRes] = await Promise.all([
      supabase.from("students").select("id,name,notes").eq("class_id", data.classId),
      supabase.from("attendance").select("student_id,date,status").eq("class_id", data.classId).gte("date", sinceIso),
      supabase.from("grades").select("student_id,subject,value,max_value,date").eq("class_id", data.classId).gte("date", sinceIso),
      supabase.from("behavior_points").select("student_id,category,points,date").eq("class_id", data.classId).gte("date", sinceIso),
      supabase.from("discipline_events").select("student_id,type,description,date").eq("class_id", data.classId).gte("date", sinceIso),
    ]);
    const err = studentsRes.error || attRes.error || gradesRes.error || behRes.error || discRes.error;
    if (err) throw new Error(err.message);

    const students = studentsRes.data ?? [];
    if (students.length === 0) throw new Error("אין תלמידים בכיתה זו");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("חסר LOVABLE_API_KEY");

    const ctxJson = JSON.stringify({
      today: todayIso(),
      students: students.map((s) => ({ id: s.id, name: s.name, notes: s.notes ?? "" })),
      attendance: attRes.data ?? [],
      grades: gradesRes.data ?? [],
      behavior: behRes.data ?? [],
      discipline: discRes.data ?? [],
    });

    const system = `אתה עוזר אישי של רב/מלמד בתלמוד תורה. השב בעברית קצר וברור.
הקלט: שאלה/בקשה חופשית של הרב + הקשר מלא של הכיתה ב-30 ימים האחרונים.
המטרה: או לענות על שאלה (ניתוח, סיכום, חיפוש), או להציע פעולות כתיבה לאישור הרב.

פעולות אפשריות (kind):
- add_grade: { student_id, subject, value, max_value (ברירת מחדל 100), notes?, date? (YYYY-MM-DD, ברירת מחדל היום) }
- mark_attendance: { student_id, status: "present"|"absent"|"late"|"excused", date?, notes? }
- add_note: { student_id, description, type?: "positive"|"negative"|"neutral" (ברירת מחדל neutral), category?: string }
- add_behavior: { student_id, points (1-5, שלילי = הורדה), category?: string, note? }
- add_parent_call: { student_id, summary, subject?, channel?: "phone"|"meeting"|"whatsapp"|"email", date? }

חוקים:
1. תמיד התאם שם תלמיד מהטקסט ל-student_id מהרשימה (זיהוי גם בשיבוש קל).
2. אם הבקשה היא שאלה בלבד — answer מפורט, actions=[].
3. אם הבקשה היא פעולה — answer קצר ("הוספתי 3 פעולות לאישור"), actions עם הפעולות.
4. summary של כל פעולה צריך להיות משפט אחד בעברית שהרב יבין מיד.
5. אל תמציא נתונים שאינם בהקשר.

החזר רק JSON: {"answer":"...","actions":[{"kind":"...","summary":"...","params":{...}}]}`;

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
          { role: "user", content: `הקשר הכיתה (JSON):\n${ctxJson}\n\nבקשת הרב:\n${data.text}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) throw new Error("חרגת ממכסת בקשות AI. נסה שוב בעוד דקה.");
    if (resp.status === 402) throw new Error("נגמרו קרדיטים ב-Lovable AI.");
    if (!resp.ok) throw new Error(`שגיאת AI: ${resp.status}`);

    const j = await resp.json() as { choices?: { message?: { content?: string } }[] };
    const raw = j.choices?.[0]?.message?.content ?? "{}";
    let parsed: { answer?: string; actions?: unknown[] } = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }

    const actions: AssistantAction[] = [];
    for (const a of parsed.actions ?? []) {
      const r = ActionSchema.safeParse(a);
      if (r.success) actions.push(r.data);
    }
    return { answer: parsed.answer ?? "(אין תשובה)", actions };
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
    const sidRaw = String(params.student_id ?? "");
    const sidParsed = z.string().uuid().safeParse(sidRaw);
    if (!sidParsed.success) throw new Error("מזהה תלמיד לא תקין");
    const sid = sidParsed.data;

    // Verify the student belongs to the provided class
    const { data: studentRow, error: studentErr } = await supabase
      .from("students").select("id").eq("id", sid).eq("class_id", data.classId).maybeSingle();
    if (studentErr) { console.error("[DB Error]", studentErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!studentRow) throw new Error("התלמיד אינו שייך לכיתה זו");

    const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    const safeDate = (v: unknown): string => {
      const r = dateSchema.safeParse(String(v ?? ""));
      return r.success ? r.data : todayIso();
    };

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
    } else if (kind === "add_behavior") {
      const points = Number(params.points ?? 1);
      if (!Number.isFinite(points) || points < -10 || points > 10) throw new Error("ערך התנהגות לא תקין");
      const { error } = await supabase.from("behavior_points").insert({
        class_id: data.classId,
        student_id: sid,
        category: String(params.category ?? "participation").slice(0, 80),
        points,
        note: String(params.note ?? "").slice(0, 1000),
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
    }
    return { ok: true };
  });