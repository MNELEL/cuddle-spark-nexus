import { createServerFn } from "@tanstack/react-start";

/**
 * Returns the public hCaptcha site key so the client can render the widget.
 * Site keys are public; the paired HCAPTCHA_SECRET_KEY stays server-only.
 */
export const getAntiSpamConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    hcaptchaSiteKey: process.env.HCAPTCHA_SITE_KEY ?? "",
  };
});