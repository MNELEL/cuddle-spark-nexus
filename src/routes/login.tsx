import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap } from "lucide-react";
import { SeatFillGrid } from "@/components/seat-fill-grid";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "כניסה למערכת · הכיתה שלי" },
      { name: "description", content: "התחבר ל-״הכיתה שלי״ כדי לנהל כיתה, סידור הושבה, ציונים ודוחות פדגוגיים בעברית מלאה." },
      { property: "og:title", content: "כניסה למערכת · הכיתה שלי" },
      { property: "og:description", content: "התחבר ל-״הכיתה שלי״ כדי לנהל כיתה, סידור הושבה, ציונים ודוחות פדגוגיים בעברית מלאה." },
      { property: "og:url", content: "https://cuddle-spark-nexus.lovable.app/login" },
    ],
    links: [{ rel: "canonical", href: "https://cuddle-spark-nexus.lovable.app/login" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/classes" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("נרשמת בהצלחה! בדוק את האימייל לאישור.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/classes" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהתחברות");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("שגיאה בהתחברות עם Google");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/classes" });
  };

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <h1 className="sr-only">התחברות ל-״הכיתה שלי״</h1>

      {/* visual panel — left column on RTL screens, hidden on small screens */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground md:order-2 md:flex">
        <Link to="/" className="flex items-center gap-2.5">
          <GraduationCap className="h-7 w-7" aria-hidden="true" />
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
            <GraduationCap className="h-6 w-6 text-primary" aria-hidden="true" />
            <span className="font-display text-lg font-bold">הכיתה שלי</span>
          </Link>

          <div role="tablist" aria-label="מצב כניסה" className="mb-6 flex gap-1 rounded-xl bg-muted p-1">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={tabClass(mode === "signin")}
              onClick={() => setMode("signin")}
            >
              התחברות
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={tabClass(mode === "signup")}
              onClick={() => setMode("signup")}
            >
              הרשמה
            </button>
          </div>

          <h2 className="font-display text-2xl font-bold">
            {mode === "signin" ? "ברוך שובך" : "צור חשבון"}
          </h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            {mode === "signin" ? "התחבר כדי לנהל את הכיתות שלך" : "התחל לנהל את הכיתות שלך בחינם"}
          </p>

          <div className="space-y-4">
            <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
              המשך עם Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">או</span>
              </div>
            </div>
            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="name">שם</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="הרב ישראל / המלמד" />
                </div>
              )}
              <div>
                <Label htmlFor="email">אימייל</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
              </div>
              <div>
                <Label htmlFor="password">סיסמה</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {mode === "signin" ? "התחבר" : "הרשם"}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}