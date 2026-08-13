import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Link2, Link2Off } from "lucide-react";
import { getClassLibraryLink } from "@/lib/class-assignments.functions";
import { Button } from "@/components/ui/button";
import { ConnectLibraryDialog } from "@/components/connect-library-dialog";
import { LibraryLinkInfo } from "@/components/library-link-info";

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
      <span className="flex items-start gap-2">
        {data.connected ? (
          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        ) : (
          <Link2Off className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden="true" />
        )}
        <span className="flex items-center gap-1 font-semibold">
          חיבור לכיתה
          <LibraryLinkInfo classId={classId} />
        </span>
        {data.connected ? (
          <span>
            חומרי הוראה מהספרייה משויכים לכיתה — {data.lessonCount} שיעורים ו-{data.bulletinCount} עלונים (דפי קשר להורים)
            כבר מפנים לחומר מהספרייה, כך שכל מי שנכנס לשיעור או לעלון רואה מיד את החומר הנלמד.
          </span>
        ) : (
          <span>
            עדיין לא שויך שום חומר הוראה מהספרייה לכיתה הזו. שיוך חומר מאפשר לפתוח את החומר ישירות מתוך השיעור
            במערכת השבועית, או לצרף אותו לעלון (דף הקשר) שנשלח להורים.
          </span>
        )}
      </span>
      <div className="flex shrink-0 gap-2">
        <ConnectLibraryDialog classId={classId} />
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to="/weekly-schedule/$classId" params={{ classId }}>
            <BookOpen className="ms-1 h-4 w-4" aria-hidden="true" /> שייך דרך שיעור במערכת
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="rounded-xl">
          <Link to="/bulletins/$classId" params={{ classId }}>שייך דרך עלון להורים</Link>
        </Button>
      </div>
    </div>
  );
}
