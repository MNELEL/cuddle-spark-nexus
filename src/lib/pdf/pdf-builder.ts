import jsPDF from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";

const FONT_REGULAR_URL = "/fonts/Heebo-Regular.ttf";
const FONT_BOLD_URL = "/fonts/Heebo-Bold.ttf";
const CACHE_NAME = "classalign-pdf-fonts-v1";
// In-memory base64 cache (survives all downloads within a session).
const fontCache: Record<string, string> = {};
// De-dupe concurrent loads so parallel PDFs share one fetch/decode.
const fontInflight: Record<string, Promise<string>> = {};

function bytesToBase64(buf: ArrayBuffer): string {
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function loadFontBase64(url: string): Promise<string> {
  if (fontCache[url]) return fontCache[url];
  if (fontInflight[url]) return fontInflight[url];
  fontInflight[url] = (async () => {
    // Prefer Cache Storage (persists across reloads) then fall back to fetch.
    try {
      if (typeof caches !== "undefined") {
        const cache = await caches.open(CACHE_NAME);
        let res = await cache.match(url);
        if (!res) {
          const fresh = await fetch(url, { cache: "force-cache" });
          if (!fresh.ok) throw new Error("טעינת הפונט נכשלה");
          cache.put(url, fresh.clone()).catch(() => { /* quota — ignore */ });
          res = fresh;
        }
        const b64 = bytesToBase64(await res.arrayBuffer());
        fontCache[url] = b64;
        return b64;
      }
    } catch { /* fall through to plain fetch */ }
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error("טעינת הפונט נכשלה");
    const b64 = bytesToBase64(await res.arrayBuffer());
    fontCache[url] = b64;
    return b64;
  })();
  try {
    return await fontInflight[url];
  } finally {
    delete fontInflight[url];
  }
}

/**
 * Prewarm PDF fonts so the first download is instant.
 * Safe to call multiple times; no-ops on the server.
 */
export function prewarmPdfAssets(): void {
  if (typeof window === "undefined") return;
  const kick = () => {
    void loadFontBase64(FONT_REGULAR_URL).catch(() => {});
    void loadFontBase64(FONT_BOLD_URL).catch(() => {});
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (typeof ric === "function") ric(kick);
  else setTimeout(kick, 0);
}

export const SLATE: [number, number, number] = [15, 23, 42];
export const AMBER: [number, number, number] = [245, 158, 11];
export const SOFT: [number, number, number] = [241, 245, 249];

/** Institution brand snapshot used by every PDF header. */
export type PdfBrand = {
  schoolName?: string;
  headerLine?: string;
  logoDataUrl?: string;
  primaryColor?: string;
};

let CURRENT_BRAND: PdfBrand = {};

/**
 * Sets the institution brand used by drawBrandHeader in all subsequent PDFs.
 * Call this once from the UI (via useBrand) before building a PDF.
 */
export function setPdfBrand(brand: PdfBrand): void {
  CURRENT_BRAND = brand ?? {};
}

export function getPdfBrand(): PdfBrand { return CURRENT_BRAND; }

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
    // Widow control: reserve room for the section header + a couple of content lines.
    ensureSpace(14 + 12);
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
    // Paginate: draw as many lines as fit, break page, continue.
    let i = 0;
    while (i < lines.length) {
      const avail = pageH - 18 - y;
      const canFit = Math.max(1, Math.floor(avail / lineH));
      const chunk = lines.slice(i, i + canFit);
      doc.text(chunk, layout.rightX, y + lineH, { align: "right" });
      y += chunk.length * lineH;
      i += chunk.length;
      if (i < lines.length) {
        doc.addPage();
        doc.setR2L(true);
        y = 16;
      }
    }
    y += opts?.gap ?? 3;
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
  const brand = CURRENT_BRAND;
  doc.setFillColor(...SLATE);
  doc.rect(0, 0, layout.pageW, 10, "F");
  doc.setFillColor(...AMBER);
  doc.rect(0, 10, layout.pageW, 1.5, "F");

  // Institution logo (left) if present.
  let logoBottom = 16;
  if (brand.logoDataUrl && brand.logoDataUrl.startsWith("data:image/")) {
    try {
      const fmt = brand.logoDataUrl.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(brand.logoDataUrl, fmt, layout.marginL, 14, 22, 22, undefined, "FAST");
      logoBottom = 14 + 22;
    } catch { /* ignore malformed logo */ }
  }

  // Institution name banner above the document title, right-aligned.
  hd.setY(16);
  if (brand.schoolName) {
    doc.setFont("Heebo", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...SLATE);
    doc.text(brand.schoolName, layout.rightX, hd.currentY(), { align: "right" });
    hd.advance(5.5);
  }
  if (brand.headerLine) {
    doc.setFont("Heebo", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(brand.headerLine, layout.rightX, hd.currentY(), { align: "right" });
    hd.advance(4.5);
  }
  if (brand.schoolName || brand.headerLine) {
    doc.setDrawColor(...AMBER);
    doc.setLineWidth(0.4);
    doc.line(layout.marginL, hd.currentY(), layout.rightX, hd.currentY());
    hd.advance(3);
  }
  if (hd.currentY() < logoBottom) hd.setY(logoBottom);

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