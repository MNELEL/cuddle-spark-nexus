import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, ChevronLeft } from "lucide-react";
import { getSchoolHome, SCHOOL_KIND_LABEL } from "@/lib/school.functions";
import { SchoolClassCard } from "@/components/school-class-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/school/")({
  head: () => ({
    meta: [
      { title: "בית הספר · הכיתה שלי" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SchoolPage,
});

function SchoolPage() {
  const fn = useServerFn(getSchoolHome);
  const { data, isLoading, error } = useQuery({ queryKey: ["school-home"], queryFn: () => fn() });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4" aria-busy="true" aria-label="טוען את בית הספר">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <p className="text-sm text-muted-foreground" role="alert">
          {error instanceof Error ? error.message : "טעינת בית הספר נכשלה."}
        </p>
        <Link to="/classes" className="mt-4 inline-flex"><Button variant="outline">לכיתות שלי</Button></Link>
      </div>
    );
  }

  const active = data.myClasses.filter((c) => c.status !== "archived");
  const archived = data.myClasses.filter((c) => c.status === "archived");

  if (!data.institution) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <h1 className="font-display text-2xl font-bold">בית הספר</h1>
        <p className="text-sm text-muted-foreground">
          החשבון עדיין לא משויך למוסד. אפשר להמשיך לעבוד עם הכיתות שלך.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/classes"><Button>לכיתות שלי</Button></Link>
          {data.isSystemAdmin && <Link to="/user-management"><Button variant="outline">ניהול משתמשים</Button></Link>}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold">{data.institution.name}</h1>
          <Badge variant="secondary">{SCHOOL_KIND_LABEL[data.institution.kind]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {data.roleLabels.join(" · ")}
          {data.myTitle ? ` · ${data.myTitle}` : ""}
        </p>
        {data.totals && (
          <p className="text-sm text-muted-foreground">
            {data.totals.activeClasses} כיתות פעילות · {data.totals.students} תלמידים · {data.totals.teachers} מלמדים
          </p>
        )}
      </header>

      <section aria-labelledby="my-classes" className="space-y-2">
        <h2 id="my-classes" className="font-bold">הכיתות שלי</h2>
        {active.length === 0 ? (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-muted-foreground">
              <span>אין לך כיתות פעילות בבעלותך.</span>
              <Link to="/classes"><Button size="sm" variant="outline">לרשימת הכיתות</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2">
            {active.map((c) => <SchoolClassCard key={c.id} cls={c} />)}
          </div>
        )}
        {archived.length > 0 && (
          <details className="rounded-2xl border bg-card/50">
            <summary className="cursor-pointer select-none p-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
              בארכיון ({archived.length})
            </summary>
            <div className="grid gap-2 p-3 pt-0">
              {archived.map((c) => <SchoolClassCard key={c.id} cls={c} />)}
            </div>
          </details>
        )}
      </section>

      {data.isManager && (
        <section aria-labelledby="teachers" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="teachers" className="font-bold">המלמדים</h2>
            <Link to="/institution"><Button size="sm" variant="outline">דשבורד המוסד</Button></Link>
          </div>
          <Card>
            <CardHeader className="sr-only"><CardTitle>רשימת המלמדים</CardTitle></CardHeader>
            <CardContent className="p-0">
              {data.teachers.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">עדיין אין מלמדים משויכים למוסד.</p>
              ) : (
                <ul className="divide-y">
                  {data.teachers.map((t) => {
                    const activeCount = t.classes.filter((c) => c.status !== "archived").length;
                    const inner = (
                      <>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{t.name}</span>
                            {t.titleLabel && <Badge variant="secondary">{t.titleLabel}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{activeCount} כיתות פעילות</p>
                        </div>
                        {t.userId && <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      </>
                    );
                    return (
                      <li key={t.userId ?? t.name}>
                        {t.userId ? (
                          <Link
                            to="/school/teacher/$userId"
                            params={{ userId: t.userId }}
                            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/50"
                          >
                            {inner}
                          </Link>
                        ) : (
                          <div className="flex items-center justify-between gap-3 px-4 py-3">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
