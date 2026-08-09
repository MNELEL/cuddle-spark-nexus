/**
 * Parashat HaShavua + Hebrew holiday helpers (pure, client-safe).
 * Uses @hebcal/core with the Israeli schedule (il = true).
 */
import { HDate, HebrewCalendar, Locale, flags, getSedra } from "@hebcal/core";

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}
export function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
/** Sunday that starts the week containing `d`. */
export function weekStartOf(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

/**
 * Hebrew name of the parasha read on the Shabbat of the week that starts at
 * `sunday`. On a festival Shabbat hebcal returns the festival reading name
 * (e.g. "שבת חול המועד פסח"), which is exactly what a teacher wants to see.
 */
export function parashaForWeek(sunday: Date): string | null {
  const shabbat = addDays(sunday, 6);
  const hd = new HDate(shabbat);
  try {
    const sedra = getSedra(hd.getFullYear(), true);
    const res = sedra.lookup(hd);
    const names = res?.parsha ?? [];
    if (!names.length) return null;
    return names.map((n) => Locale.gettext(n, "he")).join(" – ");
  } catch {
    return null;
  }
}

export type HolidayDay = {
  date: string;
  title: string;
  /** true when schools are normally closed (yom tov, chol ha-moed, major fast) */
  noSchool: boolean;
};

const NO_SCHOOL_MASK =
  flags.CHAG | flags.CHUL_ONLY | flags.CHOL_HAMOED | flags.MAJOR_FAST | flags.EREV;

/** Hebrew holidays between two ISO dates (inclusive), Israeli schedule. */
export function holidaysInRange(startIso: string, endIso: string): HolidayDay[] {
  const events = HebrewCalendar.calendar({
    start: parseIsoDate(startIso),
    end: parseIsoDate(endIso),
    il: true,
    noMinorFast: false,
  });
  const byDate = new Map<string, HolidayDay>();
  for (const ev of events) {
    const greg = ev.getDate().greg();
    const date = isoDate(greg);
    const f = ev.getFlags();
    const noSchool = (f & NO_SCHOOL_MASK) !== 0 && (f & flags.EREV) === 0;
    const title = ev.render("he");
    const prev = byDate.get(date);
    if (!prev) byDate.set(date, { date, title, noSchool });
    else byDate.set(date, { date, title: prev.title, noSchool: prev.noSchool || noSchool });
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Hebrew month/day label like "כ״ו בטבת" for a greg date. */
export function hebrewDayLabel(d: Date): string {
  return new HDate(d).renderGematriya().replace(/\s+תש.*$/, "").trim();
}
