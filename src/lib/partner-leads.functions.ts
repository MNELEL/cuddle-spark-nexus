import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const schema = z.object({
  institution_name: z.string().trim().min(1, "שם המוסד נדרש").max(160),
  institution_type: z.enum(["school", "cheder", "yeshiva", "district"]),
  contact_name: z.string().trim().min(1, "שם איש הקשר נדרש").max(120),
  role: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email("כתובת אימייל לא תקינה").max(200),
  phone: z.string().trim().max(40).optional().default(""),
  student_count: z.string().trim().max(20).optional().default(""),
  teacher_count: z.string().trim().max(20).optional().default(""),
  demo_date: z.string().trim().max(20).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
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

const TYPE_LABELS: Record<string, string> = {
  school: "בית ספר",
  cheder: "חיידר / תלמוד תורה",
  yeshiva: "ישיבה",
  district: "מחוז / רשת",
};

export const submitPartnerLead = createServerFn({ method: "POST" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const { verifyAntiSpam } = await import("./anti-spam.server");
    const verdict = await verifyAntiSpam({
      honeypot: data.honeypot,
      elapsedMs: data.elapsed_ms,
      hcaptchaToken: data.hcaptcha_token,
    });
    if (!verdict.ok) {
      console.warn("[partner_leads] anti-spam rejected", verdict.reason);
      throw new Error(
        verdict.reason === "captcha_missing" || verdict.reason === "captcha_failed"
          ? "אימות אנטי-ספאם נכשל. רענן את הדף ונסה שוב."
          : "הבקשה נחסמה. ודא שמילאת את כל השדות ונסה שוב.",
      );
    }

    const supabase = makePublicClient();
    const { error } = await supabase.from("partner_leads").insert({
      institution_name: data.institution_name,
      institution_type: data.institution_type,
      contact_name: data.contact_name,
      role: data.role || null,
      email: data.email,
      phone: data.phone || null,
      student_count: data.student_count || null,
      teacher_count: data.teacher_count || null,
      demo_date: data.demo_date || null,
      message: data.message || null,
      user_agent: data.user_agent || null,
    } as never);
    if (error) {
      console.error("[partner_leads] insert failed", error);
      throw new Error("שמירת הבקשה נכשלה. נסה שוב בעוד רגע.");
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
            subject: `בקשת דמו חדשה: ${data.institution_name}`,
            text: [
              `מוסד: ${data.institution_name}`,
              `סוג: ${TYPE_LABELS[data.institution_type] ?? data.institution_type}`,
              `איש קשר: ${data.contact_name}${data.role ? ` (${data.role})` : ""}`,
              `אימייל: ${data.email}`,
              `טלפון: ${data.phone || "-"}`,
              `מספר תלמידים: ${data.student_count || "-"}`,
              `מספר מלמדים: ${data.teacher_count || "-"}`,
              `מועד מועדף לדמו: ${data.demo_date || "-"}`,
              ``,
              `הודעה: ${data.message || "-"}`,
            ].join("\n"),
          }),
        });
      } catch (e) {
        console.warn("[partner_leads] resend notify failed", e);
      }
    }

    return { ok: true };
  });