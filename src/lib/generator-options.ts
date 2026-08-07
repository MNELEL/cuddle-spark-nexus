/** Client-safe option lists for the library generators (summaries + tasks). */
export const STUDENT_LEVELS = ["basic", "intermediate", "advanced", "high"] as const;
export type StudentLevel = (typeof STUDENT_LEVELS)[number];
export const STUDENT_LEVEL_LABELS: Record<StudentLevel, string> = {
  basic: "בסיסית",
  intermediate: "בינונית",
  advanced: "מתקדמת",
  high: "גבוהה",
};
/** תיאור קצר שמוצג תחת כל כפתור רמה */
export const STUDENT_LEVEL_HINTS: Record<StudentLevel, string> = {
  basic: "לשון פשוטה, מושגי יסוד",
  intermediate: "רמת הכיתה הרגילה",
  advanced: "העמקה ומושגים נוספים",
  high: "עיון, מקורות ודקדוקי סוגיה",
};

export const SUMMARY_SCOPES = ["partial", "full"] as const;
export type SummaryScope = (typeof SUMMARY_SCOPES)[number];
export const SUMMARY_SCOPE_LABELS: Record<SummaryScope, string> = {
  partial: "סיכום חלקי",
  full: "סיכום מלא",
};
export const SUMMARY_SCOPE_HINTS: Record<SummaryScope, string> = {
  partial: "עיקרי הדברים בקצרה — עד חצי עמוד",
  full: "סיכום מפורט של כל החומר",
};

/** כמות שאלות מוצעת בכפתורי בחירה */
export const TASK_COUNTS = [3, 5, 8, 10] as const;

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
