import { describe, it, expect } from "vitest";
import {
  evaluateBehaviorDecline, describeBehaviorDecline,
  evaluateDisciplineSpike, describeDisciplineSpike,
} from "@/lib/behavior-signals";
import {
  daysSince, latestDate,
  evaluateAttendanceGap, evaluateGradesGap, evaluateBulletinGap, describeGap,
} from "@/lib/data-gaps";

const b = (points: number, date: string) => ({ points, date });

describe("evaluateBehaviorDecline", () => {
  it("מחזיר null כשאין מספיק רישומים בחלון הקצר", () => {
    expect(evaluateBehaviorDecline([b(1, "2026-01-10")], [b(5, "2026-01-01")])).toBeNull();
  });

  it("מחזיר null כשהירידה קטנה מהרף", () => {
    const r = evaluateBehaviorDecline(
      [b(3, "2026-01-10"), b(3, "2026-01-11")],
      [b(4, "2026-01-01"), b(4, "2026-01-02")],
    );
    expect(r).toBeNull();
  });

  it("מזהה ירידה בינונית", () => {
    const r = evaluateBehaviorDecline(
      [b(1, "2026-01-10"), b(1, "2026-01-11")],
      [b(3, "2026-01-01"), b(3, "2026-01-02")],
    );
    expect(r?.severity).toBe("medium");
    expect(r?.drop).toBe(2);
    expect(describeBehaviorDecline(r!)).toContain("ממוצע נקודות ההתנהגות");
  });

  it("מזהה ירידה חמורה", () => {
    const r = evaluateBehaviorDecline(
      [b(-2, "2026-01-10"), b(-2, "2026-01-11")],
      [b(4, "2026-01-01"), b(4, "2026-01-02")],
    );
    expect(r?.severity).toBe("high");
  });
});

describe("evaluateDisciplineSpike", () => {
  it("מחזיר null כשיש אירוע אחד בלבד", () => {
    expect(evaluateDisciplineSpike([{ date: "2026-01-10" }])).toBeNull();
  });

  it("מתעלם מאירועים חיוביים", () => {
    expect(
      evaluateDisciplineSpike([
        { date: "2026-01-10", type: "positive" },
        { date: "2026-01-11", type: "positive" },
      ]),
    ).toBeNull();
  });

  it("שני אירועים = בינוני", () => {
    const s = evaluateDisciplineSpike([{ date: "2026-01-11" }, { date: "2026-01-09" }]);
    expect(s?.severity).toBe("medium");
    expect(s?.count).toBe(2);
    expect(s?.firstDate).toBe("2026-01-09");
    expect(describeDisciplineSpike(s!)).toContain("אירועי משמעת");
  });

  it("ארבעה אירועים או שני אירועים חמורים = חמור", () => {
    expect(
      evaluateDisciplineSpike([
        { date: "2026-01-08" }, { date: "2026-01-09" },
        { date: "2026-01-10" }, { date: "2026-01-11" },
      ])?.severity,
    ).toBe("high");
    expect(
      evaluateDisciplineSpike([
        { date: "2026-01-08", severity: 3 },
        { date: "2026-01-09", severity: 4 },
      ])?.severity,
    ).toBe("high");
  });
});

describe("data gaps", () => {
  const today = "2026-01-20";

  it("daysSince ו-latestDate", () => {
    expect(daysSince("2026-01-15", today)).toBe(5);
    expect(latestDate(["2026-01-01", "2026-01-15", "2026-01-09"])).toBe("2026-01-15");
    expect(latestDate([])).toBeNull();
  });

  it("פער נוכחות: null מתחת ל-3 ימים, בינוני, חמור מעל 7", () => {
    expect(evaluateAttendanceGap(["2026-01-19"], today)).toBeNull();
    expect(evaluateAttendanceGap(["2026-01-16"], today)?.severity).toBe("medium");
    expect(evaluateAttendanceGap(["2026-01-05"], today)?.severity).toBe("high");
  });

  it("אין רישום בכלל = חמור עם days=null", () => {
    const g = evaluateAttendanceGap([], today);
    expect(g?.severity).toBe("high");
    expect(g?.days).toBeNull();
    expect(describeGap(g!, "נוכחות")).toContain("לא נמצא");
  });

  it("פערי ציונים ועלון", () => {
    expect(evaluateGradesGap(["2026-01-12"], today)).toBeNull();
    expect(evaluateGradesGap(["2026-01-01"], today)?.severity).toBe("medium");
    expect(evaluateBulletinGap(["2026-01-05"], today)?.severity).toBe("medium");
    expect(evaluateBulletinGap(["2025-12-01"], today)?.severity).toBe("high");
    expect(describeGap(evaluateBulletinGap(["2026-01-05"], today)!, "עלון שבועי")).toContain("15");
  });
});

import {
  evaluateGradeOutlier,
  evaluateBelowClassAverage,
  describeGradeOutlier,
  describeBelowClassAverage,
} from "@/lib/grade-decline";

describe("evaluateGradeOutlier", () => {
  const strong = [
    { value: 92, max_value: 100, date: "2026-08-01" },
    { value: 88, max_value: 100, date: "2026-08-10" },
    { value: 95, max_value: 100, date: "2026-08-20" },
  ];

  it("flags a failing exam for a strong student", () => {
    const r = evaluateGradeOutlier([...strong, { value: 45, max_value: 100, date: "2026-09-01" }]);
    expect(r).not.toBeNull();
    expect(r!.score).toBe(45);
    expect(r!.average).toBe(92);
    expect(r!.severity).toBe("high");
    expect(describeGradeOutlier(r!)).toContain("45%");
  });

  it("ignores a passing last grade or a weak average", () => {
    expect(evaluateGradeOutlier([...strong, { value: 80, max_value: 100, date: "2026-09-01" }])).toBeNull();
    expect(
      evaluateGradeOutlier([
        { value: 60, max_value: 100, date: "2026-08-01" },
        { value: 62, max_value: 100, date: "2026-08-10" },
        { value: 40, max_value: 100, date: "2026-09-01" },
      ]),
    ).toBeNull();
  });

  it("normalizes max_value", () => {
    const r = evaluateGradeOutlier([
      { value: 19, max_value: 20, date: "2026-08-01" },
      { value: 18, max_value: 20, date: "2026-08-05" },
      { value: 9, max_value: 20, date: "2026-09-01" },
    ]);
    expect(r).not.toBeNull();
    expect(r!.score).toBe(45);
  });
});

describe("evaluateBelowClassAverage", () => {
  it("flags a meaningful gap from the class average", () => {
    const student = [
      { value: 55, max_value: 100, date: "2026-09-01" },
      { value: 60, max_value: 100, date: "2026-09-02" },
    ];
    const cls = [...student, { value: 95, max_value: 100, date: "2026-09-01" }, { value: 92, max_value: 100, date: "2026-09-02" }];
    const g = evaluateBelowClassAverage(student, cls);
    expect(g).not.toBeNull();
    expect(g!.gapPoints).toBeGreaterThanOrEqual(15);
    expect(describeBelowClassAverage(g!)).toContain("פער");
  });

  it("returns null when close to the class or with too few grades", () => {
    const student = [
      { value: 88, max_value: 100, date: "2026-09-01" },
      { value: 90, max_value: 100, date: "2026-09-02" },
    ];
    expect(evaluateBelowClassAverage(student, student)).toBeNull();
    expect(evaluateBelowClassAverage([student[0]!], student)).toBeNull();
  });
});
