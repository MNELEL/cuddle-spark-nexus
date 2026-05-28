import { tierColorClasses, tierLabel, type StudentScore } from "@/lib/performance-score";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";

export function ScoreBadge({ score, size = "md" }: { score: StudentScore; size?: "sm" | "md" | "lg" }) {
  const c = tierColorClasses(score.tier);
  const sizeCls =
    size === "sm" ? "text-xs px-1.5 py-0.5 gap-1" :
    size === "lg" ? "text-base px-3 py-1.5 gap-2" :
    "text-sm px-2 py-1 gap-1.5";
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center rounded-md border ${c.bg} ${c.text} ${c.border} ${sizeCls} font-mono-tabular font-bold cursor-help`}
            aria-label={`ציון ביצועים ${score.score} מתוך 100 — ${tierLabel(score.tier)}`}
          >
            <Sparkles className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
            {score.score}
          </span>
        </TooltipTrigger>
        <TooltipContent className="text-xs space-y-1" dir="rtl">
          <div className="font-bold mb-1">ציון ביצועים: {score.score}/100 ({tierLabel(score.tier)})</div>
          <div className="grid grid-cols-2 gap-x-3 font-mono-tabular">
            <span className="text-muted-foreground">ציונים (40%):</span>
            <span>{score.breakdown.grades !== null ? `${score.breakdown.grades}%` : "—"} <span className="text-muted-foreground">({score.raw.gradesCount})</span></span>
            <span className="text-muted-foreground">נוכחות (30%):</span>
            <span>{score.breakdown.attendance !== null ? `${score.breakdown.attendance}%` : "—"} <span className="text-muted-foreground">({score.raw.attendanceCount})</span></span>
            <span className="text-muted-foreground">התנהגות (30%):</span>
            <span>{score.breakdown.behavior} <span className="text-muted-foreground">({score.raw.behaviorTotal >= 0 ? "+" : ""}{score.raw.behaviorTotal})</span></span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}