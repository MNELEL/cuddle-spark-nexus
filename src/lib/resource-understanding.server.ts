/**
 * OCR + "understanding" של חומר שכבר קיים בספרייה.
 * מוריד את הקובץ המקורי מהאחסון, מריץ OCR/ניתוח מולטימודלי,
 * ומעדכן את החומר: טקסט מקורי מדויק, סיווג, תגיות והקשרי הוראה.
 */
import { callLovableAI } from "./ai-gateway.server";
import { indexResourceChunks } from "./resource-chunks.server";
import { RESOURCE_TYPES, type ResourceRow } from "./teaching-resources.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

export type UnderstandResult = {
  ok: true;
  ocr_chars: number;
  ocr_added: boolean;
  summary: string;
  contexts: string[];
  suggested_type: string;
  suggested_subject: string;
  suggested_grade: string;
  tags: string[];
};

function toBase64(buf: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

const SYSTEM = `אתה עוזר של רב/מלמד בתלמוד תורה חרדי. קיבלת חומר לימוד שהועלה לספרייה.
- original_text: העתק את **כל** הטקסט של המסמך כפי שהוא, מדויק ומלא, בלי שכתוב ובלי קיצור. אם המסמך סרוק או תמונה — בצע OCR מדויק בעברית.
- summary: 2-3 משפטים מה יש בחומר הזה בפועל.
- subject: מקצוע (גמרא/משנה/חומש/נביא/הלכה/מוסר/תפילה/פרשת שבוע) אם ניתן לזהות.
- grade_level: כיתה (א-ח) אם ניתן לזהות.
- resource_type: אחד מ: ${RESOURCE_TYPES.join("/")}.
- tags: עד 12 תגיות תוכן (מסכת/פרק/פרשה/נושא).
- teaching_contexts: 3-5 הקשרים מעשיים שבהם המלמד יכול להשתמש בחומר (למשל "חזרה לפני מבחן", "פתיחה לשיעור גמרא", "עבודה בזוגות").
השתמש במונחים "הרב", "המלמד", "התלמידים".
החזר JSON תקין בלבד:
{"original_text":"","summary":"","subject":"","grade_level":"","resource_type":"worksheet","tags":[],"teaching_contexts":[]}`;

export async function understandResource(
  supabase: Supa,
  userId: string,
  resourceId: string,
  force: boolean,
): Promise<UnderstandResult> {
  const { data: row, error } = await supabase
    .from("teaching_resources")
    .select("*")
    .eq("id", resourceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const res = row as ResourceRow | null;
  if (!res) throw new Error("החומר לא נמצא");

  const content = (res.content ?? {}) as Record<string, unknown>;
  const existingText = typeof content.original_text === "string" ? content.original_text : "";

  let userContent: unknown[];
  if (res.file_path) {
    const dl = await supabase.storage.from("teaching-resources").download(res.file_path);
    if (!dl.data) throw new Error("לא הצלחנו להוריד את הקובץ המקורי");
    const b64 = toBase64(new Uint8Array(await dl.data.arrayBuffer()));
    const mime = res.mime_type || "application/octet-stream";
    if (mime.startsWith("image/")) {
      userContent = [
        { type: "text", text: "בצע OCR ונתח את החומר:" },
        { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
      ];
    } else if (mime === "application/pdf") {
      userContent = [
        { type: "text", text: "בצע OCR ונתח את החומר:" },
        { type: "file", file: { filename: "material.pdf", file_data: `data:application/pdf;base64,${b64}` } },
      ];
    } else {
      const text = existingText || String(content.body ?? "");
      if (!text.trim()) throw new Error("סוג הקובץ לא נתמך לניתוח אוטומטי");
      userContent = [{ type: "text", text: "נתח את החומר הבא:\n\n" + text.slice(0, 60000) }];
    }
  } else {
    const text = existingText || String(content.body ?? "");
    if (!text.trim()) throw new Error("אין קובץ או טקסט לניתוח");
    userContent = [{ type: "text", text: "נתח את החומר הבא:\n\n" + text.slice(0, 60000) }];
  }

  const raw = (await callLovableAI({
    model: "google/gemini-2.5-flash",
    jsonResponse: true,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userContent },
    ],
  })) || "{}";

  let p: Record<string, unknown> = {};
  try { p = JSON.parse(raw) as Record<string, unknown>; } catch { /* ignore */ }

  const ocr = String(p.original_text ?? "").slice(0, 200000);
  const summary = String(p.summary ?? "").slice(0, 2000);
  const contexts = Array.isArray(p.teaching_contexts)
    ? p.teaching_contexts.map((c) => String(c).slice(0, 120)).slice(0, 6)
    : [];
  const aiTags = Array.isArray(p.tags) ? p.tags.map((t) => String(t).slice(0, 40)).slice(0, 12) : [];
  const suggestedType = String(p.resource_type ?? "").slice(0, 40);
  const suggestedSubject = String(p.subject ?? "").slice(0, 80);
  const suggestedGrade = String(p.grade_level ?? "").slice(0, 40);

  const shouldReplaceText = ocr.trim().length > 0 && (force || existingText.trim().length === 0);
  const nextText = shouldReplaceText ? ocr : existingText;
  const mergedTags = [...new Set([...(res.tags ?? []), ...aiTags])].slice(0, 25);

  const nextContent = {
    ...content,
    original_text: nextText,
    ai_understanding: {
      summary,
      contexts,
      suggested_type: suggestedType,
      at: new Date().toISOString(),
    },
  };

  const patch: Record<string, unknown> = { content: nextContent, tags: mergedTags };
  if (!res.description?.trim() && summary) patch.description = summary.slice(0, 2000);
  if (!res.subject?.trim() && suggestedSubject) patch.subject = suggestedSubject;
  if (!res.grade_level?.trim() && suggestedGrade) patch.grade_level = suggestedGrade;

  const { error: upErr } = await supabase
    .from("teaching_resources")
    .update(patch as never)
    .eq("id", resourceId);
  if (upErr) throw new Error(upErr.message);

  if (shouldReplaceText) {
    await indexResourceChunks(supabase, userId, resourceId, nextText);
  }

  return {
    ok: true,
    ocr_chars: nextText.length,
    ocr_added: shouldReplaceText,
    summary,
    contexts,
    suggested_type: suggestedType,
    suggested_subject: suggestedSubject,
    suggested_grade: suggestedGrade,
    tags: mergedTags,
  };
}
