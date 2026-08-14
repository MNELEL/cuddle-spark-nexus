import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Unlink, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  assignClassToTeacher,
  detachClassFromMyInstitution,
  listInstitutionClassAssignments,
  listInstitutionTeachers,
  reattachClassToMyInstitution,
  type TeacherClassRow,
} from "@/lib/institution-teachers.functions";

/** Seconds the undo action stays available after a class is removed. */
const UNDO_SECONDS = 8;

/** Which teacher teaches which class, with assign / detach actions for admins. */
export function InstitutionClassAssignmentsCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listInstitutionClassAssignments);
  const teachersFn = useServerFn(listInstitutionTeachers);
  const assignFn = useServerFn(assignClassToTeacher);
  const detachFn = useServerFn(detachClassFromMyInstitution);
  const reattachFn = useServerFn(reattachClassToMyInstitution);

  const [editing, setEditing] = useState<TeacherClassRow | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [detaching, setDetaching] = useState<TeacherClassRow | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const rowsQ = useQuery({ queryKey: ["institution-class-assignments"], queryFn: () => listFn() });
  const teachersQ = useQuery({
    queryKey: ["institution-teachers"],
    queryFn: () => teachersFn(),
    enabled: canEdit,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["institution-class-assignments"] });
    void qc.invalidateQueries({ queryKey: ["institution-classes"] });
    void qc.invalidateQueries({ queryKey: ["institution-teachers"] });
    void qc.invalidateQueries({ queryKey: ["institution-dashboard"] });
  };

  const assignM = useMutation({
    mutationFn: (v: { classId: string; teacherId: string }) => assignFn({ data: v }),
    onSuccess: () => { invalidate(); setEditing(null); toast.success("הכיתה שויכה למלמד"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שיוך הכיתה נכשל"),
  });

  const detachM = useMutation({
    mutationFn: (v: { classId: string; reason: string }) => detachFn({ data: v }),
    onSuccess: (_r, v) => {
      invalidate();
      setDetaching(null);
      setReason("");
      toast.success("הכיתה הוסרה מהמוסד", {
        description: `אפשר לבטל את הפעולה בתוך ${UNDO_SECONDS} שניות.`,
        duration: UNDO_SECONDS * 1000,
        action: {
          label: "ביטול הפעולה",
          onClick: () => undoM.mutate(v.classId),
        },
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הסרת הכיתה נכשלה"),
  });

  const undoM = useMutation({
    mutationFn: (classId: string) => reattachFn({ data: { classId } }),
    onSuccess: () => { invalidate(); toast.success("ההסרה בוטלה — הכיתה חזרה למוסד"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "ביטול ההסרה נכשל"),
  });

  const rows = rowsQ.data ?? [];
  const byTeacher = useMemo(() => {
    const map = new Map<string, { name: string; classes: TeacherClassRow[] }>();
    for (const r of rows) {
      const entry = map.get(r.teacherId) ?? { name: r.teacherName, classes: [] };
      entry.classes.push(r);
      map.set(r.teacherId, entry);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name, "he"));
  }, [rows]);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCog className="h-4 w-4 text-primary" aria-hidden="true" /> שיוך כיתות למלמדים
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rowsQ.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="טוען שיוכים">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : rowsQ.isError ? (
          <p className="py-6 text-center text-sm text-destructive">טעינת השיוכים נכשלה. רענן את הדף.</p>
        ) : byTeacher.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">אין כיתות משויכות למוסד זה.</p>
        ) : (
          <ul className="space-y-4">
            {byTeacher.map(([id, entry]) => (
              <li key={id} className="space-y-2">
                <div className="text-sm font-medium">
                  {entry.name}{" "}
                  <span className="font-mono-tabular text-xs text-muted-foreground">
                    ({entry.classes.length} כיתות)
                  </span>
                </div>
                <ul className="divide-y rounded-xl border">
                  {entry.classes.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm">{c.name}</span>
                        {c.status === "archived" && <Badge variant="secondary">בארכיון</Badge>}
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => { setEditing(c); setTeacherId(c.teacherId); }}
                          >
                            שינוי מלמד
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-destructive"
                            onClick={() => { setDetaching(c); setReason(""); setReasonError(""); }}
                          >
                            <Unlink className="me-1 h-3.5 w-3.5" aria-hidden="true" /> הסר מהמוסד
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        {!canEdit && (
          <p className="pt-4 text-xs text-muted-foreground">
            עריכת שיוכים זמינה למנהל מערכת בלבד. תצוגה זו לקריאה בלבד.
          </p>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        {null}
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>שיוך הכיתה {editing?.name} למלמד</DialogTitle>
            <DialogDescription>
              המלמד החדש יקבל את הכיתה, התלמידים והנתונים שלה. ניתן לבחור מלמדי המוסד בלבד.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="assign-teacher">מלמד</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger id="assign-teacher" className="rounded-xl">
                <SelectValue placeholder="בחר מלמד" />
              </SelectTrigger>
              <SelectContent>
                {(teachersQ.data ?? []).map((t) => (
                  <SelectItem key={t.userId} value={t.userId}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(teachersQ.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">אין מלמדים משויכים למוסד — הזמן מלמד בטאב "מלמדים".</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setEditing(null)}>ביטול</Button>
            <Button
              className="rounded-xl"
              disabled={assignM.isPending || !teacherId || teacherId === editing?.teacherId}
              onClick={() => {
                if (!editing || !teacherId) return;
                assignM.mutate({ classId: editing.id, teacherId });
              }}
            >
              {assignM.isPending && <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />}
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
