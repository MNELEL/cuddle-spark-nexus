/**
 * Pure helpers for the year-rollover flow (no DB access, easy to unit test).
 */

export const HEBREW_GRADE_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"] as const;

/**
 * Given a class name, return the name of the *previous* grade
 * ("כיתה ב1" -> "כיתה א1", "ג'" -> "ב'"), keeping any suffix intact.
 * Returns null when no grade letter is found or it's already the first grade.
 */
export function previousGradeName(name: string): string | null {
  return shiftGradeLetter(name, -1);
}

/** Next grade name ("כיתה א1" -> "כיתה ב1"). */
export function nextGradeName(name: string): string | null {
  return shiftGradeLetter(name, 1);
}

function shiftGradeLetter(name: string, delta: number): string | null {
  const letters: readonly string[] = HEBREW_GRADE_LETTERS;
  const re = /(^|[\s"״'׳(])([אבגדהוזח])(?=$|[\s'׳"״)0-9])/u;
  const m = re.exec(name);
  if (!m) return null;
  const idx = letters.indexOf(m[2] as string);
  const next = idx + delta;
  if (idx < 0 || next < 0 || next >= letters.length) return null;
  const at = (m.index ?? 0) + (m[1]?.length ?? 0);
  return name.slice(0, at) + letters[next] + name.slice(at + 1);
}

/** Hebrew year number (e.g. 5787) for a date; school year starts in Tishrei (~Sept). */
export function hebrewYearNumber(date = new Date()): number {
  const g = date.getFullYear();
  return date.getMonth() >= 8 ? g + 3761 : g + 3760;
}

const HUNDREDS = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];
const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];

/** Format a Hebrew year number as letters, e.g. 5787 -> תשפ"ז. */
export function formatHebrewYear(year: number): string {
  let n = year % 1000;
  let out = "";
  while (n >= 100) {
    const h = Math.min(Math.floor(n / 100), 9);
    out += HUNDREDS[h];
    n -= h * 100;
  }
  let tens = Math.floor(n / 10);
  let ones = n % 10;
  if (tens === 1 && (ones === 5 || ones === 6)) {
    out += ones === 5 ? "טו" : "טז";
    tens = 0;
    ones = 0;
  } else {
    out += TENS[tens] + ONES[ones];
  }
  if (out.length <= 1) return out;
  return `${out.slice(0, -1)}"${out.slice(-1)}`;
}

/** Default academic year label for new classes, e.g. תשפ"ז. */
export function defaultAcademicYear(date = new Date()): string {
  return formatHebrewYear(hebrewYearNumber(date));
}