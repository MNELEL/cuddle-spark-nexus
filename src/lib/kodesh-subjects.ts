// מקצועות לימוד מותאמים לתלמודי תורה וחיידרים
export const KODESH_SUBJECTS = [
  "גמרא",
  "משנה",
  "חומש",
  "נביא",
  "הלכה",
  "מוסר",
  "תפילה",
  "פרשת שבוע",
  "כתיבה",
  "לשון הקודש",
  "חשבון",
  "אנגלית",
] as const;

export type KodeshSubject = (typeof KODESH_SUBJECTS)[number];

// כינויי "מלמד / רב" במקום "מורה"
export const TEACHER_LABEL = "הרב";
export const TEACHER_LABEL_LONG = "הרב המלמד";