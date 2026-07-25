/**
 * Server-side anti-spam helpers.
 * Server-only: never imported from client code.
 */

const HCAPTCHA_VERIFY_URL = "https://api.hcaptcha.com/siteverify";

export interface AntiSpamInput {
  honeypot?: string; // must be empty — bots fill hidden fields
  elapsedMs?: number; // ms between form mount and submit
  hcaptchaToken?: string;
  remoteIp?: string;
}

export interface AntiSpamVerdict {
  ok: boolean;
  reason?: string;
}

// Real users take at least this long to fill the form. Bots submit instantly.
const MIN_FORM_MS = 2000;

export async function verifyAntiSpam(input: AntiSpamInput): Promise<AntiSpamVerdict> {
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return { ok: false, reason: "honeypot" };
  }
  if (typeof input.elapsedMs === "number" && input.elapsedMs < MIN_FORM_MS) {
    return { ok: false, reason: "too_fast" };
  }

  const secret = process.env.HCAPTCHA_SECRET_KEY;
  if (!secret) {
    // Captcha not configured — honeypot + timing are the only gates.
    return { ok: true };
  }

  if (!input.hcaptchaToken) {
    return { ok: false, reason: "captcha_missing" };
  }

  try {
    const body = new URLSearchParams({ secret, response: input.hcaptchaToken });
    if (input.remoteIp) body.set("remoteip", input.remoteIp);
    const res = await fetch(HCAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      console.error(`[anti-spam] hCaptcha verify HTTP ${res.status}`);
      return { ok: false, reason: "captcha_error" };
    }
    const payload = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!payload.success) {
      console.warn("[anti-spam] hCaptcha rejected", payload["error-codes"]);
      return { ok: false, reason: "captcha_failed" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[anti-spam] hCaptcha verify threw", err);
    return { ok: false, reason: "captcha_error" };
  }
}