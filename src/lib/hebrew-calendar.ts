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

/* ===================== הזנת תאריך עברי ידנית ===================== */

const GEMATRIYA: Record<string, number> = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50,
  ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90, ק: 100, ר: 200, ש: 300, ת: 400,
};

/** ממיר מספר בגימטריה ("כ״א", "תשפ״ו") למספר. 0 כשאין אותיות תקינות. */
export function gematriyaToNumber(text: string): number {
  let sum = 0;
  for (const ch of text.replace(/[׳'"״\s-]/g, "")) {
    const v = GEMATRIYA[ch];
    if (!v) return 0;
    sum += v;
  }
  return sum;
}

/** משלים אלפים חסרים בשנה עברית מקוצרת: תשפ״ו → 5786. */
function normalizeHebrewYear(n: number): number {
  if (n > 4000) return n;
  if (n > 0 && n < 1000) return 5000 + n;
  return n;
}

export type HebrewDateParse =
  | { ok: true; date: Date; info: HebrewDayInfo }
  | { ok: false; error: string };

/**
 * מפרק הזנה ידנית בעברית — "כ״א אלול תשפ״ו", "כא אלול תשפו",
 * וגם ספרות: "21 אלול 5786". החזרה כוללת את התאריך הלועזי המקביל.
 */
export function parseHebrewDateInput(input: string): HebrewDateParse {
  const cleaned = input.trim().replace(/\s+/g, " ").replace(/^ה?בתאריך /, "");
  if (!cleaned) return { ok: false, error: "הזן תאריך עברי, למשל: כ״א אלול תשפ״ו" };

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length < 2) return { ok: false, error: "חסר שם החודש העברי (למשל אלול)" };

  const dayRaw = parts[0]!;
  const yearRaw = parts.length >= 3 ? parts[parts.length - 1]! : "";
  const monthRaw = parts.slice(1, parts.length >= 3 ? parts.length - 1 : parts.length).join(" ");

  const day = /^\d+$/.test(dayRaw) ? Number(dayRaw) : gematriyaToNumber(dayRaw);
  if (!day || day < 1 || day > 30) return { ok: false, error: `יום לא תקין: ${dayRaw}` };

  let month: number;
  try {
    month = HDate.monthFromName(monthRaw.replace(/^ב/, ""));
  } catch {
    return { ok: false, error: `חודש עברי לא מזוהה: ${monthRaw}` };
  }

  const todayHy = new HDate(midnight(new Date())).getFullYear();
  const year = yearRaw
    ? normalizeHebrewYear(/^\d+$/.test(yearRaw) ? Number(yearRaw) : gematriyaToNumber(yearRaw))
    : todayHy;
  if (!year || year < 4000 || year > 7000) return { ok: false, error: `שנה עברית לא תקינה: ${yearRaw}` };

  let hd: HDate;
  try {
    hd = new HDate(day, month, year);
  } catch {
    return { ok: false, error: "התאריך אינו קיים בלוח העברי" };
  }
  if (hd.getDate() !== day) return { ok: false, error: "התאריך אינו קיים בחודש העברי הזה" };

  const date = midnight(hd.greg());
  return { ok: true, date, info: hebrewDayInfo(date) };
}

/** ממיר תאריך לועזי (ISO או Date) למידע העברי המלא. */
export function hebrewFromGregorian(value: string | Date): HebrewDayInfo | null {
  const d = value instanceof Date ? value : new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return hebrewDayInfo(d);
}

export type ElapsedSpan = {
  /** מספר ימים (חיובי = עבר, שלילי = עתיד) */
  days: number;
  weeks: number;
  restDays: number;
  /** מספר חודשים עבריים שלמים שחלפו */
  hebrewMonths: number;
  direction: "past" | "future" | "today";
  /** תיאור בעברית: "חלפו 3 שבועות ו-2 ימים" */
  label: string;
};

/** תאריך-החלוף: כמה ימים/שבועות/חודשים עבריים חלפו בין שני תאריכים. */
export function elapsedSince(from: Date | string, to: Date | string = new Date()): ElapsedSpan {
  const a = midnight(from instanceof Date ? from : new Date(`${from}T00:00:00`));
  const b = midnight(to instanceof Date ? to : new Date(`${to}T00:00:00`));
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  const abs = Math.abs(days);
  const weeks = Math.floor(abs / 7);
  const restDays = abs % 7;

  const ha = new HDate(a);
  const hb = new HDate(b);
  const monthsRaw =
    (hb.getFullYear() - ha.getFullYear()) * 12 + (hb.getMonth() - ha.getMonth());
  const hebrewMonths = Math.max(0, Math.abs(monthsRaw) - (hb.getDate() < ha.getDate() ? 1 : 0));

  const direction: ElapsedSpan["direction"] = days === 0 ? "today" : days > 0 ? "past" : "future";
  const pieces: string[] = [];
  if (weeks > 0) pieces.push(weeks === 1 ? "שבוע" : `${weeks} שבועות`);
  if (restDays > 0) pieces.push(restDays === 1 ? "יום" : `${restDays} ימים`);
  const span = pieces.join(" ו-") || "פחות מיום";
  const label =
    direction === "today" ? "היום" : direction === "past" ? `חלפו ${span}` : `בעוד ${span}`;

  return { days, weeks, restDays, hebrewMonths, direction, label };
}

/** רשימת השבועות של החודש העברי — לתצוגת לוח וחישוב תאריכי חזרה. */
export function hebrewMonthWeeks(date: Date = new Date()): {
  index: number;
  from: string;
  to: string;
  label: string;
  parasha: string;
}[] {
  const { start, end } = hebrewMonthBounds(date);
  const weeks: { index: number; from: string; to: string; label: string; parasha: string }[] = [];
  let cursor = new Date(start);
  let index = 1;
  while (cursor <= end) {
    const w = hebrewWeekBounds(cursor);
    const from = w.start < start ? start : w.start;
    const to = w.end > end ? end : w.end;
    const fromInfo = hebrewDayInfo(from);
    const toInfo = hebrewDayInfo(to);
    weeks.push({
      index,
      from: isoOf(from),
      to: isoOf(to),
      label: `${fromInfo.day} – ${toInfo.day} ${toInfo.month}`,
      parasha: parashaOf(from),
    });
    cursor = new Date(w.end);
    cursor.setDate(cursor.getDate() + 1);
    index += 1;
  }
  return weeks;
}

/** הזזת תאריך ביחידות של הלוח העברי (יום / שבוע / חודש עברי). */
export function shiftHebrew(date: Date, unit: "day" | "week" | "month", amount: number): Date {
  const d = midnight(date);
  if (unit === "day" || unit === "week") {
    const next = new Date(d);
    next.setDate(next.getDate() + amount * (unit === "week" ? 7 : 1));
    return next;
  }
  const hd = new HDate(d);
  const total = hd.getMonth() + amount;
  let year = hd.getFullYear();
  let month = total;
  while (month < 1) {
    year -= 1;
    month += HDate.monthsInYear(year);
  }
  while (month > HDate.monthsInYear(year)) {
    month -= HDate.monthsInYear(year);
    year += 1;
  }
  const maxDay = HDate.daysInMonth(month, year);
  return midnight(new HDate(Math.min(hd.getDate(), maxDay), month, year).greg());
}
