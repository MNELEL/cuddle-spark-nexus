import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Wrench, Sparkles, LineChart, Library, ShieldCheck, Settings } from "lucide-react";
import { TorahLogo } from "@/components/torah-logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSecurity, verifyUnlockToken } from "@/lib/security.functions";
import { isAdmin } from "@/lib/user-roles.functions";
import { PinLockScreen } from "@/components/pin-lock-screen";
import { GlobalCommandPalette } from "@/components/global-command-palette";
import { NotificationsBell } from "@/components/notifications-bell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const getSec = useServerFn(getSecurity);
  const checkAdmin = useServerFn(isAdmin);
  const checkToken = useServerFn(verifyUnlockToken);
  const queryClient = useQueryClient();
  const { data: sec } = useQuery({
    queryKey: ["app_security"],
    queryFn: () => getSec(),
    enabled: Boolean(user),
  });
  const { data: adminFlag } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdmin(),
    enabled: Boolean(user),
  });
  // Unlock state starts false and is only set after the server validates the
  // stored unlock token — a forged sessionStorage value cannot unlock the app.
  const [unlocked, setUnlocked] = useState(false);
  const [tokenChecked, setTokenChecked] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const token = typeof window !== "undefined" ? sessionStorage.getItem("ca_pin_unlocked") : null;
    if (!token) {
      setTokenChecked(true);
      return;
    }
    checkToken({ data: { token } })
      .then((r) => {
        if (!active) return;
        if (r.ok) setUnlocked(true);
        else sessionStorage.removeItem("ca_pin_unlocked");
      })
      .catch(() => sessionStorage.removeItem("ca_pin_unlocked"))
      .finally(() => active && setTokenChecked(true));
    return () => {
      active = false;
    };
  }, [user, checkToken]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const pinRequired = Boolean(sec?.pin_enabled && sec?.has_pin);
  const needsPin = pinRequired && !unlocked;

  // Drop any cached protected data while the app is locked.
  useEffect(() => {
    if (needsPin) {
      queryClient.removeQueries({
        predicate: (q) => {
          const key = q.queryKey[0];
          return key !== "app_security" && key !== "is-admin";
        },
      });
    }
  }, [needsPin, queryClient]);

  if (loading || !user || sec === undefined || !tokenChecked) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">טוען...</div>;
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-card">
        <div className="container mx-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:flex sm:px-6">
          <Link to="/classes" className="flex min-w-0 items-center gap-2">
            <TorahLogo size={24} className="shrink-0 text-primary" />
            <span className="truncate font-bold">הכיתה שלי</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link to="/toolkit" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              <Wrench className="me-1 inline h-4 w-4" />ארגז כלים
            </Link>
            <Link to="/resources" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              <Library className="me-1 inline h-4 w-4" />ספרייה
            </Link>
            <Link to="/insights" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              <LineChart className="me-1 inline h-4 w-4" />תובנות
            </Link>
            <Link to="/ingest" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              <Sparkles className="me-1 inline h-4 w-4" />העלאה חכמה
            </Link>
            <Link to="/settings" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              <Settings className="me-1 inline h-4 w-4" />הגדרות
            </Link>
            {adminFlag && (
              <Link to="/user-management" className="rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent hover:text-foreground">
                <ShieldCheck className="me-1 inline h-4 w-4" />ניהול משתמשים
              </Link>
            )}
          </nav>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground md:inline">{user.email}</span>
            {!needsPin && <NotificationsBell />}
            <ThemeSwitcher />
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/login" }))}>
              <LogOut className="ms-1 h-4 w-4" /> <span className="hidden sm:inline">יציאה</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-3 py-6 sm:px-6">
        {needsPin ? (
          <div className="min-h-[40vh]" aria-hidden />
        ) : (
          <Outlet />
        )}
      </main>
      {needsPin && <PinLockScreen onUnlock={() => setUnlocked(true)} />}
      {!needsPin && <GlobalCommandPalette />}
    </div>
  );
}