import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { portfolioKindLabel, type PortfolioKind } from "@/lib/portfolio.functions";

/** Resolve the caller-owned student row and its stable person_key (RLS scoped). */
async function resolveStudent(supabase: { from: (t: string) => any }, studentId: string) {
  const { data, error } = await supabase
    .from("students")
    .select("id, name, class_id, person_key, start_date")
    .eq("id", studentId)
    .maybeSingle();
  if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
  if (!data) throw new Error("התלמיד לא נמצא");
  return data as {
    id: string; name: string; class_id: string; person_key: string; start_date: string | null;
  };
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");

/** תקציר התלמיד: תאריך-החלוף, תאריך אישור, תקציר AI וניתוח מגמות. */
export const getStudentSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const student = await resolveStudent(context.supabase as never, data.studentId);
    const { data: row, error } = await context.supabase
      .from("student_summaries")
      .select("*")
      .eq("person_key", student.person_key)
      .maybeSingle();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    const r = row as {
      id?: string; start_date?: string | null; approved_at?: string | null;
      ai_summary?: string | null; trends?: string | null;
    } | null;
    return {
      studentName: student.name,
      personKey: student.person_key,
      /** ברירת המחדל לתאריך-החלוף היא זו של רשומת התלמיד. */
      summary: {
        id: r?.id ?? null,
        person_key: student.person_key,
        start_date: r ? (r.start_date ?? null) : student.start_date,
        approved_at: r?.approved_at ?? null,
        ai_summary: r?.ai_summary ?? "",
        trends: r?.trends ?? "",
      },
    };

  });

/** שמירת תאריך-החלוף בתקציר התלמיד (ריק = ללא תאריך). */
export const setStudentSummaryStartDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      studentId: z.string().uuid(),
      startDate: z.union([isoDate, z.literal("")]).nullable().default(null),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const student = await resolveStudent(context.supabase as never, data.studentId);
    const start_date = data.startDate ? data.startDate : null;
    const { error } = await context.supabase
      .from("student_summaries")
      .upsert(
        {
          user_id: context.userId,
          person_key: student.person_key,
          student_id: student.id,
          class_id: student.class_id,
          start_date,
        },
        { onConflict: "user_id,person_key" },
      );
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true, start_date };
  });

/** אישור התקציר (או ביטול האישור) — נשמר כתאריך אישור. */
export const approveStudentSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ studentId: z.string().uuid(), approved: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const student = await resolveStudent(context.supabase as never, data.studentId);
    const approved_at = data.approved ? new Date().toISOString() : null;
    const { error } = await context.supabase
      .from("student_summaries")
      .upsert(
        {
          user_id: context.userId,
          person_key: student.person_key,
          student_id: student.id,
          class_id: student.class_id,
          approved_at,
        },
        { onConflict: "user_id,person_key" },
      );
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true, approved_at };
  });

/**
 * הפקת תקציר AI וניתוח מגמות לתלמיד, על בסיס פריטי התיק הרב-שנתי,
 * התובנות היומיות, הנוכחות, הציונים וסיכומי הפגישות — רק דרך RLS של המשתמש.
 */
export const generateStudentSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const student = await resolveStudent(context.supabase as never, data.studentId);

    const { data: siblings } = await context.supabase
      .from("students")
      .select("id")
      .eq("person_key", student.person_key);
    const studentIds = Array.from(
      new Set([...(siblings ?? []).map((s) => s.id as string), student.id]),
    );

    const [items, insights, attendance, grades, meetings] = await Promise.all([
      context.supabase
        .from("student_portfolio_items")
        .select("kind, title, description, item_date, school_year, ai_summary, approved_at")
        .eq("person_key", student.person_key)
        .order("item_date", { ascending: false })
        .limit(30),
      context.supabase
        .from("orchestrator_insights")
        .select("insight_type, severity, title, description, suggested_action, insight_date")
        .in("student_id", studentIds)
        .eq("is_dismissed", false)
        .order("insight_date", { ascending: false })
        .limit(30),
      context.supabase
        .from("attendance")
        .select("date, status")
        .in("student_id", studentIds)
        .order("date", { ascending: false })
        .limit(60),
      context.supabase
        .from("grades")
        .select("date, subject, value, max_value")
        .in("student_id", studentIds)
        .order("date", { ascending: false })
        .limit(40),
      context.supabase
        .from("teacher_meetings")
        .select("meeting_date, summary, action_items, follow_up_date")
        .order("meeting_date", { ascending: false })
        .limit(10),
    ]);
    for (const r of [items, insights, attendance, grades, meetings]) {
      if (r.error) console.error("[DB Error]", r.error);
    }

    const cut = (s: string | null | undefined, n = 240) => (s ? String(s).slice(0, n) : "—");
    const label = (k: string) => portfolioKindLabel[k as PortfolioKind] ?? k;

    const itemsBlock = (items.data ?? [])
      .map((i) => `- [${label(i.kind)}] ${i.item_date} · ${i.title}: ${cut(i.description)}${i.approved_at ? " | אושר" : ""}`)
      .join("\n") || "אין פריטים בתיק.";
    const insightsBlock = (insights.data ?? [])
      .map((i) => `- ${i.insight_date} · ${i.insight_type} (${i.severity}): ${i.title} — ${cut(i.description)}`)
      .join("\n") || "אין תובנות פעילות.";
    const attBlock = (() => {
      const rows = attendance.data ?? [];
      if (rows.length === 0) return "אין נתוני נוכחות.";
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.status as string] = (counts[r.status as string] ?? 0) + 1;
      return `סך רשומות: ${rows.length} · ` +
        Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(", ");
    })();
    const gradesBlock = (grades.data ?? [])
      .map((g) => `- ${g.date} · ${g.subject ?? "כללי"}: ${g.value}/${g.max_value}`)
      .join("\n") || "אין ציונים.";
    const meetingsBlock = (meetings.data ?? [])
      .map((m) => `- ${m.meeting_date}: ${cut(m.summary, 300)}${m.action_items ? ` | מטלות: ${cut(m.action_items, 160)}` : ""}`)
      .join("\n") || "אין סיכומי פגישות.";

    let text = "";
    try {
      const { callLovableAI } = await import("@/lib/ai-gateway.server");
      text = await callLovableAI({
        messages: [
          {
            role: "system",
            content:
              "אתה עוזר פדגוגי בתלמוד תורה. כתוב בעברית שני חלקים, בדיוק במבנה הזה:\n" +
              "===תקציר===\n(3-5 שורות תקציר על התלמיד)\n" +
              "===מגמות===\nמגמת נוכחות:\nמגמת ציונים:\nמגמה התנהגותית ולימודית:\nחוזקות:\nנקודות לחיזוק:\nהמשך מוצע:\n" +
              "השתמש רק בנתונים שקיבלת ואל תמציא עובדות. אם אין נתונים לסעיף — כתוב 'אין נתונים'. עד 300 מילים.",
          },
          {
            role: "user",
            content:
              `תלמיד: ${student.name}\nתאריך-החלוף: ${student.start_date ?? "—"}\n\n` +
              `פריטי תיק:\n${itemsBlock}\n\nתובנות:\n${insightsBlock}\n\n` +
              `נוכחות:\n${attBlock}\n\nציונים:\n${gradesBlock}\n\nפגישות 1:1:\n${meetingsBlock}`,
          },
        ],
      });
    } catch (e) {
      console.error("[AI Error]", e);
      throw new Error("הפקת התקציר נכשלה. נסה שוב בעוד רגע.");
    }

    const parts = text.split("===מגמות===");
    const ai_summary = (parts[0] ?? "").replace("===תקציר===", "").trim().slice(0, 2000);
    const trends = (parts[1] ?? "").trim().slice(0, 2000) || text.trim().slice(0, 2000);

    const { error } = await context.supabase
      .from("student_summaries")
      .upsert(
        {
          user_id: context.userId,
          person_key: student.person_key,
          student_id: student.id,
          class_id: student.class_id,
          ai_summary,
          trends,
          ...(student.start_date ? { start_date: student.start_date } : {}),
        },
        { onConflict: "user_id,person_key" },
      );
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    return {
      ai_summary,
      trends,
      sources: {
        items: (items.data ?? []).length,
        insights: (insights.data ?? []).length,
        attendance: (attendance.data ?? []).length,
        grades: (grades.data ?? []).length,
        meetings: (meetings.data ?? []).length,
      },
    };
  });
