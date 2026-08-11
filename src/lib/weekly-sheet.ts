/**
 * "דף קשר" שבועי להורים — תבנית בסגנון המקובל בתלמודי תורה:
 * שער, הספק החומר לפי מקצועות, מבחנים והודעות, ודף חתימת הורים עם שדות הערכה.
 */

export type WeeklySubjectRow = { subject: string; content: string };

export type WeeklySheetDraft = {
  className: string;
  teacherName: string;
  teacherPhone: string;
  parasha: string;
  hebrewYear: string;
  subjects: WeeklySubjectRow[];
  exams: string;
  announcements: string;
  praise: string;
  guidelines: string[];
  evalFields: string[];
  returnBy: string;
};

/** המקצועות שמופיעים בדף קשר שבועי, בסדר המקובל. */
export const WEEKLY_SUBJECTS = ["גמרא", "משנה", "תורה", "נביא", "הלכה"] as const;

/** שדות ההערכה שההורה ממלא בדף החתימה. */
export const DEFAULT_EVAL_FIELDS = [
  "קריאה נכונה",
  "ביאורי מילים",
  "שקלא וטריא",
  "עזרה בבית",
  "התנהגות",
  "הערות",
] as const;

/** ההנחיות הקבועות להורים — נשמרות כטקסט חופשי וניתנות לעריכה. */
export const DEFAULT_GUIDELINES = [
  "ודאו שכל העבודות בוצעו בספרים ובחוברות שסומנו בכיתה.",
  "תלמיד שהשלים עבודה בבית — יציג אותה למלמד למחרת לסימון.",
  "המבחנים נשארים בגמרא; יש לוודא שכל מבחן מוחזר חתום בידי ההורים.",
  "יש להחזיר את דף הקשר חתום ביום א' בבוקר.",
] as const;

export function makeDefaultWeeklySheet(args: {
  className?: string;
  teacherName?: string;
  parasha?: string;
  hebrewYear?: string;
}): WeeklySheetDraft {
  return {
    className: args.className ?? "",
    teacherName: args.teacherName ?? "",
    teacherPhone: "",
    parasha: args.parasha ?? "",
    hebrewYear: args.hebrewYear ?? "",
    subjects: WEEKLY_SUBJECTS.map((subject) => ({ subject, content: "" })),
    exams: "",
    announcements: "",
    praise: "",
    guidelines: [...DEFAULT_GUIDELINES],
    evalFields: [...DEFAULT_EVAL_FIELDS],
    returnBy: "יום א' בבוקר",
  };
}

const STORAGE_PREFIX = "weekly-sheet:";

export function weeklySheetStorageKey(classId: string): string {
  return `${STORAGE_PREFIX}${classId || "general"}`;
}

/** קורא טיוטה שמורה מהדפדפן. מחזיר null כשאין טיוטה או שהיא פגומה. */
export function readWeeklySheetDraft(classId: string): WeeklySheetDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(weeklySheetStorageKey(classId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WeeklySheetDraft>;
    if (!parsed || !Array.isArray(parsed.subjects)) return null;
    return { ...makeDefaultWeeklySheet({}), ...parsed } as WeeklySheetDraft;
  } catch {
    return null;
  }
}

export function writeWeeklySheetDraft(classId: string, draft: WeeklySheetDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(weeklySheetStorageKey(classId), JSON.stringify(draft));
  } catch {
    /* אין מקום אחסון — ממשיכים בלי שמירה */
  }
}