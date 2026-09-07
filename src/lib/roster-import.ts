/**
 * לוגיקת ייבוא רשימת תלמידים אמיתית מאקסל — זיהוי עמודות בעברית/אנגלית,
 * מיפוי ידני, ניקוי כפילויות ובניית השורות לייבוא. ללא תלות ב-UI כדי שאפשר לבדוק.
 */
export type Height = "low" | "mid" | "high";
export type RowPref = "front" | "mid" | "back" | "any";

export type RosterField =
  | "ignore"
  | "full_name"
  | "first_name"
  | "middle_name"
  | "last_name"
  | "birth_date"
  | "start_date"
  | "height"
  | "row_pref"
  | "corner_pref"
  | "notes";

export type RosterMapping = Record<string, RosterField>;

export type RosterStudent = {
  name: string;
  height: Height;
  row_pref: RowPref;
  corner_pref: boolean;
  notes: string;
  /** תאריך לידה כ-ISO (מקור אמת), נקרא מהאקסל בעברית או בלועזי. */
  birth_date: string | null;
  /** תאריך תחילת הלימוד בכיתה — "תאריך-החלוף" של התלמיד. */
  start_date: string | null;
};

export const ROSTER_FIELD_LABELS: Record<RosterField, string> = {
  ignore: "לא לייבא",
  full_name: "שם מלא",
  first_name: "שם פרטי",
  middle_name: "שם האב / שם נוסף",
  last_name: "שם משפחה",
  birth_date: "תאריך לידה",
  start_date: "תאריך תחילת לימוד (תאריך-החלוף)",
  height: "גובה",
  row_pref: "העדפת שורה",
  corner_pref: "פינה",
  notes: "הערות",
};

const HEIGHT_MAP: Record<string, Height> = {
  low: "low", mid: "mid", high: "high",
  "נמוך": "low", "בינוני": "mid", "גבוה": "high", "ממוצע": "mid",
};

const ROW_MAP: Record<string, RowPref> = {
  front: "front", mid: "mid", back: "back", any: "any",
  "קדמית": "front", "קדימה": "front", "אמצעית": "mid", "אמצע": "mid",
  "אחורית": "back", "אחורה": "back", "לא משנה": "any",
};

const TRUE_VALUES = ["1", "true", "כן", "yes", "v", "✓", "x"];

/**
 * ממיר תא תאריך מהאקסל ל-ISO. תומך בתאריך עברי ("כ״א אלול תשפ״ו"),
 * בתאריך לועזי (2026-09-02, 02/09/2026, 2.9.2026) ובמספר הסידורי של אקסל.
 */
export function parseRosterDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) return isoDay(value);

  if (typeof value === "number" && Number.isFinite(value)) {
    // מספר סידורי של אקסל: יום 1 = 1900-01-01, עם באג השנה המעוברת של 1900.
    if (value < 1 || value > 80000) return null;
    const ms = Math.round((value - 25569) * 86400000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : isoDay(d);
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number) as [number, number, number];
    return validIso(y, m, d);
  }
  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += year < 40 ? 2000 : 1900;
    return validIso(year, month, day);
  }

  const hebrew = parseHebrewDateInput(raw);
  return hebrew.ok ? isoDay(hebrew.date) : null;
}

function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function validIso(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(m)}-${p(d)}`;
}

/** ניחוש שדה לפי כותרת העמודה בקובץ. */
export function guessField(header: string): RosterField {
  const h = header.trim().toLowerCase();
  if (!h) return "ignore";
  const has = (...keys: string[]) => keys.some((k) => h.includes(k));
  if (has("תאריך לידה", "לידה", "birth", "dob")) return "birth_date";
  if (has("תחילת", "הצטרפ", "כניסה לכיתה", "start", "join", "enroll")) return "start_date";
  if (has("שם פרטי", "first")) return "first_name";
  if (has("שם משפחה", "משפחה", "last", "surname")) return "last_name";
  if (has("שם האב", "אמצעי", "middle")) return "middle_name";
  if (has("שם מלא", "שם התלמיד", "full name")) return "full_name";
  if (h === "שם" || h === "name" || has("שם")) return "full_name";
  if (has("גובה", "height")) return "height";
  if (has("שורה", "row")) return "row_pref";
  if (has("פינה", "corner")) return "corner_pref";
  if (has("הערה", "הערות", "note", "comment")) return "notes";
  return "ignore";
}

/** מיפוי אוטומטי לכל עמודות הקובץ. */
export function guessMapping(headers: string[]): RosterMapping {
  const map: RosterMapping = {};
  for (const h of headers) map[h] = guessField(h);
  return map;
}

function pickRaw(
  row: Record<string, unknown>,
  mapping: RosterMapping,
  field: RosterField,
): unknown {
  for (const [header, f] of Object.entries(mapping)) {
    if (f === field) {
      const v = row[header];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
  }
  return undefined;
}

function pick(row: Record<string, unknown>, mapping: RosterMapping, field: RosterField): string {
  const v = pickRaw(row, mapping, field);
  return v === undefined ? "" : String(v).trim();
}

export type RosterParseResult = {
  students: RosterStudent[];
  skipped: number;
  duplicatesInFile: string[];
  existingMatches: string[];
};

/**
 * ממיר שורות גולמיות מהאקסל לרשימת תלמידים לייבוא.
 * שורות בלי שם נדלגות; כפילויות בתוך הקובץ ומול שמות קיימים מסוננות.
 */
export function buildRosterStudents(
  rows: Record<string, unknown>[],
  mapping: RosterMapping,
  existingNames: string[] = [],
): RosterParseResult {
  const existing = new Set(existingNames.map((n) => n.replace(/\s+/g, " ").trim()));
  const seen = new Set<string>();
  const students: RosterStudent[] = [];
  const duplicatesInFile: string[] = [];
  const existingMatches: string[] = [];
  let skipped = 0;

  for (const row of rows) {
    const full = pick(row, mapping, "full_name");
    const name = (
      full ||
      [
        pick(row, mapping, "first_name"),
        pick(row, mapping, "middle_name"),
        pick(row, mapping, "last_name"),
      ]
        .filter(Boolean)
        .join(" ")
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);

    if (!name) {
      skipped += 1;
      continue;
    }
    if (seen.has(name)) {
      duplicatesInFile.push(name);
      continue;
    }
    if (existing.has(name)) {
      existingMatches.push(name);
      continue;
    }
    seen.add(name);

    students.push({
      name,
      height: HEIGHT_MAP[pick(row, mapping, "height").toLowerCase()] ?? "mid",
      row_pref: ROW_MAP[pick(row, mapping, "row_pref").toLowerCase()] ?? "any",
      corner_pref: TRUE_VALUES.includes(pick(row, mapping, "corner_pref").toLowerCase()),
      notes: pick(row, mapping, "notes").slice(0, 2000),
    });
  }

  return { students, skipped, duplicatesInFile, existingMatches };
}

/** האם המיפוי מספיק כדי להפיק שם לתלמיד. */
export function mappingHasName(mapping: RosterMapping): boolean {
  const fields = Object.values(mapping);
  return fields.includes("full_name") || fields.includes("first_name") || fields.includes("last_name");
}
