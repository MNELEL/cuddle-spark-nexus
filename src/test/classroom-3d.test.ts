import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync("src/components/classroom-3d.tsx", "utf8");
const seating = readFileSync("src/components/seating-grid.tsx", "utf8");

describe("3D classroom rendering", () => {
  it("renders floor, ceiling, desks, chairs and nameplates", () => {
    for (const id of [
      "classroom-3d-stage",
      "room-ceiling",
      "room-floor",
      "room-seat",
      "room-desk",
      "room-chair",
      "room-nameplate",
      "room-object",
    ]) {
      expect(src, `missing marker ${id}`).toContain(`data-testid="${id}"`);
    }
    expect(src).toContain("{student.name}");
  });

  it("supports board, door and cabinet furniture types", () => {
    for (const type of ["board", "door", "cabinet", "teacher_desk", "window", "reading_corner"]) {
      expect(src, `missing object style ${type}`).toContain(`${type}: {`);
    }
    expect(src).toContain('data-object-type={o.type}');
  });

  it("exposes teacher / students / side presets with pressed state", () => {
    expect(src).toContain("teacher: { label: \"מכיוון המורה\"");
    expect(src).toContain("students: { label: \"מכיוון התלמידים\"");
    expect(src).toContain("side: { label: \"מהצד\"");
    expect(src).toContain('aria-pressed={preset === id}');
    expect(src).toContain('data-preset={preset}');
  });

  it("rotation and zoom state is observable for screen checks", () => {
    expect(src).toContain("data-rot-x={Math.round(rotX)}");
    expect(src).toContain("data-rot-y={Math.round(rotY)}");
    expect(src).toContain('data-zoom={zoom.toFixed(2)}');
    expect(src).toContain("onPointerMove={onPointerMove}");
    expect(src).toContain('aria-label="זום"');
  });

  it("is reachable from the seating grid views button", () => {
    expect(seating).toContain("Classroom3D");
    expect(seating).toContain("מבטים");
  });
});