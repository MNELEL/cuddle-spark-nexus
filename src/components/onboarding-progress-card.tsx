import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, X, ArrowUpLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getOnboardingState, updateOnboardingState } from "@/lib/onboarding.functions";

/** Compact "המדריך החכם" progress banner, shown until the הרב finishes or dismisses it. */
export function OnboardingProgressCard() {
  const fetchState = useServerFn(getOnboardingState);
  const update = useServerFn(updateOnboardingState);
  const qc = useQueryClient();

  const { data: state } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => fetchState(),
    retry: false,
  });

  const dismiss = useMutation({
    mutationFn: () => update({ data: { dismissed: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-state"] }),
  });

  if (!state || state.dismissed) return null;
  if (state.completedCount >= state.total) return null;

  const percent = Math.round((state.completedCount / state.total) * 100);

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
        <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium">
            המדריך החכם — {state.completedCount} מתוך {state.total} שלבים הושלמו
          </p>
          <Progress value={percent} aria-label={`התקדמות במדריך החכם: ${percent} אחוז`} />
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link to="/onboarding">
              המשך במדריך
              <ArrowUpLeft className="ms-1 h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-9 min-w-9"
            onClick={() => dismiss.mutate()}
            aria-label="הסתר את כרטיס המדריך החכם"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
