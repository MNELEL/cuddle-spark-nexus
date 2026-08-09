import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, Link2, Link2Off, Loader2, Unlink, UserCog } from "lucide-react";

import {
  listClassAssignments,
  detachClassInstitution,
  reassignClass,
  listAssignableTeachers,
  type ClassAssignmentRow,
} from "@/lib/class-assignments.functions";
import { listInstitutions } from "@/lib/institutions.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

/** Institution / teacher / library assignment overview with detach + reassign actions. */
export function ClassAssignmentsTable() {
  const qc = useQueryClient();
  const listFn = useServerFn(listClassAssignments);
  const detachFn = useServerFn(detachClassInstitution);
  const reassignFn = useServerFn(reassignClass);
  const institutionsFn = useServerFn(listInstitutions);
  const teachersFn = useServerFn(listAssignableTeachers);

  const [editing, setEditing] = useState<ClassAssignmentRow | null>(null);
  const [institutionId, setInstitutionId] = useState<string>("");
  const [teacherId, setTeacherId] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["class-assignments"],
    queryFn: () => listFn(),
  });

  const canManage = data?.canManage ?? false;

  const { data: institutions = [] } = useQuery({
    queryKey: ["institutions-for-assign"],
    queryFn: () => institutionsFn(),
    enabled: canManage && !!editing,
    retry: false,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["assignable-teachers", institutionId],
    queryFn: () => teachersFn({ data: { institutionId } }),
    enabled: canManage && !!editing && !!institutionId,
    retry: false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["class-assignments"] });
    qc.invalidateQueries({ queryKey: ["classes"] });
  };

  const detachM = useMutation({
    mutationFn: (classId: string) => detachFn({ data: { classId } }),
    onSuccess: () => { invalidate(); toast.success("הכיתה נותקה מהמוסד"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const reassignM = useMutation({
    mutationFn: () =>
      reassignFn({
        data: {
          classId: editing!.id,
          institutionId: institutionId || null,
          ...(teacherId ? { teacherId } : {}),
        },
      }),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success("השיוך עודכן");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const openEdit = (row: ClassAssignmentRow) => {
    setEditing(row);
    setInstitutionId(row.institutionId ?? "");
    setTeacherId(row.teacherId);
  };

  const rows = data?.classes ?? [];

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" aria-hidden="true" /> שיוכי כיתות — מוסד, מלמד וספרייה
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">טוען שיוכים…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין כיתות להצגה.</p>
        ) : (
          <div className="max-h-[28rem] overflow-auto">
            <p className="pb-2 text-xs text-muted-foreground font-mono-tabular">{rows.length} כיתות</p>
            <table className="w-full text-sm">
              <caption className="sr-only">טבלת שיוכי כיתות למוסד, למלמד ולספרייה</caption>
              <thead>
                <tr className="border-b bg-card text-start text-xs text-muted-foreground [&>th]:sticky [&>th]:top-0 [&>th]:bg-card">
                  <th scope="col" className="p-2 text-start">כיתה</th>
                  <th scope="col" className="p-2 text-start">מוסד</th>
                  <th scope="col" className="p-2 text-start">מלמד</th>
                  <th scope="col" className="p-2 text-start">ספרייה</th>
                  <th scope="col" className="p-2 text-start">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="p-2">
                      <Link
                        to="/classes/$classId"
                        params={{ classId: row.id }}
                        className="font-medium hover:text-primary"
                      >
                        {row.name}
                      </Link>
                      <div className="flex gap-1 pt-1">
                        {row.academicYear && (
                          <Badge variant="outline" className="font-mono-tabular">{row.academicYear}</Badge>
                        )}
                        {row.status === "archived" && <Badge variant="secondary">בארכיון</Badge>}
                      </div>
                    </td>
                    <td className="p-2">
                      {row.institutionName ?? <span className="text-muted-foreground">לא משויך</span>}
                    </td>
                    <td className="p-2">{row.teacherName}</td>
                    <td className="p-2">
                      {row.library.connected ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <Link2 className="h-4 w-4" aria-hidden="true" /> מחוברת
                        </span>
                      ) : (
                        <Link
                          to="/weekly-schedule/$classId"
                          params={{ classId: row.id }}
                          className="inline-flex items-center gap-1 text-amber hover:underline"
                        >
                          <Link2Off className="h-4 w-4" aria-hidden="true" /> השלם חיבור
                        </Link>
                      )}
                    </td>
                    <td className="p-2">
                      {canManage && row.status !== "archived" ? (
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl"
                            onClick={() => openEdit(row)}
                          >
                            <UserCog className="ms-1 h-4 w-4" aria-hidden="true" /> שיוך מחדש
                          </Button>
                          {row.institutionId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-xl text-destructive"
                              disabled={detachM.isPending}
                              onClick={() => detachM.mutate(row.id)}
                            >
                              <Unlink className="ms-1 h-4 w-4" aria-hidden="true" /> נתק
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {row.status === "archived" ? "בארכיון" : "צפייה בלבד"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!canManage && rows.length > 0 && (
          <p className="pt-3 text-xs text-muted-foreground">
            שינוי שיוך למוסד או למלמד נעשה על ידי מנהל המוסד או מנהל המערכת במסך ניהול המשתמשים.
          </p>
        )}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>שיוך מחדש — {editing?.name}</DialogTitle>
            <DialogDescription>
              בחר מוסד ומלמד. העברת בעלות אפשרית רק למלמד המשויך לאותו מוסד.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="assign-institution">מוסד</Label>
              <select
                id="assign-institution"
                value={institutionId}
                onChange={(e) => { setInstitutionId(e.target.value); setTeacherId(""); }}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">ללא מוסד</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="assign-teacher">מלמד</Label>
              <select
                id="assign-teacher"
                value={teacherId}
                disabled={!institutionId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="">ללא שינוי בעלות</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {!institutionId && (
                <p className="pt-1 text-xs text-muted-foreground">
                  כדי להעביר בעלות יש לבחור מוסד תחילה.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>ביטול</Button>
            <Button onClick={() => reassignM.mutate()} disabled={reassignM.isPending}>
              {reassignM.isPending && <Loader2 className="ms-1 h-4 w-4 animate-spin" />} שמור שיוך
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
