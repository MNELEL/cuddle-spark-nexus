import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const schema = z.object({
  full_name: z.string().trim().min(1, "שם מלא נדרש").max(120),
  institution: z.string().trim().min(1, "שם המוסד נדרש").max(160),
  role: z.enum(["rabbi", "melamed", "principal", "other"]),
  email: z.string().trim().email("כתובת אימייל לא תקינה").max(200),
  checklist_slug: z.string().trim().min(1).max(80),
  user_agent: z.string().max(500).optional().default(""),
  honeypot: z.string().max(200).optional().default(""),
  elapsed_ms: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
  hcaptcha_token: z.string().max(4000).optional().default(""),
});

function makePublicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const submitChecklistLead = createServerFn({ method: "POST" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const { verifyAntiSpam } = await import("./anti-spam.server");
    const verdict = await verifyAntiSpam({
      honeypot: data.honeypot,
      elapsedMs: data.elapsed_ms,
      hcaptchaToken: data.hcaptcha_token,
    });
    if (!verdict.ok) {
      console.warn("[checklist_leads] anti-spam rejected", verdict.reason);
      const message =
        verdict.reason === "captcha_missing" || verdict.reason === "captcha_failed"
          ? "אימות אנטי-ספאם נכשל. רענן את הדף ונסה שוב."
          : verdict.reason === "too_fast"
            ? "הטופס נשלח מהר מדי. המתן שנייה ולחץ שוב על ההורדה."
            : "הבקשה נחסמה. ודא שמילאת את כל השדות ונסה שוב.";
      throw new Error(message);
    }

    const supabase = makePublicClient();
    const { error } = await supabase.from("checklist_leads").insert({
      full_name: data.full_name,
      institution: data.institution,
      role: data.role,
      email: data.email,
      checklist_slug: data.checklist_slug,
      user_agent: data.user_agent || null,
    } as never);
    if (error) {
      console.error("[checklist_leads] insert failed", error);
      throw new Error("שמירת הפרטים נכשלה");
    }

    // Best-effort notification via Resend, if configured.
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "הכיתה שלי <noreply@classalign.dev>",
            to: ["nm0527603669@gmail.com"],
            subject: `ליד חדש לצ'קליסט (${data.checklist_slug})`,
            text: `שם: ${data.full_name}\nמוסד: ${data.institution}\nתפקיד: ${data.role}\nאימייל: ${data.email}\nצ'קליסט: ${data.checklist_slug}`,
          }),
        });
      } catch (e) {
        console.warn("[checklist_leads] resend notify failed", e);
      }
    }
    return { ok: true };
  });