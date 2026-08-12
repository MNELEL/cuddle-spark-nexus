import { describe, expect, it } from "vitest";
import { buildSeatingPrintHtml, printSeatKey, escapeHtml, type SeatingPrintCell } from "@/lib/print-seating";

const cells: Record<string, SeatingPrintCell> = {
  [printSeatKey(0, 0)]: { kind: "student", name: "יוסי כהן", locked: true },
  [printSeatKey(0, 1)]: { kind: "object", label: "לוח מחיק" },
  [printSeatKey(1, 0)]: { kind: "hidden" },
};

describe("seating print html", () => {
  const html = buildSeatingPrintHtml({
    className: 'כיתה ה"1',
    rows: 2, cols: 2, cells,
    unseated: ["דוד לוי"],
    dateLabel: "12.8.2026",
  });

  it("is an RTL Hebrew A4 landscape document", () => {
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="he"');
    expect(html).toContain("A4 landscape");
    expect(html).toContain("חזית הכיתה");
  });

  it("renders every cell kind", () => {
    expect(html).toContain("יוסי כהן");
    expect(html).toContain("🔒");
    expect(html).toContain("לוח מחיק");
    expect(html).toContain("ללא מושב");
    expect(html).toContain("ריק");
  });

  it("lists unseated students and the counters", () => {
    expect(html).toContain("דוד לוי");
    expect(html).toContain("1 תלמידים משובצים");
    expect(html).toContain("2×2");
  });

  it("renders one row per grid row", () => {
    expect(html.match(/<tr>/g)?.length).toBe(2);
    expect(html.match(/<td/g)?.length).toBe(4);
  });

  it("escapes html in names", () => {
    expect(escapeHtml('<b>"x"</b>')).toBe("&lt;b&gt;&quot;x&quot;&lt;/b&gt;");
    const evil = buildSeatingPrintHtml({
      className: "כיתה", rows: 1, cols: 1,
      cells: { [printSeatKey(0, 0)]: { kind: "student", name: "<script>alert(1)</script>" } },
    });
    expect(evil).not.toContain("<script>alert(1)</script>");
    expect(evil).toContain("&lt;script&gt;");
  });
});