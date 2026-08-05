import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock } from "lucide-react";
import { getMyTrialStatus } from "@/lib/trial.functions";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

/** Shows the signed-in user's free-trial / subscription state. */
export function SubscriptionStatusCard() {
  const fn = useServerFn(getMyTrialStatus);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-trial-status"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-5 w-5" /> מנוי ותקופת ניסיון
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : isError || !data ? (
          <p className="text-sm text-muted-foreground">טעינת מצב המנוי נכשלה. נסה לרענן את העמוד.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {data.active ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">תקופת ניסיון פעילה</Badge>
              ) : (
                <Badge variant="destructive">תקופת הניסיון הסתיימה</Badge>
              )}
              {data.active && (
                <span className="text-sm font-semibold">
                  נותרו {data.daysLeft} ימים
                </span>
              )}
            </div>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">תאריך התחלה</dt>
                <dd className="font-medium">{formatDate(data.startedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">תאריך סיום</dt>
                <dd className="font-medium">{formatDate(data.endsAt)}</dd>
              </div>
            </dl>
            {!data.active && (
              <p className="text-sm text-muted-foreground">
                כדי להמשיך להשתמש בכל התכונות, פנה אלינו במייל nm0527603669@gmail.com להמשך המנוי.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
