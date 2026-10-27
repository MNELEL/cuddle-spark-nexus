/**
 * חישוב קצב שנתי: מחלק כמות לימוד על השיעורים שנשארו, אחרי שמירת רזרבה לחזרה ולמבחנים.
 * פונקציות טהורות, בלי גישה למסד.
 */
export type PlanLesson = { date: string; weekStart: string };
export type PlanInput = {
  mode: "amount" | "topics" | "both";
  totalAmount: number | null;
  startNumber: number;
  topics: { title: string; lessons: number }[];
};
export type WeekPlan = {
  weekStart: string;
  /** כל שיעורי המקצוע בשבוע, כולל רזרבה */
  lessons: number;
  amount: number;
  from: number | null;
  to: number | null;
  topics: string | null;
};
export type PlanResult = { weeks: WeekPlan[]; teachingLessons: number; reserveLessons: number };

/** כמה שיעורים מוקצים ללימוד חדש, והשאר רזרבה (חזרה, מבחנים, ימים שנפלו). */
export function teachingLessonCount(total: number, bufferPercent: number): number {
  if (total <= 0) return 0;
  const b = Math.min(60, Math.max(0, bufferPercent));
  return Math.max(1, Math.floor((total * (100 - b)) / 100));
}

/** מחלק מספר שלם על n חלקים בעיגול מצטבר, כך שהסכום תמיד שווה למקור. */
export function splitWeek(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.round((amount * (i + 1)) / n) - Math.round((amount * i) / n));
  return out;
}

export function planSubject(lessons: PlanLesson[], input: PlanInput, bufferPercent: number): PlanResult {
  const sorted = [...lessons].sort((a, b) => a.date.localeCompare(b.date));
  const total = sorted.length;
  const teach = teachingLessonCount(total, bufferPercent);

  const hasAmount = input.mode !== "topics" && (input.totalAmount ?? 0) > 0;
  const A = hasAmount ? Math.round(input.totalAmount!) : 0;
  const cum = (k: number) => (teach > 0 ? Math.round((A * k) / teach) : 0);

  const topicList = input.mode !== "amount" ? input.topics.filter((t) => t.title.trim() && t.lessons > 0) : [];
  const E = topicList.reduce((n, t) => n + t.lessons, 0);
  let acc = 0;
  const bounds = topicList.map((t) => {
    const start = Math.round((teach * acc) / (E || 1));
    acc += t.lessons;
    return { title: t.title.trim(), start, end: Math.round((teach * acc) / (E || 1)) };
  });

  const byWeek = new Map<string, { startIdx: number; endIdx: number; lessons: number }>();
  const order: string[] = [];
  sorted.forEach((l, idx) => {
    let w = byWeek.get(l.weekStart);
    if (!w) { w = { startIdx: Math.min(idx, teach), endIdx: Math.min(idx, teach), lessons: 0 }; byWeek.set(l.weekStart, w); order.push(l.weekStart); }
    w.lessons += 1;
    if (idx < teach) w.endIdx = idx + 1;
  });

  const weeks: WeekPlan[] = order.map((ws) => {
    const w = byWeek.get(ws)!;
    const amount = hasAmount ? cum(w.endIdx) - cum(w.startIdx) : 0;
    const from = hasAmount && amount > 0 ? input.startNumber + cum(w.startIdx) : null;
    const to = hasAmount && amount > 0 ? input.startNumber + cum(w.endIdx) - 1 : null;
    let topics: string | null = null;
    if (bounds.length) {
      const names = w.endIdx > w.startIdx
        ? bounds.filter((b) => b.start < w.endIdx && b.end > w.startIdx).map((b) => b.title)
        : [];
      topics = names.length ? names.join(", ") : w.endIdx > w.startIdx ? null : "חזרה ורזרבה";
    } else if (!hasAmount || w.endIdx <= w.startIdx) {
      topics = w.endIdx <= w.startIdx ? "חזרה ורזרבה" : null;
    }
    return { weekStart: ws, lessons: w.lessons, amount, from, to, topics };
  });
  return { weeks, teachingLessons: teach, reserveLessons: total - teach };
}

/** אחרי עריכה ידנית של כמויות: מחשב מחדש את הטווח של כל שבוע לפי הכמויות, ברצף. */
export function relabel(amounts: number[], startNumber: number): { from: number | null; to: number | null }[] {
  let cum = 0;
  return amounts.map((a) => {
    const from = startNumber + cum;
    cum += a;
    return a > 0 ? { from, to: from + a - 1 } : { from: null, to: null };
  });
}

/** מחלק מחדש את מה שנשאר מהיעד על השבועות שלא נערכו ידנית, לפי מספר השיעורים בכל שבוע. */
export function respread(
  weeks: { lessons: number; amount: number; edited: boolean }[],
  target: number,
): number[] {
  const fixed = weeks.reduce((n, w) => n + (w.edited ? w.amount : 0), 0);
  const remaining = Math.max(0, Math.round(target) - fixed);
  const free = weeks.map((w, i) => ({ i, weight: w.edited ? 0 : w.lessons })).filter((x) => x.weight > 0);
  const totalWeight = free.reduce((n, x) => n + x.weight, 0);
  const out = weeks.map((w) => (w.edited ? w.amount : 0));
  let accW = 0;
  let prev = 0;
  for (const x of free) {
    accW += x.weight;
    const cum = Math.round((remaining * accW) / (totalWeight || 1));
    out[x.i] = cum - prev;
    prev = cum;
  }
  return out;
}

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
export function rangeText(unit: string, from: number | null, to: number | null): string {
  if (from == null || to == null) return "";
  return from === to ? `${unit} ${fmtNum(from)}` : `${unit} ${fmtNum(from)}–${fmtNum(to)}`;
}
