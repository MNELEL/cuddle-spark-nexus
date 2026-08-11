import type { BulletinDraft } from "@/lib/bulletins.functions";

/** תוויות מקצועות ההספק לייצוא טקסטואלי. */
const SCHEDULE_ROWS = [
  { key: "gemara", label: "גמרא", fields: [["daf", "דף"], ["topic", "נושא"]] },
  { key: "mishna", label: "משנה", fields: [["masechet", "מסכת"], ["perek", "פרק"]] },
  { key: "torah", label: "חומש", fields: [["parasha", "פרשה"], ["pasuk_range", "פסוקים"]] },
  { key: "navi", label: "נביא", fields: [["sefer", "ספר"], ["perek", "פרק"]] },
  { key: "halacha", label: "הלכה", fields: [["siman", "סימן"], ["seif", "סעיף"]] },
] as const;

const HONOR_LABELS: Record<string, string> = {
  vort: "ווארט / דבר תורה",
  mazal_tov: "מזל טוב",
  other: "יישר כח",
};

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

  if (bulletin.torah_dvar_title?.trim() || bulletin.torah_dvar_body?.trim()) {
    lines.push(`## ${bulletin.torah_dvar_title?.trim() || "דבר תורה"}`, "");
    if (bulletin.torah_dvar_body?.trim()) lines.push(bulletin.torah_dvar_body.trim(), "");
  }

  const schedule = (bulletin.study_schedule ?? {}) as Record<string, Record<string, string> | undefined>;
  const scheduleLines: string[] = [];
  for (const def of SCHEDULE_ROWS) {
    const row = schedule[def.key];
    if (!row) continue;
    const detail = def.fields
      .map(([f, label]) => {
        const v = (row[f] ?? "").trim();
        return v ? `${label}: ${v}` : "";
      })
      .filter(Boolean)
      .join(", ");
    if (detail) scheduleLines.push(`- **${def.label}** — ${detail}`);
  }
  if (scheduleLines.length) {
    lines.push("## ההספק הלימודי", "", ...scheduleLines, "");
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

  const honored = (bulletin.honored_students ?? []).filter((h) => h?.name?.trim());
  if (honored.length) {
    lines.push("## יישר כח ומזל טוב", "");
    for (const h of honored) {
      const label = HONOR_LABELS[h.type] ?? HONOR_LABELS["other"];
      lines.push(`- ${h.name} — ${label}${h.note?.trim() ? `: ${h.note.trim()}` : ""}`);
    }
    lines.push("");
  }

  const notices = (bulletin.special_notices ?? []).filter((n) => n?.title?.trim() || n?.body?.trim());
  if (notices.length) {
    lines.push("## הודעות מיוחדות", "");
    for (const n of notices) {
      if (n.title?.trim()) lines.push(`### ${n.title.trim()}`, "");
      if (n.body?.trim()) lines.push(n.body.trim(), "");
    }
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
