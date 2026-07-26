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

/* -------------------- Certificate note AI suggestions -------------------- */

const suggestSchema = z.object({
  classId: z.string().uuid(),
  studentId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CertNoteSuggestion = { text: string };

/**
 * Produces 3 distinct Hebrew certificate-note suggestions for one student,
 * grounded in that student's grades / behavior / attendance in the given
 * period. Each suggestion is exactly 3 sentences. Tone is Haredi / talmud
 * torah — "הרב", "המלמד", "התלמיד".
 */
export const suggestCertificateNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => suggestSchema.parse(d))
  .handler(async ({ data, context }): Promise<CertNoteSuggestion[]> => {
    const { classId, studentId, from, to } = data;

    const [studentRes, gradesRes, behRes, attRes] = await Promise.all([
      context.supabase.from("students").select("id,name").eq("id", studentId).maybeSingle(),
      context.supabase
        .from("grades")
        .select("subject,value,max_value")
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .gte("date", from)
        .lte("date", to),
      context.supabase
        .from("behavior_points")
        .select("points,category")
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .gte("date", from)
        .lte("date", to),
      context.supabase
        .from("attendance")
        .select("status")
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .gte("date", from)
        .lte("date", to),
    ]);

    if (studentRes.error || !studentRes.data) throw new Error("התלמיד לא נמצא.");

    // Summarize in code — send the AI compact aggregates only.
    const bySubject = new Map<string, { sum: number; max: number }>();
    for (const g of gradesRes.data ?? []) {
      const key = (g.subject || "כללי").trim();
      const cur = bySubject.get(key) ?? { sum: 0, max: 0 };
      cur.sum += Number(g.value) || 0;
      cur.max += Number(g.max_value) || 100;
      bySubject.set(key, cur);
    }
    const subjectSummary = Array.from(bySubject.entries())
      .map(([subject, v]) => ({
        subject,
        percent: v.max > 0 ? Math.round((v.sum / v.max) * 100) : null,
      }));

    const behPos = (behRes.data ?? []).filter((b) => Number(b.points) > 0);
    const behNeg = (behRes.data ?? []).filter((b) => Number(b.points) < 0);
    const posSum = behPos.reduce((s, b) => s + Number(b.points), 0);
    const negSum = behNeg.reduce((s, b) => s + Number(b.points), 0);

    const att = { present: 0, absent: 0, late: 0 };
    for (const a of attRes.data ?? []) {
      if (a.status === "present") att.present++;
      else if (a.status === "absent") att.absent++;
      else if (a.status === "late") att.late++;
    }

    const summary = {
      student: studentRes.data.name,
      subjects: subjectSummary,
      behavior: { positive: posSum, negative: negSum, total: posSum + negSum },
      attendance: att,
    };

    const system = `אתה כותב הערות תעודה למחנך בתלמוד תורה / חיידר חרדי בעברית.
כתוב 3 הצעות שונות זו מזו במיקוד ובנוסח, כל אחת בדיוק 3 משפטים.
השתמש בטרמינולוגיה חרדית: "התלמיד", "הרב", "המלמד" (לא "מורה", לא "ילד").
שלב עובדות מסוימות מהנתונים (מקצוע חזק/חלש ספציפי, מגמת התנהגות, נוכחות אם חריגה).
אם אין נתונים במקצוע/תחום — אל תמציא.
טון: מכבד, מדויק, מעודד גם כשמציין נקודות לחיזוק. בלי סופרלטיבים ריקים.
החזר JSON בלבד בפורמט: {"suggestions":["…","…","…"]}`;

    const raw = await callLovableAI({
      messages: [
        { role: "system", content: system },
        { role: "user", content: `נתוני התלמיד (סיכום):\n${JSON.stringify(summary)}` },
      ],
      jsonResponse: true,
    });

    let parsed: { suggestions?: unknown } = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }
    const arr = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    return arr
      .slice(0, 3)
      .map((t): CertNoteSuggestion => ({ text: String(t ?? "").slice(0, 800) }))
      .filter((s) => s.text.length > 0);
  });
