import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyPin, getPinForAutofill } from "@/lib/security.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, LogOut, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export function PinLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const verify = useServerFn(verifyPin);
  const fetchPin = useServerFn(getPinForAutofill);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    fetchPin()
      .then((r) => { if (!cancelled) setSavedPin(r.pin); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fetchPin]);

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

  async function quickEntry() {
    if (!savedPin || autofilling || busy) return;
    setError(null);
    setAutofilling(true);
    setPin("");
    for (let i = 1; i <= savedPin.length; i++) {
      await new Promise((res) => setTimeout(res, 80));
      setPin(savedPin.slice(0, i));
    }
    await new Promise((res) => setTimeout(res, 120));
    setBusy(true);
    try {
      const r = await verify({ data: { pin: savedPin } });
      if (r.ok) {
        sessionStorage.setItem("ca_pin_unlocked", "1");
        onUnlock();
      } else {
        setError("הקוד שמור לא תקין — הזן ידנית");
        setPin("");
      }
    } catch {
      setError("שגיאה באימות");
    } finally {
      setBusy(false);
      setAutofilling(false);
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
            if (autofilling) return;
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            setPin(v);
            if (v.length === 4) {
              setTimeout(() => submit(), 0);
            }
          }}
          className={`text-center text-3xl font-mono-tabular tracking-[0.5em] h-14 ${autofilling ? "animate-pulse" : ""}`}
          placeholder="••••"
          disabled={busy || autofilling}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || autofilling || pin.length !== 4}>
          {busy && !autofilling ? "מאמת..." : "פתח"}
        </Button>
        {savedPin && (
          <Button
            type="button"
            variant="outline"
            onClick={quickEntry}
            disabled={busy || autofilling}
            className="w-full border-amber/50 text-amber hover:bg-amber/10 hover:text-amber shadow-glow-amber/30"
          >
            <Zap className="h-4 w-4 ml-1" />
            {autofilling ? "ממלא קוד..." : "כניסה מהירה"}
          </Button>
        )}
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