import { describe, it, expect } from "vitest";
import {
  attendanceRate,
  evaluateAttendanceDecline,
  describeDecline,
} from "@/lib/attendance-decline";

const rep = (status: string, n: number) => Array.from({ length: n }, () => status);

describe("attendanceRate", () => {
  it("סופר present ו-late כנוכחות", () => {
    expect(attendanceRate(["present", "late", "absent", "absent"])).toBe(0.5);
  });
  it("מחזיר null בלי רשומות", () => {
    expect(attendanceRate([])).toBeNull();
  });
});

describe("evaluateAttendanceDecline", () => {
  it("ירידה חדה מסומנת כחמורה", () => {
    const d = evaluateAttendanceDecline(rep("absent", 5), rep("present", 20));
    expect(d?.severity).toBe("high");
    expect(d?.basePercent).toBe(100);
    expect(d?.recentPercent).toBe(0);
    expect(d?.dropPoints).toBe(100);
  });

  it("ירידה בינונית (25-50 נק״א) מסומנת כבינונית", () => {
    // בסיס 100%, שבוע אחרון 60% → ירידה 40 נק״א
    const recent = [...rep("present", 3), ...rep("absent", 2)];
    const d = evaluateAttendanceDecline(recent, rep("present", 20));
    expect(d?.severity).toBe("medium");
    expect(d?.dropPoints).toBe(40);
  });

  it("ירידה של בדיוק 50 נק״א נשארת בינונית", () => {
    const recent = [...rep("present", 2), ...rep("absent", 2)];
    const d = evaluateAttendanceDecline(recent, rep("present", 20));
    expect(d?.dropPoints).toBe(50);
    expect(d?.severity).toBe("medium");
  });

  it("פחות מ-3 ימי רישום בשבוע האחרון לא מייצר התראה", () => {
    expect(evaluateAttendanceDecline(rep("absent", 2), rep("present", 20))).toBeNull();
  });

  it("ירידה קטנה מ-25 נק״א לא מייצרת התראה", () => {
    // בסיס 100%, אחרון 80% → 20 נק״א
    const recent = [...rep("present", 4), "absent"];
    expect(evaluateAttendanceDecline(recent, rep("present", 20))).toBeNull();
  });

  it("בלי חלון בסיס אין השוואה", () => {
    expect(evaluateAttendanceDecline(rep("absent", 5), [])).toBeNull();
  });

  it("שיפור בנוכחות לא מייצר התראה", () => {
    const base = [...rep("present", 5), ...rep("absent", 15)];
    expect(evaluateAttendanceDecline(rep("present", 5), base)).toBeNull();
  });
});

describe("describeDecline", () => {
  it("מתאר את הירידה באחוזים בעברית", () => {
    const d = evaluateAttendanceDecline(rep("absent", 5), rep("present", 20))!;
    const text = describeDecline(d);
    expect(text).toContain("מ-100%");
    expect(text).toContain("ל-0%");
  });
});
