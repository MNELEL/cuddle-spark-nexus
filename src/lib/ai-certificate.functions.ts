import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

export type CertOcrSubject = {
  subject: string;
  label?: string;   // classical Hebrew label if the AI detected one
  percent?: number; // 0-100 if the AI detected a numeric grade
  note?: string;
};

export type CertOcrResult = {
  studentName: string;
  className: string;
  period: string;
  schoolName: string;
  subjects: CertOcrSubject[];
  conduct?: string;
  diligence?: string;
  manners?: string;
  teacherNote?: string;
  principalNote?: string;
  summary: string;
};

const inputSchema = z.object({
  imageBase64: z.string().min(20).max(15_000_000),
  mimeType: z.string().max(100).default("image/jpeg"),
});

/**
 * OCRs a photo of a printed report card and extracts names, subjects, and grades
 * in the classical Hebrew label scheme used across the app.
 */
export const analyzeCertificatePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<CertOcrResult> => {
    const system = `אתה מזהה תעודות מודפסות של תלמידי תלמוד תורה / ישיבות / בתי ספר בעברית.
חלץ בקפדנות: שם התלמיד, שם הכיתה, שם המוסד, תקופה, ומקצועות עם הערכה מילולית או אחוז.
התאם הערכה מילולית ל־6 התוויות: "מצוין", "טוב מאוד", "כמעט טוב מאוד", "טוב", "כמעט טוב", "להשתדל יותר".
הליכות/שקידה/דרך ארץ ל: "ראוי לשבח", "נאות", "בינוני", "טעון שיפור".
אם מופיע ציון מספרי (0-100), החזר גם percent.
summary הוא תיאור טקסטואלי של 2-3 משפטים למה שזוהה, בעברית.
החזר JSON בלבד:
{"studentName":"","className":"","period":"","schoolName":"","subjects":[{"subject":"","label":"","percent":0,"note":""}],"conduct":"","diligence":"","manners":"","teacherNote":"","principalNote":"","summary":""}`;

    const raw = (await callLovableAI({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: "זוהי תמונה של תעודה. חלץ את הנתונים." },
            { type: "image_url", image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` } },
          ],
        },
      ],
      jsonResponse: true,
    })) || "{}";
    let p: Partial<CertOcrResult> = {};
    try { p = JSON.parse(raw); } catch { /* ignore */ }
    return {
      studentName: String(p.studentName ?? "").slice(0, 120),
      className: String(p.className ?? "").slice(0, 60),
      period: String(p.period ?? "").slice(0, 60),
      schoolName: String(p.schoolName ?? "").slice(0, 120),
      subjects: Array.isArray(p.subjects)
        ? (p.subjects as CertOcrSubject[])
            .slice(0, 30)
            .map((s) => ({
              subject: String(s.subject ?? "").slice(0, 60),
              label: s.label ? String(s.label).slice(0, 40) : undefined,
              percent: typeof s.percent === "number" ? Math.max(0, Math.min(100, s.percent)) : undefined,
              note: s.note ? String(s.note).slice(0, 200) : undefined,
            }))
            .filter((s) => s.subject)
        : [],
      conduct: p.conduct ? String(p.conduct).slice(0, 40) : undefined,
      diligence: p.diligence ? String(p.diligence).slice(0, 40) : undefined,
      manners: p.manners ? String(p.manners).slice(0, 40) : undefined,
      teacherNote: p.teacherNote ? String(p.teacherNote).slice(0, 1000) : undefined,
      principalNote: p.principalNote ? String(p.principalNote).slice(0, 1000) : undefined,
      summary: String(p.summary ?? "").slice(0, 800),
    };
  });
