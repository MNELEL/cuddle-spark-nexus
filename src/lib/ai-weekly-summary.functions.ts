import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "@/lib/ai-gateway.server";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const summarySchema = z.object({
  classId: z.string().uuid(),
  weekStart: dateStr,
  weekEnd: dateStr,
});

const HEBREW_DAY: Record<string, string> = {
  sun: "יום א׳",
  mon: "יום ב׳",
  tue: "יום ג׳",
  wed: "יום ד׳",
  thu: "יום ה׳",
  fri: "יום ו׳",
  sat: "שבת",
};

type WeeklyCounts = {
  events: number;
  lessons: number;
  behaviorPositive: number;
  behaviorNegative: number;
  absences: number;
};

type WeeklyContext = {
  weekStart: string;
  weekEnd: string;
  counts: WeeklyCounts;
  events: { title: string; type: string; date: string }[];
  lessons: { title: string; subject: string | null; day_key: string | null }[];
};

/**
 * Builds a real, data-driven Hebrew weekly summary without any AI call.
 * Used whenever callLovableAI fails or returns nothing, so the teacher
 * always gets a genuine summary instead of a dead-end error string.
 */
function buildDeterministicWeeklySummary(ctx: WeeklyContext): string {
  const { counts, events, lessons } = ctx;
  const lines: string[] = [];

  const openingParts: string[] = [];
  if (counts.events > 0) openingParts.push(`${counts.events} אירועים`);
  if (counts.lessons > 0) openingParts.push(`${counts.lessons} שיעורים מתוכננים`);
  lines.push(
    openingParts.length
      ? `השבוע (${ctx.weekStart} עד ${ctx.weekEnd}) כלל ${openingParts.join(" ו-")}.`
      : `השבוע (${ctx.weekStart} עד ${ctx.weekEnd}) עבר בשגרה, ללא אירועים או שיעורים מיוחדים שתועדו.`,
  );
  lines.push("");

  if (events.length > 0) {
    lines.push("**אירועים בולטים**");
    for (const e of events.slice(0, 8)) {
      lines.push(`- ${e.title} (${e.type}, ${e.date})`);
    }
    lines.push("");
  }

  if (lessons.length > 0) {
    lines.push("**שיעורים השבוע**");
    for (const l of lessons.slice(0, 8)) {
      const dayLabel = l.day_key ? (HEBREW_DAY[l.day_key] ?? l.day_key) : "";
      lines.push(`- ${dayLabel ? `${dayLabel}: ` : ""}${l.title}${l.subject ? ` (${l.subject})` : ""}`);
    }
    lines.push("");
  }

  const attentionPoints: string[] = [];
  const netBehavior = counts.behaviorPositive - counts.behaviorNegative;
  if (counts.behaviorPositive > 0 || counts.behaviorNegative > 0) {
    if (netBehavior > 0) {
      attentionPoints.push(`מגמה התנהגותית חיובית השבוע — ${counts.behaviorPositive} נקודות זכות מול ${counts.behaviorNegative} נקודות חובה.`);
    } else if (netBehavior < 0) {
      attentionPoints.push(`יש לשים לב למגמה ההתנהגותית — ${counts.behaviorNegative} נקודות חובה מול ${counts.behaviorPositive} נקודות זכות בלבד.`);
    } else {
      attentionPoints.push(`איזון בין נקודות זכות לחובה השבוע (${counts.behaviorPositive} מול ${counts.behaviorNegative}).`);
    }
  }
  if (counts.absences > 0) {
    attentionPoints.push(`תועדו ${counts.absences} חיסורים השבוע.`);
  }
  if (attentionPoints.length > 0) {
    lines.push("**נקודות לתשומת לב**");
    for (const p of attentionPoints) lines.push(`- ${p}`);
    lines.push("");
  }

  lines.push("**מבט קדימה**");
  if (netBehavior < 0) {
    lines.push("כדאי להמשיך לעקוב אחר המגמה ההתנהגותית ולשקול שיחה אישית עם התלמידים הרלוונטיים בשבוע הבא.");
  } else if (counts.absences > 2) {
    lines.push("מומלץ לבדוק עם ההורים את סיבת החיסורים המרובים ולוודא המשך רצף לימודי.");
  } else {
    lines.push("מומלץ להמשיך באותה מגמה בשבוע הקרוב.");
  }

  return lines.join("\n");
}

export const buildWeeklySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => summarySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { classId, weekStart, weekEnd } = data;

    const [eventsRes, lessonsRes, behaviorRes, attendanceRes] = await Promise.all([
      context.supabase
        .from("class_events")
        .select("id,title,type,date")
        .eq("class_id", classId)
        .gte("date", weekStart)
        .lte("date", weekEnd)
        .order("date", { ascending: true }),
      context.supabase
        .from("weekly_lessons")
        .select("id,title,subject,day_key,hour")
        .eq("class_id", classId)
        .eq("week_start", weekStart),
      context.supabase
        .from("behavior_points")
        .select("points,note,date")
        .eq("class_id", classId)
        .gte("date", weekStart)
        .lte("date", weekEnd),
      context.supabase
        .from("attendance")
        .select("status,date")
        .eq("class_id", classId)
        .gte("date", weekStart)
        .lte("date", weekEnd),
    ]);

    if (eventsRes.error) {
      console.error("[weekly summary events]", eventsRes.error);
      throw new Error("טעינת אירועים נכשלה.");
    }
    if (lessonsRes.error) {
      console.error("[weekly summary lessons]", lessonsRes.error);
      throw new Error("טעינת שיעורים נכשלה.");
    }
    if (behaviorRes.error) {
      console.error("[weekly summary behavior]", behaviorRes.error);
      throw new Error("טעינת נקודות התנהגות נכשלה.");
    }
    if (attendanceRes.error) {
      console.error("[weekly summary attendance]", attendanceRes.error);
      throw new Error("טעינת נוכחות נכשלה.");
    }

    const events = eventsRes.data ?? [];
    const lessons = lessonsRes.data ?? [];
    const behaviors = behaviorRes.data ?? [];
    const attendance = attendanceRes.data ?? [];

    const behaviorPositive = behaviors.reduce((sum, b) => sum + Math.max(0, b.points ?? 0), 0);
    const behaviorNegative = Math.abs(behaviors.reduce((sum, b) => sum + Math.min(0, b.points ?? 0), 0));
    const absences = attendance.filter((a) => a.status === "absent").length;

    const counts: WeeklyCounts = {
      events: events.length,
      lessons: lessons.length,
      behaviorPositive,
      behaviorNegative,
      absences,
    };

    const weeklyContext: WeeklyContext = { weekStart, weekEnd, counts, events, lessons };

    let summary: string;

    try {
      const lessonsText = lessons.length
        ? lessons.map((l) => `- ${HEBREW_DAY[l.day_key ?? ""] ?? l.day_key}: ${l.title}${l.subject ? ` (${l.subject})` : ""}`).join("\n")
        : "אין שיעורים מתוכננים.";

      const eventsText = events.length
        ? events.map((e) => `- ${e.date} (${e.type}): ${e.title}`).join("\n")
        : "אין אירועים מיוחדים.";

      const prompt = `אתה עוזר מנהל כיתה חרדי. סכם בקצרה את השבוע הכיתתי בין ${weekStart} ל-${weekEnd} בכיתה (בעברית, בגוף שלישי, סגנון מכובד ותמציתי). אל תשתמש בעברית מנוקדת מיותרת.

מספר שיעורים: ${counts.lessons}
מספר אירועים: ${counts.events}
חיסורים: ${counts.absences}
נקודות התנהגות חיוביות: ${counts.behaviorPositive}
נקודות התנהגות שליליות: ${counts.behaviorNegative}

שיעורים:
${lessonsText}

אירועים:
${eventsText}

כתוב סיכום קצר ב-3-5 משפטים, הדגש את הדברים החשובים והוסף מילה אחת של המלצה/עידוד למורה.`;

      const result = await callLovableAI({
        messages: [{ role: "user", content: prompt }],
        jsonResponse: false,
      });
      summary = result.trim() || buildDeterministicWeeklySummary(weeklyContext);
    } catch (e) {
      console.error("[weekly summary AI]", e);
      summary = buildDeterministicWeeklySummary(weeklyContext);
    }

    return { summary, counts };
  });
