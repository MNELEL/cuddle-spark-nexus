import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getStudentTimeline, type TimelineKind } from "@/lib/orchestrator.functions";
import { toHebrewDateFull } from "@/lib/hebrew-date";

const KIND_LABELS: Record<TimelineKind, string> = {
  attendance: "נוכחות",
  grade: "ציונים",
  behavior: "התנהגות",
  discipline: "משמעת",
  parent_call: "הורים",
  event: "לוח",
};

const KINDS = Object.keys(KIND_LABELS) as TimelineKind[];

/** מאגר ההיסטוריה של תלמיד אחד — ציר זמן מאוחד עם חיפוש וסינון. */
export function StudentHistoryDialog({
  studentId,
  studentName,
  trigger,
}: {
  studentId: string;
  studentName?: string | null;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<TimelineKind | "all">("all");
  const fetchTimeline = useServerFn(getStudentTimeline);

  const { data, isLoading } = useQuery({
    queryKey: ["student-timeline", studentId],
    queryFn: () => fetchTimeline({ data: { studentId } }),
    enabled: open,
  });

  const items = useMemo(() => {
    const needle = q.trim();
    return (data?.items ?? []).filter(
      (i) =>
        (kind === "all" || i.kind === kind) &&
        (!needle || `${i.title} ${i.detail} ${i.date}`.includes(needle)),
    );
  }, [data, q, kind]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <History className="ms-1 h-4 w-4" aria-hidden /> היסטוריית התלמיד
          </Button>
        )}
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            היסטוריה — {data?.studentName || studentName || "תלמיד"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute end-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש בהיסטוריה…"
              className="pe-8"
              aria-label="חיפוש בהיסטוריית התלמיד"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={kind === "all" ? "default" : "outline"}
              className="h-auto py-1 text-xs"
              onClick={() => setKind("all")}
            >
              הכל
            </Button>
            {KINDS.map((k) => (
              <Button
                key={k}
                size="sm"
                variant={kind === k ? "default" : "outline"}
                className="h-auto py-1 text-xs"
                onClick={() => setKind(k)}
              >
                {KIND_LABELS[k]}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">טוען היסטוריה…</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">אין רישומים תואמים</p>
          ) : (
            <ul className="space-y-2">
              {items.map((i, idx) => (
                <li key={`${i.kind}-${i.date}-${idx}`} className="rounded-lg border p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{KIND_LABELS[i.kind]}</Badge>
                    <span className="text-sm font-medium">{i.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {toHebrewDateFull(i.date) ?? i.date} · {i.date}
                  </p>
                  {i.detail && <p className="mt-1 text-sm text-muted-foreground">{i.detail}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
