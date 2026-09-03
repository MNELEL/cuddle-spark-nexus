import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { NotebookPen, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getDailyLog, saveDailyLog } from "@/lib/daily-log.functions";
import { useHebrewAnchor } from "@/components/hebrew-anchor";

/**
 * כרטיס תיעוד יומי ידני לכיתה. התאריך נקבע לפי הלוח העברי הפעיל,
 * ולכן שינוי התאריך בלוח מחליף מיד את היום שנרשם כאן.
 */
export function DailyLogEditor({ classId, className }: { classId: string; className?: string }) {
  const { info, isCustom } = useHebrewAnchor();
  const date = info.iso;
  const qc = useQueryClient();
  const load = useServerFn(getDailyLog);
  const save = useServerFn(saveDailyLog);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);

  const q = useQuery({
    queryKey: ["daily-log", classId, date],
    queryFn: () => load({ data: { classId, date } }),
  });

  useEffect(() => {
    setText(q.data?.notes ?? "");
    setDirty(false);
  }, [q.data?.notes, date]);

  const m = useMutation({
    mutationFn: () => save({ data: { classId, date, notes: text } }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["daily-log", classId, date] });
      toast.success("התיעוד היומי נשמר");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  return (
    <Card dir="rtl" className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-base">
          <NotebookPen className="h-5 w-5 text-primary" aria-hidden />
          תיעוד יומי
          <Badge variant="secondary">{info.full}</Badge>
          <Badge variant="outline">{info.weekday}</Badge>
          {info.parasha && <Badge variant="outline">{info.parasha}</Badge>}
          {isCustom && <Badge>תאריך נבחר</Badge>}
        </CardTitle>
        <CardDescription>
          רשום בעצמך מה קרה היום בכיתה. התיעוד נשמר לתאריך {info.full} ({date}); שינוי התאריך
          בלוח העברי מחליף את היום שנרשם כאן.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          dir="rtl"
          rows={6}
          value={text}
          placeholder="מה נלמד, מה קרה, מי הצטיין, מה נשאר להמשך…"
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
          aria-label={`תיעוד יומי לתאריך ${info.full}`}
        />
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => m.mutate()} disabled={m.isPending || !dirty}>
            {m.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            שמור תיעוד
          </Button>
          {q.isLoading && <span className="text-xs text-muted-foreground">טוען…</span>}
          {!q.isLoading && !dirty && text && (
            <span className="text-xs text-muted-foreground">נשמר</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
