import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import {
  deleteDutyType, generateDutyRotation, listDutyAssignments, listDutyTypes,
  setDutyAssignment, setDutyDone, upsertDutyType,
  type DutyAssignment, type DutyType,
} from "@/lib/duties.functions";
import { listStudents } from "@/lib/students.functions";
import { ALL_DAYS, DAY_INDEX } from "@/components/schedule/schedule-context";
import { addDays, isoDate } from "@/lib/parasha";
import { printHtmlTable } from "@/lib/print-schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function DutiesPanel({ classId, weekStart, teachingDates }: {
  classId: string;
  /** ISO date of the Sunday shown in the board */
  weekStart: string;
  /** teaching dates for the whole year (holidays already removed) */
  teachingDates: string[];
}) {
  const qc = useQueryClient();
  const typesFn = useServerFn(listDutyTypes);
  const upsertTypeFn = useServerFn(upsertDutyType);
  const delTypeFn = useServerFn(deleteDutyType);
  const assignmentsFn = useServerFn(listDutyAssignments);
  const setAssignFn = useServerFn(setDutyAssignment);
  const doneFn = useServerFn(setDutyDone);
  const genFn = useServerFn(generateDutyRotation);
  const studentsFn = useServerFn(listStudents);

  const weekEnd = isoDate(addDays(new Date(`${weekStart}T00:00:00`), 6));

  const { data: types = [] } = useQuery({
    queryKey: ["duty-types", classId],
    queryFn: () => typesFn({ data: { classId } }),
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ["duty-assignments", classId, weekStart],
    queryFn: () => assignmentsFn({ data: { classId, from: weekStart, to: weekEnd } }),
  });
  const { data: students = [] } = useQuery({
    queryKey: ["students", classId],
    queryFn: () => studentsFn({ data: { classId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["duty-types", classId] });
    qc.invalidateQueries({ queryKey: ["duty-assignments", classId] });
  };
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "שגיאה");

  const addTypeM = useMutation({ mutationFn: upsertTypeFn, onSuccess: () => { invalidate(); setNewName(""); toast.success("סוג תורנות נוסף"); }, onError });
  const delTypeM = useMutation({ mutationFn: delTypeFn, onSuccess: invalidate, onError });
  const setAssignM = useMutation({ mutationFn: setAssignFn, onSuccess: invalidate, onError });
  const doneM = useMutation({ mutationFn: doneFn, onSuccess: invalidate, onError });
  const genM = useMutation({
    mutationFn: genFn,
    onSuccess: (r) => { invalidate(); toast.success(`נוצרו ${r.inserted} שיבוצי תורנות`); },
    onError,
  });

  const [newName, setNewName] = useState("");

  const studentName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of students as { id: string; name: string }[]) m.set(s.id, s.name);
    return m;
  }, [students]);

  const byKey = useMemo(() => {
    const m = new Map<string, DutyAssignment>();
    for (const a of assignments as DutyAssignment[]) m.set(`${a.duty_type_id}|${a.date}`, a);
    return m;
  }, [assignments]);

  const weekDates = ALL_DAYS.map((d) => isoDate(addDays(new Date(`${weekStart}T00:00:00`), DAY_INDEX[d.key])));
  const typeList = types as DutyType[];

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">תורנים ותורנויות</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary" size="sm" disabled={genM.isPending || !teachingDates.length}
            onClick={() => genM.mutate({ data: { classId, dates: teachingDates.slice(0, 400), overwriteAuto: true } })}
          >
            <RefreshCw className="ms-1 h-4 w-4" /> שיבוץ אוטומטי לשנה
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() =>
              printHtmlTable({
                title: "לוח תורנויות",
                subtitle: `${weekStart} – ${weekEnd}`,
                head: ["תורנות", ...ALL_DAYS.map((d) => d.label)],
                rows: typeList.map((t) => [
                  t.name,
                  ...weekDates.map((d) => byKey.get(`${t.id}|${d}`)?.student_id
                    ? studentName.get(byKey.get(`${t.id}|${d}`)!.student_id!) ?? "—"
                    : "—"),
                ]),
              })
            }
          >
            <Printer className="ms-1 h-4 w-4" /> הדפסה
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="תורנות חדשה (לוח, חלוקת חומשים, ניקיון...)"
            className="max-w-xs"
          />
          <Button
            size="sm"
            onClick={() => {
              if (!newName.trim()) { toast.error("חובה להזין שם תורנות"); return; }
              addTypeM.mutate({ data: { classId, name: newName.trim(), orderIndex: typeList.length } });
            }}
          >
            <Plus className="ms-1 h-4 w-4" /> הוסף תורנות
          </Button>
        </div>

        {typeList.length === 0 ? (
          <p className="text-sm text-muted-foreground">עדיין לא הוגדרו תורנויות לכיתה.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="rounded-lg bg-muted p-2 text-right font-bold">תורנות</th>
                  {ALL_DAYS.map((d, i) => (
                    <th key={d.key} className="rounded-lg bg-muted p-2 text-center font-bold">
                      {d.short}
                      <div className="text-[10px] font-normal text-muted-foreground">
                        {weekDates[i]!.slice(8)}/{weekDates[i]!.slice(5, 7)}
                      </div>
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {typeList.map((t) => (
                  <tr key={t.id}>
                    <td className="rounded-lg bg-card p-2 font-medium">{t.name}</td>
                    {weekDates.map((d) => {
                      const a = byKey.get(`${t.id}|${d}`);
                      return (
                        <td key={d} className="rounded-lg border bg-card/60 p-1 align-top">
                          <Select
                            value={a?.student_id ?? "none"}
                            onValueChange={(v) =>
                              setAssignM.mutate({
                                data: { classId, dutyTypeId: t.id, date: d, studentId: v === "none" ? null : v },
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— ללא —</SelectItem>
                              {(students as { id: string; name: string }[]).map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {a && (
                            <label className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Checkbox
                                checked={a.done}
                                onCheckedChange={(c) => doneM.mutate({ data: { id: a.id, done: Boolean(c) } })}
                                aria-label="בוצע"
                              />
                              בוצע
                            </label>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-0 align-middle">
                      <Button variant="ghost" size="icon" aria-label={`מחק ${t.name}`} onClick={() => delTypeM.mutate({ data: { id: t.id } })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
