// Tracks which classes the teacher actually opens, so the classes list can put
// the routine class (e.g. כיתה ה׳) at the very top instead of alphabetically.
const KEY = "hakita:recent-classes";
const MAX = 8;

export function getRecentClassIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function recordClassVisit(classId: string) {
  if (typeof window === "undefined" || !classId) return;
  try {
    const next = [classId, ...getRecentClassIds().filter((id) => id !== classId)].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — ordering just falls back to the server order */
  }
}
