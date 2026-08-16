/**
 * Recurring schedule rules — "every Friday we finish at 12:30", "on Rosh
 * Chodesh we start at 09:00", "no lessons on Rosh Chodesh".
 *
 * Unlike `academic_calendar_overrides` (a concrete date range), a rule has no
 * dates: it is evaluated on the fly for any date, so Rosh Chodesh never has to
 * be entered manually — it is derived from the Hebrew calendar.
 */
import { isRoshChodesh } from "@/lib/hebrew-months";

export type RuleKind = "weekly_day" | "rosh_chodesh";
export type RuleEffect = "early_end" | "late_start" | "no_school";

export type RecurringRule = {
  id: string;
  class_id: string;
  kind: RuleKind;
  day_key: string | null;
  effect: RuleEffect;
  hour: number | null;
  minute: number;
  label: string | null;
  active: boolean;
};

export const RULE_KIND_LABEL: Record<RuleKind, string> = {
  weekly_day: "כל שבוע ביום קבוע",
  rosh_chodesh: "ראש חודש (מחושב אוטומטית)",
};

export const RULE_EFFECT_LABEL: Record<RuleEffect, string> = {
  early_end: "סיום מוקדם",
  late_start: "התחלה מאוחרת",
  no_school: "אין לימודים",
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function timeLabel(hour: number | null | undefined, minute: number | null | undefined): string {
  if (hour == null) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute ?? 0).padStart(2, "0")}`;
}

export function minutesOf(hour: number, minute = 0): number {
  return hour * 60 + minute;
}

/** Does the rule apply to this Gregorian date? */
export function ruleMatchesDate(rule: RecurringRule, d: Date): boolean {
  if (!rule.active) return false;
  if (rule.kind === "rosh_chodesh") return isRoshChodesh(d);
  return rule.day_key === DAY_KEYS[d.getDay()];
}

export type DayRuleEffect = {
  noSchool: boolean;
  /** Lessons must not start at/after this many minutes from midnight. */
  endMinutes: number | null;
  /** Lessons must not start before this many minutes from midnight. */
  startMinutes: number | null;
  labels: string[];
};

/** Merges every matching rule into a single effect for one date (strictest wins). */
export function effectiveRulesFor(rules: RecurringRule[], iso: string): DayRuleEffect {
  const d = new Date(`${iso}T00:00:00`);
  const out: DayRuleEffect = { noSchool: false, endMinutes: null, startMinutes: null, labels: [] };
  for (const r of rules) {
    if (!ruleMatchesDate(r, d)) continue;
    const text = r.label?.trim() || `${RULE_EFFECT_LABEL[r.effect]}${r.hour != null ? ` ${timeLabel(r.hour, r.minute)}` : ""}`;
    out.labels.push(text);
    if (r.effect === "no_school") { out.noSchool = true; continue; }
    if (r.hour == null) continue;
    const m = minutesOf(r.hour, r.minute ?? 0);
    if (r.effect === "early_end") out.endMinutes = out.endMinutes == null ? m : Math.min(out.endMinutes, m);
    if (r.effect === "late_start") out.startMinutes = out.startMinutes == null ? m : Math.max(out.startMinutes, m);
  }
  return out;
}

/** Is a lesson starting at hour:minute allowed on a day with this effect? */
export function slotAllowed(effect: DayRuleEffect, hour: number, minute = 0): boolean {
  if (effect.noSchool) return false;
  const m = minutesOf(hour, minute);
  if (effect.endMinutes != null && m >= effect.endMinutes) return false;
  if (effect.startMinutes != null && m < effect.startMinutes) return false;
  return true;
}