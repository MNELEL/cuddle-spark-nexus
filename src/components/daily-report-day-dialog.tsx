import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { History, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getDailyLog, saveDailyLog, listDailyLogHistory } from "@/lib/daily-log.functions";
import { hebrewDateTime, toHebrewDateFull } from "@/lib/hebrew-date";

/**
 * עריכת יום בודד מתוך דוח התיעוד היומי: תיעוד ידני, היסטוריית שינויים
 * וקישורים מהירים לעריכת נוכחות, ציונים ותובנות של אותו יום.
 */
export function DailyReportDayDialog({
  classId,
  date,
  hebrewLabel,
  open,
  onOpenChange,
}: {
  classId: string;
  date: string | null;
  hebrewLabel?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const load = useServerFn(getDailyLog);
  const save = useServerFn(saveDailyLog);
  const history = useServerFn(listDailyLogHistory);
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);

  const q = useQuery({
    queryKey: ["daily-log", classId, date],
    queryFn: () => load({ data: { classId, date: date! } }),
    enabled: open && !!date,
  });

  const h = useQuery({
    queryKey: ["daily-log-history", classId, date],
    queryFn: () => history({ data: { classId, date: date!, limit: 30 } }),
    enabled: open && !!date,
  });

  useEffect(() => {
    setText(q.data?.notes ?? "");
    setDirty(false);
  }, [q.data?.notes, date]);

  const m = useMutation({
    mutationFn: () => save({ data: { classId, date: date!, notes: text } }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["daily-log", classId, date] });
      qc.invalidateQueries({ queryKey: ["daily-log-history", classId, date] });
      qc.invalidateQueries({ queryKey: ["daily-log-report", classId] });
      toast.success("התיעוד היומי נשמר");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-display text-base">
            עריכת יום
            {date && <Badge variant="secondary">{hebrewLabel ?? toHebrewDateFull(date) ?? date}</Badge>}
            {date && <Badge variant="outline">{date}</Badge>}
          </DialogTitle>
          <DialogDescription>
            כתוב או ערוך את התיעוד היומי; כל שינוי נשמר בהיסטוריה. נוכחות, ציונים ותובנות נערכים
            במסכים המיוחדים להם.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          dir="rtl"
          rows={6}
          value={text}
          placeholder="מה נלמד, מה קרה, מי הצטיין, מה נשאר להמשך…"
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
          aria-label="תיעוד יומי"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => m.mutate()} disabled={m.isPending || !dirty}>
            {m.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            שמור תיעוד
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/classes/$classId" params={{ classId }}>
              נוכחות וציונים
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/insights">תובנות</Link>
          </Button>
          {q.isLoading && <span className="text-xs text-muted-foreground">טוען…</span>}
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <p className="flex items-center gap-1 text-xs font-semibold">
            <History className="h-4 w-4" aria-hidden />
            היסטוריית שינויים
          </p>
          {h.isLoading && <p className="text-xs text-muted-foreground">טוען היסטוריה…</p>}
          {!h.isLoading && (h.data ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">אין שינויים מתועדים לתאריך זה.</p>
          )}
          {(h.data ?? []).map((entry) => (
            <div key={entry.id} className="space-y-1 border-b pb-2 text-xs last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <Badge variant={entry.action === "created" ? "secondary" : "outline"}>
                  {entry.action === "created" ? "נוצר" : "עודכן"}
                </Badge>
                <span>{entry.author}</span>
                <span>{hebrewDateTime(entry.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap">{entry.new_notes || "—"}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
