import { hebrewDate } from "@/lib/hebrew-date";
/**
 * הדפסת פריסת ההושבה וייצוא PDF.
 * בניית ה-HTML היא פונקציה טהורה כדי שתהיה ניתנת לבדיקה.
 */

export type SeatingPrintCell =
  | { kind: "student"; name: string; locked?: boolean }
  | { kind: "object"; label: string }
  | { kind: "hidden" }
  | { kind: "empty" };

export type SeatingPrintInput = {
  className: string;
  rows: number;
  cols: number;
  /** מפתח `row:col` -> תא */
  cells: Record<string, SeatingPrintCell>;
  unseated?: string[];
  dateLabel?: string;
  teacherName?: string | null;
  /** הגדרות הדפסה (גודל נייר, שוליים, כותרת מותאמת) */
  options?: SeatingPrintOptions;
};

export type PaperSize = "a4" | "a3" | "letter" | "legal";
export type PaperOrientation = "portrait" | "landscape";

export type SeatingPrintOptions = {
  paperSize: PaperSize;
  orientation: PaperOrientation;
  /** שוליים במילימטרים */
  marginMm: number;
  /** כותרת מותאמת אישית — ריק = כותרת ברירת המחדל */
  title?: string;
  /** כותרת תחתונה מותאמת אישית — ריק = מיתוג ברירת המחדל */
  footer?: string;
  /** הצגת מספרי מקום (שורה,עמודה) בכל תא */
  showPositions?: boolean;
};

export const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  a4: "A4",
  a3: "A3",
  letter: "Letter",
  legal: "Legal",
};

export const DEFAULT_SEATING_PRINT_OPTIONS: SeatingPrintOptions = {
  paperSize: "a4",
  orientation: "landscape",
  marginMm: 10,
  title: "",
  footer: "",
  showPositions: true,
};

/** גודל הדף במילימטרים לפי גודל הנייר והכיוון. */
export function paperDimensionsMm(size: PaperSize, orientation: PaperOrientation): { width: number; height: number } {
  const base: Record<PaperSize, [number, number]> = {
    a4: [210, 297],
    a3: [297, 420],
    letter: [215.9, 279.4],
    legal: [215.9, 355.6],
  };
  const [w, h] = base[size];
  return orientation === "landscape" ? { width: h, height: w } : { width: w, height: h };
}

export const printSeatKey = (row: number, col: number) => `${row}:${col}`;

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function buildSeatingPrintHtml(input: SeatingPrintInput): string {
  const { className, rows, cols, cells } = input;
  const opts: SeatingPrintOptions = { ...DEFAULT_SEATING_PRINT_OPTIONS, ...(input.options ?? {}) };
  const margin = Math.min(40, Math.max(0, Number.isFinite(opts.marginMm) ? opts.marginMm : 10));
  const heading = (opts.title ?? "").trim() || `פריסת הושבה — ${className}`;
  const footer = (opts.footer ?? "").trim() || "הופק במערכת ClassAlign Studio";
  const showPositions = opts.showPositions !== false;
  const dateLabel = input.dateLabel ?? hebrewDate();
  const seatedCount = Object.values(cells).filter((c) => c.kind === "student").length;

  const body = Array.from({ length: rows })
    .map((_, r) => {
      const tds = Array.from({ length: cols })
        .map((__, c) => {
          const cell = cells[printSeatKey(r, c)] ?? { kind: "empty" as const };
          const pos = showPositions ? `<span class="pos">${r + 1},${c + 1}</span>` : "";
          if (cell.kind === "hidden") return `<td class="hidden-seat">${pos}<span class="muted">ללא מושב</span></td>`;
          if (cell.kind === "object") return `<td class="object">${pos}<span class="obj">${escapeHtml(cell.label)}</span></td>`;
          if (cell.kind === "student") {
            return `<td class="student">${pos}<span class="name">${escapeHtml(cell.name)}${cell.locked ? " 🔒" : ""}</span></td>`;
          }
          return `<td class="empty">${pos}<span class="muted">ריק</span></td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  const unseated = input.unseated ?? [];
  const unseatedHtml = unseated.length
    ? `<div class="unseated"><strong>תלמידים לא משובצים (${unseated.length}):</strong> ${unseated.map(escapeHtml).join(" · ")}</div>`
    : "";

  const style = `
    *{box-sizing:border-box}
    body{font-family:'Heebo',system-ui,sans-serif;direction:rtl;margin:0;padding:${margin}mm;color:#111}
    h1{font-size:20px;margin:0 0 2px}
    .meta{color:#555;font-size:12px;margin-bottom:10px}
    .front{text-align:center;font-size:12px;font-weight:700;border:1px solid #333;border-radius:6px;padding:4px;margin-bottom:8px;background:#f1f5f9}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    td{border:1px solid #999;height:74px;vertical-align:middle;text-align:center;position:relative;padding:4px;font-size:12px}
    td .pos{position:absolute;bottom:2px;left:4px;font-size:8px;color:#888}
    td.student .name{font-weight:700;font-size:13px;display:block;word-break:break-word}
    td.hidden-seat{background:#f3f4f6;border-style:dashed}
    td.object{background:#e2e8f0}
    td.object .obj{font-weight:700;font-size:11px}
    .muted{color:#9ca3af;font-size:10px}
    .unseated{margin-top:10px;font-size:12px}
    .footer{margin-top:10px;font-size:10px;color:#777;text-align:center}
    @media print{@page{size:${PAPER_SIZE_LABELS[opts.paperSize]} ${opts.orientation};margin:${margin}mm} body{padding:0}}
  `;

  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>${escapeHtml(heading)}</title><style>${style}</style></head><body>
<h1>${escapeHtml(heading)}</h1>
<div class="meta">${escapeHtml(dateLabel)} · ${rows}×${cols} · ${seatedCount} תלמידים משובצים${input.teacherName ? ` · ${escapeHtml(input.teacherName)}` : ""}</div>
<div class="front">חזית הכיתה</div>
<table><tbody>${body}</tbody></table>
${unseatedHtml}
<div class="footer">${escapeHtml(footer)}</div>
</body></html>`;
}

/** פותח חלון הדפסה עם הפריסה. */
export function printSeatingLayout(input: SeatingPrintInput): boolean {
  const w = window.open("", "_blank", "width=1100,height=800");
  if (!w) return false;
  w.document.write(
    buildSeatingPrintHtml(input).replace(
      "</body>",
      `<script>window.onload=()=>{setTimeout(()=>window.print(),250)}</script></body>`,
    ),
  );
  w.document.close();
  return true;
}

/** ייצוא הגריד המוצג על המסך ל-PDF לפי הגדרות ההדפסה. */
export async function exportSeatingPdf(
  elementId: string,
  filename: string,
  options?: Partial<SeatingPrintOptions>,
): Promise<void> {
  const opts: SeatingPrintOptions = { ...DEFAULT_SEATING_PRINT_OPTIONS, ...(options ?? {}) };
  const el = document.getElementById(elementId);
  if (!el) throw new Error("לא נמצאה פריסת ההושבה על המסך");
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
  const pdf = new jsPDF({ orientation: opts.orientation, unit: "mm", format: opts.paperSize });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = Math.min(40, Math.max(0, opts.marginMm));
  const title = (opts.title ?? "").trim();
  const top = title ? margin + 10 : margin;
  if (title) {
    pdf.setFontSize(12);
    pdf.text(title, pageW / 2, margin + 5, { align: "center" });
  }
  const scale = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2) / canvas.height);
  const w = canvas.width * scale;
  const h = canvas.height * scale;
  const y = Math.max(top, (pageH - h) / 2);
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pageW - w) / 2, y, w, h);
  pdf.save(filename);
}