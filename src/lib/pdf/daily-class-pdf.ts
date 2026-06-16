import type { ClassReport } from "@/lib/reports.functions";
import {
  createHebrewDoc,
  drawBrandHeader,
  drawFooter,
  hebrewDate,
  safeName,
} from "./pdf-builder";

export type DailyClassPdfArgs = {
  report: ClassReport;
  date: string;
  teacherName?: string;
  schoolName?: string;
  classNote?: string;
  studentNotes?: Record<string, string>;
  mode: "class" | "student";
  studentId?: string;
};

export type DailyClassPdfResult = { blob: Blob; filename: string };

function attLabel(a: { present: number; late: number; absent: number; excused: number }): string {
  if (a.present) return "נכח";
  if (a.late) return "איחור";
  if (a.absent) return "נעדר";
  if (a.excused) return "מאושר";
  return "—";
}

export async function buildDailyClassPdf(args: DailyClassPdfArgs): Promise<DailyClassPdfResult> {
  const { report, date, teacherName, schoolName, classNote, studentNotes, mode, studentId } = args;
  const hd = await createHebrewDoc();

  const meta = [
    schoolName,
    report.class.name,
    teacherName ? `הרב ${teacherName}` : null,
    hebrewDate(date),
  ].filter(Boolean).join(" · ");

  drawBrandHeader(hd, {
    title: `סיכום יומי — ${report.class.name}`,
    meta,
  });

  if (mode === "student") {
    const s = report.students.find((x) => x.id === studentId);
    if (!s) {
      hd.section("התלמיד לא נמצא");
      drawFooter(hd, meta);
      return { blob: hd.doc.output("blob"), filename: `סיכום_יומי_${date}.pdf` };
    }

    hd.section(`תלמיד: ${s.name}`);
    hd.table({
      head: [["נוכחות", "התנהגות נטו", "ציונים היום"]],
      body: [[
        attLabel(s.attendance),
        `+${s.behavior.positive} / −${s.behavior.negative}`,
        String(s.grades.length),
      ]],
      styles: { halign: "center" },
    });

    hd.section("ציונים");
    if (s.grades.length) {
      hd.table({
        head: [["מקצוע", "ציון", "הערות"]],
        body: s.grades.map((g) => [g.subject || "—", `${g.value}/${g.max_value}`, g.notes || ""]),
        columnStyles: {
          1: { halign: "center", cellWidth: 22 },
          2: { cellWidth: "auto", overflow: "linebreak" },
        },
      });
    } else hd.paragraph("אין ציונים להיום.", { muted: true });

    hd.section("אירועי התנהגות");
    if (s.discipline.length) {
      hd.table({
        head: [["סוג", "קטגוריה", "תיאור"]],
        body: s.discipline.map((e) => [
          e.type === "positive" ? "חיובי" : "שלילי",
          e.category || "—",
          e.description || "",
        ]),
        columnStyles: {
          0: { cellWidth: 18, halign: "center" },
          1: { cellWidth: 32 },
          2: { cellWidth: "auto", overflow: "linebreak" },
        },
      });
    } else hd.paragraph("אין אירועי התנהגות להיום.", { muted: true });

    const note = studentNotes?.[s.id];
    if (note) {
      hd.section("הערות הרב");
      hd.paragraph(note);
    }
  } else {
    // class mode
    const t = report.students.reduce(
      (acc, s) => {
        acc.present += s.attendance.present;
        acc.late += s.attendance.late;
        acc.absent += s.attendance.absent;
        acc.excused += s.attendance.excused;
        return acc;
      },
      { present: 0, late: 0, absent: 0, excused: 0 },
    );
    const total = t.present + t.late + t.absent + t.excused;
    const pct = total ? Math.round(((t.present + t.excused) / total) * 100) : null;

    hd.section("נוכחות הכיתה");
    hd.table({
      head: [["נכחו", "איחרו", "נעדרו", "מאושר", "אחוז פעיל"]],
      body: [[
        String(t.present),
        String(t.late),
        String(t.absent),
        String(t.excused),
        pct !== null ? `${pct}%` : "—",
      ]],
      styles: { halign: "center" },
    });

    hd.section("פירוט תלמידים");
    hd.table({
      head: [["שם", "נוכחות", "ציונים היום", "התנהגות"]],
      body: report.students.map((s) => [
        s.name,
        attLabel(s.attendance),
        s.grades.length
          ? s.grades.map((g) => `${g.subject || "—"}: ${g.value}/${g.max_value}`).join(" · ")
          : "—",
        s.behavior.positive || s.behavior.negative
          ? `+${s.behavior.positive} / −${s.behavior.negative}`
          : "—",
      ]),
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: "auto", overflow: "linebreak" },
        3: { cellWidth: 28, halign: "center" },
      },
    });

    if (classNote) {
      hd.section("הערות הרב");
      hd.paragraph(classNote);
    }
  }

  drawFooter(hd, meta);

  const filename = `סיכום_יומי_${safeName(report.class.name)}_${date}.pdf`;
  return { blob: hd.doc.output("blob"), filename };
}