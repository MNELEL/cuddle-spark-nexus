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
        .select("title,recorded_at,summary")
        .eq("class_id", classId).gte("recorded_at", weekStart).lte("recorded_at", weekEnd + "T23:59:59"),
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
      date: (l.recorded_at ?? "").slice(0, 10),
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

    const compact = {
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
    } catch (e) {
      console.error("[weekly summary AI]", e);
      summary = "הסיכום האוטומטי אינו זמין כרגע. נסה שוב מאוחר יותר.";
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