/**
 * טביעת אצבע (SHA-256) לקובץ — משמשת לזיהוי קובץ שכבר הועלה לספרייה,
 * כדי להפנות לעותק הקיים במקום לשמור כפילות.
 */
export async function fileContentHash(file: Blob): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null; // דפדפן ללא WebCrypto — ההעלאה תמשיך בלי בדיקת כפילות
  try {
    const digest = await subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}
