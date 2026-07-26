import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

export type ExamRubricItem = {
  id: string;
  title: string;
  maxPoints: number;
  awarded: number;
  note?: string;
};

export type ExamScanResult = {
  studentName: string;
  subject: string;
  totalAwarded: number;
  totalMax: number;
  percent: number;
  items: ExamRubricItem[];
  summary: string;
  strengths?: string;
  improvements?: string;
};

const inputSchema = z.object({
  imageBase64: z.string().min(20).max(15_000_000),
  mimeType: z.string().max(100).default("image/jpeg"),
  subject: z.string().max(80).default(""),
  rubric: z.string().max(4000).default(""),
  totalMax: z.number().int().min(1).max(1000).default(100),
});

/**
 * Analyze a photo of a handwritten exam: extract the student name from the
 * header and score each rubric item. Returns a total and per-item breakdown.
 */
export const analyzeExamPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<ExamScanResult> => {
    const rubricText = data.rubric.trim() ||
      "אין מחוון מפורש. הערך את איכות התשובות בצורה הוגנת: הבנה, דיוק, וניסוח.";
    const system = `אתה בודק מבחנים בכתב-יד של תלמידי תלמוד תורה / חיידר / בתי ספר בעברית.
חלץ מהתמונה:
1) שם התלמיד מהכותרת (אם מופיע).
2) לכל שאלה במחוון — כמה נקודות לתת מתוך המקסימום, והערה קצרה.
3) סכם ציון סופי מתוך ${data.totalMax}.
דבר בעברית תקנית, השתמש בטרמינולוגיה חרדית ("הרב", "מלמד"), והיה הוגן אך מדויק.
החזר JSON בלבד במבנה:
{"studentName":"","subject":"","items":[{"id":"","title":"","maxPoints":0,"awarded":0,"note":""}],"totalAwarded":0,"totalMax":${data.totalMax},"percent":0,"summary":"","strengths":"","improvements":""}`;

    const userText = `מקצוע: ${data.subject || "לא צוין"}
סה"כ נקודות: ${data.totalMax}

מחוון:
${rubricText}

נתח את המבחן בתמונה, זהה את שם התלמיד וציין את הנקודות לכל שאלה במחוון.`;

    const raw = (await callLovableAI({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` } },
          ],
        },
      ],
      jsonResponse: true,
    })) || "{}";

    let p: Partial<ExamScanResult> = {};
    try { p = JSON.parse(raw); } catch { /* ignore */ }

    const items: ExamRubricItem[] = Array.isArray(p.items)
      ? p.items.slice(0, 40).map((it, i) => ({
          id: String(it.id ?? `q${i + 1}`).slice(0, 20),
          title: String(it.title ?? `שאלה ${i + 1}`).slice(0, 200),
          maxPoints: Math.max(0, Math.min(1000, Number(it.maxPoints) || 0)),
          awarded: Math.max(0, Math.min(1000, Number(it.awarded) || 0)),
          note: it.note ? String(it.note).slice(0, 400) : undefined,
        }))
      : [];

    const totalMax = items.reduce((s, i) => s + i.maxPoints, 0) || data.totalMax;
    const totalAwarded = items.reduce((s, i) => s + i.awarded, 0);
    const percent = totalMax > 0 ? Math.round((totalAwarded / totalMax) * 100) : 0;

    return {
      studentName: String(p.studentName ?? "").slice(0, 120),
      subject: String(p.subject ?? data.subject ?? "").slice(0, 80),
      totalAwarded,
      totalMax,
      percent,
      items,
      summary: String(p.summary ?? "").slice(0, 1000),
      strengths: p.strengths ? String(p.strengths).slice(0, 600) : undefined,
      improvements: p.improvements ? String(p.improvements).slice(0, 600) : undefined,
    };
  });