import type { BulletinDraft } from "@/lib/bulletins.functions";

/** Minimal shape needed for a plain-text certificate export. */
export type CertificateTextRow = {
  name: string;
  subjects: { subject: string; label: string; note?: string }[];
  conducts: { key: string; label: string }[];
  attendance: { present: number; absent: number; late: number };
  teacherNote: string;
  principalNote: string;
};

export type CertificateTextMeta = {
  className: string;
  period: string;
  schoolName: string;
};

/** Converts a weekly bulletin draft into Markdown (headings + lists). */
export function bulletinToMarkdown(
  bulletin: BulletinDraft & { startDate: string; endDate: string },
  className: string,
): string {
  const lines: string[] = [];
  lines.push(`# ${bulletin.title || "עלון שבועי"}`);
  lines.push("");
  lines.push(`**כיתה:** ${className}  `);
  lines.push(`**טווח תאריכים:** ${bulletin.startDate} — ${bulletin.endDate}`);
  lines.push("");

  if (bulletin.digest_summary?.trim()) {
    lines.push("## סיכום השבוע", "", bulletin.digest_summary.trim(), "");
  }

  if (bulletin.study_points?.length) {
    lines.push("## נקודות לימוד", "");
    for (const p of bulletin.study_points) lines.push(`- ${p}`);
    lines.push("");
  }

  if (bulletin.recap_questions?.length) {
    lines.push("## שאלות חזרה להורים", "");
    bulletin.recap_questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.question}`);
      if (q.answer?.trim()) lines.push(`   - תשובה: ${q.answer}`);
    });
    lines.push("");
  }

  if (bulletin.weekly_riddle?.trim()) {
    lines.push("## חידה שבועית", "", bulletin.weekly_riddle.trim(), "");
    if (bulletin.weekly_riddle_answer?.trim()) {
      lines.push(`**תשובה:** ${bulletin.weekly_riddle_answer.trim()}`, "");
    }
  }

  if (bulletin.activities?.length) {
    lines.push("## פעילויות ויוזמות", "");
    for (const a of bulletin.activities) lines.push(`- ${a}`);
    lines.push("");
  }

  return lines.join("\n");
}

/** Converts a certificate row into simple line-by-line plain text. */
export function certificateToText(row: CertificateTextRow, meta: CertificateTextMeta): string {
  const lines: string[] = [];
  lines.push("תעודת הערכה");
  lines.push(`מוסד: ${meta.schoolName}`);
  lines.push(`כיתה: ${meta.className}`);
  lines.push(`תקופה: ${meta.period}`);
  lines.push(`שם התלמיד: ${row.name}`);
  lines.push("");
  lines.push("הישגים לימודיים:");
  for (const s of row.subjects) {
    lines.push(`${s.subject}: ${s.label}${s.note?.trim() ? ` (${s.note.trim()})` : ""}`);
  }
  lines.push("");
  lines.push("הליכות ומידות:");
  for (const c of row.conducts) lines.push(`${c.key}: ${c.label}`);
  lines.push("");
  lines.push("נוכחות:");
  lines.push(`נוכח: ${row.attendance.present}`);
  lines.push(`נעדר: ${row.attendance.absent}`);
  lines.push(`איחורים: ${row.attendance.late}`);
  if (row.teacherNote?.trim()) {
    lines.push("", "הערות המחנך / הרב:", row.teacherNote.trim());
  }
  if (row.principalNote?.trim()) {
    lines.push("", "הערות ההנהלה:", row.principalNote.trim());
  }
  return lines.join("\n");
}

/** Downloads text content as a file (parallel to downloadPdfBlob). */
export function downloadTextBlob(content: string, filename: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
