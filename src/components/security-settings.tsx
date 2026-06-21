import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSecurity, setPin, disablePin, verifyPin } from "@/lib/security.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Lock, ShieldCheck, KeyRound, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function SecuritySettings() {
  const qc = useQueryClient();
  const getSec = useServerFn(getSecurity);
  const setPinFn = useServerFn(setPin);
  const disableFn = useServerFn(disablePin);
  const verifyFn = useServerFn(verifyPin);

  const { data, isLoading } = useQuery({
    queryKey: ["app_security"],
    queryFn: () => getSec(),
  });

  const [setOpen, setSetOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [verifyInput, setVerifyInput] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enabled = Boolean(data?.pin_enabled && data?.has_pin);

  async function handleSave() {
    setErr(null);
    if (!/^\d{4}$/.test(newPin)) { setErr("PIN חייב 4 ספרות"); return; }
    if (newPin !== confirmPin) { setErr("האימות לא תואם"); return; }
    setBusy(true);
    try {
      await setPinFn({ data: { pin: newPin } });
      toast.success("ה-PIN נשמר ונעילת הלוח הופעלה");
      sessionStorage.setItem("ca_pin_unlocked", "1");
      qc.invalidateQueries({ queryKey: ["app_security"] });
      setSetOpen(false);
      setNewPin(""); setConfirmPin("");
    } catch (e: any) {
      setErr(e?.message ?? "שגיאה");
    } finally { setBusy(false); }
  }

  async function handleDisable() {
    setErr(null);
    setBusy(true);
    try {
      const r = await verifyFn({ data: { pin: verifyInput } });
      if (!r.ok) { setErr("PIN שגוי"); setBusy(false); return; }
      await disableFn();
      sessionStorage.removeItem("ca_pin_unlocked");
      qc.invalidateQueries({ queryKey: ["app_security"] });
      toast.success("נעילת הלוח כובתה");
      setDisableOpen(false);
      setVerifyInput("");
    } catch (e: any) {
      setErr(e?.message ?? "שגיאה");
    } finally { setBusy(false); }
  }

  function onToggle(v: boolean) {
    if (v) setSetOpen(true);
    else setDisableOpen(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber" />
            נעילת לוח הבקרה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-muted/40 p-3 sm:flex sm:flex-wrap sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-amber" />
              <div className="min-w-0 text-sm leading-tight">
                <div className="truncate font-medium">דרוש PIN לכניסה לאפליקציה</div>
                <div className="truncate text-xs text-muted-foreground">
                  {enabled ? "מופעל — תידרש הזנת PIN בכל פתיחה" : "מכובה — כניסה ישירה לאחר התחברות"}
                </div>
              </div>
            </div>
            <Switch
              className="shrink-0"
              checked={enabled}
              disabled={isLoading}
              onCheckedChange={onToggle}
            />
          </div>

          {enabled && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setSetOpen(true)}>
                <KeyRound className="ms-1 h-4 w-4" /> שנה PIN
              </Button>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border border-amber/30 bg-amber/5 p-3 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber" />
            <p>
              ה-PIN מוצפן ונשמר בשרת מאובטח של הענן. הוא משויך אליך בלבד ולא ניתן לשחזר אותו —
              אם תשכח, תוכל לאפס דרך יציאה והתחברות מחדש לחשבון.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Set / change PIN dialog */}
      <Dialog open={setOpen} onOpenChange={(o) => { setSetOpen(o); if (!o) { setErr(null); setNewPin(""); setConfirmPin(""); } }}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{enabled ? "שנה PIN" : "הגדר PIN חדש"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>PIN חדש (4 ספרות)</Label>
              <Input
                inputMode="numeric" maxLength={4} value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="text-center text-2xl font-mono-tabular tracking-[0.4em]"
                placeholder="••••" autoFocus
              />
            </div>
            <div>
              <Label>אימות</Label>
              <Input
                inputMode="numeric" maxLength={4} value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="text-center text-2xl font-mono-tabular tracking-[0.4em]"
                placeholder="••••"
              />
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSetOpen(false)}>בטל</Button>
            <Button onClick={handleSave} disabled={busy || newPin.length !== 4 || confirmPin.length !== 4}>
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable dialog */}
      <Dialog open={disableOpen} onOpenChange={(o) => { setDisableOpen(o); if (!o) { setErr(null); setVerifyInput(""); } }}>
        <DialogContent dir="rtl" className="sm:max-w-sm">
          <DialogHeader><DialogTitle>כיבוי נעילת הלוח</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">הזן את ה-PIN הנוכחי כדי לכבות את הנעילה.</p>
            <Input
              inputMode="numeric" maxLength={4} value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="text-center text-2xl font-mono-tabular tracking-[0.4em]"
              placeholder="••••" autoFocus
            />
            {err && <p className="text-sm text-destructive">{err}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisableOpen(false)}>בטל</Button>
            <Button variant="destructive" onClick={handleDisable} disabled={busy || verifyInput.length !== 4}>
              כבה נעילה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}