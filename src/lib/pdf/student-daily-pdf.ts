import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ClassReport } from "@/lib/reports.functions";

const FONT_REGULAR_URL = "/fonts/Heebo-Regular.ttf";
const FONT_BOLD_URL = "/fonts/Heebo-Bold.ttf";
const fontCache: Record<string, string> = {};

async function loadFontBase64(url: string): Promise<string> {
  if (fontCache[url]) return fontCache[url];
  const res = await fetch(url);
  if (!res.ok) throw new Error("טעינת הפונט נכשלה");
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  fontCache[url] = btoa(bin);
  return fontCache[url];
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

  const [regB64, boldB64] = await Promise.all([
    loadFontBase64(FONT_REGULAR_URL),
    loadFontBase64(FONT_BOLD_URL),
  ]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("Heebo-Regular.ttf", regB64);
  doc.addFont("Heebo-Regular.ttf", "Heebo", "normal");
  doc.addFileToVFS("Heebo-Bold.ttf", boldB64);
  doc.addFont("Heebo-Bold.ttf", "Heebo", "bold");
  doc.setFont("Heebo", "normal");
  doc.setR2L(true);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR;
  const rightX = pageW - marginR;
  let y = 16;

  const SLATE: [number, number, number] = [15, 23, 42];
  const AMBER: [number, number, number] = [245, 158, 11];
  const SOFT: [number, number, number] = [241, 245, 249];

  // Brand strip
  doc.setFillColor(...SLATE);
  doc.rect(0, 0, pageW, 10, "F");
  doc.setFillColor(...AMBER);
  doc.rect(0, 10, pageW, 1.5, "F");

  // Header
  doc.setFont("Heebo", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...SLATE);
  doc.text(`סיכום אישי — ${student.name}`, rightX, y, { align: "right" });
  y += 7;
  doc.setFont("Heebo", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  const headerBits = [
    schoolName,
    report.class.name,
    teacherName ? `הרב ${teacherName}` : null,
    hebrewDate(date),
  ].filter(Boolean).join(" · ");
  const hbLines = doc.splitTextToSize(headerBits, contentW) as string[];
  doc.text(hbLines, rightX, y, { align: "right" });
  y += hbLines.length * 4.5;
  doc.setFontSize(8);
  doc.text(`הופק ב-${new Date().toLocaleString("he-IL")}`, rightX, y, { align: "right" });
  y += 6;

  let sectionNum = 0;
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 18) {
      doc.addPage();
      y = 16;
    }
  };
  const sectionHeader = (title: string) => {
    sectionNum += 1;
    ensureSpace(14);
    doc.setFillColor(...SOFT);
    doc.rect(marginL, y - 1, contentW, 8, "F");
    doc.setFillColor(...AMBER);
    doc.rect(rightX - 2, y - 1, 2, 8, "F");
    doc.setFont("Heebo", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...SLATE);
    doc.text(`${sectionNum}. ${title}`, rightX - 4, y + 4.8, { align: "right" });
    doc.setFont("Heebo", "normal");
    y += 11;
  };
  const afterTable = () =>
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const baseTable = {
    styles: { font: "Heebo", fontSize: 9, halign: "right" as const, cellPadding: 2.5, overflow: "linebreak" as const },
    headStyles: { font: "Heebo", fontStyle: "bold" as const, fillColor: SLATE, textColor: 255, halign: "center" as const },
    bodyStyles: { textColor: 30 },
    alternateRowStyles: { fillColor: [250, 250, 252] as [number, number, number] },
    theme: "grid" as const,
    margin: { right: marginL, left: marginR },
  };

  // ===== §1 נוכחות
  sectionHeader("נוכחות (30 ימים אחרונים)");
  autoTable(doc, {
    ...baseTable,
    startY: y,
    head: [["נוכח", "איחור", "חיסור", "מאושר"]],
    body: [[
      String(student.attendance.present),
      String(student.attendance.late),
      String(student.attendance.absent),
      String(student.attendance.excused),
    ]],
    styles: { ...baseTable.styles, halign: "center" },
  });
  y = afterTable() + 8;

  // ===== §2 ציונים
  sectionHeader("ציונים אחרונים");
  if (student.grades.length) {
    autoTable(doc, {
      ...baseTable,
      startY: y,
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
    y = afterTable() + 8;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("אין ציונים בטווח 30 הימים האחרונים.", rightX, y + 4, { align: "right" });
    y += 12;
  }

  // ===== §3 התנהגות
  sectionHeader("התנהגות ונקודות");
  autoTable(doc, {
    ...baseTable,
    startY: y,
    head: [["חיוביים", "שליליים", "נטו"]],
    body: [[
      `+${student.behavior.positive}`,
      `−${student.behavior.negative}`,
      String(student.behavior.total),
    ]],
    styles: { ...baseTable.styles, halign: "center", fontSize: 10 },
  });
  y = afterTable() + 4;

  if (student.discipline.length) {
    ensureSpace(20);
    autoTable(doc, {
      ...baseTable,
      startY: y,
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
    y = afterTable() + 8;
  } else {
    y += 4;
  }

  // ===== §4 הערות הרב
  const noteText = studentNote || classNote;
  if (noteText) {
    sectionHeader("הערות הרב");
    autoTable(doc, {
      ...baseTable,
      startY: y,
      head: [],
      body: [[noteText]],
      styles: { ...baseTable.styles, fontSize: 10, cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.2 },
      columnStyles: { 0: { cellWidth: contentW, halign: "right", overflow: "linebreak" } },
      theme: "plain",
    });
    y = afterTable() + 6;
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  const footMeta = [schoolName, report.class.name].filter(Boolean).join(" · ");
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setR2L(true);
    doc.setFont("Heebo", "normal");
    doc.setFontSize(8);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginL, pageH - 12, pageW - marginR, pageH - 12);
    doc.setTextColor(150);
    if (footMeta) doc.text(footMeta, rightX, pageH - 7, { align: "right" });
    doc.text(`ClassAlign Studio · עמ׳ ${i} מתוך ${pageCount}`, pageW / 2, pageH - 7, { align: "center" });
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