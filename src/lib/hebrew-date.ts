/**
 * Hebrew (Jewish) calendar helpers for *day + month* conversions — used for
 * Hebrew birthdays.
 *
 * NOTE: this is deliberately separate from `src/lib/year-rollover.ts`, which
 * only derives the Hebrew *year* label (תשפ״ז) for academic years using a
 * manual calculation. Here we need exact day/month conversion, so we use
 * `@hebcal/core` (`HDate`) — the same approach already used by the class
 * calendar route.
 */
import { HDate, Locale, months } from "@hebcal/core";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseIso(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function stripHebrewYear(rendered: string): string {
  // "כ״ו טֵבֵת תשפ״ו" -> "כ״ו טֵבֵת"
  return rendered.replace(/\s+תש.*$/, "").trim();
}

/** e.g. "2015-11-24" -> "י״ב בכסלו" (day + month, no year). */
export function toHebrewDateLabel(iso: string | null | undefined): string | null {
  const d = iso ? parseIso(iso) : null;
  if (!d) return null;
  const short = stripHebrewYear(new HDate(d).renderGematriya());
  const [day, ...rest] = short.split(" ");
  if (!rest.length) return short;
  return `${day} ב${rest.join(" ")}`;
}

/** Full Hebrew date including year, e.g. "י״ב כסלו תשע״ו". */
export function toHebrewDateFull(iso: string | null | undefined): string | null {
  const d = iso ? parseIso(iso) : null;
  if (!d) return null;
  return new HDate(d).renderGematriya();
}

/**
 * The same Hebrew day+month as `birth`, projected onto Hebrew year `hyear`,
 * with the classic edge cases handled:
 * - 30 Cheshvan / 30 Kislev in a year where that month has only 29 days →
 *   rolls over to the 1st of the following Hebrew month.
 * - Adar of a regular year → Adar II in a leap year (and vice versa).
 */
function hebrewAnniversary(birth: HDate, hyear: number): HDate {
  const leap = HDate.isLeapYear(hyear);
  let month = birth.getMonth();
  if (month === months.ADAR_II && !leap) month = months.ADAR_I;
  else if (month === months.ADAR_I && leap && HDate.isLeapYear(birth.getFullYear()) === false) {
    month = months.ADAR_II;
  }

  const maxDay = HDate.daysInMonth(month, hyear);
  const day = birth.getDate();
  if (day > maxDay) {
    // e.g. 30 Kislev in a year where Kislev is short → 1 Tevet
    return new HDate(maxDay, month, hyear).next();
  }
  return new HDate(day, month, hyear);
}

export type HebrewBirthday = {
  /** ISO Gregorian date of the upcoming Hebrew birthday. */
  iso: string;
  /** Hebrew label of the birth date itself, e.g. "י״ב בכסלו". */
  hebrewLabel: string;
  /** Whole days from today (0 = today). */
  daysUntil: number;
  /** Hebrew age reached on that date, when computable. */
  age: number | null;
};

/**
 * Next occurrence (today counts) of the Hebrew birthday matching `iso`.
 * Returns null for a missing/invalid date.
 */
export function nextHebrewBirthday(
  iso: string | null | undefined,
  from: Date = new Date(),
): HebrewBirthday | null {
  const birthDate = iso ? parseIso(iso) : null;
  if (!birthDate) return null;

  const birth = new HDate(birthDate);
  const todayStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const currentHYear = new HDate(todayStart).getFullYear();

  for (const hyear of [currentHYear, currentHYear + 1]) {
    const anniversary = hebrewAnniversary(birth, hyear);
    const greg = anniversary.greg();
    const gregStart = new Date(greg.getFullYear(), greg.getMonth(), greg.getDate());
    if (gregStart.getTime() < todayStart.getTime()) continue;
    const daysUntil = Math.round(
      (gregStart.getTime() - todayStart.getTime()) / 86_400_000,
    );
    const age = hyear - birth.getFullYear();
    return {
      iso: toIsoDate(gregStart),
      hebrewLabel: toHebrewDateLabel(iso) ?? "",
      daysUntil,
      age: age > 0 && age < 130 ? age : null,
    };
  }
  return null;
}

/** "היום!" / "מחר" / "בעוד 5 ימים" */
export function daysUntilLabel(daysUntil: number): string {
  if (daysUntil <= 0) return "היום!";
  if (daysUntil === 1) return "מחר";
  return `בעוד ${daysUntil} ימים`;
}

/**
 * ISO Gregorian dates on which the Hebrew birthday of `iso` falls inside the
 * [fromIso, toIso] window (used by the class calendar grid). Derived on the
 * fly — nothing is stored.
 */
export function hebrewBirthdaysInRange(
  iso: string | null | undefined,
  fromIso: string,
  toIso: string,
): { iso: string; hebrewLabel: string; age: number | null }[] {
  const start = parseIso(fromIso);
  const end = parseIso(toIso);
  const birthDate = iso ? parseIso(iso) : null;
  if (!start || !end || !birthDate) return [];

  const birth = new HDate(birthDate);
  const hYears = new Set([
    new HDate(start).getFullYear(),
    new HDate(end).getFullYear(),
  ]);
  const out: { iso: string; hebrewLabel: string; age: number | null }[] = [];
  for (const hyear of hYears) {
    const greg = hebrewAnniversary(birth, hyear).greg();
    const day = new Date(greg.getFullYear(), greg.getMonth(), greg.getDate());
    if (day < start || day > end) continue;
    const age = hyear - birth.getFullYear();
    out.push({
      iso: toIsoDate(day),
      hebrewLabel: toHebrewDateLabel(iso) ?? "",
      age: age > 0 && age < 130 ? age : null,
    });
  }
  return out;
}
