import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { getSchoolHome } from "@/lib/school.functions";
import { SchoolClassCard } from "@/components/school-class-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/school/teacher/$userId")({
  head: () => ({
    meta: [
      { title: "דף מלמד · הכיתה שלי" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TeacherPage,
});

function TeacherPage() {
  const { userId } = Route.useParams();
  const fn = useServerFn(getSchoolHome);
  const { data, isLoading, error } = useQuery({ queryKey: ["school-home"], queryFn: () => fn() });

  const back = (
    <Link to="/school" className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
      <ArrowRight className="h-4 w-4" aria-hidden="true" /> חזרה לבית הספר
    </Link>
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4" aria-busy="true" aria-label="טוען את דף המלמד">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const teacher = data?.isManager ? data.teachers.find((t) => t.userId === userId) : undefined;
  if (error || !data || !teacher) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <h1 className="font-display text-2xl font-bold">דף המלמד לא זמין</h1>
        <p className="text-sm text-muted-foreground" role="status">
          {error instanceof Error
            ? error.message
            : data && !data.isManager
              ? "הדף זמין למנהל המוסד בלבד."
              : "המלמד לא נמצא במוסד שלך."}
        </p>
        <Link to="/school"><Button variant="outline">חזרה לבית הספר</Button></Link>
      </div>
    );
  }

  const active = teacher.classes.filter((c) => c.status !== "archived");
  const archived = teacher.classes.filter((c) => c.status === "archived");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {back}
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold">{teacher.name}</h1>
          {teacher.titleLabel && <Badge variant="secondary">{teacher.titleLabel}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{data.institution?.name}</p>
      </header>

      <section aria-labelledby="teacher-classes" className="space-y-2">
        <h2 id="teacher-classes" className="font-bold">כיתות</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין למלמד כיתות פעילות במוסד.</p>
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
    </div>
  );
}
