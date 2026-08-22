import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { listRecurringRules } from "@/lib/recurring-rules.functions";
import {
  RULE_EFFECT_LABEL, timeLabel, type RecurringRule,
} from "@/lib/recurring-rules";
import { Badge } from "@/components/ui/badge";

const DAY_LABEL: Record<string, string> = {
  sun: "ראשון", mon: "שני", tue: "שלישי", wed: "רביעי", thu: "חמישי", fri: "שישי", sat: "שבת",
};

/**
 * סיכום קומפקטי של הכללים הקבועים הפעילים בראש מסך המערכת,
 * עם קישור למסך הניהול המלא (/schedule-rules).
 */
export function RecurringRulesSummary({ classId }: { classId: string }) {
  const listFn = useServerFn(listRecurringRules);
  const { data: rules = [] } = useQuery({
    queryKey: ["recurring-rules", classId],
    queryFn: () => listFn({ data: { classId } }),
  });

  const active = (rules as RecurringRule[]).filter((r) => r.active);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-sm">
      <span className="flex items-center gap-1 font-medium">
        <CalendarClock className="h-4 w-4 text-amber" aria-hidden="true" /> כללים קבועים פעילים:
      </span>
      {active.map((r) => (
        <Badge key={r.id} variant="secondary" className="font-normal">
          {r.kind === "rosh_chodesh" ? "ראש חודש" : `יום ${DAY_LABEL[r.day_key ?? ""] ?? r.day_key}`}
          {" — "}
          {RULE_EFFECT_LABEL[r.effect]}
          {r.hour != null ? ` ${timeLabel(r.hour, r.minute)}` : ""}
        </Badge>
      ))}
      <Link to="/schedule-rules" className="text-xs text-primary hover:underline">
        ניהול מלא
      </Link>
    </div>
  );
}
