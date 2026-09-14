import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PORTFOLIO_KINDS = ["achievement", "difficulty", "assessment", "milestone", "note"] as const;
export type PortfolioKind = (typeof PORTFOLIO_KINDS)[number];

export const portfolioKindLabel: Record<PortfolioKind, string> = {
  achievement: "הישג",
  difficulty: "קושי",
  assessment: "אבחון",
  milestone: "ציון דרך",
  note: "הערה",
};

const kindEnum = z.enum(PORTFOLIO_KINDS);

/** Resolve the stable person_key of a student row the caller owns (RLS scoped). */
async function resolveStudent(
  supabase: { from: (t: string) => any },
  studentId: string,
) {
  const { data, error } = await supabase
    .from("students")
    .select("id, name, class_id, person_key")
    .eq("id", studentId)
    .maybeSingle();
  if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
  if (!data) throw new Error("התלמיד לא נמצא");
  return data as { id: string; name: string; class_id: string; person_key: string };
}

/**
 * Multi-year portfolio for a student: every item recorded under the same
 * person_key, plus the chain of class rows this person appears in.
 */
export const getStudentPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const student = await resolveStudent(context.supabase as never, data.studentId);

    const [items, siblings] = await Promise.all([
      context.supabase
        .from("student_portfolio_items")
        .select("*")
        .eq("person_key", student.person_key)
        .order("item_date", { ascending: false }),
      context.supabase
        .from("students")
        .select("id, class_id, created_at")
        .eq("person_key", student.person_key),
    ]);
    if (items.error) console.error("[DB Error]", items.error);
    if (siblings.error) console.error("[DB Error]", siblings.error);

    const classIds = Array.from(
      new Set([
        ...(siblings.data ?? []).map((s) => s.class_id),
        ...(items.data ?? []).map((i) => i.class_id).filter(Boolean),
      ]),
    ) as string[];

    let classMap: Record<string, { name: string; academic_year: string | null }> = {};
    if (classIds.length > 0) {
      const { data: classes, error } = await context.supabase
        .from("classes")
        .select("id, name, academic_year")
        .in("id", classIds);
      if (error) console.error("[DB Error]", error);
      classMap = Object.fromEntries(
        (classes ?? []).map((c) => [c.id, { name: c.name, academic_year: c.academic_year ?? null }]),
      );
    }

    const timeline = (siblings.data ?? [])
      .map((s) => ({
        studentId: s.id,
        classId: s.class_id,
        className: classMap[s.class_id]?.name ?? "כיתה",
        academicYear: classMap[s.class_id]?.academic_year ?? null,
        createdAt: s.created_at as string,
        isCurrent: s.id === student.id,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return {
      personKey: student.person_key,
      studentName: student.name,
      timeline,
      items: (items.data ?? []).map((i) => ({
        ...i,
        className: i.class_id ? (classMap[i.class_id]?.name ?? null) : null,
      })),
    };
  });

export const addPortfolioItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      studentId: z.string().uuid(),
      kind: kindEnum.default("note"),
      title: z.string().trim().min(1).max(150),
      description: z.string().max(2000).optional().default(""),
      school_year: z.string().trim().max(30).nullable().optional(),
      item_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין").optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const student = await resolveStudent(context.supabase as never, data.studentId);
    const { data: row, error } = await context.supabase
      .from("student_portfolio_items")
      .insert({
        user_id: context.userId,
        person_key: student.person_key,
        student_id: student.id,
        class_id: student.class_id,
        kind: data.kind,
        title: data.title,
        description: data.description ?? "",
        school_year: data.school_year || null,
        ...(data.item_date ? { item_date: data.item_date } : {}),
      })
      .select("id")
      .single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return row;
  });

export const deletePortfolioItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("student_portfolio_items")
      .delete()
      .eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

/** אישור פריט בתיק — שומר את תאריך האישור, או מבטל אותו. */
export const approvePortfolioItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), approved: z.boolean().default(true) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("student_portfolio_items")
      .update({ approved_at: data.approved ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });

/**
 * ניתוח AI מפורט לפריט בתיק התלמיד: מצרף לפריט עצמו את שאר פריטי התיק
 * (רב-שנתי לפי person_key), את התובנות היומיות של התלמיד, ואת סיכומי
 * פגישות ה-1:1 של המלמד באותה תקופה. הכל דרך RLS של המשתמש בלבד.
 */
export const summarizePortfolioItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: item, error } = await context.supabase
      .from("student_portfolio_items")
      .select("id, kind, title, description, school_year, item_date, person_key, student_id, class_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!item) throw new Error("הפריט לא נמצא");

    // כל מופעי התלמיד (שנים שונות) לפי המזהה היציב
    const { data: siblings } = await context.supabase
      .from("students")
      .select("id, name")
      .eq("person_key", item.person_key);
    const studentIds = Array.from(
      new Set([...(siblings ?? []).map((s) => s.id), item.student_id].filter(Boolean)),
    ) as string[];
    const studentName = (siblings ?? [])[0]?.name ?? "התלמיד";

    const [others, insights, meetings] = await Promise.all([
      context.supabase
        .from("student_portfolio_items")
        .select("kind, title, description, item_date, school_year, ai_summary, approved_at")
        .eq("person_key", item.person_key)
        .neq("id", item.id)
        .order("item_date", { ascending: false })
        .limit(20),
      studentIds.length
        ? context.supabase
            .from("orchestrator_insights")
            .select("insight_type, severity, title, description, suggested_action, insight_date")
            .in("student_id", studentIds)
            .eq("is_dismissed", false)
            .order("insight_date", { ascending: false })
            .limit(25)
        : Promise.resolve({ data: [], error: null } as never),
      context.supabase
        .from("teacher_meetings")
        .select("meeting_date, summary, action_items, follow_up_date")
        .order("meeting_date", { ascending: false })
        .limit(10),
    ]);
    if (others.error) console.error("[DB Error]", others.error);
    if (insights.error) console.error("[DB Error]", insights.error);
    if (meetings.error) console.error("[DB Error]", meetings.error);

    const kindLabel = (k: string) => portfolioKindLabel[k as PortfolioKind] ?? k;
    const cut = (s: string | null, n = 400) => (s ? s.slice(0, n) : "—");

    const itemsBlock = (others.data ?? [])
      .map(
        (o) =>
          `- [${kindLabel(o.kind)}] ${o.item_date} · ${o.title}: ${cut(o.description, 220)}` +
          (o.ai_summary ? ` | תקציר קודם: ${cut(o.ai_summary, 220)}` : "") +
          (o.approved_at ? " | אושר" : ""),
      )
      .join("\n") || "אין פריטים נוספים בתיק.";

    const insightsBlock = (insights.data ?? [])
      .map(
        (i) =>
          `- ${i.insight_date} · ${i.insight_type} (${i.severity}): ${i.title} — ${cut(i.description, 220)}` +
          (i.suggested_action ? ` | המשך מוצע: ${cut(i.suggested_action, 160)}` : ""),
      )
      .join("\n") || "אין תובנות פעילות לתלמיד.";

    const meetingsBlock = (meetings.data ?? [])
      .map(
        (m) =>
          `- ${m.meeting_date}: ${cut(m.summary, 300)}` +
          (m.action_items ? ` | מטלות: ${cut(m.action_items, 200)}` : "") +
          (m.follow_up_date ? ` | מעקב: ${m.follow_up_date}` : ""),
      )
      .join("\n") || "אין סיכומי פגישות זמינים.";

    let summary = "";
    try {
      const { callLovableAI } = await import("@/lib/ai-gateway.server");
      summary = await callLovableAI({
        messages: [
          {
            role: "system",
            content:
              "אתה עוזר פדגוגי בתלמוד תורה. כתוב ניתוח מפורט בעברית לפריט בתיק התלמיד, " +
              "במבנה הבא בדיוק, כל כותרת בשורה נפרדת ותחתיה 1-3 שורות:\n" +
              "תמונת מצב:\nמגמות מהתובנות:\nמה עלה בפגישות:\nחוזקות:\nנקודות לחיזוק:\nהמשך מוצע:\n" +
              "השתמש רק בנתונים שקיבלת ואל תמציא עובדות. אם אין נתונים לסעיף — כתוב 'אין נתונים'. " +
              "עד 250 מילים בסך הכל.",
          },
          {
            role: "user",
            content:
              `תלמיד: ${studentName}\n\n` +
              `הפריט הנבחן:\nסוג: ${kindLabel(item.kind)}\nכותרת: ${item.title}\n` +
              `פירוט: ${cut(item.description, 800)}\nשנה: ${item.school_year || "—"}\nתאריך: ${item.item_date}\n\n` +
              `פריטים נוספים בתיק (רב-שנתי):\n${itemsBlock}\n\n` +
              `תובנות יומיות של התלמיד:\n${insightsBlock}\n\n` +
              `סיכומי פגישות 1:1 של המלמד:\n${meetingsBlock}`,
          },
        ],
      });
    } catch (e) {
      console.error("[AI Error]", e);
      throw new Error("הפקת התקציר נכשלה. נסה שוב בעוד רגע.");
    }

    const trimmed = summary.trim().slice(0, 2000);
    const { error: upErr } = await context.supabase
      .from("student_portfolio_items")
      .update({ ai_summary: trimmed })
      .eq("id", data.id);
    if (upErr) { console.error("[DB Error]", upErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return {
      summary: trimmed,
      sources: {
        items: (others.data ?? []).length,
        insights: (insights.data ?? []).length,
        meetings: (meetings.data ?? []).length,
      },
    };
  });
