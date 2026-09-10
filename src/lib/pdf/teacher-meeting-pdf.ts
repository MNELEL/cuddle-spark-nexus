import type { CertTemplateDesign } from "@/lib/ai-certificate.functions";
import type { TeacherMeeting } from "@/lib/teacher-meetings.functions";
import {
  createHebrewDoc,
  downloadPdfBlob as _downloadPdfBlob,
  drawBrandHeader,
  drawFooter,
  hebrewDate,
  safeName,
} from "./pdf-builder";
import { ensurePdfBrandLoaded } from "./brand-loader";
import { drawTemplateFrame } from "./template-design";

export type TeacherMeetingPdfArgs = {
  teacherName: string;
  meetings: TeacherMeeting[];
  /** תבנית סגנון שמורה; ללא תבנית נשמר העיצוב הרגיל. */
  design?: CertTemplateDesign;
  institutionName?: string;
};

export type TeacherMeetingPdfResult = { blob: Blob; filename: string };

/** מפיק PDF ליומן פגישות 1:1 — פגישה אחת או כל הפגישות של המלמד. */
export async function buildTeacherMeetingsPdf(
  args: TeacherMeetingPdfArgs,
): Promise<TeacherMeetingPdfResult> {
  const { teacherName, meetings, design, institutionName } = args;
  if (meetings.length === 0) throw new Error("אין פגישות להפקה");

  await ensurePdfBrandLoaded();
  const hd = await createHebrewDoc();

  const single = meetings.length === 1 ? meetings[0]! : null;
  const meta = [
    institutionName,
    `הרב ${teacherName}`,
    single ? hebrewDate(single.meetingDate) : `${meetings.length} פגישות`,
  ].filter(Boolean).join(" · ");

  drawBrandHeader(hd, {
    title: single ? "סיכום פגישה 1:1" : "יומן פגישות 1:1",
    meta,
  });
  if (design) drawTemplateFrame(hd, design);

  for (const m of meetings) {
    hd.section(`פגישה · ${hebrewDate(m.meetingDate)}`);
    hd.table({
      head: [["תאריך הפגישה", "מתעד", "תאריך מעקב"]],
      body: [[
        hebrewDate(m.meetingDate),
        m.adminName,
        m.followUpDate ? hebrewDate(m.followUpDate) : "—",
      ]],
      styles: { halign: "center", fontSize: 10 },
    });

    hd.subSection?.("סיכום הפגישה");
    hd.paragraph(m.summary);

    if (m.actionItems) {
      hd.subSection?.("מטלות להמשך");
      hd.paragraph(m.actionItems);
    }
    if (m.followUpDate) {
      hd.paragraph(`תאריך מעקב: ${hebrewDate(m.followUpDate)}`, { muted: true });
    }
  }

  drawFooter(hd, [institutionName, `הרב ${teacherName}`].filter(Boolean).join(" · "));

  const suffix = single ? single.meetingDate : "יומן";
  const filename = `פגישות_${safeName(teacherName)}_${suffix}.pdf`;
  return { blob: hd.doc.output("blob"), filename };
}

export const downloadPdfBlob = _downloadPdfBlob;
