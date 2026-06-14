import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PARENT_TEMPLATE_LABELS,
  renderTemplate,
  type StudentStats,
  type TemplateKey,
} from "./parent-email-templates";
import { buildStyleContextString } from "./teacher-style.functions";

const TemplateKeyZ = z.enum(
  Object.keys(PARENT_TEMPLATE_LABELS) as [TemplateKey, ...TemplateKey[]],
);

function shiftDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const draftParentEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        studentId: z.string().uuid(),
        templateKey: TemplateKeyZ,
        customNote: z.string().max(2000).optional().default(""),
        usePolish: z.boolean().optional().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ subject: string; body: string; polished: boolean }> => {
    const { supabase, userId } = context;
    const from = shiftDays(-30);
    const to = shiftDays(0);

    const [cls, student, grades, attendance, behavior, profile] = await Promise.all([
      supabase.from("classes").select("name").eq("id", data.classId).maybeSingle(),
      supabase.from("students").select("name").eq("id", data.studentId).maybeSingle(),
      supabase
        .from("grades")
        .select("subject,value,max_value,date")
        .eq("class_id", data.classId).eq("student_id", data.studentId)
        .gte("date", from).lte("date", to)
        .order("date", { ascending: false }).limit(20),
      supabase
        .from("attendance")
        .select("status,date")
        .eq("class_id", data.classId).eq("student_id", data.studentId)
        .gte("date", from).lte("date", to),
      supabase
        .from("behavior_points")
        .select("points,date")
        .eq("class_id", data.classId).eq("student_id", data.studentId)
        .gte("date", from).lte("date", to),
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);

    const att = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const a of attendance.data ?? []) {
      const k = a.status as keyof typeof att;
      if (k in att) att[k] = (att[k] ?? 0) + 1;
    }
    const beh = { positive: 0, negative: 0 };
    for (const b of behavior.data ?? []) {
      const p = Number(b.points);
      if (p >= 0) beh.positive += p; else beh.negative += -p;
    }

    const stats: StudentStats = {
      studentName: student.data?.name ?? "התלמיד",
      className: cls.data?.name ?? "",
      teacherName: (profile.data as { full_name?: string } | null)?.full_name ?? "",
      from, to,
      attendance: att,
      grades: (grades.data ?? []).map((g) => ({
        subject: g.subject ?? "",
        value: Number(g.value),
        max_value: Number(g.max_value),
      })),
      behavior: beh,
      customNote: data.customNote,
    };

    const { subject, body } = renderTemplate(data.templateKey, stats);

    if (!data.usePolish) return { subject, body, polished: false };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { subject, body, polished: false };

    const styleCtx = await buildStyleContextString(supabase, userId);
    const system = `אתה עוזר כתיבה למייל מאת רב/מלמד בתלמוד תורה להוריו של תלמיד.
שפר את ניסוח המייל המצורף תוך שמירה על: עברית מכובדת ורגישה, פנייה בלשון "שלום וברכה להוריו של...", שמירה מלאה על כל הנתונים והעובדות, אורך דומה למקור. אל תוסיף נתונים שאינם מופיעים.${styleCtx}

החזר אך ורק JSON: {"subject":"","body":""}`;
    const user = `נושא נוכחי: ${subject}\n\nגוף נוכחי:\n${body}`;

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          response_format: { type: "json_object" },
        }),
      });
      if (!resp.ok) return { subject, body, polished: false };
      const j = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
      const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as {
        subject?: string; body?: string;
      };
      if (parsed.subject && parsed.body) {
        return { subject: String(parsed.subject), body: String(parsed.body), polished: true };
      }
      return { subject, body, polished: false };
    } catch (e) {
      console.error("[draftParentEmail polish]", e);
      return { subject, body, polished: false };
    }
  });