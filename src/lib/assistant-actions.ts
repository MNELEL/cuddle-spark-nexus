/**
 * מפרט השדות של כל כוונת כתיבה של העוזר החכם.
 * מקור אמת אחד: גם לוולידציה לפני ביצוע, גם לעריכה המהירה בכרטיס הסקירה.
 */

export type AssistantFieldType = "text" | "textarea" | "number" | "date" | "select";

export type AssistantField = {
  key: string;
  label: string;
  type: AssistantFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

const STUDENT_FIELD: AssistantField = {
  key: "student_id",
  label: "תלמיד",
  type: "select",
  required: true,
  options: [],
};

const DATE_FIELD: AssistantField = { key: "date", label: "תאריך", type: "date" };

export const ASSISTANT_ACTION_FIELDS: Record<string, AssistantField[]> = {
  add_grade: [
    STUDENT_FIELD,
    { key: "subject", label: "מקצוע", type: "text", required: true, placeholder: "גמרא / חומש / הלכה" },
    { key: "value", label: "ציון", type: "number", required: true },
    { key: "max_value", label: "מתוך", type: "number" },
    DATE_FIELD,
    { key: "notes", label: "הערה", type: "text" },
  ],
  mark_attendance: [
    STUDENT_FIELD,
    {
      key: "status", label: "סטטוס", type: "select", required: true,
      options: [
        { value: "present", label: "נוכח" },
        { value: "absent", label: "נעדר" },
        { value: "late", label: "איחור" },
        { value: "excused", label: "מאושר" },
      ],
    },
    DATE_FIELD,
    { key: "notes", label: "הערה", type: "text" },
  ],
  add_note: [
    STUDENT_FIELD,
    { key: "description", label: "תיאור", type: "textarea", required: true },
    {
      key: "type", label: "סוג", type: "select",
      options: [
        { value: "positive", label: "חיובי" },
        { value: "negative", label: "שלילי" },
        { value: "neutral", label: "ניטרלי" },
      ],
    },
    { key: "category", label: "קטגוריה", type: "text" },
    DATE_FIELD,
  ],
  add_behavior: [
    STUDENT_FIELD,
    { key: "points", label: "נקודות", type: "number", required: true },
    { key: "category", label: "קטגוריה", type: "text" },
    { key: "note", label: "הערה", type: "text" },
  ],
  add_parent_call: [
    STUDENT_FIELD,
    { key: "summary", label: "סיכום השיחה", type: "textarea", required: true },
    { key: "subject", label: "נושא", type: "text" },
    {
      key: "channel", label: "ערוץ", type: "select",
      options: [
        { value: "phone", label: "טלפון" },
        { value: "meeting", label: "פגישה" },
        { value: "whatsapp", label: "וואטסאפ" },
        { value: "email", label: "מייל" },
      ],
    },
    DATE_FIELD,
  ],
  add_incident: [
    STUDENT_FIELD,
    { key: "description", label: "תיאור האירוע", type: "textarea", required: true },
    {
      key: "severity", label: "חומרה", type: "select", required: true,
      options: [
        { value: "low", label: "קלה" },
        { value: "medium", label: "בינונית" },
        { value: "high", label: "חמורה" },
      ],
    },
    { key: "category", label: "קטגוריה", type: "text" },
    DATE_FIELD,
  ],
  add_daily_update: [
    { key: "text", label: "תיעוד היום", type: "textarea", required: true },
    DATE_FIELD,
  ],
  add_announcement: [
    { key: "title", label: "כותרת", type: "text", required: true },
    { key: "body", label: "תוכן", type: "textarea" },
    {
      key: "severity", label: "חומרה", type: "select",
      options: [
        { value: "info", label: "מידע" },
        { value: "warning", label: "אזהרה" },
        { value: "urgent", label: "דחוף" },
      ],
    },
  ],
  add_class_event: [
    { key: "title", label: "כותרת האירוע", type: "text", required: true },
    {
      key: "type", label: "סוג", type: "select", required: true,
      options: [
        { value: "exam", label: "מבחן" },
        { value: "special_exam", label: "מבחן מיוחד" },
        { value: "trip", label: "טיול" },
        { value: "holiday", label: "חג" },
        { value: "meeting", label: "מפגש" },
        { value: "birthday", label: "יום הולדת" },
        { value: "celebration", label: "שמחה" },
        { value: "other", label: "אחר" },
      ],
    },
    DATE_FIELD,
    { key: "end_date", label: "עד תאריך", type: "date" },
    { key: "notes", label: "הערות", type: "textarea" },
    { key: "student_id", label: "תלמיד (לא חובה)", type: "select", options: [] },
  ],
};

export function fieldsForKind(kind: string): AssistantField[] {
  return ASSISTANT_ACTION_FIELDS[kind] ?? [];
}

/** מחזיר את השדות החסרים או הריקים שחייבים למלא לפני שליחה מחדש. */
export function missingRequiredFields(
  kind: string,
  params: Record<string, unknown>,
): AssistantField[] {
  return fieldsForKind(kind).filter((f) => {
    if (!f.required) return false;
    const v = params[f.key];
    if (v === null || v === undefined) return true;
    const s = String(v).trim();
    if (s === "") return true;
    if (f.type === "number" && !Number.isFinite(Number(s))) return true;
    if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
    return false;
  });
}

/** האם הפעולה מוכנה לביצוע (אין שדה חובה חסר). */
export function isActionReady(kind: string, params: Record<string, unknown>): boolean {
  return missingRequiredFields(kind, params).length === 0;
}
