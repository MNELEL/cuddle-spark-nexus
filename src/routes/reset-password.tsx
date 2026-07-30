import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "איפוס סיסמה · הכיתה שלי" },
      { name: "description", content: "בחר סיסמה חדשה לחשבון ״הכיתה שלי״ והמשך לנהל כיתה, הושבה, ציונים ודוחות." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "איפוס סיסמה · הכיתה שלי" },
      { property: "og:description", content: "בחר סיסמה חדשה לחשבון ״הכיתה שלי״." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(!!session);
      if (!session) setErrorMsg("הקישור אינו תקף או פג תוקפו. בקש קישור חדש ממסך הכניסה.");
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    if (password !== confirm) {
      setErrorMsg("הסיסמאות אינן תואמות");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccessMsg("הסיסמה עודכנה בהצלחה. מעבירים אותך למערכת...");
      toast.success("הסיסמה עודכנה");
      setTimeout(() => navigate({ to: "/classes" }), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "עדכון הסיסמה נכשל";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="font-display text-lg font-bold">הכיתה שלי</span>
        </Link>

        <h1 className="font-display text-2xl font-bold">בחירת סיסמה חדשה</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">הזן סיסמה חדשה לחשבון שלך.</p>

        <div aria-live="polite" aria-atomic="true" role="status" className="mb-4 space-y-2 empty:mb-0">
          {busy && (
            <p className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              מעדכנים את הסיסמה...
            </p>
          )}
          {!busy && errorMsg && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMsg}
            </p>
          )}
          {!busy && successMsg && (
            <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
              {successMsg}
            </p>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3" aria-busy={busy}>
          <fieldset disabled={busy || !ready} className="contents">
            <div>
              <Label htmlFor="new-password">סיסמה חדשה</Label>
              <Input id="new-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
            </div>
            <div>
              <Label htmlFor="confirm-password">אימות סיסמה</Label>
              <Input id="confirm-password" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" />
            </div>
            <Button type="submit" className="w-full">
              {busy && <Loader2 className="ms-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              עדכן סיסמה
            </Button>
          </fieldset>
        </form>

        <div className="mt-4 text-sm">
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">חזרה למסך הכניסה</Link>
        </div>
      </div>
    </main>
  );
}