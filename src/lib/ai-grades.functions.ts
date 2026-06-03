import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ParsedGrade = z.object({
  student_name: z.string(),
  student_id: z.string().uuid().nullable().optional(),
  subject: z.string().default(""),
  value: z.number(),
  max_value: z.number().positive().default(100),
  notes: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0.8),
});

export type ParsedGradeRow = z.infer<typeof ParsedGrade> & { matched: boolean };

/**
 * Parses free text describing test results / grades for many students
 * and matches them to the class's student list using Lovable AI.
 */
export const parseGradesFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      text: z.string().min(2).max(8000),
      defaultSubject: z.string().max(80).optional().default(""),
      defaultMax: z.number().positive().max(1000).optional().default(100),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ rows: ParsedGradeRow[]; raw: string }> => {
    const { supabase } = context;
    const { data: students, error } = await supabase
      .from("students").select("id,name").eq("class_id", data.classId);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!students || students.length === 0) throw new Error("אין תלמידים בכיתה");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("חסר מפתח LOVABLE_API_KEY");

    const studentList = students.map((s) => `- ${s.name} [id:${s.id}]`).join("\n");
    const system = `אתה עוזר של רב/מלמד בתלמוד תורה. קלט: טקסט חופשי בעברית עם ציוני מבחן/בחינה לתלמידים.
המטרה: לחלץ רשימת ציונים מובנית. תמיד התאם כל ציון לתלמיד מהרשימה הנתונה.
אם השם בטקסט שונה מעט (כינוי, ר"ת, שיבוש קל) — בחר את ההתאמה הטובה ביותר מתוך הרשימה והחזר את ה-id המתאים.
אם אין התאמה ודאית — החזר student_id: null.
מקצוע ברירת מחדל: "${data.defaultSubject}". ציון מקסימלי ברירת מחדל: ${data.defaultMax}.
החזר רק JSON בפורמט: {"grades":[{"student_name":"...","student_id":"uuid או null","subject":"...","value":0,"max_value":100,"notes":"","confidence":0.0-1.0}]}`;

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `רשימת תלמידי הכיתה:\n${studentList}\n\nטקסט הציונים:\n${data.text}` },
      ],
      response_format: { type: "json_object" },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify(body),
    });

    if (resp.status === 429) throw new Error("חרגת ממכסת בקשות AI. נסה שוב בעוד דקה.");
    if (resp.status === 402) throw new Error("נגמרו קרדיטים ב-Lovable AI. הוסף קרדיטים בהגדרות.");
    if (!resp.ok) {
      console.error("[AI Gateway Error]", resp.status, await resp.text());
      throw new Error(`שגיאת AI: ${resp.status}`);
    }

    const json = await resp.json() as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "{}";

    let parsed: { grades?: unknown[] } = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const arr = Array.isArray(parsed.grades) ? parsed.grades : [];

    const studentById = new Map(students.map((s) => [s.id, s.name]));
    const rows: ParsedGradeRow[] = [];
    for (const item of arr) {
      const r = ParsedGrade.safeParse(item);
      if (!r.success) continue;
      const valid = r.data.student_id && studentById.has(r.data.student_id);
      rows.push({
        ...r.data,
        student_id: valid ? r.data.student_id! : null,
        matched: !!valid,
      });
    }
    return { rows, raw };
  });

/** Save reviewed AI-parsed grades in bulk. */
export const bulkInsertGrades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      class_id: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      rows: z.array(z.object({
        student_id: z.string().uuid(),
        subject: z.string().max(80).default(""),
        value: z.number(),
        max_value: z.number().positive().default(100),
        notes: z.string().max(500).optional().default(""),
      })).min(1).max(100),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = data.rows.map((r) => ({
      class_id: data.class_id,
      date: data.date,
      student_id: r.student_id,
      subject: r.subject,
      value: r.value,
      max_value: r.max_value,
      notes: r.notes,
    }));
    const { error } = await context.supabase.from("grades").insert(payload);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true, count: payload.length };
  });