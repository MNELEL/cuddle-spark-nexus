import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, Link } from "@tanstack/react-router";
import { AlertCircle, Bell, CheckCircle2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateDailyBriefing,
  listDailyBriefing,
  dismissInsight,
  type DailyInsight,
} from "@/lib/orchestrator.functions";
import { listPendingUpdates } from "@/lib/pending-updates.functions";
import { StudentHistoryDialog } from "@/components/student-history-dialog";
import { hebrewDateTime } from "@/lib/hebrew-date";
import { hebrewDayInfo } from "@/lib/hebrew-calendar";

const SEVERITY_STYLES: Record<string, { wrapper: string; label: string; badge: string }> = {
  high: {
    wrapper: "border-destructive/40 bg-destructive/5",
    label: "חמור",
    badge: "bg-destructive text-destructive-foreground",
  },
  medium: {
    wrapper: "border-accent/50 bg-accent/10",
    label: "בינוני",
    badge: "bg-accent text-accent-foreground",
  },
  low: {
    wrapper: "border-border bg-muted/40",
    label: "קל",
    badge: "bg-secondary text-secondary-foreground",
  },
};

export function DailyBriefingCard() {
  const fetchList = useServerFn(listDailyBriefing);
  const runGenerate = useServerFn(generateDailyBriefing);
  const runDismiss = useServerFn(dismissInsight);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [classFilter, setClassFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"severity" | "class">("severity");

  const { data: allInsights = [], isLoading } = useQuery({
    queryKey: ["daily-briefing"],
    queryFn: () => fetchList(),
  });

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of allInsights) map.set(i.class_id, i.class_name || "כיתה");
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [allInsights]);

  const insights = useMemo(() => {
    const rows = allInsights.filter((i) => classFilter === "all" || i.class_id === classFilter);
    const bySeverity = (a: DailyInsight, b: DailyInsight) =>
      (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) ||
      (a.created_at < b.created_at ? 1 : -1);
    return [...rows].sort((a, b) =>
      sortBy === "class"
        ? (a.class_name || "").localeCompare(b.class_name || "", "he") || bySeverity(a, b)
        : bySeverity(a, b),
    );
  }, [allInsights, classFilter, sortBy]);

  const fetchPending = useServerFn(listPendingUpdates);
  const { data: pending = [] } = useQuery({
    queryKey: ["pending-updates"],
    queryFn: () => fetchPending(),
  });

  const generateMut = useMutation({
    mutationFn: () => runGenerate(),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["daily-briefing"] });
      toast.success(
        res.created > 0
          ? `נמצאו ${res.created} תובנות חדשות (נסרקו ${res.scanned} תלמידים)`
          : `לא נמצאו התראות חדשות (נסרקו ${res.scanned} תלמידים)`,
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "הסריקה נכשלה"),
  });

  const dismissMut = useMutation({
    mutationFn: (id: string) => runDismiss({ data: { id } }),
    onMutate: (id) => {
      const prev = qc.getQueryData<DailyInsight[]>(["daily-briefing"]);
      qc.setQueryData<DailyInsight[]>(["daily-briefing"], (old) =>
        (old ?? []).filter((i) => i.id !== id),
      );
      return { prev };
    },
    onError: (e: unknown, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["daily-briefing"], ctx.prev);
      toast.error(e instanceof Error ? e.message : "סילוק התובנה נכשל");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["daily-briefing"] }),
  });

  return (
    <Card dir="rtl">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-5 w-5 text-primary" aria-hidden />
          תובנות יומיות
          {insights.length > 0 && <Badge variant="secondary">{insights.length}</Badge>}
          <Badge variant="outline">{hebrewDayInfo().full}</Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            aria-busy={generateMut.isPending}
          >
            <RefreshCw
              className={`ms-2 h-4 w-4 ${generateMut.isPending ? "animate-spin" : ""}`}
              aria-hidden
            />
            רענן תובנות
          </Button>
          <p className="sr-only" role="status" aria-live="polite">
            {generateMut.isPending ? "סורק נוכחות…" : ""}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {pending.length > 0 && (
          <p className="mb-3 text-xs text-muted-foreground">
            <Link to="/review" className="underline underline-offset-2 hover:text-foreground">
              {pending.length} אירועים חריגים ממתינים לאישור
            </Link>
          </p>
        )}
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">טוען תובנות…</p>
        ) : insights.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-md bg-muted/50 py-6 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
            אין התראות כרגע — הכל תקין
          </div>
        ) : (
          <ul className="space-y-3">
            {insights.map((insight) => {
              const style = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.low!;
              return (
                <li
                  key={insight.id}
                  className={`rounded-lg border p-3 ${style.wrapper}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{insight.title}</span>
                          <Badge className={style.badge}>{style.label}</Badge>
                          {insight.class_name && (
                            <Badge variant="outline">{insight.class_name}</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {insight.description}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          נרשם: {hebrewDateTime(insight.created_at)}
                        </p>
                        {insight.suggested_action && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            הצעה: {insight.suggested_action}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      aria-label={`סלק את ההתראה: ${insight.title}`}
                      onClick={() => dismissMut.mutate(insight.id)}
                      disabled={dismissMut.isPending}
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-start gap-2">
                    {insight.action_link && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void navigate({ to: insight.action_link! })}
                      >
                        עבור לפעולה
                      </Button>
                    )}
                    {insight.student_id && (
                      <StudentHistoryDialog
                        studentId={insight.student_id}
                        studentName={insight.student_name}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
