import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { submitChecklistLead } from "@/lib/checklist-leads.functions";
import { getAntiSpamConfig } from "@/lib/anti-spam-config.functions";
import { generateClassroomManagementChecklistPdf } from "@/lib/pdf/classroom-management-checklist-pdf";

const URL = "https://cuddle-spark-nexus.lovable.app/blog/classroom-management-strategies/checklist";
const TITLE = "צ'קליסט ניהול כיתה בתלמוד תורה — PDF להורדה חינם";
const DESCRIPTION =
  "צ'קליסט מקצועי (PDF) עם 5 אסטרטגיות ניהול כיתה + מעקב שבועי למלמד. הרשמה קצרה ותוריד מיד עם מיתוג הכיתה שלי.";

export const Route = createFileRoute("/blog/classroom-management-strategies/checklist")({
  component: ChecklistPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

type Role = "rabbi" | "melamed" | "principal" | "other";
const ROLES: { value: Role; label: string }[] = [
  { value: "rabbi", label: "רב" },
  { value: "melamed", label: "מלמד" },
  { value: "principal", label: "מנהל" },
  { value: "other", label: "אחר" },
];

function ChecklistPage() {
  const submit = useServerFn(submitChecklistLead);
  const loadConfig = useServerFn(getAntiSpamConfig);
  const [fullName, setFullName] = useState("");
  const [institution, setInstitution] = useState("");
  const [role, setRole] = useState<Role>("melamed");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [hcaptchaSiteKey, setHcaptchaSiteKey] = useState<string>("");
  const [hcaptchaToken, setHcaptchaToken] = useState<string>("");
  const mountedAtRef = useRef<number>(Date.now());
  const widgetIdRef = useRef<string | null>(null);

  // Load site key + arm timing baseline on mount.
  useEffect(() => {
    mountedAtRef.current = Date.now();
    loadConfig()
      .then((cfg) => setHcaptchaSiteKey(cfg.hcaptchaSiteKey))
      .catch(() => setHcaptchaSiteKey(""));
  }, [loadConfig]);

  // Inject the hCaptcha script + render the widget when a site key is present.
  useEffect(() => {
    if (!hcaptchaSiteKey || typeof window === "undefined") return;
    const w = window as unknown as {
      hcaptcha?: {
        render: (el: HTMLElement, opts: Record<string, unknown>) => string;
        reset: (id?: string) => void;
      };
    };
    let cancelled = false;
    function renderWidget() {
      if (cancelled) return;
      const el = document.getElementById("hcaptcha-slot");
      if (!el || !w.hcaptcha || widgetIdRef.current) return;
      widgetIdRef.current = w.hcaptcha.render(el, {
        sitekey: hcaptchaSiteKey,
        callback: (t: string) => setHcaptchaToken(t),
        "expired-callback": () => setHcaptchaToken(""),
        "error-callback": () => setHcaptchaToken(""),
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
  }, [hcaptchaSiteKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (hcaptchaSiteKey && !hcaptchaToken) {
      setErrorMsg("אנא השלם את אימות ה-CAPTCHA לפני השליחה.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      await submit({
        data: {
          full_name: fullName.trim(),
          institution: institution.trim(),
          role,
          email: email.trim(),
          checklist_slug: "classroom-management-strategies",
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : "",
          honeypot,
          elapsed_ms: Date.now() - mountedAtRef.current,
          hcaptcha_token: hcaptchaToken,
        },
      });
      await generateClassroomManagementChecklistPdf({
        schoolName: institution.trim() || "הכיתה שלי",
        headerLine: `הופק עבור ${fullName.trim()} • צ'קליסט ניהול כיתה`,
      });
      setStatus("done");
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "שגיאה. נסה שוב.");
      setStatus("error");
      // Reset captcha so the user can try again
      const w = window as unknown as { hcaptcha?: { reset: (id?: string) => void } };
      if (w.hcaptcha && widgetIdRef.current) {
        w.hcaptcha.reset(widgetIdRef.current);
        setHcaptchaToken("");
      }
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/blog/classroom-management-strategies" className="text-sm text-muted-foreground hover:text-foreground">
            → חזרה למדריך
          </Link>
          <span className="text-sm font-semibold">הכיתה שלי</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          צ'קליסט ניהול כיתה — PDF להורדה
        </h1>
        <p className="mt-4 text-muted-foreground">
          מסמך מקצועי אחד לכל מלמד: 5 אסטרטגיות ליישום מיידי, שגרות שבועיות, ומקום לרשום
          הערות. השאר פרטים קצרים והצ'קליסט יופק עם שם המוסד שלך על העמוד הראשון.
        </p>

        <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
          <li>✓ 6 מקטעים עם צ'קבוקסים להדפסה</li>
          <li>✓ מיתוג מוסדי — שם המוסד שלך על הכותרת</li>
          <li>✓ תמיכה מלאה בעברית ו-RTL, מוכן להדפסה</li>
        </ul>

        {status === "done" ? (
          <div className="mt-10 rounded-2xl border border-primary/40 bg-primary/5 p-6">
            <h2 className="text-xl font-semibold">הצ'קליסט יורד עכשיו 🎉</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              אם ההורדה לא התחילה, אפשר להוריד שוב:
            </p>
            <button
              type="button"
              onClick={() =>
                generateClassroomManagementChecklistPdf({
                  schoolName: institution.trim() || "הכיתה שלי",
                  headerLine: `הופק עבור ${fullName.trim()} • צ'קליסט ניהול כיתה`,
                })
              }
              className="mt-4 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              הורד שוב את ה-PDF
            </button>
            <div className="mt-6 text-sm">
              <Link to="/" className="text-primary hover:underline">
                מוכן להטמיע את זה בכיתה? פתח כיתה ב-הכיתה שלי ←
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-4 rounded-2xl border border-border/60 bg-card/40 p-6">
            <div>
              <label className="block text-sm font-medium">שם מלא</label>
              <input
                required
                maxLength={120}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                placeholder="הרב ישראל ישראלי"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">שם המוסד</label>
              <input
                required
                maxLength={160}
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                placeholder="תלמוד תורה אור החיים"
              />
              <p className="mt-1 text-xs text-muted-foreground">יופיע ככותרת המוסד ב-PDF</p>
            </div>
            <div>
              <label className="block text-sm font-medium">תפקיד</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">אימייל</label>
              <input
                required
                type="email"
                maxLength={200}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                placeholder="rabbi@example.com"
              />
            </div>
            {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
            {/* Honeypot — hidden from users, bots fill it and get rejected. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
              <label>
                אל תמלא שדה זה
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </label>
            </div>
            {hcaptchaSiteKey && (
              <div className="flex justify-center pt-2">
                <div id="hcaptcha-slot" />
              </div>
            )}
            <button
              type="submit"
              disabled={status === "loading" || (!!hcaptchaSiteKey && !hcaptchaToken)}
              className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {status === "loading" ? "מכין את ה-PDF..." : "הורד צ'קליסט (PDF)"}
            </button>
            <p className="text-xs text-muted-foreground">
              בהרשמה אתה מסכים שנשמור את הפרטים כדי לשלוח לפעמים עדכונים על הכיתה שלי. אפשר להסיר בכל עת.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}