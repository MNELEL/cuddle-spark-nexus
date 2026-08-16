import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteRecurringRule, listRecurringRules, upsertRecurringRule,
} from "@/lib/recurring-rules.functions";
import {
  RULE_EFFECT_LABEL, RULE_KIND_LABEL, timeLabel,
  type RecurringRule, type RuleEffect, type RuleKind,
} from "@/lib/recurring-rules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DAYS = [
  { key: "sun", label: "ראשון" }, { key: "mon", label: "שני" }, { key: "tue", label: "שלישי" },
  { key: "wed", label: "רביעי" }, { key: "thu", label: "חמישי" }, { key: "fri", label: "שישי" },
  { key: "sat", label: "שבת" },
] as const;
const MINUTES = [0, 15, 30, 45] as const;
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

/**
 * Recurring effects that repeat forever without entering dates: a fixed weekday
 * ("every Friday we end at 12:30") or Rosh Chodesh, which is derived from the
 * Hebrew calendar automatically.
 */
export function RecurringRulesPanel({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listRecurringRules);
  const saveFn = useServerFn(upsertRecurringRule);
  const delFn = useServerFn(deleteRecurringRule);

  const { data: rules = [] } = useQuery({
    queryKey: ["recurring-rules", classId],
    queryFn: () => listFn({ data: { classId } }),
  });

  const [kind, setKind] = useState<RuleKind>("weekly_day");
  const [dayKey, setDayKey] = useState<(typeof DAYS)[number]["key"]>("fri");
  const [effect, setEffect] = useState<RuleEffect>("early_end");
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState<(typeof MINUTES)[number]>(30);
  const [label, setLabel] = useState("");

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["recurring-rules", classId] });
    void qc.invalidateQueries({ queryKey: ["weekly-lessons", classId] });
  };

  const saveM = useMutation({
    mutationFn: saveFn,
    onSuccess: () => { invalidate(); setLabel(""); toast.success("הכלל נשמר"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שמירת הכלל נכשלה"),
  });
  const delM = useMutation({
    mutationFn: delFn,
    onSuccess: () => { invalidate(); toast("הכלל נמחק"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקת הכלל נכשלה"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">כללים קבועים — סיום מוקדם, התחלה מאוחרת וראש חודש</CardTitle>
        <CardDescription>
          כללים חוזרים לנצח ואינם דורשים הזנת תאריכים. ראש חודש מזוהה אוטומטית מלוח השנה העברי,
          וכללים אלו נאכפים גם בהחלת המערכת הקבועה על השבועות.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label>סוג</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as RuleKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RULE_KIND_LABEL) as RuleKind[]).map((k) => (
                  <SelectItem key={k} value={k}>{RULE_KIND_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {kind === "weekly_day" && (
            <div className="space-y-1.5">
              <Label>יום</Label>
              <Select value={dayKey} onValueChange={(v) => setDayKey(v as typeof dayKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>מה קורה</Label>
            <Select value={effect} onValueChange={(v) => setEffect(v as RuleEffect)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RULE_EFFECT_LABEL) as RuleEffect[]).map((k) => (
                  <SelectItem key={k} value={k}>{RULE_EFFECT_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {effect !== "no_school" && (
            <div className="space-y-1.5">
              <Label>שעה</Label>
              <div className="flex items-center gap-1">
                <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOURS.map((h) => <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span>:</span>
                <Select value={String(minute)} onValueChange={(v) => setMinute(Number(v) as typeof minute)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MINUTES.map((m) => <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>תיאור (אופציונלי)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="למשל: ערב שבת" maxLength={200} />
          </div>
        </div>
        <Button
          size="sm"
          disabled={saveM.isPending}
          onClick={() =>
            saveM.mutate({
              data: {
                classId, kind, effect, label: label || null,
                dayKey: kind === "weekly_day" ? dayKey : null,
                hour: effect === "no_school" ? null : hour,
                minute: effect === "no_school" ? 0 : minute,
                active: true,
              },
            })
          }
        >
          <Plus className="ms-1 h-4 w-4" /> הוסף כלל
        </Button>

        <div className="space-y-2">
          {(rules as RecurringRule[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">לא הוגדרו כללים קבועים.</p>
          ) : (
            (rules as RecurringRule[]).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {r.kind === "rosh_chodesh" ? "ראש חודש" : DAYS.find((d) => d.key === r.day_key)?.label ?? r.day_key}
                  </Badge>
                  <span className="font-medium">{RULE_EFFECT_LABEL[r.effect]}</span>
                  {r.hour != null && <span className="text-muted-foreground">{timeLabel(r.hour, r.minute)}</span>}
                  {r.label && <span className="text-xs text-muted-foreground">· {r.label}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={r.active}
                    aria-label="כלל פעיל"
                    onCheckedChange={(v) =>
                      saveM.mutate({
                        data: {
                          id: r.id, classId, kind: r.kind, effect: r.effect,
                          dayKey: r.day_key as typeof dayKey | null, hour: r.hour,
                          minute: (r.minute ?? 0) as typeof minute, label: r.label, active: v,
                        },
                      })
                    }
                  />
                  <Button variant="ghost" size="icon" aria-label="מחק כלל" onClick={() => delM.mutate({ data: { id: r.id } })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}