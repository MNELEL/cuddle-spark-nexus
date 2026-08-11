import {
  createHebrewDoc, drawBrandHeader, drawFooter, downloadPdfBlob, safeName,
} from "./pdf-builder";
import { ensurePdfBrandLoaded } from "./brand-loader";

export type ContactRow = {
  category: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  notes: string;
};

/** מפיק דף קשר בעברית, מסודר לפי קטגוריות, עם המיתוג של המוסד. */
export async function exportContactSheetPdf(
  rows: ContactRow[],
  opts?: { className?: string },
): Promise<void> {
  const title = "דף קשר";
  await ensurePdfBrandLoaded();
  const hd = await createHebrewDoc();
  drawBrandHeader(hd, {
    title,
    subtitle: opts?.className ? `כיתה: ${opts.className}` : "אנשי קשר, צוות וספקים",
    meta: `${rows.length} אנשי קשר`,
  });

  const categories = [...new Set(rows.map((r) => r.category))];
  for (const cat of categories) {
    const items = rows.filter((r) => r.category === cat);
    hd.section(cat);
    hd.table({
      head: [["#", "שם", "תפקיד", "טלפון", "אימייל", "הערות"]],
      body: items.map((r, i) => [
        String(i + 1), r.name, r.role || "—", r.phone || "—", r.email || "—", r.notes || "—",
      ]),
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 34, halign: "right", fontStyle: "bold" },
        2: { cellWidth: 32, halign: "right" },
        3: { cellWidth: 26, halign: "center" },
        4: { cellWidth: 38, halign: "right" },
        5: { cellWidth: 44, halign: "right" },
      },
    });
  }

  drawFooter(hd, title);
  downloadPdfBlob(hd.doc.output("blob"), `${safeName(title)}.pdf`);
}
