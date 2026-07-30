import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { ArrowRight, Sparkles, User } from "lucide-react";
import { listStudents } from "@/lib/students.functions";
import { getClass } from "@/lib/classes.functions";

export const Route = createFileRoute("/_authenticated/student-view/$classId")({
  component: StudentViewPage,
  head: () => ({
    meta: [
      { title: "מסך תלמידים · הכיתה שלי" },
      { name: "description", content: "מסך תצוגה פשוט לתלמידים — שמות בלבד, ללא מידע רגיש." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

// This screen is meant to be projected/displayed in front of the class
// itself, so — deliberately, unlike every other screen in the app — it must
// never render anything beyond a student's first name. The `listStudents`
// server function returns full rows (notes, accommodation info, parent
// contact details, etc. — see students.functions.ts), but this component
// only ever reads the `name` field off each row and immediately reduces it
// to a first name before it touches any JSX. No other field from the
// response is referenced anywhere below.
function firstNameOnly(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function StudentViewPage() {
  const { classId } = Route.useParams();
  const listS = useServerFn(listStudents);
  const getC = useServerFn(getClass);

  const { data: cls } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getC({ data: { id: classId } }),
  });
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", classId],
    queryFn: () => listS({ data: { classId } }),
  });

  const displayNames = useMemo(
    () => (students as { id: string; name: string }[]).map((s) => ({ id: s.id, name: firstNameOnly(s.name) })),
    [students],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5" dir="rtl">
      <div className="flex items-center gap-2 print:hidden">
        <Link to="/classes/$classId" params={{ classId }} className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
      </div>

      <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-2xl dark:bg-green-900/30">🌟</div>
        <h1 className="font-display text-2xl font-bold">התלמידים שלנו</h1>
        {cls?.name && <p className="mt-1 text-sm text-muted-foreground">{cls.name} · כיתה יקרה ומיוחדת</p>}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[100px] animate-pulse rounded-2xl border bg-muted/40" />
          ))}
        </div>
      ) : displayNames.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {displayNames.map((student) => (
            <div
              key={student.id}
              className="flex min-h-[100px] flex-col items-center justify-center rounded-2xl border bg-card p-4 shadow-sm"
            >
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/40">
                <User className="h-6 w-6 text-primary" />
              </div>
              <p className="text-center text-sm font-semibold">{student.name}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <Sparkles className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">אין תלמידים להצגה</p>
        </div>
      )}
    </div>
  );
}
