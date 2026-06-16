import type { ClassReport } from "@/lib/reports.functions";
import {
  AMBER,
  createHebrewDoc,
  drawBrandHeader,
  drawFooter,
  hebrewDate,
  safeName,
} from "./pdf-builder";

export type ClassReportPdfArgs = {
  report: ClassReport;
  teacherName?: string;
  schoolName?: string;
};

export type ClassReportPdfResult = { blob: Blob; filename: string };

export async function buildClassReportPdf(args: ClassReportPdfArgs): Promise<ClassReportPdfResult> {
  const { report, teacherName, schoolName } = args;
  const hd = await createHebrewDoc();

  const meta = [
    schoolName,
    `תקופה: ${hebrewDate(report.range.from)} — ${hebrewDate(report.range.to)}`,
    teacherName ? `הרב ${teacherName}` : null,
    `${report.students.length} תלמידים`,
  ].filter(Boolean).join(" · ");

  drawBrandHeader(hd, {
    title: `דוח כיתה — ${report.class.name}`,
    meta,
  });

  if (report.students.length === 0) {
    hd.section("אין נתונים בטווח זה");
  } else {
    for (const s of report.students) {
      const headline = s.avgPct !== null ? `${s.name} · ממוצע ${Math.round(s.avgPct)}%` : s.name;
      hd.section(headline);

      hd.subSection("נוכחות");
      hd.table({
        head: [["נוכח", "איחור", "נעדר", "מאושר"]],
        body: [[
          String(s.attendance.present),
          String(s.attendance.late),
          String(s.attendance.absent),
          String(s.attendance.excused),
        ]],
        styles: { halign: "center" },
      });

      if (s.grades.length) {
        hd.subSection("ציונים");
        hd.table({
          head: [["מקצוע / מסכת", "ציון", "אחוז", "תאריך", "הערות"]],
          body: s.grades.map((g) => [
            g.subject || "—",
            `${g.value}/${g.max_value}`,
            `${Math.round((Number(g.value) / (Number(g.max_value) || 100)) * 100)}%`,
            g.date,
            g.notes || "",
          ]),
          columnStyles: {
            1: { halign: "center", cellWidth: 18 },
            2: { halign: "center", cellWidth: 18 },
            3: { halign: "center", cellWidth: 24 },
            4: { cellWidth: "auto", overflow: "linebreak" },
          },
          foot: s.avgPct != null
            ? [["", "", `ממוצע ${Math.round(s.avgPct)}%`, "", ""]]
            : undefined,
          footStyles: { font: "Heebo", fontStyle: "bold", fillColor: AMBER, textColor: 0, halign: "center" },
        });
      }

      hd.subSection("התנהגות ונקודות");
      hd.table({
        head: [["חיוביים", "שליליים", "נטו"]],
        body: [[
          `+${s.behavior.positive}`,
          `−${s.behavior.negative}`,
          String(s.behavior.total),
        ]],
        styles: { halign: "center" },
      });

      if (s.discipline.length) {
        hd.subSection("אירועי משמעת");
        hd.table({
          head: [["תאריך", "סוג", "קטגוריה", "חומרה", "תיאור"]],
          body: s.discipline.map((e) => [
            e.date,
            e.type === "positive" ? "חיובי" : "שלילי",
            e.category || "—",
            String(e.severity ?? ""),
            e.description || "",
          ]),
          columnStyles: {
            0: { cellWidth: 22, halign: "center" },
            1: { cellWidth: 16, halign: "center" },
            2: { cellWidth: 28 },
            3: { cellWidth: 16, halign: "center" },
            4: { cellWidth: "auto", overflow: "linebreak" },
          },
        });
      }

      hd.advance(2);
    }
  }

  drawFooter(hd, [schoolName, report.class.name].filter(Boolean).join(" · "));

  const filename = `דוח_כיתה_${safeName(report.class.name)}_${report.range.from}_${report.range.to}.pdf`;
  return { blob: hd.doc.output("blob"), filename };
}