import { callLovableAI } from "./ai-gateway.server";
import {
  STUDENT_LEVEL_LABELS, SUMMARY_SCOPE_LABELS, TASK_KIND_LABELS, DIFFICULTY_TEXT,
  type StudentLevel, type SummaryScope, type TaskKind,
} from "./generator-options";

const SYSTEM_PROMPT =
  "אתה עוזר פדגוגי למלמדים בתלמוד תורה, חיידר ובית ספר חרדי. כתוב בעברית תקנית ובלשון מכובדת " +
  "המתאימה לציבור החרדי. אין להוסיף פתיחות מיותרות — רק התוצר עצמו, מסודר בכותרות ובנקודות.";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from: (table: string) => any };

/** Builds a compact text context from a stored teaching resource (RLS scoped by the caller's client). */
export async function loadResourceContext(supabase: SupabaseLike, resourceId: string): Promise<{
  text: string;
  title: string;
  subject: string;
  grade: string;
}> {
  const { data, error } = await supabase
    .from("teaching_resources")
    .select("title, description, subject, grade_level, content")
    .eq("id", resourceId)
    .maybeSingle();
  if (error || !data) throw new Error("החומר לא נמצא בספרייה");

  const content = (data.content ?? {}) as {
    body?: string;
    questions?: { q: string; a?: string }[];
    steps?: string[];
  };
  const text = [
    `כותרת: ${data.title}`,
    data.description ? `תיאור: ${data.description}` : "",
    data.subject ? `מקצוע: ${data.subject}` : "",
    data.grade_level ? `כיתה: ${data.grade_level}` : "",
    content.body ? `תוכן:\n${content.body}` : "",
    content.questions?.length
      ? `שאלות קיימות:\n${content.questions.map((q, i) => `${i + 1}. ${q.q}`).join("\n")}`
      : "",
    content.steps?.length ? `שלבים:\n${content.steps.join("\n")}` : "",
  ].filter(Boolean).join("\n").slice(0, 8000);

  return {
    text,
    title: String(data.title ?? ""),
    subject: String(data.subject ?? ""),
    grade: String(data.grade_level ?? ""),
  };
}

export async function buildSummary(input: {
  source: string;
  level: StudentLevel;
  scope: SummaryScope;
  notes: string;
}): Promise<string> {
  const text = await callLovableAI({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `הפק סיכום לימודי מהחומר הבא.\n` +
          `רמת התלמידים: ${STUDENT_LEVEL_LABELS[input.level]}.\n` +
          `היקף הסיכום: ${SUMMARY_SCOPE_LABELS[input.scope]}.\n` +
          (input.notes ? `הנחיות נוספות מהרב: ${input.notes}\n` : "") +
          `\nהחומר:\n${input.source}`,
      },
    ],
  });
  return text.trim();
}

export async function buildTasks(input: {
  source: string;
  level: StudentLevel;
  difficulty: keyof typeof DIFFICULTY_TEXT;
  kind: TaskKind;
  count: number;
  notes: string;
}): Promise<string> {
  const text = await callLovableAI({
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT + " החזר את המשימות ממוספרות, ואת התשובות בסוף תחת הכותרת 'תשובות'.",
      },
      {
        role: "user",
        content:
          `הפק ${input.count} ${TASK_KIND_LABELS[input.kind]}.\n` +
          `רמת התלמידים: ${STUDENT_LEVEL_LABELS[input.level]}.\n` +
          `רמת קושי: ${DIFFICULTY_TEXT[input.difficulty]}.\n` +
          (input.notes ? `הנחיות נוספות מהרב: ${input.notes}\n` : "") +
          `\nהמקור:\n${input.source}`,
      },
    ],
  });
  return text.trim();
}
