/**
 * Performance score engine — pure functions, no DB.
 * Combines grades (40%), attendance (30%), behavior points (30%) → 0..100.
 */

export type ScoreTier = "excellent" | "good" | "needs-attention";

export type StudentScore = {
  score: number; // 0..100
  tier: ScoreTier;
  breakdown: {
    grades: number | null;    // avg %, null if no grades
    attendance: number | null; // % present, null if no records
    behavior: number;          // 0..100 normalized
  };
  raw: {
    gradesCount: number;
    attendanceCount: number;
    behaviorTotal: number;
  };
};

export function tierOf(score: number): ScoreTier {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  return "needs-attention";
}

export function tierColorClasses(tier: ScoreTier) {
  switch (tier) {
    case "excellent":
      return { text: "text-[color:var(--emerald-score)]", bg: "bg-[color:var(--emerald-score)]/15", border: "border-[color:var(--emerald-score)]/40" };
    case "good":
      return { text: "text-[color:var(--amber)]", bg: "bg-[color:var(--amber)]/15", border: "border-[color:var(--amber)]/40" };
    default:
      return { text: "text-[color:var(--rose-score)]", bg: "bg-[color:var(--rose-score)]/15", border: "border-[color:var(--rose-score)]/40" };
  }
}

export function tierLabel(tier: ScoreTier): string {
  return tier === "excellent" ? "מצוין" : tier === "good" ? "טוב" : "דורש תשומת לב";
}

type GradeRow = { student_id: string; value: number; max_value: number };
type AttendanceRow = { student_id: string; status: string };
type BehaviorRow = { student_id: string; points: number };

export function computeStudentScore(
  studentId: string,
  grades: GradeRow[],
  attendance: AttendanceRow[],
  behavior: BehaviorRow[],
): StudentScore {
  // Grades — avg percentage
  const g = grades.filter((r) => r.student_id === studentId);
  const gradesPct = g.length
    ? g.reduce((sum, r) => sum + (r.value / Math.max(1, r.max_value)) * 100, 0) / g.length
    : null;

  // Attendance — present + excused count as 100, late as 60, absent as 0
  const a = attendance.filter((r) => r.student_id === studentId);
  const attendancePct = a.length
    ? a.reduce((sum, r) => {
        if (r.status === "present" || r.status === "excused") return sum + 100;
        if (r.status === "late") return sum + 60;
        return sum;
      }, 0) / a.length
    : null;

  // Behavior — normalize sum: 0pts→70, +10→100, -10→40, clamped
  const totalBehavior = behavior
    .filter((r) => r.student_id === studentId)
    .reduce((s, r) => s + r.points, 0);
  const behaviorNormalized = Math.max(0, Math.min(100, 70 + totalBehavior * 3));

  // Weighted: fall back gracefully if a component is missing
  const components: { value: number; weight: number }[] = [];
  if (gradesPct !== null) components.push({ value: gradesPct, weight: 0.4 });
  if (attendancePct !== null) components.push({ value: attendancePct, weight: 0.3 });
  components.push({ value: behaviorNormalized, weight: 0.3 });

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const score = totalWeight > 0
    ? Math.round(components.reduce((s, c) => s + c.value * c.weight, 0) / totalWeight)
    : 70;

  return {
    score,
    tier: tierOf(score),
    breakdown: {
      grades: gradesPct !== null ? Math.round(gradesPct) : null,
      attendance: attendancePct !== null ? Math.round(attendancePct) : null,
      behavior: Math.round(behaviorNormalized),
    },
    raw: {
      gradesCount: g.length,
      attendanceCount: a.length,
      behaviorTotal: totalBehavior,
    },
  };
}