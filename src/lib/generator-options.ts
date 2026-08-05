/** Client-safe option lists for the library generators (summaries + tasks). */
export const STUDENT_LEVELS = ["beginner", "average", "advanced", "mixed"] as const;
export type StudentLevel = (typeof STUDENT_LEVELS)[number];
export const STUDENT_LEVEL_LABELS: Record<StudentLevel, string> = {
  beginner: "מתחילים",
  average: "רמה ממוצעת",
  advanced: "מתקדמים",
  mixed: "כיתה מעורבת",
};

export const SUMMARY_SCOPES = ["short", "medium", "full"] as const;
export type SummaryScope = (typeof SUMMARY_SCOPES)[number];
export const SUMMARY_SCOPE_LABELS: Record<SummaryScope, string> = {
  short: "תקציר קצר (עד חצי עמוד)",
  medium: "סיכום בינוני (עמוד)",
  full: "סיכום מלא ומפורט",
};

export const TASK_KINDS = ["questions", "worksheet", "homework", "quiz", "discussion"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];
export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  questions: "שאלות הבנה",
  worksheet: "דף עבודה",
  homework: "שיעורי בית",
  quiz: "בוחן קצר",
  discussion: "נושאים לדיון בכיתה",
};

export const DIFFICULTY_TEXT = { easy: "קל", medium: "בינוני", hard: "מאתגר" } as const;
