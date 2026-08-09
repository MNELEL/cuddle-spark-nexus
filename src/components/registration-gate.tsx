import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { TorahLogo } from "@/components/torah-logo";
import { Mail, Gift, Lock, Home, Loader2, AlertTriangle, BadgeCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getMyTrialStatus } from "@/lib/trial.functions";
import { isAdmin } from "@/lib/user-roles.functions";
import { TrialExtensionRequestButton } from "@/components/trial-extension-request-button";

type Props = {
  title: string;
  description: string;
  /** When true, an expired trial blocks the content instead of only warning. */
  requireActiveTrial?: boolean;
  children: React.ReactNode;
};

/**
 * Client-side registration gate: content is server-rendered (so it stays indexable),
 * but after hydration only registered users keep seeing it. Anyone signed out — or whose
 * session expired — gets a re-auth card with a way back to the home screen.
 */
export function RegistrationGate({ title, description, requireActiveTrial = false, children }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { user, loading } = useAuth();
  const fetchTrial = useServerFn(getMyTrialStatus);
  const fetchIsAdmin = useServerFn(isAdmin);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const trial = useQuery({
    queryKey: ["trial-status", user?.id],
    queryFn: () => fetchTrial(),
    enabled: mounted && !!user,
    retry: false,
  });

  const { data: viewerIsAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => fetchIsAdmin(),
    enabled: mounted && !!user,
    staleTime: 5 * 60_000,
    retry: false,
  });

  /** Direct one-click approval link for admins: lands on the approvals card with this user focused. */
  const approvalLink = (
    <Link
      to="/user-management"
      search={{ focus: "trials" as const, trialUser: user?.email ?? user?.id }}
    >
      <Button variant="outline" size="sm" className="gap-2">
        <BadgeCheck className="h-4 w-4" aria-hidden="true" /> אישור מיידי במסך האישורים
      </Button>
    </Link>
  );

  // Before hydration finishes we render the content as-is (SSR/SEO parity).
  if (!mounted) return <>{children}</>;

  if (loading || (user && trial.isLoading)) {
    return (
      <div dir="rtl" className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        בודקים את מצב ההרשמה שלך...
      </div>
    );
  }

  if (!user) {
    return (
      <div dir="rtl" className="flex min-h-[70vh] items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg rounded-2xl border border-border/70 bg-card/70 p-8 text-center backdrop-blur">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium">
            <Gift className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            חודש ניסיון חינם · ללא כרטיס אשראי
          </div>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Link to="/login" search={{ mode: "signup", next: pathname }}>
              <Button className="gap-2 shadow-glow-primary">
                <Mail className="h-4 w-4" aria-hidden="true" /> רישום במייל
              </Button>
            </Link>
            <Link to="/login" search={{ next: pathname }}>
              <Button variant="outline">כבר נרשמתי — התחברות</Button>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="gap-2">
                <Home className="h-4 w-4" aria-hidden="true" /> חזרה למסך הבית
              </Button>
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <TorahLogo size={14} aria-hidden="true" /> הכיתה שלי
          </p>
        </div>
      </div>
    );
  }

  const expired = trial.data && !trial.data.active;

  if (expired && requireActiveTrial) {
    return (
      <div dir="rtl" className="flex min-h-[70vh] items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg rounded-2xl border border-amber/40 bg-card/70 p-8 text-center backdrop-blur">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber/10 text-amber">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold">תקופת הניסיון הסתיימה</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            הכלי הזה פתוח למשתמשים עם ניסיון פעיל או מנוי. הבלוג ומחולל הקבוצות נשארים פתוחים לכולם,
            תמיד וללא רישום.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <TrialExtensionRequestButton className="shadow-glow-primary" />
            {viewerIsAdmin && approvalLink}
            <Link to="/support">
              <Button className="gap-2 shadow-glow-primary">
                <Mail className="h-4 w-4" aria-hidden="true" /> פנה אלינו לשדרוג
              </Button>
            </Link>
            <Link to="/tools/group-maker">
              <Button variant="outline" className="gap-2">
                <Gift className="h-4 w-4" aria-hidden="true" /> למחולל הקבוצות החינמי
              </Button>
            </Link>
            <Link to="/">
              <Button variant="ghost" className="gap-2">
                <Home className="h-4 w-4" aria-hidden="true" /> מסך הבית
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {expired && (
        <div dir="rtl" className="border-b border-amber/40 bg-amber/10 px-6 py-3 text-sm">
          <div className="mx-auto flex max-w-3xl items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden="true" />
            <div className="space-y-2">
            <p>
              תקופת הניסיון החינמית שלך הסתיימה. התוכן נשאר פתוח לקריאה — לשדרוג פנה אלינו בעמוד{" "}
              <Link to="/support" className="font-medium underline underline-offset-4">
                התמיכה
              </Link>
              , או בקש הארכה שהמנהל מאשר בקליק אחד.
            </p>
            <TrialExtensionRequestButton size="sm" variant="outline" />
            {viewerIsAdmin && approvalLink}
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
