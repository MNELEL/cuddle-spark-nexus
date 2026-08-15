// Pure helpers for the "הכיתות שלי" home screen: per-class metrics summary and
// the sort comparators used by the sort picker. Kept free of server/React code
// so they can be unit tested directly.

export type ClassMetrics = {
  studentCount: number;
  draftBulletins: number;
  upcomingExams: number;
};

export type OverviewStats = {
  totalStudents: number;
  activeClasses: number;
  totalClasses: number;
  pendingActions: number;
};

export type ClassSort = "recent" | "name" | "students";

export const CLASS_SORT_STORAGE_KEY = "hakita:classes-sort";

export const EMPTY_METRICS: ClassMetrics = {
  studentCount: 0,
  draftBulletins: 0,
  upcomingExams: 0,
};

export function metricsFor(
  perClass: Record<string, ClassMetrics> | undefined,
  classId: string,
): ClassMetrics {
  return perClass?.[classId] ?? EMPTY_METRICS;
}

/** ISO date (YYYY-MM-DD) window used for the "מבחן קרוב" badge. */
export function examWindow(from: Date = new Date(), days = 14) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const to = new Date(from.getTime());
  to.setDate(to.getDate() + days);
  return { from: iso(from), to: iso(to) };
}

export function summarizeClasses(
  classes: Array<{ id: string; status?: string | null }>,
  perClass: Record<string, ClassMetrics>,
): OverviewStats {
  let totalStudents = 0;
  let activeClasses = 0;
  let pendingActions = 0;
  for (const c of classes) {
    const status = c.status ?? "active";
    const m = perClass[c.id] ?? EMPTY_METRICS;
    if (status === "active") {
      activeClasses += 1;
      totalStudents += m.studentCount;
      pendingActions += m.draftBulletins;
    }
  }
  return { totalStudents, activeClasses, totalClasses: classes.length, pendingActions };
}

/**
 * Comparator for the classes grid. `recent` keeps the existing behaviour
 * (visited classes first, by recency), the others sort by Hebrew name or by
 * student count (descending).
 */
export function compareClasses(
  sort: ClassSort,
  recentIds: string[],
  perClass: Record<string, ClassMetrics>,
) {
  const rank = (id: string) => {
    const i = recentIds.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const count = (id: string) => (perClass[id] ?? EMPTY_METRICS).studentCount;

  return (a: { id: string; name?: string | null }, b: { id: string; name?: string | null }) => {
    if (sort === "name") {
      return String(a.name ?? "").localeCompare(String(b.name ?? ""), "he");
    }
    if (sort === "students") {
      const diff = count(b.id) - count(a.id);
      if (diff !== 0) return diff;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""), "he");
    }
    return rank(a.id) - rank(b.id);
  };
}

export function isClassSort(v: unknown): v is ClassSort {
  return v === "recent" || v === "name" || v === "students";
}
