import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { advisorInput, interventionPlan, sugyaInput, sugyaResult } from "./claude-tools.schemas";

const BLOCK_SOURCE = "claude-tools-access-block";
async function generate(context: { supabase: any; userId: string }, key: string | undefined, system: string, input: unknown) {
  if (!key) throw new Error("שירות Claude אינו מוגדר כרגע.");
  // The authenticated handler has authorized the caller; diagnostic logs are service-only.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: blocked, error: readError } = await supabaseAdmin.from("app_logs").select("message").eq("source", BLOCK_SOURCE).limit(1);
  if (readError) throw new Error("לא ניתן לבדוק את זמינות שירות Claude.");
  if (blocked?.length) throw new Error(blocked[0].message);
  const { runClaude } = await import("./claude-tools.server");
  try { return await runClaude(key, system, input); }
  catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
    const provider = error && typeof error === "object" && "error" in error ? error.error as any : null;
    const message = provider?.error?.message ?? provider?.message ?? (error instanceof Error ? error.message : "הבקשה נכשלה.");
    if (status === 402 || status === 403) {
      const { error: writeError } = await supabaseAdmin.from("app_logs").insert({ user_id: context.userId, source: BLOCK_SOURCE, level: "warn", message });
      if (writeError) throw new Error("השירות חסום ולא ניתן לשמור את מצב החסימה.");
    }
    const failure = new Error(message);
    if (status) Object.assign(failure, { statusCode: status });
    throw failure;
  }
}

export const generateClassSugya = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => sugyaInput.parse(d)).handler(async ({ data, context }) => {
    const raw = await generate(context, process.env['LOVABLE_API_KEY'],
      'אתה הרב המלמד. הכן סוגיית כיתה בעברית מכובדת לפי המקצוע והמקום בנתוני המשתמש. כלול פתיחה, שאלות דיון והמשך לשיעור הבא. כשאין טקסט מקור, אל תמציא ציטוטים או מראי מקומות; ציין שחובה לאמת את המקור. החזר JSON בלבד: {"title":"","introduction":"","discussion":[""],"nextLesson":"","sourceCaution":""}.', data);
    const { parseClaudeJson } = await import("./claude-tools.server");
    return sugyaResult.parse(parseClaudeJson(raw));
  });
export const adviseTeacher = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => advisorInput.parse(d)).handler(async ({ data, context }) => {
    const raw = await generate(context, process.env['LOVABLE_API_KEY'],
      'אתה יועץ פדגוגי למלמד בתלמוד תורה. הצע בדיוק שלושה צעדי התערבות הדרגתיים, מכבדים ומעשיים לדילמה. ללא אבחנות רפואיות, ענישה משפילה או הנחות שלא נמסרו. לכל צעד פעולה ומדד הצלחה. אם יש סכנה מיידית ציין צורך לערב איש מקצוע מוסמך. החזר JSON בלבד: {"summary":"","steps":[{"title":"","action":"","success":""}]}.', data);
    const { parseClaudeJson } = await import("./claude-tools.server");
    return interventionPlan.parse(parseClaudeJson(raw));
  });
export const generateAppreciationLetter = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid() }).parse(d)).handler(async ({ data, context }) => {
    const db = context.supabase;
    const { data: student, error } = await db.from("students").select("id,name,class_id").eq("id", data.studentId).maybeSingle();
    if (error || !student) throw new Error("התלמיד לא נמצא.");
    const { data: cls } = await db.from("classes").select("name,owner_id").eq("id", student.class_id).maybeSingle();
    if (cls?.owner_id !== context.userId) throw new Error("אין הרשאה לתלמיד זה.");
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    const [attendance, grades, notes] = await Promise.all([
      db.from("attendance").select("date,status,notes").eq("student_id", student.id).eq("class_id", student.class_id).gte("date", from).lte("date", to).order("date").limit(60),
      db.from("grades").select("date,subject,value,max_value").eq("student_id", student.id).eq("class_id", student.class_id).gte("date", from).lte("date", to).order("date").limit(100),
      db.from("orchestrator_insights").select("insight_date,title,description").eq("student_id", student.id).eq("class_id", student.class_id).eq("insight_type", "manual").gte("insight_date", from).lte("insight_date", to).order("insight_date").limit(60),
    ]);
    if ([attendance, grades, notes].some((r) => r.error)) throw new Error("טעינת התיעוד למכתב נכשלה.");
    if (!attendance.data?.length && !grades.data?.length && !notes.data?.length) throw new Error("אין תיעוד או ציונים בחודש האחרון למכתב אישי.");
    const raw = await generate(context, process.env['LOVABLE_API_KEY'],
      'נסח מכתב הערכה אישי וחם מאת הרב המלמד להורי התלמיד, לפי התיעוד בלבד. הדגש הצלחות אמיתיות והתקדמות שניתן להוכיח; אין להמציא הישגים, לחשוף מידע רגיש, להזכיר תלמידים אחרים או לשלוח את המכתב. החזר JSON בלבד: {"subject":"","body":""}.',
      { studentName: student.name, className: cls.name, attendance: attendance.data, grades: grades.data, dailyNotes: notes.data });
    const { parseClaudeJson } = await import("./claude-tools.server");
    return z.object({ subject: z.string(), body: z.string() }).parse(parseClaudeJson(raw));
  });