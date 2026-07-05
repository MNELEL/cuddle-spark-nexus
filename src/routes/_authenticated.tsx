import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, Wrench, Music, Sparkles } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSecurity } from "@/lib/security.functions";
import { PinLockScreen } from "@/components/pin-lock-screen";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const getSec = useServerFn(getSecurity);
  const { data: sec } = useQuery({
    queryKey: ["app_security"],
    queryFn: () => getSec(),
    enabled: Boolean(user),
  });
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("ca_pin_unlocked") === "1";
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">טוען...</div>;
  }

  const needsPin = Boolean(sec?.pin_enabled && sec?.has_pin) && !unlocked;

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="border-b bg-card">
        <div className="container mx-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 sm:flex sm:px-6">
          <Link to="/classes" className="flex min-w-0 items-center gap-2">
            <GraduationCap className="h-6 w-6 shrink-0 text-primary" />
            <span className="truncate font-bold">ClassAlign Studio</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link to="/toolkit" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              <Wrench className="me-1 inline h-4 w-4" />ארגז כלים
            </Link>
            <Link to="/sound-board" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              <Music className="me-1 inline h-4 w-4" />לוח צלילים
            </Link>
            <Link to="/resources" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              ספרייה
            </Link>
            <Link to="/ingest" className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
              <Sparkles className="me-1 inline h-4 w-4" />העלאה חכמה
            </Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground md:inline">{user.email}</span>
            <ThemeSwitcher />
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/login" }))}>
              <LogOut className="ms-1 h-4 w-4" /> <span className="hidden sm:inline">יציאה</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-3 py-6 sm:px-6">
        <Outlet />
      </main>
      {needsPin && <PinLockScreen onUnlock={() => setUnlocked(true)} />}
    </div>
  );
}