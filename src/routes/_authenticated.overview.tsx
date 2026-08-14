import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Archive, Building2, ChevronLeft, ClipboardList, GraduationCap, Hourglass, Users,
} from "lucide-react";
import { getInstitutionDashboard } from "@/lib/institution-dashboard.functions";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({
    meta: [
      { title: "דשבורד מוסדי מרוכז | הכיתה שלי" },
      { name: "description", content: "תמונת מצב כלל-מוסדית: כיתות, מלמדים, משימות פתוחות והתקדמות לימודית." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "דשבורד מוסדי מרוכז | הכיתה שלי" },
      { property: "og:description", content: "תמונת מצב כלל-מוסדית לניהול המוסד." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  const fetchDashboard = useServerFn(getInstitutionDashboard);
  const q = useQuery({
    queryKey: ["institution-dashboard"],
    queryFn: () => fetchDashboard(),
    retry: false,
  });

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4" aria-busy="true" aria-label="טוען דשבורד">
        <Skeleton className="h-9 w-64 rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">אין לך הרשאת מנהל מוסד</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>הדשבורד המרוכז זמין למנהלי מוסד ומנהלי מערכת בלבד.</p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/classes">חזרה לכיתות שלי</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = q.data;

  const metrics = [
    { label: "כיתות פעילות", value: d.activeClasses, icon: GraduationCap, to: "/institution" as const },
    { label: "מלמדים פעילים", value: d.teachers, icon: Users, to: "/institution" as const },
    { label: "תלמידים", value: d.students, icon: Building2, to: "/classes" as const },
    { label: "כיתות בארכיון", value: d.archivedClasses, icon: Archive, to: "/institution" as const },
  ];

  const tasks = [
    { label: "בקשות הרשאה ממתינות", value: d.pendingAccessRequests, to: "/user-management" as const, cta: "לניהול המשתמשים" },
    { label: "בקשות הארכת ניסיון ממתינות", value: d.pendingTrialRequests, to: "/user-management" as const, cta: "לניהול המשתמשים" },
    { label: "עלונים שטרם פורסמו", value: d.draftBulletins, to: "/institution" as const, cta: "לכיתות המוסד" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">דשבורד מוסדי מרוכז</h1>
          <p className="text-sm text-muted-foreground">
            {d.institutionName} · {d.role === "admin" ? "מנהל מערכת" : "מנהל מוסד (צפייה)"}
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/institution">
            לוח המוסד המפורט <ChevronLeft className="ms-1 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="rounded-2xl">
            <CardContent className="p-4">
              <Link to={m.to} className="flex items-center gap-3 focus-visible:outline-none">
                <m.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="font-mono-tabular text-2xl font-bold">{m.value}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.label}</div>
                </div>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" /> משימות פתוחות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {tasks.map((t) => (
              <li key={t.label} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant={t.value > 0 ? "default" : "secondary"} className="font-mono-tabular">
                    {t.value}
                  </Badge>
                  <span className="text-sm">{t.label}</span>
                </div>
                <Button asChild variant="ghost" size="sm" className="rounded-xl">
                  <Link to={t.to}>{t.cta} <ChevronLeft className="ms-1 h-4 w-4" aria-hidden="true" /></Link>
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Hourglass className="h-4 w-4 text-primary" aria-hidden="true" /> התקדמות מלמדים בתוכנית הלימודים
          </CardTitle>
        </CardHeader>
        <CardContent>
          {d.progress.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">אין כיתות פעילות במוסד.</p>
          ) : d.progress.every((p) => p.totalUnits === 0) ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              טרם הוגדרו יחידות לימוד בכיתות המוסד — לאחר הגדרתן תוצג כאן ההתקדמות.
            </p>
          ) : (
            <ul className="space-y-4">
              {d.progress.map((p) => {
                const pct = p.totalUnits > 0 ? Math.round((p.completedUnits / p.totalUnits) * 100) : 0;
                return (
                  <li key={p.classId} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        {p.className} · <span className="text-muted-foreground">{p.teacherName}</span>
                      </span>
                      <span className="shrink-0 font-mono-tabular text-xs text-muted-foreground">
                        {p.completedUnits}/{p.totalUnits} ({pct}%)
                      </span>
                    </div>
                    <Progress value={pct} aria-label={`התקדמות ${p.className}`} />
                    <div className="text-end">
                      <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                        <Link to="/classes/$classId" params={{ classId: p.classId }}>לכיתה</Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
