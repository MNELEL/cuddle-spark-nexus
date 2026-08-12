import { describe, expect, it } from "vitest";
import {
  emptyHistory, recordChange, undo, redo, canUndo, canRedo, diffSnapshots, MAX_HISTORY,
  type SeatSnapshot,
} from "@/lib/seat-history";

const snap = (row: number | null): SeatSnapshot[] => [
  { id: "a", seat_row: row, seat_col: 0, seat_locked: false },
];

describe("seat history (undo/redo)", () => {
  it("starts empty", () => {
    const h = emptyHistory();
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(undo(h, snap(1))).toBeNull();
    expect(redo(h, snap(1))).toBeNull();
  });

  it("undo restores the previous layout and enables redo", () => {
    const h = recordChange(emptyHistory(), snap(0));
    const step = undo(h, snap(1))!;
    expect(step.restore).toEqual(snap(0));
    expect(canUndo(step.history)).toBe(false);
    expect(canRedo(step.history)).toBe(true);

    const back = redo(step.history, snap(0))!;
    expect(back.restore).toEqual(snap(1));
    expect(canUndo(back.history)).toBe(true);
    expect(canRedo(back.history)).toBe(false);
  });

  it("a new change clears the redo branch", () => {
    let h = recordChange(emptyHistory(), snap(0));
    h = undo(h, snap(1))!.history;
    expect(canRedo(h)).toBe(true);
    h = recordChange(h, snap(0));
    expect(canRedo(h)).toBe(false);
  });

  it("caps the history length", () => {
    let h = emptyHistory();
    for (let i = 0; i < MAX_HISTORY + 8; i++) h = recordChange(h, snap(i));
    expect(h.past.length).toBe(MAX_HISTORY);
  });

  it("diffSnapshots returns only moved students", () => {
    const from: SeatSnapshot[] = [
      { id: "a", seat_row: 0, seat_col: 0, seat_locked: false },
      { id: "b", seat_row: 1, seat_col: 1, seat_locked: false },
    ];
    const to: SeatSnapshot[] = [
      { id: "a", seat_row: 0, seat_col: 0, seat_locked: false },
      { id: "b", seat_row: 2, seat_col: 1, seat_locked: false },
    ];
    expect(diffSnapshots(from, to).map((s) => s.id)).toEqual(["b"]);
  });
});