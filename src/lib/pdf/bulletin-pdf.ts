import type { BulletinDraft } from "@/lib/bulletins.functions";
import {
  createHebrewDoc,
  drawBrandHeader,
  drawFooter,
  hebrewDate,
  safeName,
} from "./pdf-builder";
import { ensurePdfBrandLoaded } from "./brand-loader";

export type BulletinPdfArgs = {
  bulletin: BulletinDraft & { startDate: string; endDate: string };
  className: string;
  schoolName?: string;
  teacherName?: string;
};

export type BulletinPdfResult = { blob: Blob; filename: string };

/** תוויות מקצועות ההספק — סדר הצגה קבוע בטבלת ההספק. */
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

function scheduleBody(schedule: unknown): string[][] {
  const s = (schedule ?? {}) as Record<string, Record<string, string> | undefined>;
  const rows: string[][] = [];
  for (const def of SCHEDULE_ROWS) {
    const row = s[def.key];
    if (!row) continue;
    const detail = def.fields
      .map(([field, label]) => {
        const v = (row[field] ?? "").trim();
        return v ? `${label}: ${v}` : "";
      })
      .filter(Boolean)
      .join("  |  ");
    if (detail) rows.push([def.label, detail]);
  }
  return rows;
}

/** מסגרת דקורטיבית עדינה לעמוד דבר התורה. */
function drawDecorativeFrame(hd: Awaited<ReturnType<typeof createHebrewDoc>>) {
  const { doc, layout } = hd;
  const x = layout.marginL - 4;
  const y = 10;
  const w = layout.contentW + 8;
  const h = layout.pageH - 24;
  doc.setFillColor(252, 249, 242);
  doc.roundedRect(x, y, w, h, 3, 3, "F");
  doc.setDrawColor(196, 154, 60);
  doc.setLineWidth(0.7);
  doc.roundedRect(x, y, w, h, 3, 3, "S");
  doc.setLineWidth(0.25);
  doc.roundedRect(x + 2.2, y + 2.2, w - 4.4, h - 4.4, 2.4, 2.4, "S");
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
}

export async function buildBulletinPdf(args: BulletinPdfArgs): Promise<BulletinPdfResult> {
  const { bulletin, className, schoolName, teacherName } = args;
  await ensurePdfBrandLoaded();
  const hd = await createHebrewDoc();
  const footerText = [schoolName, className].filter(Boolean).join(" · ");

  const meta = [
    schoolName,
    className,
    teacherName ? `הרב ${teacherName}` : null,
    `${hebrewDate(bulletin.startDate)} — ${hebrewDate(bulletin.endDate)}`,
  ].filter(Boolean).join(" · ");

  // ── עמוד 1: שער + סיכום השבוע ──────────────────────────────────────────
  drawBrandHeader(hd, {
    title: bulletin.title || "עלון שבועי",
    meta,
  });

  if (bulletin.digest_summary?.trim()) {
    hd.section("סיכום השבוע");
    hd.paragraph(bulletin.digest_summary);
  }

  // ── עמוד 2: דבר תורה ───────────────────────────────────────────────────
  const dvarTitle = bulletin.torah_dvar_title?.trim();
  const dvarBody = bulletin.torah_dvar_body?.trim();
  if (dvarTitle || dvarBody) {
    drawFooter(hd, footerText);
    hd.newPage();
    drawDecorativeFrame(hd);
    hd.setY(22);
    hd.section(dvarTitle || "דבר תורה");
    if (dvarBody) hd.paragraph(dvarBody);
  }

  // ── עמוד 3: הספק לימודי + הודעות ───────────────────────────────────────
  const schedule = scheduleBody(bulletin.study_schedule);
  const honored = (bulletin.honored_students ?? []).filter((h) => h?.name?.trim());
  const notices = (bulletin.special_notices ?? []).filter((n) => n?.title?.trim() || n?.body?.trim());
  const hasPage3 = schedule.length > 0 || honored.length > 0 || notices.length > 0
    || (bulletin.study_points?.length ?? 0) > 0 || (bulletin.activities?.length ?? 0) > 0;

  if (hasPage3) {
    drawFooter(hd, footerText);
    hd.newPage();
  }

  if (schedule.length) {
    hd.section("ההספק הלימודי");
    hd.table({
      head: [["מקצוע", "פירוט"]],
      body: schedule,
      columnStyles: {
        0: { cellWidth: 28, halign: "right" },
        1: { cellWidth: "auto", overflow: "linebreak", halign: "right" },
      },
    });
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

  if (honored.length) {
    hd.section("יישר כח ומזל טוב");
    hd.table({
      head: [["שם", "סוג", "הערה"]],
      body: honored.map((h) => [h.name, HONOR_LABELS[h.type] ?? HONOR_LABELS["other"]!, h.note ?? ""]),
      columnStyles: {
        0: { cellWidth: 45, overflow: "linebreak", halign: "right" },
        1: { cellWidth: 38, halign: "right" },
        2: { cellWidth: "auto", overflow: "linebreak", halign: "right" },
      },
    });
  }

  if (notices.length) {
    hd.section("הודעות מיוחדות");
    hd.table({
      head: [["נושא", "פירוט"]],
      body: notices.map((n) => [n.title ?? "", n.body ?? ""]),
      columnStyles: {
        0: { cellWidth: 45, overflow: "linebreak", halign: "right" },
        1: { cellWidth: "auto", overflow: "linebreak", halign: "right" },
      },
    });
  }

  // ── עמוד 4: שאלות חזרה + חידה שבועית ───────────────────────────────────
  const hasPage4 = (bulletin.recap_questions?.length ?? 0) > 0 || !!bulletin.weekly_riddle?.trim();
  if (hasPage4) {
    drawFooter(hd, footerText);
    hd.newPage();
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

  drawFooter(hd, footerText);

  const filename = `עלון_${safeName(className)}_${bulletin.startDate}.pdf`;
  return { blob: hd.doc.output("blob"), filename };
}