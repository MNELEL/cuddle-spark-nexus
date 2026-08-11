import type { MapSection } from "@/lib/system-map";
import {
  createHebrewDoc, drawBrandHeader, drawFooter, downloadPdfBlob, safeName,
} from "./pdf-builder";
import { ensurePdfBrandLoaded } from "./brand-loader";

/** מייצא את מפת המערכת (כותרות, קטגוריות ותיאורים) למסמך PDF בעברית. */
export async function exportSystemMapPdf(
  sections: MapSection[],
  opts?: { className?: string },
): Promise<void> {
  const title = "מפת המערכת";
  const total = sections.reduce((a, s) => a + s.items.length, 0);
  await ensurePdfBrandLoaded();
  const hd = await createHebrewDoc();
  drawBrandHeader(hd, {
    title,
    subtitle: opts?.className ? `הקישורים מותאמים לכיתה: ${opts.className}` : "כל המסכים והכלים של המערכת",
    meta: `${sections.length} קטגוריות · ${total} מסכים`,
  });

  hd.paragraph(
    "המסמך מרכז את כל מסכי המערכת לפי קטגוריות, עם תיאור קצר של מה עושים בכל מסך ומה המטרה שלו.",
    { size: 9.5, muted: true, gap: 4 },
  );

  for (const s of sections) {
    if (s.items.length === 0) continue;
    hd.section(s.title);
    hd.table({
      head: [["#", "המסך", "מה עושים בו"]],
      body: s.items.map((it, i) => [String(i + 1), it.label, it.sub]),
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 52, halign: "right", fontStyle: "bold" },
        2: { cellWidth: 120, halign: "right" },
      },
    });
  }

  drawFooter(hd, title);
  downloadPdfBlob(hd.doc.output("blob"), `${safeName(title)}.pdf`);
}
