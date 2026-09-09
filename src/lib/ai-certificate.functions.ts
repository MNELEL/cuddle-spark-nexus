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

/* -------------------- Certificate design template (detect + store) -------------------- */

export const FRAME_STYLES = ["double_border", "single_border", "ornate", "none"] as const;
export const CORNER_DECORATIONS = ["none", "flourish", "rosette", "seal"] as const;
export const TITLE_WEIGHTS = ["bold", "normal"] as const;
export const TITLE_ALIGNMENTS = ["center", "right"] as const;
export const LAYOUT_DENSITIES = ["compact", "standard", "spacious"] as const;

export type CertTemplateDesign = {
  frame_style: (typeof FRAME_STYLES)[number];
  corner_decoration: (typeof CORNER_DECORATIONS)[number];
  primary_color: string;
  accent_color: string;
  title_font_weight: (typeof TITLE_WEIGHTS)[number];
  title_alignment: (typeof TITLE_ALIGNMENTS)[number];
  layout_density: (typeof LAYOUT_DENSITIES)[number];
};

export const DEFAULT_CERT_DESIGN: CertTemplateDesign = {
  frame_style: "double_border",
  corner_decoration: "none",
  primary_color: "#334155",
  accent_color: "#d97706",
  title_font_weight: "bold",
  title_alignment: "center",
  layout_density: "standard",
};

const designSchema = z.object({
  frame_style: z.enum(FRAME_STYLES),
  corner_decoration: z.enum(CORNER_DECORATIONS),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  title_font_weight: z.enum(TITLE_WEIGHTS),
  title_alignment: z.enum(TITLE_ALIGNMENTS),
  layout_density: z.enum(LAYOUT_DENSITIES),
});

function pick<T extends readonly string[]>(v: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T[number]) : fallback;
}
function pickHex(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : fallback;
}

/**
 * Analyzes ONLY the visual structure of a photographed certificate (frame,
 * corner decorations, dominant colors, title alignment/weight, density).
 * No content, names, or grades are read here.
 */
export const analyzeCertificateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<CertTemplateDesign> => {
    const system = `אתה מנתח תבנית עיצוב חזותית של תעודה מתמונה.
נתח אך ורק את המבנה החזותי: אל תקרא ואל תחזיר תוכן, שמות, מקצועות או ציונים.
זהה:
- frame_style: double_border (מסגרת כפולה), single_border (מסגרת יחידה), ornate (מסגרת מעוטרת), none (בלי מסגרת)
- corner_decoration: none (ללא), flourish (עיטור פרחוני), rosette (רוזטה), seal (חותם)
- primary_color: הצבע הדומיננטי של המסגרת/הכותרת, כ-hex בן 6 ספרות
- accent_color: צבע ההדגשה המשני, כ-hex בן 6 ספרות
- title_font_weight: bold (מודגש) או normal (רגיל)
- title_alignment: center (מרכז) או right (ימין)
- layout_density: compact (דחוס), standard (רגיל), spacious (מרווח)
החזר JSON בלבד:
{"frame_style":"","corner_decoration":"","primary_color":"#334155","accent_color":"#d97706","title_font_weight":"","title_alignment":"","layout_density":""}`;

    const raw = (await callLovableAI({
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: "זוהי תמונה של תעודה. נתח את סגנון העיצוב בלבד." },
            { type: "image_url", image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` } },
          ],
        },
      ],
      jsonResponse: true,
    })) || "{}";

    let p: Record<string, unknown> = {};
    try { p = JSON.parse(raw) as Record<string, unknown>; } catch { /* ignore */ }

    return {
      frame_style: pick(p.frame_style, FRAME_STYLES, DEFAULT_CERT_DESIGN.frame_style),
      corner_decoration: pick(p.corner_decoration, CORNER_DECORATIONS, DEFAULT_CERT_DESIGN.corner_decoration),
      primary_color: pickHex(p.primary_color, DEFAULT_CERT_DESIGN.primary_color),
      accent_color: pickHex(p.accent_color, DEFAULT_CERT_DESIGN.accent_color),
      title_font_weight: pick(p.title_font_weight, TITLE_WEIGHTS, DEFAULT_CERT_DESIGN.title_font_weight),
      title_alignment: pick(p.title_alignment, TITLE_ALIGNMENTS, DEFAULT_CERT_DESIGN.title_alignment),
      layout_density: pick(p.layout_density, LAYOUT_DENSITIES, DEFAULT_CERT_DESIGN.layout_density),
    };
  });

export type CertificateTemplate = CertTemplateDesign & {
  id: string;
  name: string;
  source_image_note: string | null;
  is_default: boolean;
  created_at: string;
};

const saveTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sourceImageNote: z.string().trim().max(200).optional(),
  design: designSchema,
});

/** Saves a detected (or manually edited) design as a named template. */
export const saveCertificateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveTemplateSchema.parse(d))
  .handler(async ({ data, context }): Promise<CertificateTemplate> => {
    const { data: row, error } = await context.supabase
      .from("certificate_templates")
      .insert({
        owner_id: context.userId,
        name: data.name,
        source_image_note: data.sourceImageNote ?? null,
        ...data.design,
      })
      .select("id,name,source_image_note,is_default,created_at,frame_style,corner_decoration,primary_color,accent_color,title_font_weight,title_alignment,layout_density")
      .single();
    if (error || !row) throw new Error("שמירת התבנית נכשלה.");
    return row as CertificateTemplate;
  });

/** All templates of the signed-in teacher, newest first. */
export const listCertificateTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CertificateTemplate[]> => {
    const { data, error } = await context.supabase
      .from("certificate_templates")
      .select("id,name,source_image_note,is_default,created_at,frame_style,corner_decoration,primary_color,accent_color,title_font_weight,title_alignment,layout_density")
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("טעינת התבניות נכשלה.");
    return (data ?? []) as CertificateTemplate[];
  });

/** Deletes one template after verifying ownership. */
export const deleteCertificateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: existing } = await context.supabase
      .from("certificate_templates")
      .select("id")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!existing) throw new Error("התבנית לא נמצאה.");
    const { error } = await context.supabase
      .from("certificate_templates")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error("מחיקת התבנית נכשלה.");
    return { ok: true };
  });
