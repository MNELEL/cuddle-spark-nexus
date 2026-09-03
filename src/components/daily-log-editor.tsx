import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { NotebookPen, Save, Loader2, History, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getDailyLog, saveDailyLog, listDailyLogHistory } from "@/lib/daily-log.functions";
import { useHebrewAnchor } from "@/components/hebrew-anchor";
import { hebrewDateTime, toHebrewDateFull } from "@/lib/hebrew-date";

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
  const history = useServerFn(listDailyLogHistory);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const q = useQuery({
    queryKey: ["daily-log", classId, date],
    queryFn: () => load({ data: { classId, date } }),
  });

  const h = useQuery({
    queryKey: ["daily-log-history", classId, date],
    queryFn: () => history({ data: { classId, date, limit: 30 } }),
    enabled: showHistory,
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
      qc.invalidateQueries({ queryKey: ["daily-log-history", classId, date] });
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
          >
            <History className="h-4 w-4" aria-hidden />
            היסטוריית שינויים
            {showHistory ? (
              <ChevronUp className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
          </Button>
          {q.isLoading && <span className="text-xs text-muted-foreground">טוען…</span>}
          {!q.isLoading && !dirty && text && (
            <span className="text-xs text-muted-foreground">נשמר</span>
          )}
        </div>

        {showHistory && (
          <div className="space-y-2 rounded-md border p-3">
            {h.isLoading && <p className="text-xs text-muted-foreground">טוען היסטוריה…</p>}
            {!h.isLoading && (h.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">אין שינויים מתועדים לתאריך זה.</p>
            )}
            {(h.data ?? []).map((entry) => (
              <div key={entry.id} className="space-y-1 border-b pb-2 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={entry.action === "created" ? "secondary" : "outline"}>
                    {entry.action === "created" ? "נוצר" : "עודכן"}
                  </Badge>
                  <span>{entry.author}</span>
                  <span>{hebrewDateTime(entry.created_at)}</span>
                  {entry.date && <span>({toHebrewDateFull(entry.date) ?? entry.date})</span>}
                </div>
                {entry.previous_notes && (
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground line-through">
                    {entry.previous_notes}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm">{entry.new_notes}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
