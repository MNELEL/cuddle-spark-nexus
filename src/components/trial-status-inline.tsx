import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Gift, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getMyTrialStatus } from "@/lib/trial.functions";

/**
 * Shows the signed-in user's free-month trial state directly on the auth screen,
 * so registration and eligibility live in the same place.
 */
export function TrialStatusInline({ continueTo }: { continueTo: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { user, loading } = useAuth();
  const fetchTrial = useServerFn(getMyTrialStatus);
  const navigate = useNavigate();

  const trial = useQuery({
    queryKey: ["trial-status", user?.id],
    queryFn: () => fetchTrial(),
    enabled: mounted && !!user,
    retry: false,
  });

  if (!mounted || loading || !user) return null;

  return (
    <div
      dir="rtl"
      aria-live="polite"
      className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"
    >
      {trial.isLoading ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          בודקים את מצב תקופת הניסיון שלך...
        </p>
      ) : trial.data?.active ? (
        <>
          <p className="flex items-center gap-2 font-medium">
            <Gift className="h-4 w-4 text-primary" aria-hidden="true" />
            הניסיון החינמי שלך פעיל — נותרו {trial.data.daysLeft} ימים
          </p>
          <p className="mt-1 text-muted-foreground">כל הכלים והתוכן פתוחים לך בתקופה זו.</p>
          <Button size="sm" className="mt-3" onClick={() => navigate({ href: continueTo })}>
            המשך למערכת
          </Button>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 font-medium">
            <Clock className="h-4 w-4 text-amber" aria-hidden="true" />
            תקופת הניסיון שלך הסתיימה
          </p>
          <p className="mt-1 text-muted-foreground">
            הבלוג ומחולל הקבוצות נשארים פתוחים. לשדרוג — פנה אלינו בעמוד התמיכה.
          </p>
          <Link to="/support" className="mt-3 inline-block">
            <Button size="sm" variant="outline">
              לעמוד התמיכה
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}