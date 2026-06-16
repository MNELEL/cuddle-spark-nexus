import type { ClassReport } from "@/lib/reports.functions";
import {
  AMBER,
  createHebrewDoc,
  downloadPdfBlob as _downloadPdfBlob,
  drawBrandHeader,
  drawFooter,
  hebrewDate,
  safeName,
} from "./pdf-builder";

export type StudentDailyPdfArgs = {
  report: ClassReport;
  studentId: string;
  date: string;
  teacherName?: string;
  schoolName?: string;
  classNote?: string;
  studentNote?: string;
};

export type StudentDailyPdfResult = {
  blob: Blob;
  filename: string;
};

export async function buildStudentDailyPdf(args: StudentDailyPdfArgs): Promise<StudentDailyPdfResult> {
  const { report, studentId, date, teacherName, schoolName, classNote, studentNote } = args;
  const student = report.students.find((s) => s.id === studentId);
  if (!student) throw new Error("התלמיד לא נמצא בדוח");

  const hd = await createHebrewDoc();
  const headerBits = [
    schoolName,
    report.class.name,
    teacherName ? `הרב ${teacherName}` : null,
    hebrewDate(date),
  ].filter(Boolean).join(" · ");
  drawBrandHeader(hd, {
    title: `סיכום אישי — ${student.name}`,
    meta: headerBits,
  });

  // §1 נוכחות
  hd.section("נוכחות (30 ימים אחרונים)");
  hd.table({
    head: [["נוכח", "איחור", "חיסור", "מאושר"]],
    body: [[
      String(student.attendance.present),
      String(student.attendance.late),
      String(student.attendance.absent),
      String(student.attendance.excused),
    ]],
    styles: { halign: "center" },
  });

  // §2 ציונים
  hd.section("ציונים אחרונים");
  if (student.grades.length) {
    hd.table({
      head: [["מקצוע", "ציון", "אחוז", "תאריך", "הערה"]],
      body: student.grades.map((g) => [
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
      foot: student.avgPct != null
        ? [["", "", `ממוצע ${Math.round(student.avgPct)}%`, "", ""]]
        : undefined,
      footStyles: { font: "Heebo", fontStyle: "bold", fillColor: AMBER, textColor: 0, halign: "center" },
    });
  } else {
    hd.paragraph("אין ציונים בטווח 30 הימים האחרונים.", { muted: true });
  }

  // §3 התנהגות
  hd.section("התנהגות ונקודות");
  hd.table({
    head: [["חיוביים", "שליליים", "נטו"]],
    body: [[
      `+${student.behavior.positive}`,
      `−${student.behavior.negative}`,
      String(student.behavior.total),
    ]],
    styles: { halign: "center", fontSize: 10 },
  });

  if (student.discipline.length) {
    hd.table({
      head: [["תאריך", "סוג", "קטגוריה", "חומרה", "תיאור"]],
      body: student.discipline.map((e) => [
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

  // §4 הערות הרב
  const noteText = studentNote || classNote;
  if (noteText) {
    hd.section("הערות הרב");
    hd.table({
      head: [],
      body: [[noteText]],
      styles: { fontSize: 10, cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: hd.layout.contentW, halign: "right", overflow: "linebreak" } },
      theme: "plain",
    });
  }

  drawFooter(hd, [schoolName, report.class.name].filter(Boolean).join(" · "));

  const filename = `סיכום_${safeName(student.name)}_${date}.pdf`;
  const blob = hd.doc.output("blob");
  return { blob, filename };
}

export const downloadPdfBlob = _downloadPdfBlob;