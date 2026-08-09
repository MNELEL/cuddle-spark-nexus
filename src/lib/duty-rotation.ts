/**
 * Fair round-robin duty rotation (pure logic, unit-testable).
 *
 * Each duty type gets its own offset so two duties on the same day never fall
 * on the same student while enough students exist.
 */
export type RotationInput = {
  studentIds: string[];
  /** teaching dates, already filtered (no holidays / closures), ascending */
  dates: string[];
  /** stable offset per duty type, e.g. its index in the duty list */
  offset?: number;
};

export type RotationSlot = { date: string; studentId: string };

export function buildRotation({ studentIds, dates, offset = 0 }: RotationInput): RotationSlot[] {
  if (!studentIds.length || !dates.length) return [];
  return dates.map((date, i) => ({
    date,
    studentId: studentIds[(i + offset) % studentIds.length]!,
  }));
}

/** Swap the students of two dates inside an already-built rotation. */
export function swapRotation(slots: RotationSlot[], dateA: string, dateB: string): RotationSlot[] {
  const a = slots.find((s) => s.date === dateA);
  const b = slots.find((s) => s.date === dateB);
  if (!a || !b) return slots;
  return slots.map((s) =>
    s.date === dateA ? { ...s, studentId: b.studentId } : s.date === dateB ? { ...s, studentId: a.studentId } : s,
  );
}
