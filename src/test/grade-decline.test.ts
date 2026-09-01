import { describe, expect, it } from "vitest";
import { evaluateGradeDecline, gradeAverage, describeGradeDecline } from "@/lib/grade-decline";
import { evaluateAbsenceStreak, describeAbsenceStreak } from "@/lib/attendance-decline";

const g = (value: number, date = "2026-01-01", max_value: number | null = 100) => ({ value, max_value, date });

describe("gradeAverage", () => {
  it("normalizes to percent", () => {
    expect(gradeAverage([g(50, "2026-01-01", 50), g(100)])).toBe(100);
  });
  it("returns null for empty input", () => {
    expect(gradeAverage([])).toBeNull();
  });
  it("treats a missing max as 100", () => {
    expect(gradeAverage([g(80, "2026-01-01", null)])).toBe(80);
  });
});

describe("evaluateGradeDecline", () => {
  it("needs at least two recent grades", () => {
    expect(evaluateGradeDecline([g(40)], [g(90), g(90)])).toBeNull();
  });
  it("ignores small drops", () => {
    expect(evaluateGradeDecline([g(85), g(85)], [g(90), g(90)])).toBeNull();
  });
  it("flags a medium decline", () => {
    const d = evaluateGradeDecline([g(75), g(75)], [g(90), g(90)]);
    expect(d).not.toBeNull();
    expect(d!.severity).toBe("medium");
    expect(d!.dropPoints).toBe(15);
    expect(describeGradeDecline(d!)).toContain("90%");
  });
  it("flags a high decline above 20 points", () => {
    expect(evaluateGradeDecline([g(50), g(50)], [g(90), g(90)])!.severity).toBe("high");
  });
  it("returns null without a baseline", () => {
    expect(evaluateGradeDecline([g(50), g(50)], [])).toBeNull();
  });
});

describe("evaluateAbsenceStreak", () => {
  const row = (date: string, status: string) => ({ date, status });

  it("ignores streaks shorter than three days", () => {
    expect(evaluateAbsenceStreak([row("2026-01-02", "absent"), row("2026-01-01", "absent")])).toBeNull();
  });
  it("flags three consecutive absences from the latest date", () => {
    const s = evaluateAbsenceStreak([
      row("2026-01-01", "present"),
      row("2026-01-04", "absent"),
      row("2026-01-02", "absent"),
      row("2026-01-03", "absent"),
    ]);
    expect(s).not.toBeNull();
    expect(s!.days).toBe(3);
    expect(s!.lastDate).toBe("2026-01-04");
    expect(s!.firstDate).toBe("2026-01-02");
    expect(s!.severity).toBe("medium");
    expect(describeAbsenceStreak(s!)).toContain("3 ימי היעדרות");
  });
  it("stops the streak at the first non-absent day", () => {
    expect(evaluateAbsenceStreak([
      row("2026-01-05", "present"),
      row("2026-01-04", "absent"),
      row("2026-01-03", "absent"),
      row("2026-01-02", "absent"),
    ])).toBeNull();
  });
  it("marks five or more absences as high severity", () => {
    const rows = ["2026-01-05", "2026-01-04", "2026-01-03", "2026-01-02", "2026-01-01"].map((d) => row(d, "absent"));
    expect(evaluateAbsenceStreak(rows)!.severity).toBe("high");
  });
});
