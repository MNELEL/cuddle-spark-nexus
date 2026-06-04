import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClass } from "@/lib/classes.functions";
import { listStudents } from "@/lib/students.functions";
import { Button } from "@/components/ui/button";
import { ArrowRight, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/classes/$classId/display")({
  component: DisplayMode,
});

type Student = {
  id: string; name: string;
  seat_row: number | null; seat_col: number | null;
};

function DisplayMode() {
  const { classId } = Route.useParams();
  const getC = useServerFn(getClass);
  const listS = useServerFn(listStudents);

  const { data: cls } = useQuery({ queryKey: ["class", classId], queryFn: () => getC({ data: { id: classId } }) });
  const { data: students = [] } = useQuery({
    queryKey: ["students", classId],
    queryFn: () => listS({ data: { classId } }),
  }) as { data: Student[] };

  const rows = cls?.grid_rows ?? 5;
  const cols = cls?.grid_cols ?? 6;
  const hidden = new Set<string>(((cls?.hidden_seats as string[] | undefined) ?? []));
  const seated = new Map<string, Student>();
  for (const s of students) {
    if (s.seat_row !== null && s.seat_col !== null) seated.set(`${s.seat_row}:${s.seat_col}`, s);
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background p-4 md:p-8 print:p-0">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <Link to="/classes/$classId" params={{ classId }}>
            <Button variant="ghost" size="sm">
              <ArrowRight className="ms-1 h-4 w-4" /> חזרה לכיתה
            </Button>
          </Link>
          <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight">
            {cls?.name ?? "..."} — סידור הושבה
          </h1>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="ms-1 h-4 w-4" /> הדפסה
          </Button>
        </div>

        <div className="hidden print:block text-center text-2xl font-bold mb-4">
          {cls?.name} — סידור הושבה
        </div>

        <div className="rounded-2xl border-2 border-amber/40 bg-card p-6 md:p-10 shadow-lg print:shadow-none print:border-foreground">
          <div className="mb-4 rounded-md bg-amber/15 py-2 text-center text-sm md:text-lg font-bold tracking-wide text-amber">
            חזית הכיתה · לוח
          </div>
          <div
            className="grid gap-2 md:gap-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
          >
            {Array.from({ length: rows }).flatMap((_, r) =>
              Array.from({ length: cols }).map((__, c) => {
                const k = `${r}:${c}`;
                if (hidden.has(k)) {
                  return <div key={k} className="aspect-[5/3] rounded-md border border-dashed border-muted/40 print:hidden" />;
                }
                const child = seated.get(k);
                return (
                  <div
                    key={k}
                    className={`flex aspect-[5/3] items-center justify-center rounded-lg border p-2 text-center transition ${
                      child ? "border-amber/40 bg-amber/5" : "border-dashed border-muted bg-muted/10"
                    }`}
                  >
                    {child ? (
                      <span className="font-display text-lg md:text-3xl font-bold leading-tight text-foreground break-words">
                        {child.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">ריק</span>
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground print:hidden">
          {students.filter((s) => s.seat_row !== null).length} / {students.length} תלמידים משובצים
        </div>
      </div>
    </div>
  );
}