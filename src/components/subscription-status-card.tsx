import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, BadgeCheck, Mail } from "lucide-react";
import { getMyTrialStatus } from "@/lib/trial.functions";
import { isAdmin } from "@/lib/user-roles.functions";
import { TrialExtensionRequestButton } from "@/components/trial-extension-request-button";

const ADMIN_EMAIL = "nm0527603669@gmail.com";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

/** Shows the signed-in user's free-trial / subscription state. */
export function SubscriptionStatusCard() {
  const fn = useServerFn(getMyTrialStatus);
  const adminFn = useServerFn(isAdmin);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-trial-status"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });
  const { data: viewerIsAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => adminFn(),
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
            <div className="space-y-2 rounded-md border bg-muted/40 p-3">
              <p className="text-sm">
                {data.active
                  ? "הארכת המנוי מאושרת על ידי מנהל המערכת."
                  : "כדי להמשיך להשתמש בכל התכונות נדרש אישור של מנהל המערכת."}
              </p>
              <div className="flex flex-wrap gap-2">
                <TrialExtensionRequestButton size="sm" />
                <Button asChild variant="outline" size="sm">
                  <a href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent("בקשת אישור מנוי")}`}>
                    <Mail className="ms-1 h-4 w-4" /> פנייה למנהל המערכת
                  </a>
                </Button>
                {viewerIsAdmin && (
                  <Button asChild size="sm">
                    <Link to="/user-management">
                      <BadgeCheck className="ms-1 h-4 w-4" /> אישור מנויים למשתמשים
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
