import {
  createHebrewDoc,
  drawBrandHeader,
  drawFooter,
  downloadPdfBlob,
  setPdfBrand,
  getPdfBrand,
  safeName,
  SLATE,
} from "./pdf-builder";
import type { RewardChart } from "@/lib/reward-charts";
import { REWARD_CHARTS } from "@/lib/reward-charts";
import { ensurePdfBrandLoaded } from "./brand-loader";

export type RewardChartBrand = {
  schoolName?: string;
  headerLine?: string;
  logoDataUrl?: string;
};

/**
 * Loads the institution brand (school name + logo) once per session and merges
 * it with any explicit overrides, so every reward-chart document carries the
 * same header band and logo as the rest of the app's PDFs.
 */
async function applyBrand(brand?: RewardChartBrand) {
  await ensurePdfBrandLoaded();
  const current = getPdfBrand();
  setPdfBrand({
    ...current,
    schoolName: brand?.schoolName || current.schoolName || "הכיתה שלי",
    headerLine:
      brand?.headerLine || current.headerLine || "לוח מבצעים ופרסים • להדפסה ותלייה בכיתה",
    logoDataUrl: brand?.logoDataUrl || current.logoDataUrl,
  });
}

/** Meta line shown under every chart title — kept identical across templates. */
function chartMeta(chart: RewardChart): string {
  const school = getPdfBrand().schoolName || "הכיתה שלי";
  return chart.classLabel
    ? `לוח מבצעים להדפסה · ${school} · ${chart.classLabel}`
    : `לוח מבצעים להדפסה · ${school}`;
}

/**
 * Draws one blank, ready-to-fill chart into an open Hebrew doc.
 * The grid is drawn manually (rect + text) rather than with autoTable:
 * autoTable drops digits from cell labels under R2L mode, which would leave
 * every numbered column header blank.
 */
function drawChart(
  hd: Awaited<ReturnType<typeof createHebrewDoc>>,
  chart: RewardChart,
  teacherName?: string,
) {
  const { doc, layout } = hd;

  hd.paragraph(`יעד המבצע: ${chart.goal}`, { size: 10 });
  if (chart.classLabel) hd.paragraph(`כיתה: ${chart.classLabel}`, { size: 10 });
  hd.paragraph(`סולם פרסים: ${chart.reward}`, { size: 10, muted: true, gap: 4 });

  const nameW = 28;
  const gridW = layout.contentW - nameW;
  const colW = gridW / chart.columns.length;
  const headH = 8;
  const rowH = Math.min(
    8,
    Math.max(5.5, (layout.pageH - 30 - hd.currentY() - headH) / chart.rows),
  );
  const tableH = headH + rowH * chart.rows;
  hd.ensureSpace(tableH + 14);

  const top = hd.currentY();
  const right = layout.rightX;
  const left = layout.marginL;
  const headFont = chart.columns.length > 16 ? 5 : 7;

  // Header band.
  doc.setFillColor(...SLATE);
  doc.rect(left, top, layout.contentW, headH, "F");
  doc.setFont("Heebo", "normal");
  doc.setTextColor(255);
  doc.setFontSize(8);
  doc.text(chart.rowLabel, right - 2, top + headH / 2 + 1.6, { align: "right" });
  doc.setFontSize(headFont);
  chart.columns.forEach((label, i) => {
    const cx = right - nameW - colW * i - colW / 2;
    // Pure-number labels ("12") get their digits reversed by R2L mode, so
    // draw those with R2L temporarily disabled.
    const numeric = /^[0-9]+$/.test(label.trim());
    if (numeric) doc.setR2L(false);
    doc.text(label, cx, top + headH / 2 + 1.4, { align: "center" });
    if (numeric) doc.setR2L(true);
  });

  // Grid lines.
  doc.setDrawColor(160);
  doc.setLineWidth(0.2);
  for (let r = 0; r <= chart.rows; r++) {
    const y = top + headH + rowH * r;
    doc.line(left, y, right, y);
  }
  doc.line(right, top, right, top + tableH);
  doc.line(right - nameW, top, right - nameW, top + tableH);
  for (let c = 1; c <= chart.columns.length; c++) {
    const x = right - nameW - colW * c;
    doc.line(x, top, x, top + tableH);
  }

  hd.setY(top + tableH + 6);

  hd.ensureSpace(16);
  doc.setFont("Heebo", "normal");
  // No parentheses here: R2L rendering mirrors bracket glyphs in jsPDF.
  const signer = teacherName?.trim()
    ? `חתימת המלמד ${teacherName.trim()}: ______________`
    : "חתימת המלמד: ______________";
  hd.paragraph(`${signer}          תאריך סיום המבצע: ______________`, {
    size: 10,
    gap: 6,
  });
}

/** Downloads a single printable chart as a branded A4 PDF. */
export async function generateRewardChartPdf(
  chart: RewardChart,
  brand?: RewardChartBrand,
  teacherName?: string,
): Promise<void> {
  const prev = getPdfBrand();
  await applyBrand(brand);
  try {
    const hd = await createHebrewDoc();
    drawBrandHeader(hd, {
      title: chart.name,
      subtitle: chart.grid,
      meta: chartMeta(chart),
    });
    drawChart(hd, chart, teacherName);
    drawFooter(hd, `לוח מבצעים להדפסה — ${getPdfBrand().schoolName || "הכיתה שלי"}`);
    downloadPdfBlob(hd.doc.output("blob"), `reward-chart-${safeName(chart.id)}.pdf`);
  } finally {
    setPdfBrand(prev);
  }
}

/** Downloads all five charts as one branded PDF booklet. */
export async function generateAllRewardChartsPdf(
  brand?: RewardChartBrand,
  charts: RewardChart[] = REWARD_CHARTS,
  teacherName?: string,
): Promise<void> {
  const prev = getPdfBrand();
  await applyBrand(brand);
  try {
    const hd = await createHebrewDoc();
    charts.forEach((chart, i) => {
      if (i > 0) {
        hd.doc.addPage();
        hd.doc.setR2L(true);
        hd.setY(16);
      }
      // Same branded header band on every page so the booklet looks uniform
      // with the single-chart export.
      drawBrandHeader(hd, {
        title: chart.name,
        subtitle: chart.grid,
        meta: chartMeta(chart),
      });
      drawChart(hd, chart, teacherName);
    });
    drawFooter(hd, `ערכת לוחות מבצעים — ${getPdfBrand().schoolName || "הכיתה שלי"}`);
    downloadPdfBlob(hd.doc.output("blob"), "reward-charts-kit.pdf");
  } finally {
    setPdfBrand(prev);
  }
}