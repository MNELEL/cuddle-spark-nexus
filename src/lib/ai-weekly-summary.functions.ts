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

    const counts = {
      events: events.length,
      lessons: lessons.length,
      behaviorPositive,
      behaviorNegative,
      absences,
    };

    let summary = "לא ניתן ליצור סיכום אוטומטי.";

    try {
      const hebrewDay: Record<string, string> = {
        sun: "יום א׳",
        mon: "יום ב׳",
        tue: "יום ג׳",
        wed: "יום ד׳",
        thu: "יום ה׳",
        fri: "יום ו׳",
        sat: "שבת",
      };

      const lessonsText = lessons.length
        ? lessons.map((l) => `- ${hebrewDay[l.day_key ?? ""] ?? l.day_key}: ${l.title}${l.subject ? ` (${l.subject})` : ""}`).join("\n")
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
      summary = result.trim() || summary;
    } catch (e) {
      console.error("[weekly summary AI]", e);
      summary = "הסיכום האוטומטי לא נוצר. ניתן לרענן ולנסות שוב.";
    }

    return { summary, counts };
  });
