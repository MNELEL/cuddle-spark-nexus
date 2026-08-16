/**
 * Hebrew-month navigation helpers for calendar grids that are driven by the
 * Hebrew month (טבת, שבט…) rather than the Gregorian one.
 *
 * Month arithmetic is done through `HDate` day stepping (last day → `next()`)
 * instead of raw month numbers, because the Hebrew year has a variable number
 * of months (Adar I/II in a leap year) and the year starts at Tishrei.
 */
import { HDate, Locale } from "@hebcal/core";

export type HebMonthCursor = { hy: number; hm: number };

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Hebrew month containing the given Gregorian date. */
export function hebMonthOf(d: Date): HebMonthCursor {
  const hd = new HDate(d);
  return { hy: hd.getFullYear(), hm: hd.getMonth() };
}

/** First/last Gregorian dates of a Hebrew month (local midnight). */
export function hebMonthBounds(c: HebMonthCursor): { start: Date; end: Date } {
  const firstG = new HDate(1, c.hm, c.hy).greg();
  const lastDay = HDate.daysInMonth(c.hm, c.hy);
  const lastG = new HDate(lastDay, c.hm, c.hy).greg();
  return {
    start: new Date(firstG.getFullYear(), firstG.getMonth(), firstG.getDate()),
    end: new Date(lastG.getFullYear(), lastG.getMonth(), lastG.getDate()),
  };
}

export function nextHebMonth(c: HebMonthCursor): HebMonthCursor {
  const last = new HDate(HDate.daysInMonth(c.hm, c.hy), c.hm, c.hy);
  const first = last.next();
  return { hy: first.getFullYear(), hm: first.getMonth() };
}

export function prevHebMonth(c: HebMonthCursor): HebMonthCursor {
  const prevLast = new HDate(1, c.hm, c.hy).prev();
  return { hy: prevLast.getFullYear(), hm: prevLast.getMonth() };
}

/** e.g. "טֵבֵת תשפ״ז" */
export function hebMonthLabel(c: HebMonthCursor): string {
  const first = new HDate(1, c.hm, c.hy);
  const monthName = Locale.gettext(first.getMonthName(), "he");
  const yearHe = first.renderGematriya().split(" ").pop() ?? "";
  return `${monthName} ${yearHe}`;
}

/** Is this Gregorian date a Rosh Chodesh day (1st, or the 30th of a long month)? */
export function isRoshChodesh(d: Date): boolean {
  const hd = new HDate(d);
  const day = hd.getDate();
  if (day === 30) return true;
  // 1 Tishrei is Rosh Hashana, not Rosh Chodesh
  return day === 1 && hd.getMonth() !== 7;
}