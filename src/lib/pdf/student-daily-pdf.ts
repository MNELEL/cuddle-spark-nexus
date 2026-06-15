import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ClassReport } from "@/lib/reports.functions";

const FONT_URL = "/fonts/Heebo-Regular.ttf";
let cachedFontB64: string | null = null;

async function loadHeeboBase64(): Promise<string> {
  if (cachedFontB64) return cachedFontB64;
  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error("טעינת הפונט נכשלה");
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  cachedFontB64 = btoa(bin);
  return cachedFontB64;
}

function hebrewDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("he-IL", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "student";
}

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

  const fontB64 = await loadHeeboBase64();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Heebo-Regular.ttf", fontB64);
  doc.addFont("Heebo-Regular.ttf", "Heebo", "normal");
  doc.setFont("Heebo", "normal");
  doc.setR2L(true);

  const pageW = doc.internal.pageSize.getWidth();
  const marginR = pageW - 14;
  let y = 16;

  // Brand strip
  doc.setFillColor(15, 23, 42); // Midnight Slate
  doc.rect(0, 0, pageW, 10, "F");
  doc.setFillColor(245, 158, 11); // Amber
  doc.rect(0, 10, pageW, 1.5, "F");

  // Header
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`סיכום אישי — ${student.name}`, marginR, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(100);
  const headerBits = [
    schoolName,
    report.class.name,
    teacherName ? `הרב ${teacherName}` : null,
    hebrewDate(date),
  ].filter(Boolean).join(" · ");
  doc.text(headerBits, marginR, y);
  y += 4;
  doc.setFontSize(8);
  doc.text(`הופק ב-${new Date().toLocaleString("he-IL")}`, marginR, y);
  y += 6;

  // ===== Section 1: Daily attendance + 30d totals
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("נוכחות (30 ימים אחרונים)", marginR, y);
  y += 2;
  autoTable(doc, {
    startY: y + 2,
    head: [["נוכח", "איחור", "חיסור", "מאושר"]],
    body: [[
      String(student.attendance.present),
      String(student.attendance.late),
      String(student.attendance.absent),
      String(student.attendance.excused),
    ]],
    styles: { font: "Heebo", halign: "center", fontSize: 10 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    margin: { right: 14, left: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // ===== Section 2: Grades
  doc.setFontSize(13);
  doc.text("ציונים אחרונים", marginR, y);
  y += 2;
  if (student.grades.length) {
    const rows = student.grades.map((g) => [
      g.subject || "—",
      `${g.value}/${g.max_value}`,
      `${Math.round((Number(g.value) / (Number(g.max_value) || 100)) * 100)}%`,
      g.date,
      g.notes || "",
    ]);
    autoTable(doc, {
      startY: y + 2,
      head: [["מקצוע", "ציון", "אחוז", "תאריך", "הערה"]],
      body: rows,
      styles: { font: "Heebo", halign: "right", fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      margin: { right: 14, left: 14 },
      foot: student.avgPct != null
        ? [["", "", `ממוצע ${Math.round(student.avgPct)}%`, "", ""]]
        : undefined,
      footStyles: { fillColor: [245, 158, 11], textColor: 0, fontStyle: "normal" },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("אין ציונים בטווח 30 הימים האחרונים.", marginR, y + 6);
    y += 12;
  }

  // ===== Section 3: Behavior + discipline
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("התנהגות ונקודות", marginR, y);
  y += 2;
  autoTable(doc, {
    startY: y + 2,
    head: [["חיוביים", "שליליים", "נטו"]],
    body: [[
      `+${student.behavior.positive}`,
      `−${student.behavior.negative}`,
      String(student.behavior.total),
    ]],
    styles: { font: "Heebo", halign: "center", fontSize: 10 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    margin: { right: 14, left: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  if (student.discipline.length) {
    autoTable(doc, {
      startY: y + 2,
      head: [["תאריך", "סוג", "קטגוריה", "חומרה", "תיאור"]],
      body: student.discipline.map((e) => [
        e.date,
        e.type === "positive" ? "חיובי" : "שלילי",
        e.category || "—",
        String(e.severity ?? ""),
        e.description || "",
      ]),
      styles: { font: "Heebo", halign: "right", fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      margin: { right: 14, left: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  } else {
    y += 4;
  }

  // ===== Section 4: Notes
  const noteText = studentNote || classNote;
  if (noteText) {
    if (y > 250) { doc.addPage(); y = 16; }
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text("הערות הרב", marginR, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(40);
    const lines = doc.splitTextToSize(noteText, pageW - 28) as string[];
    doc.text(lines, marginR, y);
    y += lines.length * 5 + 4;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`ClassAlign Studio · עמ׳ ${i} מתוך ${pageCount}`, pageW / 2, 290, { align: "center" });
  }

  const filename = `סיכום_${safeName(student.name)}_${date}.pdf`;
  const blob = doc.output("blob");
  return { blob, filename };
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