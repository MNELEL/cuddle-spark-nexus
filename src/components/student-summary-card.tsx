import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HebrewDateInput } from "@/components/hebrew-date-input";
import {
  getStudentSummary,
  generateStudentSummary,
  approveStudentSummary,
  setStudentSummaryStartDate,
} from "@/lib/student-summaries.functions";
import { hebrewDate } from "@/lib/hebrew-date";

type SummaryRow = {
  start_date?: string | null;
  approved_at?: string | null;
  ai_summary?: string | null;
  trends?: string | null;
};

/** תקציר התלמיד: תאריך-החלוף, תאריך אישור, תקציר AI וניתוח מגמות. */
export function StudentSummaryCard({ studentId }: { studentId: string }) {
  const load = useServerFn(getStudentSummary);
  const gen = useServerFn(generateStudentSummary);
  const approve = useServerFn(approveStudentSummary);
  const saveStart = useServerFn(setStudentSummaryStartDate);
  const qc = useQueryClient();
  const key = ["student-summary", studentId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => load({ data: { studentId } }),
  });

  const row = (data?.summary ?? {}) as SummaryRow;
  const [startDate, setStartDate] = useState("");

  useEffect(() => {
    setStartDate(row.start_date ? String(row.start_date).slice(0, 10) : "");
  }, [row.start_date]);

  const invalidate = () => qc.invalidateQueries({ queryKey: key });
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "שגיאה");

  const genM = useMutation({
    mutationFn: () => gen({ data: { studentId } }),
    onSuccess: (r) => {
      invalidate();
      const s = (r as { sources?: Record<string, number> }).sources;
      toast.success(
        s
          ? `הניתוח הופק · ${s.items} פריטים, ${s.insights} תובנות, ${s.grades} ציונים`
          : "הניתוח הופק",
      );
    },
    onError: fail,
  });

  const approveM = useMutation({
    mutationFn: (approved: boolean) => approve({ data: { studentId, approved } }),
    onSuccess: () => { invalidate(); toast.success("האישור עודכן"); },
    onError: fail,
  });

  const startM = useMutation({
    mutationFn: (v: string) => saveStart({ data: { studentId, startDate: v } }),
    onSuccess: () => { invalidate(); toast.success("תאריך-החלוף נשמר"); },
    onError: fail,
  });

  return (
    <Card dir="rtl">
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="font-display text-lg">תקציר התלמיד</h3>
          {row.approved_at ? (
            <Badge className="bg-accent text-accent-foreground font-mono-tabular">
              אושר · {hebrewDate(String(row.approved_at).slice(0, 10))}
            </Badge>
          ) : (
            <Badge variant="outline">טרם אושר</Badge>
          )}
        </div>

        <div className="max-w-xs">
          <HebrewDateInput
            id={`summary-start-${studentId}`}
            label="תאריך-החלוף"
            value={startDate}
            onChange={(v) => { setStartDate(v); startM.mutate(v); }}
            clearable
            compact
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">טוען…</p>
        ) : (
          <>
            <div className="rounded-lg bg-muted/50 p-2 text-xs">
              <div className="mb-1 font-medium">תקציר AI</div>
              <div className="whitespace-pre-wrap leading-relaxed">
                {row.ai_summary || "טרם הופק תקציר."}
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-xs">
              <div className="mb-1 font-medium">ניתוח מגמות</div>
              <div className="whitespace-pre-wrap leading-relaxed">
                {row.trends || "טרם הופק ניתוח מגמות."}
              </div>
            </div>
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            disabled={genM.isPending}
            onClick={() => genM.mutate()}
          >
            {genM.isPending ? (
              <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="me-1 h-4 w-4" aria-hidden="true" />
            )}
            {row.ai_summary ? "רענן תקציר ומגמות" : "הפק תקציר ומגמות"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl"
            disabled={approveM.isPending}
            onClick={() => approveM.mutate(!row.approved_at)}
          >
            <CheckCircle2 className="me-1 h-4 w-4" aria-hidden="true" />
            {row.approved_at ? "בטל אישור" : "אשר תקציר"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
