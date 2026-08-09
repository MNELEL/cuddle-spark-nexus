/**
 * Semester pacing: compares "how much should be covered this half-year" that
 * the teacher entered up-front against what was actually marked as done.
 * Pure logic so it can be unit-tested without a database.
 */
export type SemesterKey = "h1" | "h2";

export type SemesterTarget = { subject: string; semester: SemesterKey; target_units: number };
export type DoneItem = { subject: string | null; date: string; done: boolean };

export type SubjectProgress = {
  subject: string;
  target: number;
  done: number;
  remaining: number;
  weeksLeft: number;
  perWeekNeeded: number;
  /** ahead / on-track / behind — drives the colour badge in the UI */
  status: "ahead" | "on_track" | "behind";
  expectedByNow: number;
};

/** Israeli school year: h1 = Sep–Jan, h2 = Feb–Jun. */
export function semesterOf(date: Date): SemesterKey {
  const m = date.getMonth() + 1; // 1..12
  return m >= 8 || m <= 1 ? "h1" : "h2";
}

export function semesterRange(semester: SemesterKey, today = new Date()): { start: Date; end: Date } {
  const y = today.getFullYear();
  const schoolStartYear = today.getMonth() + 1 >= 8 ? y : y - 1;
  return semester === "h1"
    ? { start: new Date(schoolStartYear, 7, 1), end: new Date(schoolStartYear + 1, 0, 31) }
    : { start: new Date(schoolStartYear + 1, 1, 1), end: new Date(schoolStartYear + 1, 5, 30) };
}

function weeksBetween(a: Date, b: Date): number {
  return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / (7 * 86400000)));
}

export function computeSemesterProgress(
  targets: SemesterTarget[],
  items: DoneItem[],
  semester: SemesterKey,
  today = new Date(),
): SubjectProgress[] {
  const { start, end } = semesterRange(semester, today);
  const inRange = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return d >= start && d <= end;
  };
  const totalWeeks = Math.max(1, weeksBetween(start, end));
  const weeksLeft = weeksBetween(today < start ? start : today, end);
  const elapsedWeeks = Math.max(0, totalWeeks - weeksLeft);

  return targets
    .filter((t) => t.semester === semester)
    .map((t) => {
      const done = items.filter((i) => i.done && i.subject === t.subject && inRange(i.date)).length;
      const remaining = Math.max(0, t.target_units - done);
      const expectedByNow = Math.round((t.target_units * elapsedWeeks) / totalWeeks);
      const status: SubjectProgress["status"] =
        done > expectedByNow ? "ahead" : done === expectedByNow ? "on_track" : "behind";
      return {
        subject: t.subject,
        target: t.target_units,
        done,
        remaining,
        weeksLeft,
        perWeekNeeded: weeksLeft > 0 ? Math.ceil(remaining / weeksLeft) : remaining,
        status,
        expectedByNow,
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject, "he"));
}
