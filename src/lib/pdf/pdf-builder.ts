import jsPDF from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";

const FONT_REGULAR_URL = "/fonts/Heebo-Regular.ttf";
const FONT_BOLD_URL = "/fonts/Heebo-Bold.ttf";
const fontCache: Record<string, string> = {};

async function loadFontBase64(url: string): Promise<string> {
  if (fontCache[url]) return fontCache[url];
  const res = await fetch(url);
  if (!res.ok) throw new Error("טעינת הפונט נכשלה");
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  fontCache[url] = btoa(bin);
  return fontCache[url];
}

export const SLATE: [number, number, number] = [15, 23, 42];
export const AMBER: [number, number, number] = [245, 158, 11];
export const SOFT: [number, number, number] = [241, 245, 249];

export type PdfLayout = {
  pageW: number;
  pageH: number;
  marginL: number;
  marginR: number;
  contentW: number;
  rightX: number;
};

export type HebrewDoc = {
  doc: jsPDF;
  layout: PdfLayout;
  ensureSpace: (needed: number) => void;
  section: (title: string) => void;
  subSection: (title: string) => void;
  resetSubCounter: () => void;
  afterTable: () => number;
  table: (opts: UserOptions) => void;
  paragraph: (text: string, opts?: { size?: number; gap?: number; muted?: boolean }) => void;
  baseTable: UserOptions;
  currentY: () => number;
  setY: (y: number) => void;
  advance: (delta: number) => void;
};

export async function createHebrewDoc(): Promise<HebrewDoc> {
  const [regB64, boldB64] = await Promise.all([
    loadFontBase64(FONT_REGULAR_URL),
    loadFontBase64(FONT_BOLD_URL),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Heebo-Regular.ttf", regB64);
  doc.addFont("Heebo-Regular.ttf", "Heebo", "normal");
  doc.addFileToVFS("Heebo-Bold.ttf", boldB64);
  doc.addFont("Heebo-Bold.ttf", "Heebo", "bold");
  doc.setFont("Heebo", "normal");
  doc.setR2L(true);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = 14;
  const layout: PdfLayout = {
    pageW, pageH, marginL, marginR,
    contentW: pageW - marginL - marginR,
    rightX: pageW - marginR,
  };

  let y = 16;
  let sectionNum = 0;
  let subNum = 0;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 18) {
      doc.addPage();
      doc.setR2L(true);
      y = 16;
    }
  };

  const baseTable: UserOptions = {
    styles: { font: "Heebo", fontSize: 9, halign: "right", cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { font: "Heebo", fontStyle: "bold", fillColor: SLATE, textColor: 255, halign: "center" },
    bodyStyles: { textColor: 30 },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    theme: "grid",
    margin: { right: marginL, left: marginR },
  };

  const section = (title: string) => {
    sectionNum += 1;
    subNum = 0;
    ensureSpace(14);
    doc.setFillColor(...SOFT);
    doc.rect(layout.marginL, y - 1, layout.contentW, 8, "F");
    doc.setFillColor(...AMBER);
    doc.rect(layout.rightX - 2, y - 1, 2, 8, "F");
    doc.setFont("Heebo", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...SLATE);
    doc.text(`§${sectionNum}. ${title}`, layout.rightX - 4, y + 4.8, { align: "right" });
    doc.setFont("Heebo", "normal");
    y += 11;
  };

  const subSection = (title: string) => {
    subNum += 1;
    ensureSpace(8);
    doc.setFont("Heebo", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(60);
    doc.text(`§${sectionNum}.${subNum} ${title}`, layout.rightX, y + 3, { align: "right" });
    doc.setFont("Heebo", "normal");
    y += 6;
  };

  const resetSubCounter = () => { subNum = 0; };

  const afterTable = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const table = (opts: UserOptions) => {
    autoTable(doc, { ...baseTable, startY: y, ...opts, styles: { ...baseTable.styles, ...(opts.styles ?? {}) } });
    y = afterTable() + 6;
  };

  const paragraph = (text: string, opts?: { size?: number; gap?: number; muted?: boolean }) => {
    const size = opts?.size ?? 10;
    doc.setFont("Heebo", "normal");
    doc.setFontSize(size);
    doc.setTextColor(opts?.muted ? 110 : 30);
    const lines = doc.splitTextToSize(text, layout.contentW) as string[];
    const lineH = size * 0.45;
    ensureSpace(lines.length * lineH + 2);
    doc.text(lines, layout.rightX, y + lineH, { align: "right" });
    y += lines.length * lineH + (opts?.gap ?? 3);
  };

  return {
    doc, layout, ensureSpace, section, subSection, resetSubCounter,
    afterTable, table, paragraph, baseTable,
    currentY: () => y,
    setY: (next: number) => { y = next; },
    advance: (delta: number) => { y += delta; },
  };
}

export function drawBrandHeader(
  hd: HebrewDoc,
  args: { title: string; meta?: string; subtitle?: string },
): void {
  const { doc, layout } = hd;
  doc.setFillColor(...SLATE);
  doc.rect(0, 0, layout.pageW, 10, "F");
  doc.setFillColor(...AMBER);
  doc.rect(0, 10, layout.pageW, 1.5, "F");

  hd.setY(16);
  doc.setFont("Heebo", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...SLATE);
  const titleLines = doc.splitTextToSize(args.title, layout.contentW) as string[];
  doc.text(titleLines, layout.rightX, hd.currentY(), { align: "right" });
  hd.advance(titleLines.length * 7);

  if (args.subtitle) {
    doc.setFont("Heebo", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80);
    const subLines = doc.splitTextToSize(args.subtitle, layout.contentW) as string[];
    doc.text(subLines, layout.rightX, hd.currentY(), { align: "right" });
    hd.advance(subLines.length * 5);
  }

  if (args.meta) {
    doc.setFont("Heebo", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(110);
    const metaLines = doc.splitTextToSize(args.meta, layout.contentW) as string[];
    doc.text(metaLines, layout.rightX, hd.currentY(), { align: "right" });
    hd.advance(metaLines.length * 4.5);
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`הופק ב-${new Date().toLocaleString("he-IL")}`, layout.rightX, hd.currentY(), { align: "right" });
  hd.advance(6);
}

export function drawFooter(hd: HebrewDoc, meta?: string): void {
  const { doc, layout } = hd;
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setR2L(true);
    doc.setFont("Heebo", "normal");
    doc.setFontSize(8);
    doc.setDrawColor(226, 232, 240);
    doc.line(layout.marginL, layout.pageH - 12, layout.pageW - layout.marginR, layout.pageH - 12);
    doc.setTextColor(150);
    if (meta) doc.text(meta, layout.rightX, layout.pageH - 7, { align: "right" });
    doc.text(
      `ClassAlign Studio · עמ׳ ${i} מתוך ${pageCount}`,
      layout.pageW / 2,
      layout.pageH - 7,
      { align: "center" },
    );
  }
}

export function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "file";
}

export function hebrewDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("he-IL", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}