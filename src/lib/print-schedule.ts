import { hebrewDate } from "@/lib/hebrew-date";
/** RTL print helpers for the schedule screens (week grid, duties, holidays, targets). */

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

const STYLE = `
  body{font-family:'Heebo',system-ui,sans-serif;direction:rtl;padding:24px;color:#111}
  h1{font-size:22px;margin:0 0 4px}
  .meta{color:#666;font-size:12px;margin-bottom:18px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #ccc;padding:6px;vertical-align:top;text-align:right}
  th{background:#f3f4f6;font-size:12px}
  .muted{color:#777}
  .off{background:#fef2f2;color:#991b1b}
  .box{display:inline-block;width:12px;height:12px;border:1px solid #999;margin-inline-end:6px}
  @media print{@page{margin:12mm;size:A4 landscape}}
`;

export function printHtmlTable(opts: {
  title: string;
  subtitle?: string;
  head: string[];
  rows: (string | { text: string; off?: boolean })[][];
}) {
  const w = window.open("", "_blank", "width=1100,height=800");
  if (!w) return;
  const head = opts.head.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const rows = opts.rows
    .map(
      (r) =>
        `<tr>${r
          .map((c) => {
            const cell = typeof c === "string" ? { text: c } : c;
            return `<td class="${cell.off ? "off" : ""}">${escapeHtml(cell.text).replace(/\n/g, "<br>")}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  w.document.write(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
    <title>${escapeHtml(opts.title)}</title><style>${STYLE}</style></head><body>
    <h1>${escapeHtml(opts.title)}</h1>
    <div class="meta">${escapeHtml(opts.subtitle ?? "")}${opts.subtitle ? " · " : ""}הודפס ב-${hebrewDate(new Date())}</div>
    <table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>setTimeout(()=>window.print(),250)</script>
  </body></html>`);
  w.document.close();
}
