import jsPDF from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import { hebrewDate, hebrewDateTime } from "@/lib/hebrew-date";

const FONT_REGULAR_URL = "/fonts/Heebo-Regular.ttf";
const FONT_BOLD_URL = "/fonts/Heebo-Bold.ttf";
const CACHE_NAME = "classalign-pdf-fonts-v1";
// In-memory base64 cache (survives all downloads within a session).
const fontCache: Record<string, string> = {};
// De-dupe concurrent loads so parallel PDFs share one fetch/decode.
const fontInflight: Record<string, Promise<string> | undefined> = {};

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
  const existing = fontInflight[url];
  if (existing) return existing;
  const p = (async () => {
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
  fontInflight[url] = p;
  try {
    return await p;
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

/* ------------------------------------------------------------------ *
 * Bidi (RTL) helpers
 * ------------------------------------------------------------------ *
 * jsPDF's setR2L(true) mode is not a bidi implementation: it reverses each
 * rendered line and only partly compensates through its bidi engine, which
 * is why Latin words, dates, percentages and brackets used to come out
 * mirrored depending on where they sat in the line.
 *
 * Instead we keep R2L off and reorder every string ourselves with jsPDF's
 * own UAX#9 bidi engine (logical RTL -> visual LTR), then tell the engine
 * the text is already visual so it does not touch it again. This produces
 * identical, correct output for pure Hebrew, mixed Hebrew/Latin, numbers
 * and punctuation in every PDF viewer and on every platform.
 */

type BidiEngine = { doBidiReorder: (t: string) => string };

type BidiCtor = new (o: Record<string, unknown>) => BidiEngine;

let visualEngine: BidiEngine | null = null;
let engineResolved = false;

/**
 * jsPDF exposes its UAX#9 engine as an undocumented internal, whose location
 * differs between builds (constructor static vs. API prototype) and can be
 * absent entirely. Resolve it lazily so a missing internal degrades to
 * pass-through text instead of throwing while the module is evaluated (which
 * would break SSR for every route importing a PDF builder).
 */
function getVisualEngine(): BidiEngine | null {
  if (engineResolved) return visualEngine;
  engineResolved = true;
  const candidates = [
    (jsPDF as unknown as { __bidiEngine__?: BidiCtor }).__bidiEngine__,
    (jsPDF as unknown as { API?: { __bidiEngine__?: BidiCtor } }).API?.__bidiEngine__,
  ];
  for (const Ctor of candidates) {
    if (typeof Ctor !== "function") continue;
    try {
      visualEngine = new Ctor({
        isInputVisual: false,
        isInputRtl: true,
        isOutputVisual: true,
        isOutputRtl: false,
        isSymmetricSwapping: true,
      });
      if (typeof visualEngine?.doBidiReorder === "function") return visualEngine;
      visualEngine = null;
    } catch {
      visualEngine = null;
    }
  }
  return visualEngine;
}

/**
 * Text options that make jsPDF treat the string as already-visual and skip
 * its own reordering pass.
 */
export const VISUAL_TEXT_OPTS = {
  isInputVisual: true,
  isOutputVisual: true,
  isInputRtl: false,
  isOutputRtl: false,
} as const;

/**
 * Converts a logical (typed) Hebrew string into visual order for the PDF.
 * Safe to call on any string, including pure Latin/numeric text.
 */
export function bidi(text: string): string {
  if (!text) return text;
  try {
    const engine = getVisualEngine();
    return engine ? engine.doBidiReorder(text) : text;
  } catch {
    return text;
  }
}

/** Applies bidi() to every line of a pre-split array (or a single string). */
export function bidiLines(input: string | string[]): string[] {
  return (Array.isArray(input) ? input : [input]).map((l) => bidi(l));
}

const PATCHED = Symbol.for("hakita.rtlTextPatched");

/**
 * Wraps doc.text so every string drawn into the document — including text
 * drawn by jsPDF-autotable and by feature-specific PDF builders — is
 * reordered to visual order exactly once, with jsPDF's own reorder disabled.
 */
export function patchTextForRtl(doc: jsPDF): void {
  const target = doc as unknown as Record<string | symbol, unknown>;
  if (target[PATCHED]) return;
  target[PATCHED] = true;
  if (!getVisualEngine()) {
    // No internal bidi engine available: fall back to jsPDF's own R2L mode so
    // Hebrew still reads correctly (Latin runs may be less precise).
    doc.setR2L(true);
    return;
  }
  const original = doc.text.bind(doc);
  (doc as unknown as { text: (...a: unknown[]) => unknown }).text = (
    ...args: unknown[]
  ) => {
    const [text, x, y, options, ...rest] = args as [
      string | string[],
      number,
      number,
      Record<string, unknown> | undefined,
      ...unknown[],
    ];
    const converted = Array.isArray(text) ? bidiLines(text) : bidi(String(text));
    return (original as unknown as (...a: unknown[]) => unknown)(
      converted,
      x,
      y,
      { ...(options ?? {}), ...VISUAL_TEXT_OPTS },
      ...rest,
    );
  };
}

/** Draws RTL-safe text at (x, y). Use instead of doc.text for Hebrew content. */
export function rtlText(
  doc: jsPDF,
  text: string | string[],
  x: number,
  y: number,
  opts?: { align?: "right" | "center" | "left"; maxWidth?: number },
): void {
  const src = Array.isArray(text) ? text : [text];
  const lines = opts?.maxWidth
    ? src.flatMap((t) => doc.splitTextToSize(t, opts.maxWidth!) as string[])
    : src;
  // doc.text is patched by createHebrewDoc to reorder to visual order.
  doc.text(lines, x, y, { align: opts?.align ?? "right" });
}

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
  newPage: () => void;
  text: (text: string | string[], x: number, y: number, opts?: { align?: "right" | "center" | "left"; maxWidth?: number }) => void;
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
  // R2L stays OFF: we reorder to visual order ourselves (see bidi()).
  doc.setR2L(false);
  try { doc.setLanguage("he"); } catch { /* older jsPDF builds */ }
  patchTextForRtl(doc);
  doc.setProperties({ title: "הכיתה שלי" });

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

  // Every new page must re-assert the font/direction state so a page never
  // renders with a stale (left-to-right) setup.
  const newPage = () => {
    doc.addPage();
    doc.setR2L(false);
    doc.setFont("Heebo", "normal");
    y = 16;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 18) newPage();
  };

  const baseTable: UserOptions = {
    styles: { font: "Heebo", fontSize: 9, halign: "right", cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { font: "Heebo", fontStyle: "bold", fillColor: SLATE, textColor: 255, halign: "center" },
    bodyStyles: { textColor: 30 },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    theme: "grid",
    margin: { right: marginL, left: marginR },
    // autoTable draws through doc.text, so each wrapped line needs bidi fixing
    // after the wrap is computed — otherwise numbers/Latin flip inside cells.
    willDrawCell: (data) => {
      // Cell text is reordered by the patched doc.text; nothing to do here
      // beyond keeping the Hebrew font on every cell.
      data.doc.setFont("Heebo", data.cell.styles.fontStyle === "bold" ? "bold" : "normal");
    },
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
    rtlText(doc, `§${sectionNum}. ${title}`, layout.rightX - 4, y + 4.8, { align: "right" });
    doc.setFont("Heebo", "normal");
    y += 11;
  };

  const subSection = (title: string) => {
    subNum += 1;
    ensureSpace(8);
    doc.setFont("Heebo", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(60);
    rtlText(doc, `§${sectionNum}.${subNum} ${title}`, layout.rightX, y + 3, { align: "right" });
    doc.setFont("Heebo", "normal");
    y += 6;
  };

  const resetSubCounter = () => { subNum = 0; };

  const afterTable = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const table = (opts: UserOptions) => {
    const userWillDraw = opts.willDrawCell;
    autoTable(doc, {
      ...baseTable,
      startY: y,
      ...opts,
      styles: { ...baseTable.styles, ...(opts.styles ?? {}) },
      willDrawCell: (data) => {
        baseTable.willDrawCell?.(data);
        userWillDraw?.(data);
      },
    });
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
      if (i < lines.length) newPage();
    }
    y += opts?.gap ?? 3;
  };

  return {
    doc, layout, ensureSpace, newPage, section, subSection, resetSubCounter,
    text: (t, x, ty, o) => rtlText(doc, t, x, ty, o),
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
    rtlText(doc, brand.schoolName, layout.rightX, hd.currentY(), { align: "right" });
    hd.advance(5.5);
  }
  if (brand.headerLine) {
    doc.setFont("Heebo", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    rtlText(doc, brand.headerLine, layout.rightX, hd.currentY(), { align: "right" });
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
  rtlText(doc, `הופק ב-${hebrewDateTime(new Date())}`, layout.rightX, hd.currentY(), { align: "right" });
  hd.advance(6);
}

export function drawFooter(hd: HebrewDoc, meta?: string): void {
  const { doc, layout } = hd;
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setR2L(false);
    doc.setFont("Heebo", "normal");
    doc.setFontSize(8);
    doc.setDrawColor(226, 232, 240);
    doc.line(layout.marginL, layout.pageH - 12, layout.pageW - layout.marginR, layout.pageH - 12);
    doc.setTextColor(150);
    if (meta) rtlText(doc, meta, layout.rightX, layout.pageH - 7, { align: "right" });
    rtlText(
      doc,
      `הכיתה שלי · עמ׳ ${i} מתוך ${pageCount}`,
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
    return hebrewDate(iso + "T00:00:00");
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