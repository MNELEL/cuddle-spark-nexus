import { createFileRoute, useNavigate, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle, Gift, CheckCircle2, Home } from "lucide-react";
import { SeatFillGrid } from "@/components/seat-fill-grid";
import { TorahLogo } from "@/components/torah-logo";
import { toast } from "sonner";
import { TrialStatusInline } from "@/components/trial-status-inline";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>): {
    reset?: string;
    mode?: "signup";
    next?: string;
  } => ({
    reset: typeof search.reset === "string" ? search.reset : undefined,
    mode: search.mode === "signup" ? ("signup" as const) : undefined,
    // only same-origin internal paths are honoured as a post-auth destination
    next:
      typeof search.next === "string" && search.next.startsWith("/") && !search.next.startsWith("//")
        ? search.next
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "כניסה למערכת · הכיתה שלי" },
      { name: "description", content: "התחבר ל-״הכיתה שלי״ — סטודיו לניהול כיתה תורנית: סידור הושבה, ציונים, דוחות פדגוגיים וכלי AI בעברית מלאה." },
      { property: "og:title", content: "כניסה למערכת · הכיתה שלי" },
      { property: "og:description", content: "התחבר ל-״הכיתה שלי״ — סטודיו לניהול כיתה תורנית בעברית מלאה." },
      { property: "og:url", content: "https://hakitasheli.lovable.app/login" },
    ],
    links: [{ rel: "canonical", href: "https://hakitasheli.lovable.app/login" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const resetExpired = search.reset === "expired";
  const nextPath = search.next ?? "/classes";
  /**
   * `next` may carry its own query string (e.g. "/classes?from=exam-generator").
   * `navigate({ to })` treats the whole string as a pathname, so use `href`,
   * which parses pathname + search and preserves those params.
   */
  const goNext = () => navigate({ href: nextPath });
  const [mode, setMode] = useState<"signin" | "signup">(search.mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [signedUp, setSignedUp] = useState(false);

  const busy = submitting || googleBusy || resetBusy;

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const signinTabRef = useRef<HTMLButtonElement | null>(null);
  const signupTabRef = useRef<HTMLButtonElement | null>(null);
  // null on first render → don't steal focus on initial page load
  const focusTargetRef = useRef<"heading" | "field" | null>(null);

  useEffect(() => {
    const target = focusTargetRef.current;
    focusTargetRef.current = null;
    if (!target) return;
    if (target === "field") firstFieldRef.current?.focus();
    else headingRef.current?.focus();
  }, [mode]);

  const switchMode = (next: "signin" | "signup", viaKeyboard: boolean) => {
    if (busy || next === mode) return;
    setErrorMsg(null);
    focusTargetRef.current = viaKeyboard ? "field" : "heading";
    setMode(next);
  };

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    // RTL tablist: ArrowLeft moves forward visually, ArrowRight backwards.
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = mode === "signin" ? "signup" : "signin";
    setErrorMsg(null);
    focusTargetRef.current = null;
    setMode(next);
    requestAnimationFrame(() => {
      (next === "signin" ? signinTabRef : signupTabRef).current?.focus();
    });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) goNext();
    });
  }, [navigate, nextPath]);

  /** Client-side validation with explicit Hebrew messages. */
  const validate = () => {
    const mail = email.trim();
    if (mode === "signup" && name.trim().length > 0 && name.trim().length < 2) {
      return "השם קצר מדי — הזן שם מלא או השאר ריק";
    }
    if (!mail) return "יש להזין כתובת אימייל";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) return "כתובת האימייל אינה תקינה";
    if (mail.length > 200) return "כתובת האימייל ארוכה מדי";
    if (!password) return "יש להזין סיסמה";
    if (password.length < 6) return "הסיסמה חייבת להכיל 6 תווים לפחות";
    if (password.length > 72) return "הסיסמה ארוכה מדי (עד 72 תווים)";
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return; // form-level lock: no double submits while a request is in flight
    const invalid = validate();
    if (invalid) {
      setSuccessMsg(null);
      setErrorMsg(invalid);
      firstFieldRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${nextPath}`,
            data: { display_name: name.trim() || email.trim().split("@")[0] },
          },
        });
        if (error) throw error;
        setSignedUp(true);
        toast.success("נרשמת בהצלחה! בדוק את האימייל לאישור.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        goNext();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const msg =
        /Invalid login credentials/i.test(raw)
          ? "האימייל או הסיסמה שגויים"
          : /already registered|already exists/i.test(raw)
            ? "כתובת האימייל הזו כבר רשומה — עבור ללשונית ״התחברות״"
            : /Email not confirmed/i.test(raw)
              ? "החשבון עדיין לא אושר — לחץ על קישור האישור שנשלח לאימייל"
              : raw || (mode === "signin" ? "שגיאה בהתחברות" : "ההרשמה נכשלה");
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const google = async () => {
    if (busy) return;
    setGoogleBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      // Land back on the public /login route (protected routes can't complete the
      // OAuth handshake); the session effect above then forwards to `next`.
      redirect_uri: `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`,
    });
    if (result.error) {
      setErrorMsg("שגיאה בהתחברות עם Google");
      toast.error("שגיאה בהתחברות עם Google");
      setGoogleBusy(false);
      return;
    }
    if (result.redirected) return;
    goNext();
  };

  const forgotPassword = async () => {
    if (busy) return;
    if (!email.trim()) {
      setSuccessMsg(null);
      setErrorMsg("הזן כתובת אימייל ולאחר מכן לחץ על ״שכחתי סיסמה״");
      firstFieldRef.current?.focus();
      return;
    }
    setResetBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSuccessMsg("שלחנו קישור לאיפוס סיסמה לכתובת האימייל שלך. בדוק גם בתיבת הספאם.");
      toast.success("נשלח קישור לאיפוס סיסמה");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "שליחת קישור האיפוס נכשלה";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setResetBusy(false);
    }
  };

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none ${
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`;

  const statusText = submitting
    ? mode === "signin" ? "מתחברים לחשבון שלך..." : "יוצרים עבורך חשבון..."
    : googleBusy ? "מפנים אותך ל-Google..."
    : resetBusy ? "שולחים קישור לאיפוס סיסמה..." : null;

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <h1 className="sr-only">התחברות ל-״הכיתה שלי״</h1>

      {/* visual panel — left column on RTL screens, hidden on small screens */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground md:order-2 md:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <TorahLogo size={28} />
          <span className="font-display text-xl font-bold tracking-tight">הכיתה שלי</span>
        </Link>

        <div className="max-w-sm">
          <p className="font-display text-3xl font-bold leading-snug">
            כל הכיתה במקום אחד
          </p>
          <p className="mt-3 text-base text-primary-foreground/85">
            הושבה, ציונים, דוחות פדגוגיים וכלי AI — מסונכרנים בעברית מלאה.
          </p>
          <div className="mt-10">
            <SeatFillGrid rows={3} cols={7} />
          </div>
        </div>

        <p className="text-xs text-primary-foreground/70">© הכיתה שלי</p>
      </aside>

      {/* form panel */}
      <main className="flex items-center justify-center bg-background p-6 md:order-1">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 md:hidden">
            <TorahLogo size={24} className="text-primary" />
            <span className="font-display text-lg font-bold">הכיתה שלי</span>
          </Link>

          <div role="tablist" aria-label="מצב כניסה" className="mb-6 flex gap-1 rounded-xl bg-muted p-1">
            <button
              ref={signinTabRef}
              id="auth-tab-signin"
              type="button"
              role="tab"
              aria-controls="auth-panel"
              tabIndex={mode === "signin" ? 0 : -1}
              aria-selected={mode === "signin"}
              disabled={busy}
              className={tabClass(mode === "signin")}
              onKeyDown={onTabKeyDown}
              onClick={(e) => switchMode("signin", e.detail === 0)}
            >
              התחברות
            </button>
            <button
              ref={signupTabRef}
              id="auth-tab-signup"
              type="button"
              role="tab"
              aria-controls="auth-panel"
              tabIndex={mode === "signup" ? 0 : -1}
              aria-selected={mode === "signup"}
              disabled={busy}
              className={tabClass(mode === "signup")}
              onKeyDown={onTabKeyDown}
              onClick={(e) => switchMode("signup", e.detail === 0)}
            >
              הרשמה
            </button>
          </div>

          <div id="auth-panel" role="tabpanel" aria-labelledby={mode === "signin" ? "auth-tab-signin" : "auth-tab-signup"}>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-2xl font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 rounded-sm"
          >
            {mode === "signin" ? "ברוך שובך" : "צור חשבון"}
          </h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            {mode === "signin" ? "התחבר כדי לנהל את הכיתות שלך" : "התחל לנהל את הכיתות שלך בחינם"}
          </p>

          <div
            aria-live={resetExpired ? "assertive" : "polite"}
            aria-atomic="true"
            role="status"
            className="mb-4 space-y-2 empty:mb-0"
          >
            {resetExpired && !statusText && (
              <div className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-3 text-sm text-foreground">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden="true" />
                  <div>
                    <p className="font-medium">הקישור לאיפוס הסיסמה פג</p>
                    <p className="mt-1 text-muted-foreground">
                      הזן את כתובת האימייל שלך ולחץ על "שכחתי סיסמה" כדי לקבל קישור חדש.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {statusText && (
              <p className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {statusText}
              </p>
            )}
            {!statusText && errorMsg && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </p>
            )}
            {!statusText && successMsg && (
              <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
                {successMsg}
              </p>
            )}
          </div>

          {mode === "signup" && !signedUp && (
            <TrialStatusInline continueTo={nextPath} />
          )}

          {mode === "signup" && !signedUp && (
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Gift className="h-4 w-4 text-primary" aria-hidden="true" />
                איך מפעילים את חודש הניסיון החינמי
              </p>
              <ol className="mt-2 list-decimal space-y-1 pe-5 text-muted-foreground">
                <li>ממלאים אימייל וסיסמה (6 תווים לפחות) ולוחצים ״הרשם״.</li>
                <li>פותחים את המייל שקיבלתם ולוחצים על קישור האישור.</li>
                <li>הניסיון של 30 יום נפתח אוטומטית — ללא כרטיס אשראי.</li>
              </ol>
            </div>
          )}

          {signedUp && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-5 text-sm">
              <p className="flex items-center gap-2 font-display text-base font-bold">
                <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
                ההרשמה נשלחה בהצלחה
              </p>
              <p className="mt-2 text-muted-foreground">
                שלחנו קישור אישור ל־<span dir="ltr" className="font-medium text-foreground">{email.trim()}</span>.
                לאחר האישור חודש הניסיון החינמי נפתח אוטומטית, וכל הבלוג והכלים החינמיים ייפתחו לפניך.
              </p>
              <p className="mt-2 text-muted-foreground">לא מצאת את המייל? בדוק בתיבת הספאם או הירשם שוב.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/">
                  <Button className="gap-2">
                    <Home className="h-4 w-4" aria-hidden="true" /> חזרה למסך הבית
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSignedUp(false);
                    setMode("signin");
                  }}
                >
                  אישרתי — להתחברות
                </Button>
              </div>
            </div>
          )}

          <div className={`space-y-4 ${signedUp ? "hidden" : ""}`}>
            <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
              {googleBusy && <Loader2 className="ms-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {googleBusy ? "מתחבר ל-Google..." : "המשך עם Google"}
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">או</span>
              </div>
            </div>
            <fieldset disabled={busy} className="contents">
            <form onSubmit={submit} className="space-y-3" aria-busy={busy}>
              {mode === "signup" && (
                <div>
                  <Label htmlFor="name">שם</Label>
                  <Input ref={firstFieldRef} id="name" disabled={busy} value={name} onChange={(e) => setName(e.target.value)} placeholder="הרב ישראל / המלמד" />
                </div>
              )}
              <div>
                <Label htmlFor="email">אימייל</Label>
                <Input ref={mode === "signin" ? firstFieldRef : undefined} id="email" type="email" required disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
              </div>
              <div>
                <Label htmlFor="password">סיסמה</Label>
                <Input id="password" type="password" required minLength={6} disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
              </div>
              {mode === "signin" && (
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={forgotPassword}
                    disabled={busy}
                    className="rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {resetBusy ? "שולח קישור..." : "שכחתי סיסמה"}
                  </button>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {submitting && <Loader2 className="ms-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {submitting ? (mode === "signin" ? "מתחבר..." : "יוצר חשבון...") : (mode === "signin" ? "התחבר" : "הרשם")}
              </Button>
            </form>
            </fieldset>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}