import { createHebrewDoc, drawBrandHeader, drawFooter, safeName } from "./pdf-builder";
import { sensitiveFlagLabel, type SensitiveFlag } from "@/lib/student-profiles.functions";
import { hebrewDate, hebrewDateTime } from "@/lib/hebrew-date";

export type HandoffProfile = {
  student_name: string;
  sensitive_flags: string[];
  sensitive_notes: string;
  teaching_style_notes: string;
  handoff_notes: string;
  updated_at?: string | null;
};

export async function buildHandoffPdfBlob(
  className: string,
  profiles: HandoffProfile[],
): Promise<Blob> {
  const hd = await createHebrewDoc();
  drawBrandHeader(hd, {
    title: "מסמך מסירה — פרופילי תלמידים",
    subtitle: `כיתה ${className}`,
    meta: `מסמך פנימי חסוי · ${profiles.length} תלמידים · ${hebrewDate()}`,
  });

  hd.paragraph(
    "מסמך זה מכיל מידע רגיש והנחיות הוראה. מיועד למורה הכיתה ולמנהל המוסד בלבד — אין להעבירו להורים או לגורם חיצוני.",
  );

  if (profiles.length === 0) {
    hd.paragraph("אין פרופילי תלמידים מתועדים בכיתה זו.");
  }

  for (const p of profiles) {
    hd.section(p.student_name || "תלמיד");
    if (p.updated_at) {
      hd.paragraph(
        `עודכן לאחרונה: ${hebrewDateTime(p.updated_at)}`,
      );
    }
    const labels = p.sensitive_flags
      .map((f) => sensitiveFlagLabel[f as SensitiveFlag] ?? f)
      .join(" · ");
    if (labels) hd.paragraph(`סימונים: ${labels}`);
    if (p.sensitive_notes) hd.paragraph(`מידע רגיש: ${p.sensitive_notes}`);
    if (p.teaching_style_notes) hd.paragraph(`סגנון ויחס נדרש: ${p.teaching_style_notes}`);
    if (p.handoff_notes) hd.paragraph(`הדגשים למורה היורש: ${p.handoff_notes}`);
  }

  drawFooter(hd, "מסמך פנימי חסוי");
  return hd.doc.output("blob");
}

export function handoffPdfFilename(className: string): string {
  return `handoff-${safeName(className)}.pdf`;
}