/** Shared constants + helpers for the schedule views (week/day/month/year). */
import type { WeeklyDayKey } from "@/lib/weekly-schedule.functions";

export const ALL_DAYS: { key: WeeklyDayKey; label: string; short: string }[] = [
  { key: "sun", label: "ראשון", short: "א׳" },
  { key: "mon", label: "שני", short: "ב׳" },
  { key: "tue", label: "שלישי", short: "ג׳" },
  { key: "wed", label: "רביעי", short: "ד׳" },
  { key: "thu", label: "חמישי", short: "ה׳" },
  { key: "fri", label: "שישי", short: "ו׳" },
  { key: "sat", label: "שבת", short: "ש׳" },
];

export const DAY_INDEX: Record<WeeklyDayKey, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export const DAY_KEYS: WeeklyDayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function dayKeyOf(d: Date): WeeklyDayKey {
  return DAY_KEYS[d.getDay()]!;
}

export const KIND_LABEL: Record<string, string> = {
  task: "משימה",
  exam: "מבחן",
  pacing: "הספק",
};

export const OVERRIDE_LABEL: Record<string, string> = {
  institution_break: "חופשה",
  unexpected_closure: "סגירה בלתי צפויה",
  extra_session: "לימוד נוסף",
  late_start: "התחלה מאוחרת",
  early_end: "סיום מוקדם",
  holiday: "חג",
};

/** Expands overrides into a date -> types map for quick lookups in the grids. */
export function expandOverrides(
  items: { start_date: string; end_date: string; type: string; label: string | null }[],
): Map<string, { type: string; label: string | null }[]> {
  const map = new Map<string, { type: string; label: string | null }[]>();
  for (const o of items) {
    const start = new Date(`${o.start_date}T00:00:00`);
    const end = new Date(`${o.end_date}T00:00:00`);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const arr = map.get(iso) ?? [];
      arr.push({ type: o.type, label: o.label });
      map.set(iso, arr);
    }
  }
  return map;
}
