import { describe, expect, it } from "vitest";
import {
  defaultAcademicYear,
  formatHebrewYear,
  hebrewYearNumber,
  nextGradeName,
  previousGradeName,
} from "@/lib/year-rollover";

describe("year rollover: consecutive grade naming", () => {
  it("advances the Hebrew grade letter and keeps the suffix", () => {
    expect(nextGradeName("כיתה א1")).toBe("כיתה ב1");
    expect(nextGradeName('כיתה ג"2')).toBe('כיתה ד"2');
    expect(nextGradeName("א'")).toBe("ב'");
  });

  it("walks back to the previous grade", () => {
    expect(previousGradeName("כיתה ב1")).toBe("כיתה א1");
    expect(previousGradeName("כיתה א1")).toBeNull();
  });

  it("stops at the last grade and on names without a grade letter", () => {
    expect(nextGradeName("כיתה ח1")).toBeNull();
    expect(nextGradeName("שיעור מיוחד")).toBeNull();
  });

  it("formats Hebrew years", () => {
    expect(formatHebrewYear(5787)).toBe('תשפ"ז');
    expect(formatHebrewYear(5786)).toBe('תשפ"ו');
    expect(hebrewYearNumber(new Date("2026-09-15"))).toBe(5787);
    expect(hebrewYearNumber(new Date("2026-03-15"))).toBe(5786);
    expect(defaultAcademicYear(new Date("2026-09-15"))).toBe('תשפ"ז');
  });
});