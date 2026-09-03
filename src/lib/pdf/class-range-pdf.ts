import type { ClassRangeExport } from "@/lib/class-range-export.functions";
import { createHebrewDoc, drawBrandHeader, drawFooter, hebrewDate, safeName } from "./pdf-builder";
import { ensurePdfBrandLoaded } from "./brand-loader";

const EVENT_LABEL: Record<string, string> = {
  birthday: "יום הולדת",
  exam: "מבחן",
  special_exam: "בחינה מיוחדת",
  trip: "טיול",
  holiday: "חג",
  meeting: "אסיפה",
  celebration: "שמחה",
  other: "אחר",
};

const SEVERITY_LABEL: Record<string, string> = { high: "גבוהה", medium: "בינונית", low: "נמוכה" };

/** דוח כיתה מלא לטווח תאריכים עברי: תלמידים, אירועים, תיעוד יומי ותובנות. */
export async function buildClassRangePdf(
  data: ClassRangeExport,
  opts?: { rangeLabel?: string },
): Promise<{ blob: Blob; filename: string }> {
  await ensurePdfBrandLoaded();
  const hd = await createHebrewDoc();

  drawBrandHeader(hd, {
    title: `נתוני כיתה — ${data.class.name}`,
    subtitle: opts?.rangeLabel,
    meta: `תקופה: ${hebrewDate(data.range.from)} — ${hebrewDate(data.range.to)} · ${data.students.length} תלמידים`,
  });

  const nameOf = (id: string | null) =>
    (id && data.students.find((s) => s.id === id)?.name) || "";

  hd.section(`תלמידים (${data.students.length})`);
  if (data.students.length === 0) hd.paragraph("אין תלמידים בכיתה.");
  else
    hd.table({
      head: [["#", "שם", "מקום (שורה/עמודה)", "הערות"]],
      body: data.students.map((s, i) => [
        String(i + 1),
        s.name,
        s.seat_row !== null && s.seat_col !== null ? `${s.seat_row + 1} / ${s.seat_col + 1}` : "—",
        s.notes || "",
      ]),
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        2: { cellWidth: 32, halign: "center" },
        3: { cellWidth: "auto", overflow: "linebreak" },
      },
    });

  hd.section(`אירועים (${data.events.length})`);
  if (data.events.length === 0) hd.paragraph("אין אירועים בטווח זה.");
  else
    hd.table({
      head: [["תאריך", "סוג", "כותרת", "תלמיד", "הערות"]],
      body: data.events.map((e) => [
        hebrewDate(e.date),
        EVENT_LABEL[e.type] ?? e.type,
        e.title,
        nameOf(e.student_id),
        e.notes || "",
      ]),
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 22, halign: "center" },
        4: { cellWidth: "auto", overflow: "linebreak" },
      },
    });

  hd.section(`תיעוד יומי (${data.dailyLogs.length})`);
  if (data.dailyLogs.length === 0) hd.paragraph("אין תיעוד יומי בטווח זה.");
  else
    for (const log of data.dailyLogs) {
      hd.subSection(`${hebrewDate(log.date)} (${log.date})`);
      hd.paragraph(log.notes || "—");
    }

  hd.section(`תובנות (${data.insights.length})`);
  if (data.insights.length === 0) hd.paragraph("אין תובנות בטווח זה.");
  else
    hd.table({
      head: [["תאריך", "חומרה", "כותרת", "תלמיד", "תיאור"]],
      body: data.insights.map((i) => [
        hebrewDate(i.created_at.slice(0, 10)),
        SEVERITY_LABEL[i.severity] ?? i.severity,
        i.title,
        nameOf(i.student_id),
        [i.description, i.suggested_action].filter(Boolean).join(" — "),
      ]),
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20, halign: "center" },
        4: { cellWidth: "auto", overflow: "linebreak" },
      },
    });

  drawFooter(hd, data.class.name);
  const filename = `כיתה_${safeName(data.class.name)}_${data.range.from}_${data.range.to}.pdf`;
  return { blob: hd.doc.output("blob"), filename };
}
