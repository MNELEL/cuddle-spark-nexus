import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { advisorInput, interventionPlan, lessonPlanInput, lessonPlanResult, sugyaInput, sugyaResult } from "./claude-tools.schemas";
import { hebrewDate } from "./hebrew-date";
import { claudeExamInput, claudeExamOutputSchema, validateClaudeExam } from "./claude-exam.schemas";

const BLOCK_SOURCE = "claude-tools-access-block";
const objectSchema = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const stringSchema = { type: "string" };
const outputSchemas = {
  sugya: objectSchema({ title: stringSchema, introduction: stringSchema, discussion: { type: "array", items: stringSchema }, nextLesson: stringSchema, sourceCaution: stringSchema }),
  advisor: objectSchema({ summary: stringSchema, steps: { type: "array", items: objectSchema({ title: stringSchema, action: stringSchema, success: stringSchema }) } }),
  letter: objectSchema({ subject: stringSchema, body: stringSchema }),
  lesson: objectSchema({
    title: stringSchema,
    objectives: { type: "array", items: stringSchema },
    opening: stringSchema,
    timeline: { type: "array", items: objectSchema({ minutes: { type: "number" }, activity: stringSchema }) },
    guidingQuestions: { type: "array", items: stringSchema },
    worksheetLevels: { type: "array", items: objectSchema({ level: stringSchema, questions: { type: "array", items: stringSchema } }) },
    homework: stringSchema,
    sourceCaution: stringSchema,
  }),
};
async function generate(context: { supabase: any; userId: string }, key: string | undefined, system: string, input: unknown, outputSchema?: Record<string, unknown>) {
  if (!key) throw new Error("שירות Claude אינו מוגדר כרגע.");
  // Logs are diagnostic only: a past provider failure must never block a new request.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { runClaude } = await import("./claude-tools.server");
  const schema = outputSchema ?? (input && typeof input === "object" && "studentName" in input ? outputSchemas.letter : input && typeof input === "object" && "dilemma" in input ? outputSchemas.advisor : input && typeof input === "object" && "gradeLevel" in input ? outputSchemas.lesson : outputSchemas.sugya);
  try { return await runClaude(key, system, input, schema); }
  catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
    const provider = error && typeof error === "object" && "error" in error ? error.error as any : null;
    const message = provider?.error?.message ?? provider?.message ?? (error instanceof Error ? error.message : "הבקשה נכשלה.");
    if (status === 402 || status === 403) {
      try {
        const { error: writeError } = await supabaseAdmin.from("app_logs").insert({ user_id: context.userId, source: BLOCK_SOURCE, level: "warn", message });
        if (writeError) console.error("[Claude diagnostic log]", writeError);
      } catch (logError) {
        console.error("[Claude diagnostic log]", logError);
      }
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
      { studentName: student.name, className: cls.name,
        attendance: (attendance.data ?? []).map((a) => ({ ...a, date: hebrewDate(a.date) })),
        grades: (grades.data ?? []).map((g) => ({ ...g, date: hebrewDate(g.date) })),
        dailyNotes: (notes.data ?? []).map((n) => ({ ...n, insight_date: hebrewDate(n.insight_date) })),
      });
    const { parseClaudeJson } = await import("./claude-tools.server");
    return z.object({ subject: z.string(), body: z.string() }).parse(parseClaudeJson(raw));
  });
export const generateLessonPlan = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => lessonPlanInput.parse(d)).handler(async ({ data, context }) => {
    const { requireActiveAITrial } = await import("./ai-entitlement.server");
    await requireActiveAITrial(context.supabase, context.userId);
    const raw = await generate(context, process.env['LOVABLE_API_KEY'],
      'אתה הרב המלמד. הכן מערך שיעור מלא בעברית מכובדת לפי המקצוע, שכבת הגיל, הנושא ומשך השיעור בנתוני המשתמש. כלול מטרות, פתיחה, ציר זמן שסך דקותיו שווה בדיוק למשך השיעור, שאלות מנחות להבנה, ובדיוק שלוש רמות של דפי עבודה (תמיכה, רגיל, העשרה) מוכנות להדפסת A4, ושיעורי בית. כשאין טקסט מקור, אל תמציא ציטוטים או מראי מקומות; ציין שחובה לאמת את המקור. החזר JSON בלבד: {"title":"","objectives":[""],"opening":"","timeline":[{"minutes":0,"activity":""}],"guidingQuestions":[""],"worksheetLevels":[{"level":"","questions":[""]}],"homework":"","sourceCaution":""}.', data);
    const { parseClaudeJson } = await import("./claude-tools.server");
    return lessonPlanResult.parse(parseClaudeJson(raw));
  });

export const generateClaudeExam = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d) => claudeExamInput.parse(d)).handler(async ({ data, context }) => {
    const { requireActiveAITrial } = await import("./ai-entitlement.server");
    await requireActiveAITrial(context.supabase, context.userId);
    const raw = await generate(context, process.env['LOVABLE_API_KEY'],
      'אתה הרב המלמד בתלמוד תורה. הכן מבחן ומחוון בדיקה בעברית לפי המקצוע ושכבת הגיל שבנתוני המשתמש. אם צורף קטע מקור, בסס את כל השאלות והתשובות רק עליו; אחרת בסס על הנושא, בלי להמציא ציטוטים או מראי מקומות, וציין ב-sourceCaution שחובה לאמת את התוכן והמקורות לפני מסירה. צור בדיוק knowledgeCount שאלות בקיאות (זכירה, זיהוי והבנת פשט) ובדיוק depthCount שאלות העמקה (הסבר, השוואה ויישום), בקיאות תחילה. כל שאלה פתוחה, ברורה ועצמאית עם ניקוד שלם חיובי, תשובה צפויה ומחוון מפורט המאפשר ניקוד חלקי. סכום points של השאלות חייב להיות בדיוק totalPoints; סכום points של criteria בכל שאלה חייב להיות בדיוק points שלה. אין שאלות ללא תשובה מבוססת, אין קריטריונים עמומים ואין התייחסות למידע שלא סופק. התאם את ההיקף ל-durationMinutes. כתוב instructions לתלמיד בלבד בלי תשובות. החזר JSON לפי הסכמה שסופקה.', data, claudeExamOutputSchema);
    const { parseClaudeJson } = await import("./claude-tools.server");
    return validateClaudeExam(parseClaudeJson(raw), data);
  });