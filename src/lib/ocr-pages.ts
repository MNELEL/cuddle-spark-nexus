/**
 * חלוקת טקסט OCR ל"עמודים" לוגיים, כדי לאפשר הדפסה או שמירת PDF של טווח חלקי.
 * אם יש בטקסט מפרידי עמוד מפורשים (form-feed או "--- עמוד N ---") משתמשים בהם,
 * ואחרת מחלקים לפי פסקאות עד לגודל עמוד קבוע.
 */
export const OCR_PAGE_CHARS = 2600;

export function splitOcrPages(text: string | null | undefined, perPage = OCR_PAGE_CHARS): string[] {
  const t = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!t) return [];

  const explicit = t
    .split(/\f|\n\s*-{2,}\s*(?:עמוד|page)[^\n]*\n/gi)
    .map((s) => s.trim())
    .filter(Boolean);
  const blocks = explicit.length > 1 ? explicit : [t];

  const pages: string[] = [];
  for (const block of blocks) {
    if (block.length <= perPage) {
      pages.push(block);
      continue;
    }
    let cur = "";
    const flush = () => {
      if (cur.trim()) pages.push(cur.trim());
      cur = "";
    };
    for (const para of block.split(/\n{2,}/)) {
      if (para.length > perPage) {
        flush();
        for (let i = 0; i < para.length; i += perPage) pages.push(para.slice(i, i + perPage).trim());
        continue;
      }
      if (cur && cur.length + para.length + 2 > perPage) flush();
      cur = cur ? `${cur}\n\n${para}` : para;
    }
    flush();
  }
  return pages.filter(Boolean);
}

/** "1-3,5" → [0,1,2,4] (אינדקסים), מסונן לטווח החוקי וממוין ללא כפילויות. */
export function parsePageRange(input: string, max: number): number[] {
  const out = new Set<number>();
  for (const part of input.split(/[,،;]/)) {
    const seg = part.trim();
    if (!seg) continue;
    const m = seg.match(/^(\d+)\s*(?:[-–]\s*(\d+))?$/);
    if (!m) continue;
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    for (let p = lo; p <= hi; p++) if (p >= 1 && p <= max) out.add(p - 1);
  }
  return [...out].sort((a, b) => a - b);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** מדפיס (או שומר כ-PDF דרך חלון ההדפסה) רק את העמודים שנבחרו. */
export function printOcrPages(opts: {
  title: string;
  meta?: string;
  pages: string[];
  indexes: number[];
}) {
  const { title, meta = "", pages, indexes } = opts;
  const body = indexes
    .map(
      (i) => `<section class="page">
        <header>${escapeHtml(title)}${meta ? ` · ${escapeHtml(meta)}` : ""} — עמוד ${i + 1} מתוך ${pages.length}</header>
        <pre>${escapeHtml(pages[i] ?? "")}</pre>
      </section>`,
    )
    .join("");

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Heebo", "Arial Hebrew", Arial, sans-serif; color: #111; margin: 0; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  header { font-size: 11px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 13.5px; line-height: 1.8; margin: 0; }
</style></head><body>${body}</body></html>`;

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  };
  if (frame.contentWindow?.document.readyState === "complete") run();
  else frame.onload = run;
  return true;
}