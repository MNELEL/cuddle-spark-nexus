import { describe, expect, it } from "vitest";
import { HDate } from "@hebcal/core";
import {
  hebMonthBounds, hebMonthLabel, hebMonthOf, isRoshChodesh, isoOf,
  nextHebMonth, prevHebMonth, type HebMonthCursor,
} from "@/lib/hebrew-months";
import {
  effectiveRulesFor, ruleMatchesDate, slotAllowed, timeLabel,
  type RecurringRule,
} from "@/lib/recurring-rules";

function rule(over: Partial<RecurringRule>): RecurringRule {
  return {
    id: "r1", class_id: "c1", kind: "weekly_day", day_key: "fri",
    effect: "early_end", hour: 12, minute: 30, label: null, active: true,
    ...over,
  };
}

describe("hebrew month navigation", () => {
  it("maps a Gregorian date to its Hebrew month and back to bounds", () => {
    const c = hebMonthOf(new Date(2026, 0, 15)); // mid Tevet 5786
    const { start, end } = hebMonthBounds(c);
    expect(new HDate(start).getDate()).toBe(1);
    expect(new HDate(end).getDate()).toBe(HDate.daysInMonth(c.hm, c.hy));
    expect(isoOf(start) <= "2026-01-15").toBe(true);
    expect(isoOf(end) >= "2026-01-15").toBe(true);
  });

  it("steps forward and backward without skipping or repeating months", () => {
    let c: HebMonthCursor = hebMonthOf(new Date(2026, 0, 15));
    const seen: string[] = [];
    for (let i = 0; i < 14; i++) {
      seen.push(`${c.hy}-${c.hm}`);
      c = nextHebMonth(c);
    }
    expect(new Set(seen).size).toBe(seen.length);
    // Walking back returns to the starting cursor.
    let back = c;
    for (let i = 0; i < 14; i++) back = prevHebMonth(back);
    expect(`${back.hy}-${back.hm}`).toBe(seen[0]);
  });

  it("crosses the Hebrew year boundary at Tishrei", () => {
    const elul = hebMonthOf(new Date(2026, 8, 10)); // Elul 5786
    const next = nextHebMonth(elul);
    expect(next.hy).toBe(elul.hy + 1);
    expect(hebMonthLabel(next)).toContain("תשפ");
  });

  it("includes Adar I and Adar II when walking through a leap year", () => {
    // 5787 is a leap year (13 months).
    let c: HebMonthCursor = { hy: 5787, hm: 7 }; // Tishrei 5787
    let months = 0;
    while (c.hy === 5787 || months === 0) {
      c = nextHebMonth(c);
      months++;
      if (months > 20) break;
    }
    expect(months).toBe(13);
  });

  it("detects Rosh Chodesh days but not Rosh Hashana", () => {
    const firstTishrei = new HDate(1, 7, 5787).greg();
    expect(isRoshChodesh(firstTishrei)).toBe(false);
    const firstShvat = new HDate(1, 5, 5786).greg();
    expect(isRoshChodesh(firstShvat)).toBe(true);
    const tenthShvat = new HDate(10, 5, 5786).greg();
    expect(isRoshChodesh(tenthShvat)).toBe(false);
  });
});

describe("recurring rules", () => {
  it("matches a weekly rule only on its weekday", () => {
    const r = rule({ day_key: "fri" });
    expect(ruleMatchesDate(r, new Date(2026, 7, 21))).toBe(true); // Friday
    expect(ruleMatchesDate(r, new Date(2026, 7, 20))).toBe(false); // Thursday
  });

  it("ignores inactive rules", () => {
    expect(ruleMatchesDate(rule({ active: false }), new Date(2026, 7, 21))).toBe(false);
  });

  it("matches a Rosh Chodesh rule on the computed Hebrew date", () => {
    const r = rule({ kind: "rosh_chodesh", day_key: null, effect: "late_start", hour: 9, minute: 0 });
    const rc = new HDate(1, 5, 5786).greg();
    expect(ruleMatchesDate(r, rc)).toBe(true);
    expect(ruleMatchesDate(r, new HDate(10, 5, 5786).greg())).toBe(false);
  });

  it("merges rules with the strictest window winning", () => {
    const iso = isoOf(new Date(2026, 7, 21)); // Friday
    const eff = effectiveRulesFor(
      [
        rule({ id: "a", effect: "early_end", hour: 13, minute: 0 }),
        rule({ id: "b", effect: "early_end", hour: 12, minute: 15 }),
        rule({ id: "c", effect: "late_start", hour: 8, minute: 0 }),
        rule({ id: "d", effect: "late_start", hour: 9, minute: 30 }),
      ],
      iso,
    );
    expect(eff.noSchool).toBe(false);
    expect(eff.endMinutes).toBe(12 * 60 + 15);
    expect(eff.startMinutes).toBe(9 * 60 + 30);
    expect(eff.labels).toHaveLength(4);
    expect(slotAllowed(eff, 9, 0)).toBe(false);
    expect(slotAllowed(eff, 9, 30)).toBe(true);
    expect(slotAllowed(eff, 12, 15)).toBe(false);
    expect(slotAllowed(eff, 11, 45)).toBe(true);
  });

  it("no_school beats every time-based rule", () => {
    const iso = isoOf(new Date(2026, 7, 21));
    const eff = effectiveRulesFor(
      [rule({ id: "a", effect: "no_school", hour: null }), rule({ id: "b", effect: "early_end", hour: 12, minute: 30 })],
      iso,
    );
    expect(eff.noSchool).toBe(true);
    expect(slotAllowed(eff, 8, 0)).toBe(false);
  });

  it("applies no effect on a day no rule matches", () => {
    const eff = effectiveRulesFor([rule({})], isoOf(new Date(2026, 7, 19))); // Wednesday
    expect(eff).toEqual({ noSchool: false, endMinutes: null, startMinutes: null, labels: [] });
    expect(slotAllowed(eff, 15, 45)).toBe(true);
  });

  it("formats 15-minute precision labels", () => {
    expect(timeLabel(14, 15)).toBe("14:15");
    expect(timeLabel(9, 0)).toBe("09:00");
    expect(timeLabel(null, 30)).toBe("");
  });
});
