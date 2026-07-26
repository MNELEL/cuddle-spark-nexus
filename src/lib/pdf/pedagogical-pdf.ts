import {
  createHebrewDoc,
  drawBrandHeader,
  drawFooter,
  safeName,
} from "./pdf-builder";
import type { PedagogicalReport } from "@/lib/ai-pedagogical.functions";

export async function buildPedagogicalPdfBlob(r: PedagogicalReport): Promise<Blob> {
  const hd = await createHebrewDoc();
  drawBrandHeader(hd, {
    title: "דוח פדגוגי כיתתי",
    subtitle: `כיתה ${r.className}`,
    meta: `${r.range.from} — ${r.range.to} · ${r.studentCount} תלמידים${
      r.overallAvgPercent !== null ? ` · ממוצע ${r.overallAvgPercent}%` : ""
    }`,
  });

  hd.section("תקציר וניתוח פדגוגי");
  hd.paragraph(r.aiAnalysis || "—");

  if (r.strongSubjects.length || r.weakSubjects.length || r.highlightSubjects.length) {
    hd.section("תמצית מקצועות");
    if (r.strongSubjects.length) hd.paragraph(`חזקים: ${r.strongSubjects.join(" · ")}`);
    if (r.weakSubjects.length) hd.paragraph(`לחיזוק: ${r.weakSubjects.join(" · ")}`);
    if (r.highlightSubjects.length) hd.paragraph(`דגש: ${r.highlightSubjects.join(" · ")}`);
  }

  if (r.subjects.length) {
    hd.section("ממוצע לפי מקצוע");
    hd.table({
      head: [["מקצוע", "ממוצע (%)", "מספר ציונים"]],
      body: r.subjects.map((s) => [s.subject, String(s.avgPercent), String(s.count)]),
      columnStyles: { 1: { halign: "center" }, 2: { halign: "center" } },
    });
  }

  if (r.behaviorCategories.length) {
    hd.section("התנהגות לפי קטגוריה");
    hd.table({
      head: [["קטגוריה", "חיובי", "שלילי"]],
      body: r.behaviorCategories.map((b) => [b.category, String(b.positive), String(b.negative)]),
      columnStyles: { 1: { halign: "center" }, 2: { halign: "center" } },
    });
  }

  if (r.disciplineCategories.length) {
    hd.section("אירועי משמעת");
    hd.table({
      head: [["קטגוריה", "מספר", "חומרה ממוצעת"]],
      body: r.disciplineCategories.map((d) => [d.category, String(d.count), String(d.avgSeverity)]),
      columnStyles: { 1: { halign: "center" }, 2: { halign: "center" } },
    });
  }

  hd.section("נוכחות בטווח");
  hd.table({
    head: [["נוכח", "נעדר", "איחורים", "מאושר"]],
    body: [[
      String(r.attendance.present),
      String(r.attendance.absent),
      String(r.attendance.late),
      String(r.attendance.excused),
    ]],
    styles: { halign: "center" },
  });

  if (r.trend.length > 1) {
    hd.section("מגמה שבועית");
    hd.table({
      head: [["שבוע", "חיובי", "שלילי", "משמעת"]],
      body: r.trend.map((t) => [t.weekStart, String(t.positive), String(t.negative), String(t.discipline)]),
      columnStyles: { 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } },
    });
  }

  drawFooter(hd, `${r.className} · דוח פדגוגי`);
  return hd.doc.output("blob");
}

export function pedagogicalPdfFilename(r: PedagogicalReport): string {
  return `דוח_פדגוגי_${safeName(r.className)}_${r.range.from}_${r.range.to}.pdf`;
}