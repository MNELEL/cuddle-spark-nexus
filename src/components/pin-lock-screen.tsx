import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyPin } from "@/lib/security.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export function PinLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const verify = useServerFn(verifyPin);
  const navigate = useNavigate();

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError("יש להזין 4 ספרות");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await verify({ data: { pin } });
      if (r.ok) {
        sessionStorage.setItem("ca_pin_unlocked", "1");
        onUnlock();
      } else {
        setError("PIN שגוי");
        setPin("");
      }
    } catch {
      setError("שגיאה באימות");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md p-4"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-6 rounded-2xl border-2 border-amber/40 bg-card p-6 sm:p-8 shadow-glow-amber text-center"
      >
        <div className="grid place-items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-amber to-amber-glow text-primary-foreground shadow-lg">
            <Lock className="h-8 w-8" />
          </div>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold">לוח הבקרה נעול</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            הזן את קוד ה-PIN בן 4 הספרות שלך
          </p>
        </div>
        <Input
          autoFocus
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            setPin(v);
            if (v.length === 4) {
              setTimeout(() => submit(), 0);
            }
          }}
          className="text-center text-3xl font-mono-tabular tracking-[0.5em] h-14"
          placeholder="••••"
          disabled={busy}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || pin.length !== 4}>
          {busy ? "מאמת..." : "פתח"}
        </Button>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
            sessionStorage.removeItem("ca_pin_unlocked");
            navigate({ to: "/login" });
          }}
          className="mx-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-3 w-3" /> יציאה מהחשבון
        </button>
      </form>
    </div>
  );
}