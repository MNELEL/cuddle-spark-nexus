import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronUp, History, Loader2 } from "lucide-react";
import { listTeacherAuditLog } from "@/lib/institution-teachers.functions";
import { TEACHER_AUDIT_ACTIONS, TEACHER_AUDIT_LABEL, formatAuditDate } from "@/lib/teacher-audit";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Change history for teacher records: every edit of "teaching style & notes"
 * and every class↔teacher assignment, with who made it and when.
 * Pass `teacherId` to scope the list to a single teacher.
 */
export function TeacherChangeHistory({
  teacherId = null,
  defaultOpen = false,
}: {
  teacherId?: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const listFn = useServerFn(listTeacherAuditLog);

  const historyQ = useQuery({
    queryKey: ["teacher-audit-log", teacherId],
    queryFn: () => listFn({ data: { teacherId, limit: 30 } }),
    enabled: open,
  });

  const entries = historyQ.data ?? [];

  return (
    <Card className="print:hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-6 py-4 text-start"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 text-base font-bold">
          <History className="h-5 w-5 text-muted-foreground" />
          היסטוריית שינויים — סגנון הוראה ושיוכי כיתות
        </span>
        {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>
      {open && (
        <CardContent className="border-t py-5">
          {historyQ.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> טוען היסטוריה…
            </div>
          ) : historyQ.isError ? (
            <p className="text-sm text-destructive">טעינת ההיסטוריה נכשלה. נסה שוב.</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              עדיין לא נרשמו שינויים. כל עריכה של הערות וסגנון הוראה, וכל שיוך כיתה למלמד, יופיעו כאן עם השם והתאריך.
            </p>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="rounded-md border bg-card p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{TEACHER_AUDIT_LABEL[e.action] ?? "שינוי"}</Badge>
                    <span className="font-medium">{e.actorName}</span>
                    <span className="text-xs text-muted-foreground">{formatAuditDate(e.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {e.action === TEACHER_AUDIT_ACTIONS.assignClass ? (
                      <>
                        כיתה {e.className ?? "—"} הועברה
                        {e.previousTeacherName ? ` מ${e.previousTeacherName}` : ""}
                        {e.teacherName ? ` ל${e.teacherName}` : ""}
                      </>
                    ) : (
                      <>עודכנו ההערות של {e.teacherName ?? "מלמד"}</>
                    )}
                  </p>
                  {e.action === TEACHER_AUDIT_ACTIONS.notes && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md bg-muted/60 p-2 text-xs">
                        <div className="mb-1 font-semibold">לפני</div>
                        <p className="whitespace-pre-wrap break-words">{e.before?.trim() || "— ריק —"}</p>
                      </div>
                      <div className="rounded-md bg-accent/40 p-2 text-xs">
                        <div className="mb-1 font-semibold">אחרי</div>
                        <p className="whitespace-pre-wrap break-words">{e.after?.trim() || "— ריק —"}</p>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}