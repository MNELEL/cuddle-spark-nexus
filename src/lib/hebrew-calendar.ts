/**
 * קווים אוטומטיים ללוח העברי — כל התצוגות (יום, שבוע, חודש, שנה) נגזרות
 * מהתאריך העברי עצמו דרך `@hebcal/core`, כך שכל שינוי בתאריך העברי
 * מתגלגל אוטומטית לכל המסכים ללא שמירה כלשהי במסד הנתונים.
 */
import { HDate, HebrewCalendar, Locale } from "@hebcal/core";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const WEEKDAYS = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];

/** תחילת השבוע העברי (יום ראשון) וסופו (שבת) עבור תאריך לועזי נתון. */
export function hebrewWeekBounds(d: Date): { start: Date; end: Date } {
  const base = midnight(d);
  const start = new Date(base);
  start.setDate(start.getDate() - base.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start, end };
}

/** גבולות החודש העברי המכיל את התאריך. */
export function hebrewMonthBounds(d: Date): { start: Date; end: Date } {
  const hd = new HDate(midnight(d));
  const firstG = new HDate(1, hd.getMonth(), hd.getFullYear()).greg();
  const lastG = new HDate(
    HDate.daysInMonth(hd.getMonth(), hd.getFullYear()),
    hd.getMonth(),
    hd.getFullYear(),
  ).greg();
  return { start: midnight(firstG), end: midnight(lastG) };
}

/** גבולות שנת הלימודים העברית (א׳ תשרי – כ״ט אלול) של התאריך. */
export function hebrewYearBounds(d: Date): { start: Date; end: Date } {
  const hy = new HDate(midnight(d)).getFullYear();
  return {
    start: midnight(new HDate(1, 7, hy).greg()),
    end: midnight(new HDate(1, 7, hy + 1).prev().greg()),
  };
}

/** פרשת השבוע של אותו שבוע (ריק בשבועות שבהם אין קריאה רגילה). */
export function parashaOf(d: Date): string {
  const { start, end } = hebrewWeekBounds(d);
  const events = HebrewCalendar.calendar({ start, end, sedrot: true, noHolidays: true, il: true });
  const ev = events[0];
  return ev ? ev.render("he") : "";
}

/** מועדים וחגים החלים בתאריך (בעברית). */
export function holidaysOn(d: Date): string[] {
  const day = midnight(d);
  return HebrewCalendar.calendar({ start: day, end: day, il: true }).map((e) => e.render("he"));
}

export type HebrewDayInfo = {
  iso: string;
  /** "כ״א אֱלוּל תשפ״ו" */
  full: string;
  /** "כ״א" */
  day: string;
  /** "אֱלוּל תשפ״ו" */
  month: string;
  /** "תשפ״ו" */
  year: string;
  weekday: string;
  /** מספר היום בחודש העברי (1–30) */
  dayOfMonth: number;
  /** מספר השבוע בתוך החודש העברי (1–5) */
  weekOfMonth: number;
  /** מספר השבוע מתחילת השנה העברית */
  weekOfYear: number;
  parasha: string;
  holidays: string[];
  isRoshChodesh: boolean;
  isShabbat: boolean;
  /** גבולות השבוע/החודש/השנה העברית של אותו יום, כתאריכי ISO. */
  weekRange: { from: string; to: string };
  monthRange: { from: string; to: string };
  yearRange: { from: string; to: string };
};

/** כל הקווים של הלוח העברי הנגזרים מתאריך אחד. */
export function hebrewDayInfo(date: Date = new Date()): HebrewDayInfo {
  const d = midnight(date);
  const hd = new HDate(d);
  const full = hd.renderGematriya();
  const parts = full.split(" ");
  const day = parts[0] ?? "";
  const year = parts[parts.length - 1] ?? "";
  const monthName = Locale.gettext(hd.getMonthName(), "he");

  const week = hebrewWeekBounds(d);
  const month = hebrewMonthBounds(d);
  const yearB = hebrewYearBounds(d);
  const dayOfMonth = hd.getDate();
  const weekOfYear =
    Math.floor((week.start.getTime() - hebrewWeekBounds(yearB.start).start.getTime()) / 604_800_000) + 1;

  return {
    iso: isoOf(d),
    full,
    day,
    month: `${monthName} ${year}`,
    year,
    weekday: WEEKDAYS[d.getDay()]!,
    dayOfMonth,
    weekOfMonth: Math.floor((dayOfMonth - 1) / 7) + 1,
    weekOfYear,
    parasha: parashaOf(d),
    holidays: holidaysOn(d),
    isRoshChodesh: dayOfMonth === 30 || (dayOfMonth === 1 && hd.getMonth() !== 7),
    isShabbat: d.getDay() === 6,
    weekRange: { from: isoOf(week.start), to: isoOf(week.end) },
    monthRange: { from: isoOf(month.start), to: isoOf(month.end) },
    yearRange: { from: isoOf(yearB.start), to: isoOf(yearB.end) },
  };
}

export type HebrewRangePreset = {
  id: "today" | "week" | "month" | "prev_month" | "year";
  label: string;
  from: string;
  to: string;
};

/** טווחי סינון מוכנים — כולם נגזרים מהלוח העברי, לא מהחודש הלועזי. */
export function hebrewRangePresets(date: Date = new Date()): HebrewRangePreset[] {
  const info = hebrewDayInfo(date);
  const month = hebrewMonthBounds(midnight(date));
  const prevMonthDay = new Date(month.start);
  prevMonthDay.setDate(prevMonthDay.getDate() - 1);
  const prev = hebrewMonthBounds(prevMonthDay);
  const prevInfo = hebrewDayInfo(prevMonthDay);

  return [
    { id: "today", label: `היום · ${info.full}`, from: info.iso, to: info.iso },
    { id: "week", label: `השבוע${info.parasha ? ` · ${info.parasha}` : ""}`, ...info.weekRange },
    { id: "month", label: `חודש ${info.month}`, ...info.monthRange },
    {
      id: "prev_month",
      label: `חודש ${prevInfo.month}`,
      from: isoOf(prev.start),
      to: isoOf(prev.end),
    },
    { id: "year", label: `שנת ${info.year}`, ...info.yearRange },
  ];
}
