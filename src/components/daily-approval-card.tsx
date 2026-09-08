import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { hebrewDateTime } from "@/lib/hebrew-date";
import {
  getDailyApproval,
  saveDailyApproval,
  removeDailyApproval,
} from "@/lib/daily-approvals.functions";

/**
 * אישור המלמד לתיעוד היומי של התלמיד: סימון שהתיעוד נבדק ואושר,
 * עם שם המאשר והערה. האישור נספר מיד בדוח התיעוד היומי.
 */
export function DailyApprovalCard({
  studentId,
  classId,
  date,
}: {
  studentId: string;
  classId: string;
  date: string;
}) {
  const qc = useQueryClient();
  const [approver, setApprover] = useState("");
  const [notes, setNotes] = useState("");

  const load = useServerFn(getDailyApproval);
  const save = useServerFn(saveDailyApproval);
  const remove = useServerFn(removeDailyApproval);

  const existing = useQuery({
    queryKey: ["daily-approval", studentId, date],
    queryFn: () => load({ data: { studentId, date } }),
    enabled: !!studentId,
  });

  useEffect(() => {
    setApprover(existing.data?.approver_name ?? "");
    setNotes(existing.data?.notes ?? "");
  }, [existing.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["daily-approval", studentId, date] });
    qc.invalidateQueries({ queryKey: ["student-daily-history", studentId] });
    qc.invalidateQueries({ queryKey: ["daily-log-report"] });
    qc.invalidateQueries({ queryKey: ["daily-briefing"] });
    void classId;
  };

  const saveM = useMutation({
    mutationFn: () => save({ data: { studentId, date, approverName: approver, notes } }),
    onSuccess: () => {
      toast.success("התיעוד היומי אושר");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  const removeM = useMutation({
    mutationFn: () => remove({ data: { studentId, date } }),
    onSuccess: () => {
      toast.success("האישור בוטל");
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הפעולה נכשלה"),
  });

  const approved = !!existing.data;

  return (
    <div dir="rtl" className="space-y-3 rounded-md border p-3">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
        <BadgeCheck className={`h-4 w-4 ${approved ? "text-primary" : "text-muted-foreground"}`} aria-hidden />
        אישור המלמד לתיעוד היום
        {approved ? (
          <Badge>אושר · {hebrewDateTime(existing.data!.updated_at)}</Badge>
        ) : (
          <Badge variant="secondary">טרם אושר</Badge>
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ap-name">שם המאשר</Label>
          <Input
            id="ap-name"
            value={approver}
            onChange={(e) => setApprover(e.target.value)}
            placeholder="למשל: הרב כהן"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ap-notes">הערת אישור</Label>
          <Input
            id="ap-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="לא חובה"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => saveM.mutate()} disabled={saveM.isPending}>
          {saveM.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <BadgeCheck className="h-4 w-4" aria-hidden />
          )}
          {approved ? "עדכן אישור" : "אשר את התיעוד"}
        </Button>
        {approved && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => removeM.mutate()}
            disabled={removeM.isPending}
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            בטל אישור
          </Button>
        )}
      </div>
    </div>
  );
}
