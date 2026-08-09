import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Link2, Link2Off } from "lucide-react";
import { getClassLibraryLink } from "@/lib/class-assignments.functions";
import { Button } from "@/components/ui/button";

/** Shows whether the class is connected to the library through a lesson or a bulletin. */
export function ClassLibraryStatus({ classId }: { classId: string }) {
  const fn = useServerFn(getClassLibraryLink);
  const { data, isLoading } = useQuery({
    queryKey: ["class-library-link", classId],
    queryFn: () => fn({ data: { classId } }),
  });

  if (isLoading || !data) return null;

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
        data.connected ? "border-emerald-500/40 bg-emerald-500/5" : "border-amber/40 bg-amber/10"
      }`}
    >
      <span className="flex items-center gap-2">
        {data.connected ? (
          <Link2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        ) : (
          <Link2Off className="h-4 w-4 text-amber" aria-hidden="true" />
        )}
        {data.connected ? (
          <span>
            הספרייה מחוברת לכיתה — {data.lessonCount} שיעורים ו-{data.bulletinCount} עלונים מקושרים לחומרי ההוראה.
          </span>
        ) : (
          <span>הספרייה עדיין לא מחוברת לכיתה. חבר חומר הוראה דרך שיעור במערכת השבועית או דרך עלון.</span>
        )}
      </span>
      <div className="flex shrink-0 gap-2">
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/weekly-schedule/$classId" params={{ classId }}>
            <BookOpen className="ms-1 h-4 w-4" aria-hidden="true" /> חבר דרך שיעור
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="rounded-xl">
          <Link to="/bulletins/$classId" params={{ classId }}>חבר דרך עלון</Link>
        </Button>
      </div>
    </div>
  );
}
