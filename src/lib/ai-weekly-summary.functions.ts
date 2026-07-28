import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const EVENT_TYPE_LABEL: Record<string, string> = {
  birthday: "יום הולדת",
  exam: "מבחן",
  trip: "טיול",
  holiday: "חג",
  meeting: "פגישה",
  other: "אירוע",
};

export type WeeklySummary = {
  weekStart: string;
  weekEnd: string;
  summary: string;
  counts: {
    events: number;
    lessons: number;
    behaviorPositive: number;
    behaviorNegative: number;
    absences: number;
  };
};

type CompactWeek = {
  className: string;
  week: { from: string; to: string };
  events: { title: string; type: string; date: string; end_date: string | null; notes: string }[];
  lessons: { title: string; date: string; summary: string }[];
  behavior: {
    positive: number;
    negative: number;
    byCategory: { category: string; net: number }[];
  };
  attendance: { absences: number; lates: number };
};

/**
 * Builds a real, data-driven Hebrew weekly summary without any AI call.
 * Used as the fallback when callLovableAI fails (quota/network/credits),
 * so the teacher always gets a genuine summary instead of a generic error string.
 */
function buildDeterministicWeeklySummary(compact: CompactWeek): string {
  const lines: string[] = [];

  // Opening paragraph
  const eventCount = compact.events.length;
  const lessonCount = compact.lessons.length;
  const openingParts: string[] = [];
  if (eventCount > 0) openingParts.push(`${eventCount} אירועים`);
  if (lessonCount > 0) openingParts.push(`${lessonCount} שיעורים מתועדים`);
  const opening = openingParts.length
    ? `השבוע בכיתת ${compact.className} כלל ${openingParts.join(" ו-")}.`
    : `השבוע בכיתת ${compact.className} עבר בשגרה, ללא אירועים או שיעורים מיוחדים שתועדו.`;
  lines.push(opening);
  lines.push("");

  // אירועים בולטים
  if (compact.events.length > 0) {
    lines.push("**אירועים בולטים**");
    for (const e of compact.events.slice(0, 8)) {
      const dateLabel = e.end_date && e.end_date !== e.date ? `${e.date}–${e.end_date}` : e.date;
      lines.push(`- ${e.title} (${e.type}, ${dateLabel})`);
    }
    lines.push("");
  }

  // נקודות לתשומת לב
  const attentionPoints: string[] = [];
  const netBehavior = compact.behavior.positive - compact.behavior.negative;
  if (compact.behavior.positive > 0 || compact.behavior.negative > 0) {
    if (netBehavior > 0) {
      attentionPoints.push(`מגמה התנהגותית חיובית השבוע — ${compact.behavior.positive} נקודות זכות מול ${compact.behavior.negative} נקודות חובה.`);
    } else if (netBehavior < 0) {
      attentionPoints.push(`יש לשים לב למגמה ההתנהגותית — ${compact.behavior.negative} נקודות חובה מול ${compact.behavior.positive} נקודות זכות בלבד.`);
    } else {
      attentionPoints.push(`איזון בין נקודות זכות לחובה השבוע (${compact.behavior.positive} מול ${compact.behavior.negative}).`);
    }
    const topCategory = compact.behavior.byCategory[0];
    if (topCategory) {
      attentionPoints.push(`הקטגוריה הבולטת ביותר: "${topCategory.category}" (${topCategory.net > 0 ? "+" : ""}${topCategory.net}).`);
    }
  }
  if (compact.attendance.absences > 0 || compact.attendance.lates > 0) {
    const parts: string[] = [];
    if (compact.attendance.absences > 0) parts.push(`${compact.attendance.absences} היעדרויות`);
    if (compact.attendance.lates > 0) parts.push(`${compact.attendance.lates} איחורים`);
    attentionPoints.push(`נוכחות השבוע: ${parts.join(", ")}.`);
  }
  if (compact.lessons.length > 0) {
    attentionPoints.push(`תועדו ${compact.lessons.length} שיעורים, ביניהם: ${compact.lessons.slice(0, 3).map((l) => l.title).join(", ")}.`);
  }
  if (attentionPoints.length > 0) {
    lines.push("**נקודות לתשומת לב**");
    for (const p of attentionPoints) lines.push(`- ${p}`);
    lines.push("");
  }

  // מבט קדימה
  lines.push("**מבט קדימה**");
  if (netBehavior < 0) {
    lines.push("כדאי להמשיך לעקוב אחר המגמה ההתנהגותית ולשקול שיחה אישית עם התלמידים הרלוונטיים בשבוע הבא.");
  } else if (compact.attendance.absences > 2) {
    lines.push("מומלץ לבדוק עם ההורים את סיבת ההיעדרויות המרובות ולוודא המשך רצף לימודי.");
  } else {
    lines.push("מומלץ להמשיך באותה מגמה בשבוע הקרוב.");
  }

  return lines.join("\n");
}

export const buildWeeklySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      weekStart: dateStr,
      weekEnd: dateStr,
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<WeeklySummary> => {
    const { classId, weekStart, weekEnd } = data;
    const { supabase } = context;

    const [cls, events, lessons, behavior, attendance] = await Promise.all([
      supabase.from("classes").select("name").eq("id", classId).single(),
      supabase.from("class_events")
        .select("title,type,date,end_date,notes")
        .eq("class_id", classId).gte("date", weekStart).lte("date", weekEnd)
        .order("date", { ascending: true }),
      supabase.from("lesson_transcripts")
        .select("title,created_at,summary")
        .eq("class_id", classId).gte("created_at", weekStart).lte("created_at", weekEnd + "T23:59:59"),
      supabase.from("behavior_points")
        .select("points,category,date")
        .eq("class_id", classId).gte("date", weekStart).lte("date", weekEnd),
      supabase.from("attendance")
        .select("status,date")
        .eq("class_id", classId).gte("date", weekStart).lte("date", weekEnd),
    ]);

    const eventsList = (events.data ?? []).map((e) => ({
      title: e.title,
      type: EVENT_TYPE_LABEL[e.type as string] ?? e.type,
      date: e.date,
      end_date: e.end_date,
      notes: (e.notes ?? "").slice(0, 200),
    }));
    const lessonsList = (lessons.data ?? []).map((l) => ({
      title: l.title,
      date: (l.created_at ?? "").slice(0, 10),
      summary: (l.summary ?? "").slice(0, 400),
    }));
    let posSum = 0, negSum = 0;
    const behCatMap = new Map<string, number>();
    for (const b of behavior.data ?? []) {
      const p = Number(b.points) || 0;
      if (p >= 0) posSum += p; else negSum += -p;
      const key = (b.category || "כללי").trim();
      behCatMap.set(key, (behCatMap.get(key) ?? 0) + p);
    }
    let absences = 0, lates = 0;
    for (const a of attendance.data ?? []) {
      if (a.status === "absent") absences++;
      else if (a.status === "late") lates++;
    }

    const compact: CompactWeek = {
      className: cls.data?.name ?? "כיתה",
      week: { from: weekStart, to: weekEnd },
      events: eventsList,
      lessons: lessonsList,
      behavior: {
        positive: posSum,
        negative: negSum,
        byCategory: Array.from(behCatMap.entries())
          .map(([k, v]) => ({ category: k, net: v }))
          .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
          .slice(0, 5),
      },
      attendance: { absences, lates },
    };

    const system = `אתה עוזר פדגוגי לתלמוד תורה/חיידר בעברית.
כתוב סיכום שבועי קצר וברור למלמד על מה שקרה השבוע בכיתה שלו.
מבנה:
- פסקת פתיחה קצרה (1-2 משפטים) על השבוע.
- "אירועים בולטים" — רשימה קצרה של אירועים שהיו/יהיו השבוע (ימי הולדת, מבחנים, טיולים).
- "נקודות לתשומת לב" — 2-4 סעיפים על מגמות (התנהגות, נוכחות, שיעורים).
- "מבט קדימה" — משפט או שניים על מה חשוב לזכור לשבוע הבא.
טון: "המלמד", "התלמידים", "הרב". Markdown קל, 150-250 מילים, ללא המצאות. אל תחזיר JSON.`;

    let summary = "";
    try {
      summary = await callLovableAI({
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(compact) },
        ],
      });
      if (!summary.trim()) throw new Error("AI החזיר תשובה ריקה");
    } catch (e) {
      console.error("[weekly summary AI]", e);
      summary = buildDeterministicWeeklySummary(compact);
    }

    return {
      weekStart,
      weekEnd,
      summary: summary.slice(0, 4000),
      counts: {
        events: eventsList.length,
        lessons: lessonsList.length,
        behaviorPositive: posSum,
        behaviorNegative: negSum,
        absences,
      },
    };
  });
