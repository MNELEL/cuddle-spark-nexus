/**
 * אימות איכות הטקסט שחולץ (OCR / הדבקה) לפני הפקת שאלות וסיכומים ב-AI.
 * לוגיקה טהורה — בלי רשת ובלי Supabase — כדי שתהיה ניתנת לבדיקה.
 *
 * המטרה: לא לתת ל-AI "להמציא" תוכן על בסיס טקסט ריק, קטוע או משובש.
 */

export type TextQualityIssue =
  | "empty"
  | "too_short"
  | "low_hebrew"
  | "noisy_characters"
  | "repetitive"
  | "low_ocr_confidence";

export type TextQualityResult = {
  /** האם אפשר להפיק תוצר מהטקסט הזה */
  ok: boolean;
  /** 0-1 — הערכת איכות משוקללת */
  score: number;
  chars: number;
  words: number;
  hebrewRatio: number;
  noiseRatio: number;
  issues: TextQualityIssue[];
  /** הודעה בעברית למלמד כשהטקסט לא מספיק לניתוח */
  message: string;
  /** הנחיה שתצטרף ל-prompt כשהטקסט חלקי אבל שמיש */
  promptGuard: string;
};

export const MIN_TEXT_CHARS = 120;

const ISSUE_LABELS: Record<TextQualityIssue, string> = {
  empty: "לא נמצא טקסט בחומר",
  too_short: `הטקסט קצר מדי (פחות מ-${MIN_TEXT_CHARS} תווים)`,
  low_hebrew: "כמעט אין עברית בטקסט שחולץ",
  noisy_characters: "הטקסט מכיל הרבה תווים משובשים",
  repetitive: "הטקסט חוזר על עצמו ונראה פגום",
  low_ocr_confidence: "רמת הביטחון בחילוץ הטקסט נמוכה",
};

function ratio(count: number, total: number) {
  return total > 0 ? count / total : 0;
}

/** בודק את הטקסט שחולץ ומחזיר החלטה + הנחיות ל-AI. */
export function assessExtractedText(
  raw: string | null | undefined,
  opts: { ocrConfidence?: number | null } = {},
): TextQualityResult {
  const text = (raw ?? "").trim();
  const chars = text.length;
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const issues: TextQualityIssue[] = [];

  const letters = text.replace(/\s/g, "");
  const hebrew = (text.match(/[\u0590-\u05FF]/g) ?? []).length;
  // תווים שאינם עברית/לטינית/ספרות/פיסוק סבירה — סימן מובהק ל-OCR משובש
  const noise = (text.match(/[^\u0590-\u05FFA-Za-z0-9\s.,;:!?'"()\[\]{}\-–—…/\\%&*+=@#$~`^|<>\n\r\t]/g) ?? []).length;
  const hebrewRatio = ratio(hebrew, letters.length);
  const noiseRatio = ratio(noise, letters.length);

  if (chars === 0) issues.push("empty");
  else if (chars < MIN_TEXT_CHARS || words < 20) issues.push("too_short");

  if (chars > 0 && hebrewRatio < 0.2 && !/[A-Za-z]{40,}/.test(text)) issues.push("low_hebrew");
  if (noiseRatio > 0.08) issues.push("noisy_characters");

  // חזרתיות: מעט מילים ייחודיות ביחס לאורך = פלט OCR שנתקע
  if (words >= 40) {
    const unique = new Set(text.toLowerCase().split(/\s+/).filter(Boolean)).size;
    if (unique / words < 0.25) issues.push("repetitive");
  }
  if (/(.)\1{25,}/.test(text)) issues.push("repetitive");

  const conf = typeof opts.ocrConfidence === "number" ? opts.ocrConfidence : null;
  if (conf !== null && conf > 0 && conf < 0.45) issues.push("low_ocr_confidence");

  const blocking = issues.some((i) => i === "empty" || i === "too_short" || i === "low_hebrew" || i === "repetitive")
    || noiseRatio > 0.2;

  let score = 1;
  if (chars === 0) score = 0;
  else {
    score = Math.min(1, chars / 1200) * 0.4 + Math.min(1, hebrewRatio / 0.6) * 0.4 + (1 - Math.min(1, noiseRatio / 0.2)) * 0.2;
    if (conf !== null && conf > 0) score = score * 0.75 + conf * 0.25;
  }
  score = Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;

  const uniqueIssues = Array.from(new Set(issues));
  const message = blocking
    ? `לא ניתן להפיק תוצר איכותי מהחומר: ${uniqueIssues.map((i) => ISSUE_LABELS[i]).join("; ")}. ` +
      "כדאי להריץ ניתוח/OCR מחדש, לתקן את הטקסט שחולץ, או להדביק את התוכן ידנית."
    : "";
  const promptGuard = !blocking && uniqueIssues.length
    ? "\n\nשים לב: הטקסט שחולץ אינו מושלם (" +
      uniqueIssues.map((i) => ISSUE_LABELS[i]).join("; ") +
      "). התבסס רק על מה שמופיע בפועל בטקסט, התעלם מתווים משובשים, ואל תשלים תוכן מהדמיון. " +
      "אם חסר מידע לשאלה מסוימת — כתוב פחות שאלות במקום להמציא."
    : "";

  return {
    ok: !blocking,
    score,
    chars,
    words,
    hebrewRatio: Math.round(hebrewRatio * 100) / 100,
    noiseRatio: Math.round(noiseRatio * 100) / 100,
    issues: uniqueIssues,
    message,
    promptGuard,
  };
}
