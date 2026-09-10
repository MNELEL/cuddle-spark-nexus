import type { CertTemplateDesign } from "@/lib/ai-certificate.functions";
import type { DailyReportDay } from "@/lib/daily-report.functions";
import { createHebrewDoc, drawBrandHeader, drawFooter, hebrewDate, safeName } from "./pdf-builder";
import { drawTemplateFrame } from "./template-design";
import { ensurePdfBrandLoaded } from "./brand-loader";

/** שורת תיעוד יומי לתלמיד בודד: נוכחות, ציון ותובנה ליום מסוים. */
export type DailyReportStudentEntry = {
  date: string;
  student: string;
  attendance: string;
  grade: string;
  insight: string;
  /** תאריך אישור המלמד לתיעוד היום (אם אושר). */
  approvedAt?: string;
  /** שם המאשר, אם קיים. */
  approvedBy?: string;
};

export type DailyReportPdfInput = {
  className: string;
  range: { from: string; to: string };
  rangeLabel?: string;
  studentCount: number;
  days: DailyReportDay[];
  /** תיעוד לפי תלמיד — שם, תאריך, נוכחות, ציון ותובנה. */
  entries?: DailyReportStudentEntry[];
  /** תבנית סגנון שמורה (מסגרת וצבעים); ללא תבנית — העיצוב הרגיל. */
  design?: CertTemplateDesign;
  /** שם התבנית שנבחרה — מוצג בכותרת הדוח. */
  templateName?: string;
};

/** דוח תיעוד יומי לפי כיתה — טבלת סיכום לכל ימי הטווח העברי + התיעוד המלא. */
export async function buildDailyReportPdf(
  input: DailyReportPdfInput,
): Promise<{ blob: Blob; filename: string }> {
  await ensurePdfBrandLoaded();
  const hd = await createHebrewDoc();
  if (input.design) drawTemplateFrame(hd, input.design);


  const totals = input.days.reduce(
    (a, d) => {
      a.present += d.attendance.present;
      a.absent += d.attendance.absent;
      a.late += d.attendance.late;
      a.logs += d.notes ? 1 : 0;
      a.insights += d.insights.total;
      if (d.grades.avgPct !== null) {
        a.gradeSum += d.grades.avgPct * d.grades.count;
        a.gradeCount += d.grades.count;
      }
      return a;
    },
    { present: 0, absent: 0, late: 0, logs: 0, insights: 0, gradeSum: 0, gradeCount: 0 },
  );

  drawBrandHeader(hd, {
    title: `דוח תיעוד יומי — ${input.className}`,
    subtitle: input.rangeLabel,
    meta:
      `תקופה: ${hebrewDate(input.range.from)} — ${hebrewDate(input.range.to)} · ${input.studentCount} תלמידים` +
      (input.templateName ? ` · תבנית: ${input.templateName}` : ""),
  });

  hd.section("סיכום הטווח");
  hd.paragraph(
    `ימי תיעוד: ${totals.logs} · נוכחים: ${totals.present} · נעדרים: ${totals.absent} · איחורים: ${totals.late} · ` +
      `ממוצע ציונים: ${totals.gradeCount ? `${Math.round(totals.gradeSum / totals.gradeCount)}%` : "—"} · תובנות: ${totals.insights}`,
  );

  hd.section(`ימי הלוח העברי (${input.days.length})`);
  if (input.days.length === 0) hd.paragraph("אין ימים בטווח שנבחר.");
  else
    hd.table({
      head: [["תאריך עברי", "תאריך", "נוכחות", "ציונים", "תובנות", "תיעוד"]],
      body: input.days.map((d) => [
        hebrewDate(d.date),
        d.date,
        d.attendance.total > 0
          ? `${d.attendance.present}/${d.attendance.total}${d.attendance.late > 0 ? ` (${d.attendance.late} איחורים)` : ""}`
          : "—",
        d.grades.count > 0 ? `${d.grades.count} · ${Math.round(d.grades.avgPct ?? 0)}%` : "—",
        d.insights.total > 0 ? String(d.insights.total) : "—",
        d.notes ? "יש" : "—",
      ]),
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 30, halign: "center" },
        3: { cellWidth: 26, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: "auto", halign: "center" },
      },
    });

  const withNotes = input.days.filter((d) => d.notes);
  hd.section(`תיעוד יומי מלא (${withNotes.length})`);
  if (withNotes.length === 0) hd.paragraph("אין תיעוד יומי בטווח זה.");
  else
    for (const d of withNotes) {
      hd.subSection(`${hebrewDate(d.date)} (${d.date})`);
      hd.paragraph(d.notes || "—");
    }

  const entries = input.entries ?? [];
  hd.section(`תיעוד לפי תלמיד (${entries.length})`);
  if (entries.length === 0) hd.paragraph("אין תיעוד לפי תלמיד בטווח זה.");
  else
    hd.table({
      head: [["תאריך עברי", "תלמיד", "כיתה", "נוכחות", "ציון", "תובנה"]],
      body: entries.map((e) => [
        hebrewDate(e.date),
        e.student,
        input.className,
        e.attendance || "—",
        e.grade || "—",
        e.insight || "—",
      ]),
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 30 },
        2: { cellWidth: 24 },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: "auto", overflow: "linebreak" },
      },
    });

  drawFooter(hd, input.className);
  const filename = `דוח_תיעוד_יומי_${safeName(input.className)}_${input.range.from}_${input.range.to}.pdf`;
  return { blob: hd.doc.output("blob"), filename };
}
