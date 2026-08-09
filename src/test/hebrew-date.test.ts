import { describe, expect, it } from "vitest";
import {
  daysUntilLabel,
  hebrewBirthdaysInRange,
  nextHebrewBirthday,
  toHebrewDateLabel,
  toIsoDate,
} from "@/lib/hebrew-date";

/**
 * Fixed `from` dates so the assertions are deterministic.
 * Reference points (Hebrew years): 5786 has a short Cheshvan (29 days),
 * 5790 has a short Kislev (29 days), 5787 is a leap year, 5788 is not.
 */
describe("hebrew-date", () => {
  it("returns null for missing or malformed input", () => {
    expect(nextHebrewBirthday(null)).toBeNull();
    expect(nextHebrewBirthday(undefined)).toBeNull();
    expect(nextHebrewBirthday("")).toBeNull();
    expect(nextHebrewBirthday("12/03/2015")).toBeNull();
    expect(toHebrewDateLabel(null)).toBeNull();
  });

  it("reports 0 days when the Hebrew birthday is today", () => {
    // 2015-12-12 = 30 Kislev 5776; 30 Kislev 5786 = 2025-12-20
    const res = nextHebrewBirthday("2015-12-12", new Date(2025, 11, 20));
    expect(res?.iso).toBe("2025-12-20");
    expect(res?.daysUntil).toBe(0);
    expect(res?.age).toBe(10);
  });

  it("rolls 30 Cheshvan over to 1 Kislev in a year where Cheshvan is short", () => {
    // 2015-11-12 = 30 Cheshvan 5776; Cheshvan 5786 has 29 days -> 1 Kislev = 2025-11-21
    const res = nextHebrewBirthday("2015-11-12", new Date(2025, 10, 1));
    expect(res?.iso).toBe("2025-11-21");
  });

  it("rolls 30 Kislev over to 1 Tevet in a year where Kislev is short", () => {
    // Kislev 5790 has 29 days -> 1 Tevet 5790 = 2029-12-07
    const res = nextHebrewBirthday("2015-12-12", new Date(2029, 10, 1));
    expect(res?.iso).toBe("2029-12-07");
  });

  it("maps Adar of a regular year onto Adar II of a leap year", () => {
    // 2025-03-10 = 10 Adar 5785 (regular); 5787 is a leap year -> 10 Adar II = 2027-03-19
    const res = nextHebrewBirthday("2025-03-10", new Date(2026, 9, 1));
    expect(res?.iso).toBe("2027-03-19");
  });

  it("maps Adar II of a leap year onto Adar of a regular year", () => {
    // 2027-03-19 = 10 Adar II 5787; 5788 is regular -> 10 Adar = 2028-03-08
    const res = nextHebrewBirthday("2027-03-19", new Date(2027, 9, 1));
    expect(res?.iso).toBe("2028-03-08");
  });

  it("never returns a date in the past", () => {
    const from = new Date(2026, 4, 15);
    const res = nextHebrewBirthday("2014-07-03", from);
    expect(res).not.toBeNull();
    expect(res!.iso >= toIsoDate(from)).toBe(true);
    expect(res!.daysUntil).toBeGreaterThanOrEqual(0);
  });

  it("hebrewBirthdaysInRange only returns dates inside the window", () => {
    const inside = hebrewBirthdaysInRange("2015-12-12", "2025-12-01", "2025-12-31");
    expect(inside.map((d) => d.iso)).toEqual(["2025-12-20"]);

    const outside = hebrewBirthdaysInRange("2015-12-12", "2025-01-01", "2025-01-31");
    expect(outside).toEqual([]);

    expect(hebrewBirthdaysInRange(null, "2025-01-01", "2025-12-31")).toEqual([]);
    expect(hebrewBirthdaysInRange("2015-12-12", "bad", "2025-12-31")).toEqual([]);
  });

  it("labels the countdown in Hebrew", () => {
    expect(daysUntilLabel(0)).toBe("היום!");
    expect(daysUntilLabel(-3)).toBe("היום!");
    expect(daysUntilLabel(1)).toBe("מחר");
    expect(daysUntilLabel(5)).toBe("בעוד 5 ימים");
  });

  it("renders a day+month Hebrew label without the year", () => {
    const label = toHebrewDateLabel("2015-12-12");
    expect(label).toBeTruthy();
    expect(label).not.toMatch(/תש/);
    expect(label).toContain(" ב");
  });
});
