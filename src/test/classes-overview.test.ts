import { describe, expect, it } from "vitest";
import {
  type ClassMetrics,
  compareClasses,
  examWindow,
  isClassSort,
  metricsFor,
  summarizeClasses,
} from "@/lib/classes-overview";

const m = (studentCount: number, draftBulletins = 0, upcomingExams = 0): ClassMetrics =>
  ({ studentCount, draftBulletins, upcomingExams });

const perClass: Record<string, ClassMetrics> = {
  a: m(20, 1),
  b: m(5),
  c: m(31, 2, 1),
};

const classes = [
  { id: "a", name: "כיתה ה׳", status: "active" },
  { id: "b", name: "כיתה א׳", status: "archived" },
  { id: "c", name: "כיתה ג׳", status: "active" },
];

describe("summarizeClasses", () => {
  it("counts only active classes for students and pending actions", () => {
    const stats = summarizeClasses(classes, perClass);
    expect(stats.totalClasses).toBe(3);
    expect(stats.activeClasses).toBe(2);
    expect(stats.totalStudents).toBe(51);
    expect(stats.pendingActions).toBe(3);
  });

  it("treats a missing status as active and missing metrics as zero", () => {
    const stats = summarizeClasses([{ id: "z" }], {});
    expect(stats).toEqual({ totalStudents: 0, activeClasses: 1, totalClasses: 1, pendingActions: 0 });
  });
});

describe("compareClasses", () => {
  it("recent puts visited classes first, unvisited last", () => {
    const sorted = [...classes].sort(compareClasses("recent", ["c", "a"], perClass));
    expect(sorted.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by Hebrew name", () => {
    const sorted = [...classes].sort(compareClasses("name", [], perClass));
    expect(sorted.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by student count descending", () => {
    const sorted = [...classes].sort(compareClasses("students", [], perClass));
    expect(sorted.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("breaks student-count ties by name", () => {
    const tie = [{ id: "x", name: "כיתה ב׳" }, { id: "y", name: "כיתה א׳" }];
    const sorted = [...tie].sort(compareClasses("students", [], { x: m(4), y: m(4) }));
    expect(sorted.map((c) => c.id)).toEqual(["y", "x"]);
  });
});

describe("helpers", () => {
  it("metricsFor falls back to zeros", () => {
    expect(metricsFor(perClass, "a").studentCount).toBe(20);
    expect(metricsFor(perClass, "missing")).toEqual(m(0));
    expect(metricsFor(undefined, "a")).toEqual(m(0));
  });

  it("examWindow spans 14 days by default", () => {
    const { from, to } = examWindow(new Date("2026-08-01T00:00:00Z"));
    expect(from).toBe("2026-08-01");
    expect(to).toBe("2026-08-15");
  });

  it("isClassSort validates stored values", () => {
    expect(isClassSort("name")).toBe(true);
    expect(isClassSort("bogus")).toBe(false);
  });
});
