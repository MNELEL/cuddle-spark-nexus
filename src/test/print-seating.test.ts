import { describe, expect, it } from "vitest";
import { buildSeatingPrintHtml, printSeatKey, escapeHtml, paperDimensionsMm, type SeatingPrintCell } from "@/lib/print-seating";

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

describe("seating print options", () => {
  const opts = (o: Parameters<typeof buildSeatingPrintHtml>[0]["options"]) =>
    buildSeatingPrintHtml({ className: "כיתה ג׳", rows: 1, cols: 1, cells, options: o });

  it("applies paper size, orientation and margins", () => {
    const html = opts({ paperSize: "a3", orientation: "portrait", marginMm: 25 });
    expect(html).toContain("size:A3 portrait");
    expect(html).toContain("margin:25mm");
    expect(html).toContain("padding:25mm");
  });

  it("clamps out-of-range margins", () => {
    expect(opts({ paperSize: "a4", orientation: "landscape", marginMm: 999 })).toContain("margin:40mm");
    expect(opts({ paperSize: "a4", orientation: "landscape", marginMm: -5 })).toContain("margin:0mm");
  });

  it("uses a custom title and footer, escaped", () => {
    const html = opts({
      paperSize: "letter", orientation: "portrait", marginMm: 10,
      title: "מפת הושבה <ה׳1>", footer: "ת״ת אור החיים",
    });
    expect(html).toContain("מפת הושבה &lt;ה׳1&gt;");
    expect(html).toContain("ת״ת אור החיים");
    expect(html).not.toContain("הופק במערכת ClassAlign Studio");
  });

  it("can hide seat position labels", () => {
    expect(opts({ paperSize: "a4", orientation: "landscape", marginMm: 10, showPositions: false }))
      .not.toContain('class="pos"');
  });

  it("reports paper dimensions per orientation", () => {
    expect(paperDimensionsMm("a4", "portrait")).toEqual({ width: 210, height: 297 });
    expect(paperDimensionsMm("a4", "landscape")).toEqual({ width: 297, height: 210 });
  });
});