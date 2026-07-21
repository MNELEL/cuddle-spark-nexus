import {
  createHebrewDoc,
  drawBrandHeader,
  drawFooter,
  safeName,
  SLATE,
  AMBER,
  SOFT,
} from "./pdf-builder";

export const GRADE_LABELS = [
  "מצוין",
  "טוב מאוד",
  "כמעט טוב מאוד",
  "טוב",
  "כמעט טוב",
  "להשתדל יותר",
] as const;
export type GradeLabel = (typeof GRADE_LABELS)[number];

export const BEHAVIOR_LABELS = [
  "ראוי לשבח",
  "נאות",
  "בינוני",
  "טעון שיפור",
] as const;
export type BehaviorLabel = (typeof BEHAVIOR_LABELS)[number];

/** Maps a numeric percentage (0-100) to the classic Hebrew grade label. */
export function labelForPercent(pct: number): GradeLabel {
  if (pct >= 95) return "מצוין";
  if (pct >= 88) return "טוב מאוד";
  if (pct >= 82) return "כמעט טוב מאוד";
  if (pct >= 72) return "טוב";
  if (pct >= 60) return "כמעט טוב";
  return "להשתדל יותר";
}

export type CertificateSubject = {
  subject: string;
  label: GradeLabel;
  note?: string;
};

export type CertificatePayload = {
  schoolName: string;
  className: string;
  studentName: string;
  period: string; // e.g. "מחצית א' – תשפ"ה"
  academicYear: string;
  subjects: CertificateSubject[];
  behavior: {
    conduct: BehaviorLabel;   // הליכות
    diligence?: BehaviorLabel; // שקידה
    manners?: BehaviorLabel;   // דרך ארץ
  };
  attendance?: { present: number; absent: number; late: number };
  teacherNote?: string;
  principalNote?: string;
  teacherName?: string;
  principalName?: string;
  issueDate: string; // YYYY-MM-DD
  type?: "regular" | "correction"; // "תיקון" if correction
};

export async function buildCertificatePdfBlob(p: CertificatePayload): Promise<Blob> {
  const hd = await createHebrewDoc();
  const { doc, layout } = hd;

  // Ornate double border in slate + amber
  const outer = 6;
  const inner = 9;
  doc.setDrawColor(...SLATE);
  doc.setLineWidth(0.8);
  doc.rect(outer, outer, layout.pageW - outer * 2, layout.pageH - outer * 2);
  doc.setDrawColor(...AMBER);
  doc.setLineWidth(0.4);
  doc.rect(inner, inner, layout.pageW - inner * 2, layout.pageH - inner * 2);

  drawBrandHeader(hd, {
    title: p.type === "correction" ? "תעודה — תיקון" : "תעודת הערכה",
    subtitle: p.schoolName,
    meta: `${p.period} · שנה"ל ${p.academicYear}`,
  });

  // Student panel
  const y0 = hd.currentY() + 2;
  doc.setFillColor(...SOFT);
  doc.rect(layout.marginL, y0, layout.contentW, 16, "F");
  doc.setFont("Heebo", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...SLATE);
  doc.text(`שם התלמיד: ${p.studentName}`, layout.rightX - 3, y0 + 7, { align: "right" });
  doc.setFont("Heebo", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(60);
  doc.text(`כיתה: ${p.className}`, layout.rightX - 3, y0 + 13, { align: "right" });
  hd.setY(y0 + 20);

  // Subjects table
  hd.section("הישגים לימודיים");
  hd.table({
    head: [["מקצוע", "הערכה", "הערה"]],
    body: p.subjects.map((s) => [s.subject, s.label, s.note ?? ""]),
    columnStyles: {
      0: { cellWidth: 60, fontStyle: "bold" },
      1: { cellWidth: 45, halign: "center" },
      2: { cellWidth: "auto" },
    },
  });

  // Behavior
  hd.section("הליכות ומידות");
  const behaviorRows: [string, string][] = [
    ["הליכות", p.behavior.conduct],
  ];
  if (p.behavior.diligence) behaviorRows.push(["שקידה", p.behavior.diligence]);
  if (p.behavior.manners) behaviorRows.push(["דרך ארץ", p.behavior.manners]);
  hd.table({
    head: [["תחום", "הערכה"]],
    body: behaviorRows,
    columnStyles: {
      0: { cellWidth: 60, fontStyle: "bold" },
      1: { halign: "center" },
    },
  });

  if (p.attendance) {
    hd.section("נוכחות");
    hd.table({
      head: [["נוכח", "נעדר", "איחורים"]],
      body: [[
        String(p.attendance.present),
        String(p.attendance.absent),
        String(p.attendance.late),
      ]],
      styles: { halign: "center" },
    });
  }

  if (p.teacherNote) {
    hd.section("הערות המחנך/הרב");
    hd.paragraph(p.teacherNote);
  }
  if (p.principalNote) {
    hd.section("הערות ההנהלה");
    hd.paragraph(p.principalNote);
  }

  // Signatures
  hd.ensureSpace(30);
  const sigY = hd.currentY() + 8;
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  const midX = layout.pageW / 2;
  const rightSigX = layout.rightX - 20;
  const leftSigX = layout.marginL + 20;
  doc.line(rightSigX - 40, sigY, rightSigX, sigY);
  doc.line(leftSigX, sigY, leftSigX + 40, sigY);
  doc.setFont("Heebo", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(p.teacherName ?? "חתימת המחנך/הרב", rightSigX - 20, sigY + 5, { align: "center" });
  doc.text(p.principalName ?? "חתימת ההנהלה", leftSigX + 20, sigY + 5, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`תאריך הפקה: ${p.issueDate}`, midX, sigY + 5, { align: "center" });

  drawFooter(hd, `${p.schoolName} · ${p.period}`);
  return doc.output("blob");
}

export function certificateFilename(studentName: string, period: string): string {
  return `תעודה_${safeName(studentName)}_${safeName(period)}.pdf`;
}

/* ---------------- Parent–teacher conference prep sheet ---------------- */

export type ConferencePayload = {
  schoolName: string;
  className: string;
  studentName: string;
  period: string;
  strengths: string;
  challenges: string;
  actionItems: string;
  gradesSummary: { subject: string; label: GradeLabel }[];
  behavior: { conduct: BehaviorLabel };
  teacherName?: string;
  meetingDate?: string;
};

export async function buildConferencePdfBlob(p: ConferencePayload): Promise<Blob> {
  const hd = await createHebrewDoc();
  drawBrandHeader(hd, {
    title: "דף הכנה לפגישת הורים ומורים",
    subtitle: `${p.schoolName} · ${p.className}`,
    meta: p.meetingDate ? `מועד הפגישה: ${p.meetingDate}` : p.period,
  });

  hd.section("פרטי התלמיד");
  hd.paragraph(`${p.studentName} · ${p.period}`);

  hd.section("תמונת מצב לימודית");
  hd.table({
    head: [["מקצוע", "הערכה"]],
    body: p.gradesSummary.map((g) => [g.subject, g.label]),
    columnStyles: { 1: { halign: "center" } },
  });

  hd.section("הליכות");
  hd.paragraph(p.behavior.conduct);

  hd.section("חוזקות");
  hd.paragraph(p.strengths || "—");
  hd.section("אתגרים ונקודות לחיזוק");
  hd.paragraph(p.challenges || "—");
  hd.section("סיכום ותוכנית פעולה");
  hd.paragraph(p.actionItems || "—");

  drawFooter(hd, `${p.schoolName} · הכנה לפגישת הורים`);
  return hd.doc.output("blob");
}