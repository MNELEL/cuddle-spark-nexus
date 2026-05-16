export type SeatPos = { row: number; col: number };

export type ScoringStudent = {
  id: string;
  height: "low" | "mid" | "high";
  row_pref: "front" | "mid" | "back" | "any";
  corner_pref: boolean;
  seat_row: number | null;
  seat_col: number | null;
  seat_locked: boolean;
};

export type ScoringRelation = {
  student_a: string;
  student_b: string;
  kind: "friend" | "avoid" | "distance";
};

export type Violation = {
  kind: "friend" | "avoid" | "distance" | "row" | "corner" | "height";
  severity: "hard" | "soft";
  message: string;
  studentIds: string[];
};

const cheby = (a: SeatPos, b: SeatPos) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));

function rowZone(row: number, rows: number): "front" | "mid" | "back" {
  if (rows <= 2) return row === 0 ? "front" : "back";
  const third = rows / 3;
  if (row < third) return "front";
  if (row >= 2 * third) return "back";
  return "mid";
}

export function computeViolations(
  students: ScoringStudent[],
  relations: ScoringRelation[],
  rows: number,
  cols: number,
): Violation[] {
  const byId = new Map(students.map((s) => [s.id, s]));
  const seated = students.filter((s) => s.seat_row !== null && s.seat_col !== null);
  const v: Violation[] = [];
  const nameRef = (id: string) => id; // names resolved in UI

  // relations
  for (const r of relations) {
    const a = byId.get(r.student_a);
    const b = byId.get(r.student_b);
    if (!a || !b) continue;
    if (a.seat_row === null || b.seat_row === null) continue;
    const pa = { row: a.seat_row!, col: a.seat_col! };
    const pb = { row: b.seat_row!, col: b.seat_col! };
    const d = cheby(pa, pb);
    if (r.kind === "friend" && d > 1) {
      v.push({ kind: "friend", severity: "soft", message: "חברים יושבים רחוק", studentIds: [a.id, b.id] });
    } else if (r.kind === "avoid" && d <= 1) {
      v.push({ kind: "avoid", severity: "hard", message: "תלמידים שצריך להפריד יושבים יחד", studentIds: [a.id, b.id] });
    } else if (r.kind === "distance" && d < 3) {
      v.push({ kind: "distance", severity: "hard", message: "אילוץ ריחוק לא מתקיים", studentIds: [a.id, b.id] });
    }
  }

  // personal preferences
  for (const s of seated) {
    const zone = rowZone(s.seat_row!, rows);
    if (s.row_pref !== "any" && s.row_pref !== zone) {
      v.push({ kind: "row", severity: "soft", message: `העדפת שורה (${s.row_pref}) לא מתקיימת`, studentIds: [s.id] });
    }
    if (s.corner_pref && s.seat_col !== 0 && s.seat_col !== cols - 1) {
      v.push({ kind: "corner", severity: "soft", message: "העדפת פינה לא מתקיימת", studentIds: [s.id] });
    }
    if (s.height === "high" && zone === "front") {
      v.push({ kind: "height", severity: "soft", message: "תלמיד גבוה בשורה קדמית", studentIds: [s.id] });
    }
    if (s.height === "low" && zone === "back") {
      v.push({ kind: "height", severity: "soft", message: "תלמיד נמוך בשורה אחורית", studentIds: [s.id] });
    }
  }
  void nameRef;
  return v;
}

export function scoreAssignment(
  students: ScoringStudent[],
  relations: ScoringRelation[],
  rows: number,
  cols: number,
): number {
  const v = computeViolations(students, relations, rows, cols);
  let score = 0;
  for (const x of v) score -= x.severity === "hard" ? 100 : 5;
  return score;
}

/**
 * Smart shuffle: random-restart search. Tries `tries` random assignments
 * of movable students to free seats, returns the assignment with the best score.
 * Returns map of studentId -> {row,col} for ALL movable students (or null if unseated).
 */
export function smartAssign(
  students: ScoringStudent[],
  relations: ScoringRelation[],
  rows: number,
  cols: number,
  hiddenSeats: Set<string>,
  tries = 200,
): Map<string, SeatPos | null> {
  const lockedKeys = new Set<string>();
  for (const s of students) {
    if (s.seat_locked && s.seat_row !== null && s.seat_col !== null) {
      lockedKeys.add(`${s.seat_row}:${s.seat_col}`);
    }
  }
  const freeSeats: SeatPos[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = `${r}:${c}`;
    if (!hiddenSeats.has(k) && !lockedKeys.has(k)) freeSeats.push({ row: r, col: c });
  }
  const movable = students.filter((s) => !s.seat_locked);

  let best: { score: number; assign: Map<string, SeatPos | null> } | null = null;

  for (let t = 0; t < tries; t++) {
    const pool = [...freeSeats];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const order = [...movable];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const assign = new Map<string, SeatPos | null>();
    const projected: ScoringStudent[] = students.map((s) => ({ ...s }));
    const idx = new Map(projected.map((s, i) => [s.id, i]));
    for (let i = 0; i < order.length; i++) {
      if (i < pool.length) {
        const seat = pool[i];
        assign.set(order[i].id, seat);
        const k = idx.get(order[i].id)!;
        projected[k].seat_row = seat.row;
        projected[k].seat_col = seat.col;
      } else {
        assign.set(order[i].id, null);
        const k = idx.get(order[i].id)!;
        projected[k].seat_row = null;
        projected[k].seat_col = null;
      }
    }
    const score = scoreAssignment(projected, relations, rows, cols);
    if (!best || score > best.score) {
      best = { score, assign };
      if (score === 0) break;
    }
  }
  return best?.assign ?? new Map();
}