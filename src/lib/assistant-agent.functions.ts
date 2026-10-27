import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAIChat, type ChatToolDef } from "./ai-gateway.server";
import { ActionSchema, type AssistantAction, type AssistantReply, type StudentSnapshot } from "./ai-assistant.functions";
import { buildSourceLinks } from "./assistant-reply";
import { NAV_TARGETS, findNavTarget } from "./assistant-nav";
import { READ_TOOLS, readToolByName, type ToolCtx } from "./assistant-tools.server";
import { appendAssistantMessages, buildAssistantMemoryString } from "./assistant-memory.functions";
import { buildStyleContextString } from "./teacher-style.functions";
import { dayKeyOfIso } from "./schedule-view";

/**
 * סוכן העוזר האישי: מודל עם כלים. כלי קריאה רצים מיד ומחזירים נתונים למודל;
 * כלי כתיבה ("propose_action") רק מכינים פעולות שהרב מאשר בעצמו; ו-"navigate" פותח מסכים.
 */
const MAX_STEPS = 6;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const DAY_HE: Record<string, string> = { sun: "ראשון", mon: "שני", tue: "שלישי", wed: "רביעי", thu: "חמישי", fri: "שישי", sat: "שבת" };

const ACTION_CATALOG = `פעולות כתיבה (kind) והפרמטרים שלהן:
- add_grade: { student_id, subject, value, max_value (ברירת מחדל 100), notes?, date? }
- mark_attendance: { student_id, status: "present"|"absent"|"late"|"excused", date?, notes? }
- add_note: { student_id, description, type?: "positive"|"negative"|"neutral", category? }
- add_behavior: { student_id, points (1-5, שלילי = הורדה), category?, note? }
- add_parent_call: { student_id, summary, subject?, channel?: "phone"|"meeting"|"whatsapp"|"email", date? }
- add_incident: { student_id, description, severity: "low"|"medium"|"high", category?, date? }
- add_daily_update: { text, date? } — תיעוד או סיכום היום לכיתה כולה
- add_announcement: { title, body?, severity?: "info"|"warning"|"urgent" }
- add_class_event: { title, type: "birthday"|"exam"|"trip"|"holiday"|"meeting"|"special_exam"|"celebration"|"other", date?, end_date?, notes?, student_id? }
- add_calendar_override: { type: "institution_break"|"unexpected_closure"|"extra_session"|"late_start"|"early_end"|"holiday", start_date, end_date?, label? }
- add_recurring_rule: { kind: "weekly_day"|"rosh_chodesh", effect: "no_school"|"early_end"|"late_start", day_key?, hour?, minute?, label? }
- set_weekly_honor: { student_id, kind: "excellent"|"investing", week_start?, note? } — מצטיין השבוע או משקיע השבוע
- save_pacing_subject: { subject, mode: "amount"|"topics"|"both", total_amount?, unit_label?, start_number?, topics? } — הגדרת מה להספיק במקצוע. topics בפורמט "נושא:שיעורים; נושא:שיעורים"
- compute_pacing: {} — חישוב טיוטת תוכנית שנתית (אחרי שהוגדרו מקצועות)
- approve_pacing: {} — אישור התוכנית וכתיבת היעדים לשיעורים
- edit_pacing_week: { subject, week_start, amount } — שינוי ידני של כמות בשבוע
- set_day_column: { subject, rated?, criteria?, label? } — עמודה בדשבורד היומי. criteria: שמות קטגוריות מופרדים בפסיק, מחרוזת ריקה = ציון אחד בלי קטגוריות
- swap_seats: { student_a, student_b } — החלפת מקומות ישיבה בין שני תלמידים
- import_timetable: { slots, replace? } — slots הוא מחרוזת JSON של [{"day":"sun".."fri","hour":8,"minute":0,"subject":"גמרא"}]`;

const TOOL_NOTE: Record<string, string> = {
  propose_action: "פעולות לאישור",
  navigate: "ניווט",
};

async function buildSnapshot(supabase: any, classId: string, today: string, students: { id: string; name: string }[]): Promise<StudentSnapshot[]> {
  const since = new Date(today); since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString().slice(0, 10);
  const [att, grades, beh, disc] = await Promise.all([
    supabase.from("attendance").select("student_id,date,status").eq("class_id", classId).gte("date", sinceIso),
    supabase.from("grades").select("student_id,value,max_value").eq("class_id", classId).gte("date", sinceIso),
    supabase.from("behavior_points").select("student_id,points").eq("class_id", classId).gte("date", sinceIso),
    supabase.from("discipline_events").select("student_id").eq("class_id", classId).gte("date", sinceIso),
  ]);
  return students.map((s) => {
    const a = ((att.data ?? []) as any[]).filter((x) => x.student_id === s.id);
    const good = a.filter((x) => x.status === "present" || x.status === "late").length;
    const g = ((grades.data ?? []) as any[]).filter((x) => x.student_id === s.id).map((x) => (x.value / (x.max_value > 0 ? x.max_value : 100)) * 100);
    const todayRow = a.find((x) => x.date === today);
    return {
      id: s.id, name: s.name,
      todayStatus: (todayRow?.status as StudentSnapshot["todayStatus"]) ?? null,
      attendancePercent: a.length ? Math.round((good / a.length) * 100) : null,
      gradeAvg: g.length ? Math.round(g.reduce((p, c) => p + c, 0) / g.length) : null,
      gradesCount: g.length,
      behaviorPoints: ((beh.data ?? []) as any[]).filter((x) => x.student_id === s.id).reduce((p, c) => p + (Number(c.points) || 0), 0),
      disciplineCount: ((disc.data ?? []) as any[]).filter((x) => x.student_id === s.id).length,
    };
  });
}

export const assistantAgentQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      text: z.string().trim().min(2).max(2000),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(8).optional(),
      threadId: z.string().uuid().nullable().optional(),
      today: dateStr.optional(),
      path: z.string().max(200).optional(),
      /** תמונה מצורפת (כתובת data:), למשל צילום של מערכת שעות */
      image: z.string().max(7_000_000).regex(/^data:image\/(png|jpe?g|webp);base64,/).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<AssistantReply> => {
    const supabase = context.supabase as any;
    const today = data.today ?? new Date().toISOString().slice(0, 10);

    const [{ data: cls, error: cErr }, { data: studentRows, error: sErr }] = await Promise.all([
      supabase.from("classes").select("id,name,owner_id").eq("id", data.classId).maybeSingle(),
      supabase.from("students").select("id,name").eq("class_id", data.classId).order("name", { ascending: true }),
    ]);
    if (cErr || sErr) { console.error("[DB Error]", cErr ?? sErr); throw new Error("טעינת הכיתה נכשלה."); }
    if (!cls || cls.owner_id !== context.userId) throw new Error("הכיתה לא נמצאה");
    const roster = (studentRows ?? []) as { id: string; name: string }[];

    const [style, memory] = await Promise.all([
      buildStyleContextString(supabase, context.userId).catch(() => ""),
      buildAssistantMemoryString(supabase, context.userId).catch(() => ""),
    ]);

    const system = `אתה הסוכן האישי של רב/מלמד בתלמוד תורה, ונקרא "עוזר הרב". כתוב בעברית ברורה וקצרה, בטון מכבד, בלי הקדמות מיותרות.
תאריך היום: ${today} (יום ${DAY_HE[dayKeyOfIso(today)] ?? ""}). הכיתה הנוכחית: ${cls.name}. המסך הפתוח: ${data.path ?? "לא ידוע"}.

מה אתה יכול:
1. לשלוף נתונים בעזרת כלי הקריאה (תלמידים לפי רחוב, ימי הולדת עבריים, מצטייני ומשקיעני השבוע, מועמדים לפי נוכחות וביצוע עבודות, נוכחות, מערכת שעות, תכנון קצב, סקירת כיתה).
2. להציע פעולות כתיבה לאישור בעזרת propose_action. אתה לא מבצע בעצמך: הרב מאשר כל פעולה. לעולם אל תכתוב שמשהו "בוצע" לפני שאושר.
3. לפתוח מסכים בעזרת navigate.

חוקים:
- כל עובדה על תלמידים או על הכיתה חייבת להגיע מכלי קריאה. אל תנחש ואל תמציא. אם חסר מידע (למשל אין כתובת לתלמיד), אמור זאת.
- שאלה: קרא לכלי המתאים, ואז ענה בתשובה ממוקדת. הרבה תלמידים: רשימה קצרה.
- בקשת שינוי: propose_action אחת לכל שינוי (בקשה על כמה תלמידים = פעולה לכל תלמיד).
- בקשה לפתוח או לעבור למסך: navigate (אפשר גם הסבר קצר).
- בקשה גדולה (למשל לתכנן את השנה): פרק לשלבים, הצע את הפעולות לפי הסדר, ואמור מה הרב צריך לאשר. אל תיצור פעולות שתלויות בשלב שעוד לא אושר.
- זהה תלמיד לפי שם מהרשימה למטה בלבד, ושלח את ה-id שלו. אם כמה תלמידים מתאימים, שאל איזה.
- פרטיות: לא לחשוף כתובות מלאות, תאריכי לידה לועזיים או מידע אישי מעבר למה שנשאל.
- תמונה מצורפת של מערכת שעות: חלץ שיעורים (יום, שעה, מקצוע) והצע import_timetable. אם משהו לא קריא או לא בטוח, אמור זאת ושאל.

${ACTION_CATALOG}

${style ? `סגנון העבודה של הרב:\n${style}\n` : ""}${memory ? `מה ידוע על ההעדפות של הרב (מוזיכרון קודם):\n${memory}\n` : ""}
תלמידי הכיתה (id | שם):
${roster.map((s) => `${s.id} | ${s.name}`).join("\n")}`;

    const proposals: AssistantAction[] = [];
    const navigation: { label: string; path: string }[] = [];
    const usedLabels = new Set<string>();

    const resolveStudentId = (v: unknown): string | null => {
      const s = String(v ?? "").trim();
      if (roster.some((r) => r.id === s)) return s;
      const hit = roster.filter((r) => r.name.trim() === s);
      return hit.length === 1 ? hit[0]!.id : null;
    };

    const ctx: ToolCtx = { supabase, userId: context.userId, classId: data.classId, today };
    const STUDENT_KEYS = ["student_id", "student_a", "student_b"];
    const NO_STUDENT_NEEDED = new Set([
      "add_daily_update", "add_announcement", "add_class_event", "add_calendar_override", "add_recurring_rule",
      "save_pacing_subject", "compute_pacing", "approve_pacing", "edit_pacing_week", "set_day_column", "import_timetable", "swap_seats",
    ]);

    const toolDefs: ChatToolDef[] = [
      ...READ_TOOLS.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } })),
      {
        type: "function",
        function: {
          name: "propose_action",
          description: "מציע פעולת כתיבה שתוצג לרב לאישור. לא מבצע כלום בעצמו.",
          parameters: {
            type: "object",
            properties: {
              kind: { type: "string", enum: [...ACTION_KINDS_FOR_MODEL] },
              summary: { type: "string", description: "משפט אחד בעברית שהרב יבין מיד, כולל שם התלמיד והתאריך" },
              params_json: { type: "string", description: "אובייקט JSON עם הפרמטרים של הפעולה, כמתואר בקטלוג" },
            },
            required: ["kind", "summary", "params_json"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "navigate",
          description: `פותח מסך באפליקציה. מסכים אפשריים:\n${NAV_TARGETS.map((t) => `${t.key}: ${t.label} (${t.about})`).join("\n")}`,
          parameters: {
            type: "object",
            properties: { page: { type: "string", enum: NAV_TARGETS.map((t) => t.key) } },
            required: ["page"],
          },
        },
      },
    ];

    const runTool = async (name: string, args: any): Promise<unknown> => {
      if (name === "navigate") {
        const t = findNavTarget(String(args?.page ?? ""));
        if (!t) return { error: "מסך לא מוכר" };
        if (!navigation.some((n) => n.path === t.path(data.classId))) navigation.push({ label: t.label, path: t.path(data.classId) });
        usedLabels.add(TOOL_NOTE.navigate!);
        return { ok: true, opened: t.label };
      }
      if (name === "propose_action") {
        let params: Record<string, unknown> = {};
        try { params = JSON.parse(String(args?.params_json ?? "{}")); } catch { return { error: "params_json אינו JSON תקין" }; }
        const clean: Record<string, string | number | boolean | null> = {};
        for (const [k, v] of Object.entries(params ?? {})) {
          if (STUDENT_KEYS.includes(k)) {
            const id = resolveStudentId(v);
            if (!id) return { error: `תלמיד לא נמצא ברשימה: ${String(v)}. השתמש ב-id מהרשימה, או שאל את הרב.` };
            clean[k] = id;
          } else if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") clean[k] = v;
          else clean[k] = JSON.stringify(v);
        }
        const parsed = ActionSchema.safeParse({ kind: args?.kind, summary: String(args?.summary ?? "").slice(0, 280), params: clean });
        if (!parsed.success) return { error: "פעולה לא תקינה" };
        if (!NO_STUDENT_NEEDED.has(parsed.data.kind) && !clean.student_id) return { error: "חסר student_id" };
        proposals.push(parsed.data);
        usedLabels.add(TOOL_NOTE.propose_action!);
        return { ok: true, queued_for_approval: proposals.length };
      }
      const tool = readToolByName(name);
      if (!tool) return { error: "כלי לא מוכר" };
      usedLabels.add(tool.label);
      return tool.run(args ?? {}, ctx);
    };

    const userContent: any = data.image
      ? [{ type: "text", text: data.text }, { type: "image_url", image_url: { url: data.image } }]
      : data.text;
    const messages: any[] = [
      { role: "system", content: system },
      ...(data.history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userContent },
    ];

    let finalText = "";
    for (let step = 0; step < MAX_STEPS; step++) {
      const msg = await callLovableAIChat({
        messages, tools: toolDefs,
        model: data.image ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
      });
      if (!msg.tool_calls?.length) { finalText = (msg.content ?? "").trim(); break; }
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });
      for (const tc of msg.tool_calls) {
        let args: any = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* ignore */ }
        let result: unknown;
        try { result = await runTool(tc.function.name, args); }
        catch (e) { console.error("[assistant tool]", tc.function.name, e); result = { error: e instanceof Error ? e.message : "הכלי נכשל" }; }
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 12000) });
      }
    }
    if (!finalText) finalText = proposals.length ? `הכנתי ${proposals.length} פעולות לאישור.` : navigation.length ? `פותח: ${navigation[0]!.label}` : "לא הצלחתי להשלים את הבקשה. אפשר לנסח אחרת?";

    const sources = [...usedLabels].slice(0, 5);
    const threadId = await appendAssistantMessages(supabase, context.userId, {
      threadId: data.threadId ?? null, classId: data.classId,
      userText: data.image ? `${data.text} (עם תמונה)` : data.text,
      assistantText: proposals.length ? `${finalText}\n[הוצעו ${proposals.length} פעולות לאישור]` : finalText,
    });

    return {
      mode: proposals.length > 0 ? "write" : "read",
      answer: finalText,
      actions: proposals,
      clarify: null,
      clarifyOptions: [],
      sources: sources.length ? sources : ["הכיתה"],
      sourceLinks: buildSourceLinks(sources),
      students: roster,
      snapshot: await buildSnapshot(supabase, data.classId, today, roster),
      navigation,
      threadId,
    };
  });

// קבוצת ה-kind שהמודל רשאי להציע (נגזרת מהקטלוג; הסכימה האמיתית נבדקת ב-ActionSchema)
const ACTION_KINDS_FOR_MODEL = [
  "add_grade", "mark_attendance", "add_note", "add_behavior", "add_parent_call", "add_daily_update", "add_incident",
  "add_class_event", "add_announcement", "add_calendar_override", "add_recurring_rule",
  "set_weekly_honor", "save_pacing_subject", "compute_pacing", "approve_pacing", "edit_pacing_week",
  "set_day_column", "swap_seats", "import_timetable",
] as const;
