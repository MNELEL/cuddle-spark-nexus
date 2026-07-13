import type { LessonExtracted, LessonExamQuestion } from "@/lib/ingest.functions";
import {
  createHebrewDoc, drawBrandHeader, drawFooter, downloadPdfBlob, safeName,
} from "./pdf-builder";

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function lessonPdfFileName(lesson: LessonExtracted): string {
  const base = safeName(lesson.title?.trim() || "סיכום-שיעור");
  return `${base}__${todayIso()}.pdf`;
}

const DIFF_LABEL: Record<LessonExamQuestion["difficulty"], string> = {
  easy: "קל",
  medium: "בינוני",
  hard: "מאתגר",
};

export type LessonPdfResult = { blob: Blob; filename: string };

export async function buildLessonSummaryPdf(
  lesson: LessonExtracted,
  opts?: { className?: string; onlyIncluded?: boolean },
): Promise<LessonPdfResult> {
  const hd = await createHebrewDoc();

  const meta = [
    opts?.className ? `כיתה: ${opts.className}` : null,
    `${(lesson.exam_questions ?? []).length} שאלות מבחן`,
    `${(lesson.key_points ?? []).length} נקודות מפתח`,
  ].filter(Boolean).join(" · ");

  drawBrandHeader(hd, {
    title: lesson.title || "סיכום שיעור",
    subtitle: "סיכום, נקודות מפתח ושאלות מבחן",
    meta,
  });

  // Summary
  if (lesson.summary?.trim()) {
    hd.section("סיכום השיעור");
    hd.paragraph(lesson.summary.trim());
  }

  // Key points
  const kp = (lesson.key_points ?? []).filter((s) => s && s.trim());
  if (kp.length) {
    hd.section("נקודות מפתח");
    hd.table({
      head: [["#", "נקודה"]],
      body: kp.map((p, i) => [String(i + 1), p]),
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { halign: "right" },
      },
    });
  }

  // Exam questions
  const questions = (lesson.exam_questions ?? [])
    .filter((q) => (opts?.onlyIncluded ? q.include !== false : true))
    .filter((q) => q.q && q.q.trim());

  if (questions.length) {
    const avg = Math.round(
      (questions.reduce((s, q) => s + (q.confidence ?? 0), 0) / questions.length) * 100,
    );
    hd.section(`שאלות מבחן (${questions.length}) · ביטחון ממוצע ${avg}%`);
    hd.table({
      head: [["#", "שאלה", "תשובה", "קושי", "נושא", "ביטחון"]],
      body: questions.map((q, i) => [
        String(i + 1),
        q.q,
        q.a ?? "—",
        DIFF_LABEL[q.difficulty],
        q.topic ?? "—",
        `${Math.round((q.confidence ?? 0) * 100)}%`,
      ]),
      rowPageBreak: "avoid",
      showHead: "everyPage",
      columnStyles: {
        0: { cellWidth: 9, halign: "center" },
        1: { cellWidth: 62, halign: "right" },
        2: { cellWidth: 55, halign: "right" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 24, halign: "center" },
        5: { cellWidth: 16, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index !== 5) return;
        const pct = parseInt(String(data.cell.raw).replace("%", ""), 10) || 0;
        if (pct >= 80) data.cell.styles.textColor = [22, 101, 52];
        else if (pct >= 50) data.cell.styles.textColor = [161, 98, 7];
        else data.cell.styles.textColor = [153, 27, 27];
        data.cell.styles.fontStyle = "bold";
      },
    });
  }

  drawFooter(hd, lesson.title || "סיכום שיעור");
  const blob = hd.doc.output("blob");
  return { blob, filename: lessonPdfFileName(lesson) };
}

export async function exportLessonSummaryPdf(
  lesson: LessonExtracted,
  opts?: { className?: string; onlyIncluded?: boolean },
): Promise<void> {
  const { blob, filename } = await buildLessonSummaryPdf(lesson, opts);
  downloadPdfBlob(blob, filename);
}