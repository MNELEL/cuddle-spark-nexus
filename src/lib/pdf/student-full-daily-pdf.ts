import type { CertTemplateDesign } from "@/lib/ai-certificate.functions";
import { createHebrewDoc, drawBrandHeader, drawFooter, hebrewDate, safeName } from "./pdf-builder";
import { drawTemplateFrame } from "./template-design";
import { ensurePdfBrandLoaded } from "./brand-loader";

/** תיעוד יומי מלא לתלמיד אחד — נוכחות, ציונים, תובנות ואישור המלמד. */
export type StudentFullDailyPdfInput = {
  studentName: string;
  className: string;
  /** התאריך המתועד (ISO). */
  date: string;
  /** תאריך-החלוף הפעיל בלוח העברי (ISO). */
  elapsedFrom: string;
  attendance: { status: string; notes: string } | null;
  grades: { subject: string; value: number; max_value: number }[];
  insights: { severity: string; title: string; description: string }[];
  approval: { date: string; approver: string; notes: string } | null;
  design?: CertTemplateDesign;
  templateName?: string;
};

const STATUS_LABEL: Record<string, string> = {
  present: "נוכח",
  absent: "נעדר",
  late: "איחור",
  excused: "מאושר",
};
const SEVERITY_LABEL: Record<string, string> = {
  low: "רגילה",
  medium: "לתשומת לב",
  high: "דחופה",
};

export async function buildStudentFullDailyPdf(
  input: StudentFullDailyPdfInput,
): Promise<{ blob: Blob; filename: string }> {
  await ensurePdfBrandLoaded();
  const hd = await createHebrewDoc();
  if (input.design) drawTemplateFrame(hd, input.design);

  drawBrandHeader(hd, {
    title: `תיעוד יומי מלא — ${input.studentName}`,
    subtitle: input.templateName,
    meta: `${input.className} · ${hebrewDate(input.date)} (${input.date})`,
  });

  hd.section("תאריכי הלוח העברי");
  hd.table({
    head: [["תאריך-החלוף", "תאריך התיעוד"]],
    body: [[`${hebrewDate(input.elapsedFrom)} (${input.elapsedFrom})`, `${hebrewDate(input.date)} (${input.date})`]],
    styles: { halign: "center" },
  });

  hd.section("נוכחות");
  hd.paragraph(
    input.attendance
      ? [STATUS_LABEL[input.attendance.status] ?? input.attendance.status, input.attendance.notes]
          .filter(Boolean)
          .join(" · ")
      : "לא נרשמה נוכחות ליום זה.",
  );

  hd.section(`ציונים (${input.grades.length})`);
  if (input.grades.length === 0) hd.paragraph("אין ציונים ליום זה.");
  else
    hd.table({
      head: [["מקצוע", "ציון", "אחוז"]],
      body: input.grades.map((g) => [
        g.subject || "—",
        `${g.value}/${g.max_value}`,
        `${Math.round((g.value / (g.max_value || 100)) * 100)}%`,
      ]),
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 26, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
      },
    });

  hd.section(`תובנות (${input.insights.length})`);
  if (input.insights.length === 0) hd.paragraph("אין תובנות ליום זה.");
  else
    hd.table({
      head: [["חשיבות", "תובנה", "פירוט"]],
      body: input.insights.map((i) => [
        SEVERITY_LABEL[i.severity] ?? i.severity,
        i.title,
        i.description || "—",
      ]),
      columnStyles: {
        0: { cellWidth: 24, halign: "center" },
        1: { cellWidth: 46 },
        2: { cellWidth: "auto", overflow: "linebreak" },
      },
    });

  hd.section("אישור המלמד");
  hd.paragraph(
    input.approval
      ? `אושר בתאריך ${hebrewDate(input.approval.date)} (${input.approval.date})` +
          (input.approval.approver ? ` · ${input.approval.approver}` : "") +
          (input.approval.notes ? ` — ${input.approval.notes}` : "")
      : "טרם אושר",
  );

  drawFooter(hd, `${input.className} · ${input.studentName}`);
  const filename = `תיעוד_מלא_${safeName(input.studentName)}_${input.date}.pdf`;
  return { blob: hd.doc.output("blob"), filename };
}
