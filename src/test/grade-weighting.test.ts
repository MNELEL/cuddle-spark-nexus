import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHT,
  hasCustomWeights,
  MAX_WEIGHT,
  MIN_WEIGHT,
  subjectAverages,
  UNKNOWN_SUBJECT,
  weightedAverage,
  weightedAverageByStudent,
  weightFor,
  weightMap,
} from "@/lib/grade-weighting";

const grades = [
  { student_id: "s1", subject: "גמרא", value: 90, max_value: 100 },
  { student_id: "s1", subject: "חומש", value: 60, max_value: 100 },
];

describe("grade-weighting", () => {
  it("weightMap clamps to the legal range and drops invalid rows", () => {
    const map = weightMap([
      { subject: "גמרא", weight: 99 },
      { subject: "חומש", weight: "0.01" },
      { subject: "הלכה", weight: 0 },
      { subject: "מוסר", weight: "abc" },
    ]);
    expect(map.get("גמרא")).toBe(MAX_WEIGHT);
    expect(map.get("חומש")).toBe(MIN_WEIGHT);
    expect(map.has("הלכה")).toBe(false);
    expect(map.get("מוסר")).toBe(DEFAULT_WEIGHT);
  });

  it("weightFor falls back to the default weight", () => {
    expect(weightFor("גמרא", [{ subject: "גמרא", weight: 2 }])).toBe(2);
    expect(weightFor("נביא", [{ subject: "גמרא", weight: 2 }])).toBe(DEFAULT_WEIGHT);
    expect(weightFor(null, null)).toBe(DEFAULT_WEIGHT);
    expect(weightFor("  ", [{ subject: UNKNOWN_SUBJECT, weight: 4 }])).toBe(4);
  });

  it("subjectAverages sums value/max per subject", () => {
    const res = subjectAverages([
      { subject: "גמרא", value: 40, max_value: 50 },
      { subject: "גמרא", value: 30, max_value: 50 },
      { subject: null, value: 50, max_value: 100 },
    ]);
    const gemara = res.find((r) => r.subject === "גמרא");
    expect(gemara?.pct).toBe(70);
    expect(gemara?.count).toBe(2);
    expect(res.find((r) => r.subject === UNKNOWN_SUBJECT)?.pct).toBe(50);
  });

  it("with no weights the weighted average equals the simple average", () => {
    const res = weightedAverage(grades, null);
    expect(res.value).toBe(75);
    expect(res.unweighted).toBe(75);
  });

  it("weights shift the result toward the heavier subject", () => {
    const res = weightedAverage(grades, [{ subject: "גמרא", weight: 3 }]);
    // (90*3 + 60*1) / 4 = 82.5
    expect(res.value).toBe(82.5);
    expect(res.unweighted).toBe(75);
    expect(res.contributions[0]?.subject).toBe("גמרא");
    expect(res.contributions[0]?.share).toBeCloseTo(0.75, 5);
    expect(res.contributions.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 5);
  });

  it("returns nulls when there are no grades", () => {
    const res = weightedAverage([], [{ subject: "גמרא", weight: 3 }]);
    expect(res.value).toBeNull();
    expect(res.unweighted).toBeNull();
    expect(res.contributions).toEqual([]);
    expect(weightedAverage(null, null).value).toBeNull();
  });

  it("weightedAverageByStudent groups by student_id and skips rows without one", () => {
    const map = weightedAverageByStudent(
      [
        ...grades,
        { student_id: "s2", subject: "גמרא", value: 50, max_value: 100 },
        { subject: "גמרא", value: 100, max_value: 100 },
      ],
      [{ subject: "גמרא", weight: 3 }],
    );
    expect(map.get("s1")).toBe(82.5);
    expect(map.get("s2")).toBe(50);
    expect(map.size).toBe(2);
  });

  it("hasCustomWeights only when a weight differs from the default", () => {
    expect(hasCustomWeights(null)).toBe(false);
    expect(hasCustomWeights([{ subject: "גמרא", weight: 1 }])).toBe(false);
    expect(hasCustomWeights([{ subject: "גמרא", weight: "2" }])).toBe(true);
  });
});
