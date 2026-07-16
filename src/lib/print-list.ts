// Utilities for printing / copying simple name lists (whole class or single group).

export type PrintSection = { title: string; items: string[] };

export function copyList(sections: PrintSection[]): string {
  return sections
    .map((s) => {
      const header = sections.length > 1 ? `${s.title} (${s.items.length}):\n` : "";
      return header + s.items.map((n) => `• ${n}`).join("\n");
    })
    .join("\n\n");
}

export function printList(title: string, sections: PrintSection[]) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  const style = `
    body{font-family:'Heebo',system-ui,sans-serif;direction:rtl;padding:32px;color:#111}
    h1{font-size:22px;margin:0 0 6px}
    .meta{color:#666;font-size:12px;margin-bottom:24px}
    h2{font-size:16px;margin:20px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
    ol{margin:0;padding-inline-start:22px}
    li{padding:4px 0;font-size:14px}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:0 24px}
    @media print{@page{margin:16mm}}
  `;
  const now = new Date().toLocaleDateString("he-IL");
  const body = sections
    .map(
      (s) => `
      <h2>${escapeHtml(s.title)} <span style="font-weight:400;color:#666;font-size:12px">(${s.items.length})</span></h2>
      <ol class="grid">${s.items.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ol>
    `,
    )
    .join("");
  w.document.write(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${style}</style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">${now} · ${sections.reduce((a, s) => a + s.items.length, 0)} שמות</div>
    ${body}
    <script>window.onload=()=>{setTimeout(()=>window.print(),200)}</script>
  </body></html>`);
  w.document.close();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}