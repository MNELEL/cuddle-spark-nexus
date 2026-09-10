import { createHebrewDoc, drawBrandHeader, drawFooter, hebrewDate, safeName } from "./pdf-builder";
import { ensurePdfBrandLoaded } from "./brand-loader";

export type SeatingConfigPdfInput = {
  name: string;
  className: string;
  created_at: string;
  score: number | null;
  violation_count: number | null;
  grid: { rows: number; cols: number };
  seats: { student: string; row: number; col: number; locked: boolean }[];
  objects: { label: string; row: number; col: number; span: number }[];
};

/** PDF של תצורת הושבה שמורה — שם הכיתה, התלמידים לפי מקום ופריטי הסביבה. */
export async function buildSeatingConfigPdf(
  input: SeatingConfigPdfInput,
): Promise<{ blob: Blob; filename: string }> {
  await ensurePdfBrandLoaded();
  const hd = await createHebrewDoc();

  drawBrandHeader(hd, {
    title: `סידור הושבה — ${input.className}`,
    subtitle: input.name,
    meta:
      `נשמר: ${hebrewDate(String(input.created_at).slice(0, 10))} · לוח ${input.grid.rows}×${input.grid.cols} · ` +
      (input.violation_count === null
        ? "ללא ציון"
        : input.violation_count === 0
          ? "ציון מושלם"
          : `${input.violation_count} הפרות (ציון ${input.score ?? 0})`),
  });

  hd.section(`תלמידים לפי מקום (${input.seats.length})`);
  if (input.seats.length === 0) hd.paragraph("אין תלמידים משובצים בתצורה זו.");
  else
    hd.table({
      head: [["מקום", "שורה", "עמודה", "תלמיד", "נעול"]],
      body: input.seats.map((s, i) => [
        String(i + 1),
        String(s.row),
        String(s.col),
        s.student,
        s.locked ? "כן" : "—",
      ]),
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: "auto" },
        4: { cellWidth: 20, halign: "center" },
      },
    });

  hd.section(`פריטי הסביבה (${input.objects.length})`);
  if (input.objects.length === 0) hd.paragraph("אין פריטים בסביבת הכיתה.");
  else
    hd.table({
      head: [["פריט", "שורה", "עמודה", "רוחב"]],
      body: input.objects.map((o) => [o.label, String(o.row), String(o.col), String(o.span)]),
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
      },
    });

  drawFooter(hd, input.className);
  return {
    blob: hd.doc.output("blob"),
    filename: `סידור_${safeName(input.className)}_${safeName(input.name)}.pdf`,
  };
}
