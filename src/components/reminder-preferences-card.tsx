import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BellRing, Loader2, Check, RotateCcw } from "lucide-react";
import {
  getReminderPreferences, saveReminderPreferences,
  type ReminderTypes,
} from "@/lib/reminder-preferences.functions";

const LEADS = [15, 30, 60, 120] as const;

export function ReminderPreferencesCard() {
  const qc = useQueryClient();
  const getP = useServerFn(getReminderPreferences);
  const saveP = useServerFn(saveReminderPreferences);
  const { data, isLoading } = useQuery({ queryKey: ["reminder_prefs"], queryFn: () => getP() });

  const [types, setTypes] = useState<ReminderTypes>({ lessons: true, assignments: true, messages: true });
  const [lead, setLead] = useState<number>(30);
  const snapshotRef = useRef<{ types: ReminderTypes; lead: number } | null>(null);
  const attemptedRef = useRef<{ types: ReminderTypes; lead: number } | null>(null);

  useEffect(() => {
    if (data) {
      setTypes(data.types_enabled);
      setLead(data.lead_time_minutes);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (vars: { types: ReminderTypes; lead: number }) =>
      saveP({ data: { types_enabled: vars.types, lead_time_minutes: vars.lead } }),
    onMutate: (vars) => {
      attemptedRef.current = vars;
      toast.loading("שומר העדפות…", { id: "reminder_prefs_save" });
    },
    onSuccess: () => {
      snapshotRef.current = null;
      qc.invalidateQueries({ queryKey: ["reminder_prefs"] });
      toast.success("ההעדפות נשמרו בהצלחה", { id: "reminder_prefs_save" });
    },
    onError: () => {
      const snap = snapshotRef.current;
      if (snap) {
        setTypes(snap.types);
        setLead(snap.lead);
      }
      toast.error("שמירת ההעדפות נכשלה — הערכים הוחזרו למצב הקודם. נסה שוב.", {
        id: "reminder_prefs_save",
      });
    },
  });

  function handleSave() {
    snapshotRef.current = data
      ? { types: data.types_enabled, lead: data.lead_time_minutes }
      : { types, lead };
    save.mutate({ types, lead });
  }

  function handleRetry() {
    const attempted = attemptedRef.current;
    if (!attempted) return;
    save.mutate(attempted);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" /> העדפות תזכורות</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> טוען העדפות…
          </div>
        )}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="t-lessons">תזכורות לשיעורים קרובים</Label>
            <Switch id="t-lessons" checked={types.lessons} onCheckedChange={(v) => setTypes({ ...types, lessons: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="t-assignments">תזכורות למטלות</Label>
            <Switch id="t-assignments" checked={types.assignments} onCheckedChange={(v) => setTypes({ ...types, assignments: v })} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="t-messages">תזכורות להודעות/הורים</Label>
            <Switch id="t-messages" checked={types.messages} onCheckedChange={(v) => setTypes({ ...types, messages: v })} />
          </div>
        </div>
        <div>
          <Label className="mb-2 block">זמן התראה מראש</Label>
          <div className="flex flex-wrap gap-2">
            {LEADS.map((n) => (
              <Button
                key={n}
                type="button"
                size="sm"
                variant={lead === n ? "default" : "outline"}
                onClick={() => setLead(n)}
              >
                {n} דק'
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-muted-foreground" aria-live="polite" role="status">
            {save.isPending ? "שומר…" : save.isSuccess ? "נשמר" : ""}
          </span>
          {save.isError && !save.isPending && (
            <Button type="button" variant="outline" onClick={handleRetry}>
              <RotateCcw className="ms-1 h-4 w-4" /> נסה שוב
            </Button>
          )}
          <Button onClick={handleSave} disabled={save.isPending || isLoading}>
            {save.isPending ? (
              <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> שומר…</>
            ) : save.isSuccess ? (
              <><Check className="ms-1 h-4 w-4" /> נשמר</>
            ) : (
              "שמור העדפות"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}