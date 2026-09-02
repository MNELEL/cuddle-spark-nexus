import { describe, expect, it } from "vitest";
import {
  hebrewDayInfo,
  hebrewMonthBounds,
  hebrewRangePresets,
  hebrewWeekBounds,
  hebrewYearBounds,
  isoOf,
} from "@/lib/hebrew-calendar";

const REF = new Date(2026, 8, 2); // 2 Sep 2026 = כ׳ אלול תשפ״ו

describe("hebrewWeekBounds", () => {
  it("spans Sunday to Saturday", () => {
    const { start, end } = hebrewWeekBounds(REF);
    expect(start.getDay()).toBe(0);
    expect(end.getDay()).toBe(6);
    expect(Math.round((end.getTime() - start.getTime()) / 86_400_000)).toBe(6);
  });
});

describe("hebrewMonthBounds", () => {
  it("starts on the 1st of the Hebrew month and ends on its last day", () => {
    const { start, end } = hebrewMonthBounds(REF);
    expect(hebrewDayInfo(start).dayOfMonth).toBe(1);
    const dayAfter = new Date(end);
    dayAfter.setDate(dayAfter.getDate() + 1);
    expect(hebrewDayInfo(dayAfter).dayOfMonth).toBe(1);
  });
});

describe("hebrewYearBounds", () => {
  it("runs from 1 Tishrei to the eve of the next Hebrew year", () => {
    const { start, end } = hebrewYearBounds(REF);
    expect(hebrewDayInfo(start).dayOfMonth).toBe(1);
    const dayAfter = new Date(end);
    dayAfter.setDate(dayAfter.getDate() + 1);
    expect(hebrewDayInfo(dayAfter).dayOfMonth).toBe(1);
    expect(start.getTime()).toBeLessThan(end.getTime());
  });
});

describe("hebrewDayInfo", () => {
  it("derives Hebrew date, weekday and week counters", () => {
    const info = hebrewDayInfo(REF);
    expect(info.iso).toBe("2026-09-02");
    expect(info.full).toContain("תשפ״ו");
    expect(info.weekday).toBe("יום רביעי");
    expect(info.weekOfMonth).toBeGreaterThanOrEqual(1);
    expect(info.weekOfMonth).toBeLessThanOrEqual(5);
    expect(info.weekOfYear).toBeGreaterThan(0);
    expect(info.weekRange.from <= info.iso && info.iso <= info.weekRange.to).toBe(true);
    expect(info.monthRange.from <= info.iso && info.iso <= info.monthRange.to).toBe(true);
    expect(info.yearRange.from <= info.iso && info.iso <= info.yearRange.to).toBe(true);
  });

  it("flags Rosh Chodesh on the first of a Hebrew month (not Tishrei)", () => {
    const firstOfMonth = hebrewMonthBounds(REF).start;
    expect(hebrewDayInfo(firstOfMonth).isRoshChodesh).toBe(true);
  });

  it("flags Shabbat", () => {
    const { end } = hebrewWeekBounds(REF);
    expect(hebrewDayInfo(end).isShabbat).toBe(true);
  });
});

describe("hebrewRangePresets", () => {
  it("returns today/week/month/prev month/year ranges", () => {
    const presets = hebrewRangePresets(REF);
    expect(presets.map((p) => p.id)).toEqual(["today", "week", "month", "prev_month", "year"]);
    for (const p of presets) expect(p.from <= p.to).toBe(true);
    const today = presets[0]!;
    expect(today.from).toBe(isoOf(REF));
    expect(today.to).toBe(isoOf(REF));
    const month = presets[2]!;
    const prev = presets[3]!;
    expect(prev.to < month.from).toBe(true);
  });
});
