import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAntiSpamConfig } from "@/lib/anti-spam-config.functions";

type HCaptchaApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
};

/**
 * Loads the anti-spam config, renders an hCaptcha widget into `slotId`
 * when a site key is configured, and exposes the timing baseline used by
 * the server-side anti-spam verdict.
 */
export function useHcaptcha(slotId: string) {
  const loadConfig = useServerFn(getAntiSpamConfig);
  const [siteKey, setSiteKey] = useState("");
  const [token, setToken] = useState("");
  const mountedAtRef = useRef<number>(Date.now());
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    mountedAtRef.current = Date.now();
    loadConfig()
      .then((cfg) => setSiteKey(cfg.hcaptchaSiteKey))
      .catch(() => setSiteKey(""));
  }, [loadConfig]);

  useEffect(() => {
    if (!siteKey || typeof window === "undefined") return;
    const w = window as unknown as { hcaptcha?: HCaptchaApi };
    let cancelled = false;
    function renderWidget() {
      if (cancelled) return;
      const el = document.getElementById(slotId);
      if (!el || !w.hcaptcha || widgetIdRef.current) return;
      widgetIdRef.current = w.hcaptcha.render(el, {
        sitekey: siteKey,
        callback: (t: string) => setToken(t),
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    }
    if (w.hcaptcha) {
      renderWidget();
    } else if (!document.getElementById("hcaptcha-script")) {
      const s = document.createElement("script");
      s.id = "hcaptcha-script";
      s.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      s.onload = renderWidget;
      document.head.appendChild(s);
    } else {
      const iv = window.setInterval(() => {
        if (w.hcaptcha) {
          window.clearInterval(iv);
          renderWidget();
        }
      }, 200);
      window.setTimeout(() => window.clearInterval(iv), 10000);
    }
    return () => {
      cancelled = true;
    };
  }, [siteKey, slotId]);

  function reset() {
    const w = window as unknown as { hcaptcha?: HCaptchaApi };
    if (w.hcaptcha && widgetIdRef.current) {
      w.hcaptcha.reset(widgetIdRef.current);
      setToken("");
    }
  }

  return {
    siteKey,
    token,
    reset,
    elapsedMs: () => Date.now() - mountedAtRef.current,
  };
}