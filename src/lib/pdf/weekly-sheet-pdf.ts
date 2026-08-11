import type { WeeklySheetDraft } from "@/lib/weekly-sheet";
import {
  createHebrewDoc, drawFooter, downloadPdfBlob, safeName, getPdfBrand,
} from "./pdf-builder";
import { ensurePdfBrandLoaded } from "./brand-loader";

/**
 * מפיק דף קשר שבועי בשלושה עמודים:
 * 1) שער עם שם המוסד, הכיתה, הפרשה, המלמד ושורת שם התלמיד
 * 2) הספק החומר לפי מקצועות + מבחנים והודעות
 * 3) דף חתימת הורים עם שדות הערכה
 */
export async function exportWeeklySheetPdf(draft: WeeklySheetDraft): Promise<void> {
  await ensurePdfBrandLoaded();
  const hd = await createHebrewDoc();
  const { doc, layout } = hd;
  const brand = getPdfBrand();
  const weekLabel = [draft.parasha && `פרשת ${draft.parasha}`, draft.hebrewYear]
    .filter(Boolean)
    .join(" ");

  const line = (label: string, y: number) => {
    doc.setFont("Heebo", "normal");
    doc.setFontSize(11);
    doc.setTextColor(40);
    hd.text(label, layout.rightX, y, { align: "right" });
    doc.setDrawColor(170);
    doc.setLineWidth(0.3);
    doc.line(layout.marginL, y + 1, layout.rightX - doc.getTextWidth(label) - 4, y + 1);
  };

  // ---------- עמוד 1: שער ----------
  if (brand.logoDataUrl?.startsWith("data:image/")) {
    try {
      const fmt = brand.logoDataUrl.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(brand.logoDataUrl, fmt, layout.marginL, 16, 28, 28, undefined, "FAST");
    } catch { /* לוגו פגום — מדלגים */ }
  }
  doc.setFont("Heebo", "bold");
  doc.setFontSize(15);
  doc.setTextColor(30);
  hd.text(brand.schoolName || "תלמוד תורה", layout.rightX, 24, { align: "right" });
  if (brand.headerLine) {
    doc.setFont("Heebo", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110);
    hd.text(brand.headerLine, layout.rightX, 31, { align: "right" });
  }

  doc.setFont("Heebo", "bold");
  doc.setFontSize(30);
  doc.setTextColor(20);
  hd.text(
    draft.className ? `דף קשר / ${draft.className}` : "דף קשר",
    layout.pageW / 2, 120, { align: "center" },
  );
  if (weekLabel) {
    doc.setFontSize(17);
    hd.text(`ערש"ק ${weekLabel}`, layout.pageW / 2, 133, { align: "center" });
  }
  doc.setFont("Heebo", "normal");
  doc.setFontSize(15);
  hd.text("המלמד", layout.pageW / 2, 158, { align: "center" });
  doc.setFont("Heebo", "bold");
  doc.setFontSize(18);
  hd.text(draft.teacherName || "____________", layout.pageW / 2, 168, { align: "center" });
  doc.setFont("Heebo", "normal");
  doc.setFontSize(12);
  doc.setTextColor(90);
  hd.text(brand.schoolName || "", layout.pageW / 2, 180, { align: "center" });
  doc.setFontSize(12);
  doc.setTextColor(40);
  hd.text("שם התלמיד: ______________________", layout.pageW / 2, 200, { align: "center" });

  // ---------- עמוד 2: הספק החומר ----------
  hd.newPage();
  hd.setY(18);
  doc.setFont("Heebo", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20);
  hd.text("הספק חומר הלימודים השבוע", layout.rightX, hd.currentY(), { align: "right" });
  hd.advance(8);
  if (weekLabel) {
    doc.setFont("Heebo", "normal");
    doc.setFontSize(11);
    doc.setTextColor(110);
    hd.text(`${draft.className ? draft.className + " · " : ""}ערש"ק ${weekLabel}`, layout.rightX, hd.currentY(), { align: "right" });
    hd.advance(7);
  }

  doc.setFont("Heebo", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40);
  hd.text("הורים יקרים, שותפים נכבדים!", layout.rightX, hd.currentY(), { align: "right" });
  hd.advance(8);

  hd.table({
    head: [["מקצוע", "החומר שנלמד"]],
    body: draft.subjects
      .filter((s) => s.subject.trim() !== "")
      .map((s) => [s.subject, s.content || "—"]),
    columnStyles: {
      0: { cellWidth: 32, halign: "right", fontStyle: "bold" },
      1: { cellWidth: 150, halign: "right" },
    },
  });

  if (draft.exams.trim()) {
    hd.section("מבחנים השבוע");
    hd.paragraph(draft.exams, { size: 11 });
  }
  if (draft.announcements.trim()) {
    hd.section("הודעות להורים");
    hd.paragraph(draft.announcements, { size: 11 });
  }
  if (draft.praise.trim()) {
    hd.section("יישר כח");
    hd.paragraph(draft.praise, { size: 11 });
  }
  if (draft.teacherName || draft.teacherPhone) {
    hd.advance(4);
    doc.setFont("Heebo", "bold");
    doc.setFontSize(11);
    doc.setTextColor(40);
    hd.text("בברכת שבת שלום ובשורות טובות", layout.rightX, hd.currentY(), { align: "right" });
    hd.advance(5.5);
    hd.text(
      [draft.teacherName, draft.teacherPhone].filter(Boolean).join(" · "),
      layout.rightX, hd.currentY(), { align: "right" },
    );
  }

  // ---------- עמוד 3: חתימת הורים ----------
  hd.newPage();
  hd.setY(18);
  doc.setFont("Heebo", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  hd.text("חזרתי על החומר עם בני והערכתי כדלהלן", layout.rightX, hd.currentY(), { align: "right" });
  hd.advance(10);

  const guidelines = draft.guidelines.filter((g) => g.trim() !== "");
  if (guidelines.length > 0) {
    doc.setFont("Heebo", "bold");
    doc.setFontSize(12);
    hd.text("הנחיות להתקדמות לימודית", layout.rightX, hd.currentY(), { align: "right" });
    hd.advance(6);
    for (const g of guidelines) hd.paragraph(`• ${g}`, { size: 10.5, gap: 1 });
    hd.advance(4);
  }

  doc.setFont("Heebo", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40);
  hd.text("שם התלמיד: ______________________", layout.rightX, hd.currentY(), { align: "right" });
  hd.advance(10);

  for (const field of draft.evalFields.filter((f) => f.trim() !== "")) {
    hd.ensureSpace(12);
    line(`${field}:`, hd.currentY());
    hd.advance(11);
  }

  hd.advance(6);
  doc.setFont("Heebo", "bold");
  doc.setFontSize(11.5);
  hd.text(
    `תודה רבה! חובה להחזיר את הדף חתום עד ${draft.returnBy || "יום א'"}.`,
    layout.rightX, hd.currentY(), { align: "right" },
  );
  hd.advance(12);
  line("חתימת הורים:", hd.currentY());

  drawFooter(hd, `דף קשר${weekLabel ? ` · ${weekLabel}` : ""}`);
  downloadPdfBlob(
    hd.doc.output("blob"),
    `${safeName(`דף קשר ${draft.className} ${draft.parasha}`.trim())}.pdf`,
  );
}