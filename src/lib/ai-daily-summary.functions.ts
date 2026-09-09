import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

/**
 * הצעת תקציר יומי אוטומטי לתלמיד: מקבצת את הנוכחות, הציון והתובנה של היום
 * (הקיימים במערכת + מה שהוקלד עכשיו) ומחזירה כותרת ופירוט קצרים בעברית.
 * התקציר נשמר כתובנה יומית — ולכן מופיע גם בדוח התיעוד היומי.
 */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");

const STATUS_LABEL: Record<string, string> = {
  present: "נוכח",
  absent: "נעדר",
  late: "איחור",
  excused: "חיסור מאושר",
};

export type DailySummarySuggestion = { title: string; description: string };

export const suggestStudentDailySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        studentId: z.string().uuid(),
        date: isoDate,
        draft: z
          .object({
            status: z.string().max(20).optional().default(""),
            attendanceNotes: z.string().max(500).optional().default(""),
            subject: z.string().max(60).optional().default(""),
            value: z.number().nullable().optional(),
            maxValue: z.number().positive().optional().default(100),
            note: z.string().max(2000).optional().default(""),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<DailySummarySuggestion> => {
    const supabase = context.supabase as any;

    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("id,name,class_id,classes!inner(owner_id,name)")
      .eq("id", data.studentId)
      .maybeSingle();
    if (sErr) {
      console.error("[DB Error]", sErr);
      throw new Error("בדיקת ההרשאות נכשלה.");
    }
    if (!student || student.classes?.owner_id !== context.userId) {
      throw new Error("התלמיד לא נמצא");
    }

    const [att, grades, insights] = await Promise.all([
      supabase
        .from("attendance")
        .select("status,notes")
        .eq("student_id", data.studentId)
        .eq("date", data.date)
        .maybeSingle(),
      supabase
        .from("grades")
        .select("subject,value,max_value")
        .eq("student_id", data.studentId)
        .eq("date", data.date),
      supabase
        .from("orchestrator_insights")
        .select("title,description,severity")
        .eq("student_id", data.studentId)
        .eq("insight_date", data.date),
    ]);
    for (const r of [att, grades, insights]) {
      if (r.error) {
        console.error("[DB Error]", r.error);
        throw new Error("טעינת נתוני היום נכשלה.");
      }
    }

    const draft = data.draft;
    const facts: string[] = [];
    const status = draft?.status || att.data?.status || "";
    if (status) facts.push(`נוכחות: ${STATUS_LABEL[status] ?? status}`);
    const attNote = draft?.attendanceNotes || att.data?.notes || "";
    if (attNote) facts.push(`הערת נוכחות: ${attNote}`);
    if (draft?.value !== null && draft?.value !== undefined) {
      facts.push(
        `ציון שהוקלד: ${draft.value}/${draft.maxValue ?? 100}${draft.subject ? ` ב${draft.subject}` : ""}`,
      );
    }
    for (const g of (grades.data ?? []) as any[]) {
      facts.push(`ציון רשום: ${Number(g.value)}/${Number(g.max_value) || 100} ${g.subject ?? ""}`.trim());
    }
    if (draft?.note) facts.push(`הערת המלמד: ${draft.note}`);
    for (const i of (insights.data ?? []) as any[]) {
      facts.push(`תובנה רשומה: ${i.title}${i.description ? ` — ${i.description}` : ""}`);
    }

    if (facts.length === 0) {
      throw new Error("אין נתונים ליום זה — מלא נוכחות, ציון או הערה ואז בקש תקציר.");
    }

    const raw = await callLovableAI({
      jsonResponse: true,
      messages: [
        {
          role: "system",
          content: `אתה עוזר למלמד בתלמוד תורה לנסח תיעוד יומי קצר בעברית תקנית.
נסח על בסיס הנתונים בלבד — בלי להמציא עובדות, ציונים או אירועים.
טון ענייני, מכבד ומעודד. פנה אל התלמיד בגוף שלישי.
החזר JSON בלבד: {"title":"כותרת עד 8 מילים","description":"2-3 משפטים על הנוכחות, הציון וההתקדמות"}`,
        },
        {
          role: "user",
          content: `תלמיד: ${student.name}
כיתה: ${student.classes?.name ?? ""}
תאריך: ${data.date}
נתוני היום:
${facts.map((f) => `- ${f}`).join("\n")}`,
        },
      ],
    });

    let parsed: { title?: unknown; description?: unknown } = {};
    try {
      parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "")) as typeof parsed;
    } catch {
      throw new Error("ניסוח התקציר נכשל. נסה שוב.");
    }
    const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, 200) : "";
    const description =
      typeof parsed.description === "string" ? parsed.description.trim().slice(0, 2000) : "";
    if (!title) throw new Error("ניסוח התקציר נכשל. נסה שוב.");
    return { title, description };
  });
