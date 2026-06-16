import type { BulletinDraft } from "@/lib/bulletins.functions";
import {
  createHebrewDoc,
  drawBrandHeader,
  drawFooter,
  hebrewDate,
  safeName,
} from "./pdf-builder";

export type BulletinPdfArgs = {
  bulletin: BulletinDraft & { startDate: string; endDate: string };
  className: string;
  schoolName?: string;
  teacherName?: string;
};

export type BulletinPdfResult = { blob: Blob; filename: string };

export async function buildBulletinPdf(args: BulletinPdfArgs): Promise<BulletinPdfResult> {
  const { bulletin, className, schoolName, teacherName } = args;
  const hd = await createHebrewDoc();

  const meta = [
    schoolName,
    className,
    teacherName ? `הרב ${teacherName}` : null,
    `${hebrewDate(bulletin.startDate)} — ${hebrewDate(bulletin.endDate)}`,
  ].filter(Boolean).join(" · ");

  drawBrandHeader(hd, {
    title: bulletin.title || "עלון שבועי",
    meta,
  });

  if (bulletin.digest_summary?.trim()) {
    hd.section("סיכום השבוע");
    hd.paragraph(bulletin.digest_summary);
  }

  if (bulletin.study_points?.length) {
    hd.section("נקודות לימוד");
    hd.table({
      head: [["#", "נקודה"]],
      body: bulletin.study_points.map((p, i) => [String(i + 1), p]),
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: "auto", overflow: "linebreak", halign: "right" },
      },
    });
  }

  if (bulletin.recap_questions?.length) {
    hd.section("שאלות חזרה להורים");
    hd.table({
      head: [["#", "שאלה", "תשובה"]],
      body: bulletin.recap_questions.map((q, i) => [String(i + 1), q.question, q.answer]),
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 70, overflow: "linebreak" },
        2: { cellWidth: "auto", overflow: "linebreak" },
      },
    });
  }

  if (bulletin.weekly_riddle?.trim()) {
    hd.section("חידה שבועית");
    hd.paragraph(bulletin.weekly_riddle);
    if (bulletin.weekly_riddle_answer?.trim()) {
      hd.paragraph(`תשובה: ${bulletin.weekly_riddle_answer}`, { muted: true, size: 9.5 });
    }
  }

  if (bulletin.activities?.length) {
    hd.section("פעילויות ויוזמות");
    hd.table({
      head: [["#", "פעילות"]],
      body: bulletin.activities.map((a, i) => [String(i + 1), a]),
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: "auto", overflow: "linebreak", halign: "right" },
      },
    });
  }

  drawFooter(hd, [schoolName, className].filter(Boolean).join(" · "));

  const filename = `עלון_${safeName(className)}_${bulletin.startDate}.pdf`;
  return { blob: hd.doc.output("blob"), filename };
}