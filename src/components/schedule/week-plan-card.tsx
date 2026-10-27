import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getWeekPlan } from "@/lib/pacing-plan.functions";
import { isoDate, weekStartIso } from "@/lib/schedule-view";

/** מה מתוכנן להספיק בשבוע, מתוך התכנון השנתי. לא מוצג כשאין תוכנית לשבוע. */
export function WeekPlanCard({ classId, weekOf }: { classId: string; weekOf?: string | null }) {
  const fn = useServerFn(getWeekPlan);
  const [week, setWeek] = useState<string | null>(null);
  useEffect(() => { setWeek(weekStartIso(weekOf || isoDate(new Date()))); }, [weekOf]);
  const { data } = useQuery({
    queryKey: ["pacing-week", classId, week],
    enabled: !!week,
    queryFn: () => fn({ data: { classId, weekStart: week! } }),
  });
  if (!data || data.length === 0) return null;
  return (
    <section aria-label="מה מתוכנן להספיק בשבוע" className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-primary" aria-hidden="true" /> מתוכנן להספיק השבוע</h2>
        <Link to="/pacing/$classId" params={{ classId }} className="text-xs text-muted-foreground underline">לתכנון השנתי</Link>
      </div>
      <ul className="space-y-1 text-sm">
        {data.map((r) => (
          <li key={r.subject} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.subject}:</span>
            <span>{[r.range, r.topics].filter(Boolean).join(" · ") || "חזרה"}</span>
            <span className="text-xs text-muted-foreground">({r.lessons} שיעורים)</span>
            {r.status === "draft" && <Badge variant="outline">טיוטה</Badge>}
          </li>
        ))}
      </ul>
    </section>
  );
}
