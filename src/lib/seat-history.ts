/**
 * היסטוריית שינויים לסידור ההושבה — Undo / Redo.
 * מודול טהור (בלי React) כדי שיהיה אפשר לבדוק אותו בטסטים.
 */

export type SeatSnapshot = {
  id: string;
  seat_row: number | null;
  seat_col: number | null;
  seat_locked: boolean;
};

export type SeatHistory = {
  past: SeatSnapshot[][];
  future: SeatSnapshot[][];
};

export const MAX_HISTORY = 20;

export const emptyHistory = (): SeatHistory => ({ past: [], future: [] });

/** לפני כל שינוי — שומרים את המצב הנוכחי ומנקים את ה-Redo. */
export function recordChange(history: SeatHistory, current: SeatSnapshot[]): SeatHistory {
  return {
    past: [...history.past, current].slice(-MAX_HISTORY),
    future: [],
  };
}

export const canUndo = (h: SeatHistory) => h.past.length > 0;
export const canRedo = (h: SeatHistory) => h.future.length > 0;

/** מחזיר את המצב שצריך לשחזר + ההיסטוריה המעודכנת (או null אם אין מה לבטל). */
export function undo(
  history: SeatHistory,
  current: SeatSnapshot[],
): { restore: SeatSnapshot[]; history: SeatHistory } | null {
  const restore = history.past[history.past.length - 1];
  if (!restore) return null;
  return {
    restore,
    history: {
      past: history.past.slice(0, -1),
      future: [current, ...history.future].slice(0, MAX_HISTORY),
    },
  };
}

/** מחזיר את המצב שצריך להחזיר קדימה + ההיסטוריה המעודכנת. */
export function redo(
  history: SeatHistory,
  current: SeatSnapshot[],
): { restore: SeatSnapshot[]; history: SeatHistory } | null {
  const restore = history.future[0];
  if (!restore) return null;
  return {
    restore,
    history: {
      past: [...history.past, current].slice(-MAX_HISTORY),
      future: history.future.slice(1),
    },
  };
}

/** רק התלמידים שמקומם שונה בין שני מצבים — כדי לא לשלוח עדכונים מיותרים לשרת. */
export function diffSnapshots(from: SeatSnapshot[], to: SeatSnapshot[]): SeatSnapshot[] {
  const byId = new Map(from.map((s) => [s.id, s]));
  return to.filter((t) => {
    const f = byId.get(t.id);
    if (!f) return true;
    return f.seat_row !== t.seat_row || f.seat_col !== t.seat_col;
  });
}