import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Printer, Trash2 } from "lucide-react";
import {
  deleteSemesterTarget, listScheduleTasks, listSemesterTargets, upsertSemesterTarget,
  type ScheduleTask, type SemesterTargetRow,
} from "@/lib/schedule-planning.functions";
import { computeSemesterProgress, semesterOf, semesterRange, type SemesterKey } from "@/lib/schedule-pacing";
import { isoDate } from "@/lib/parasha";
import { printHtmlTable } from "@/lib/print-schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ahead: { label: "לפני הקצב", variant: "default" },
  on_track: { label: "בקצב", variant: "secondary" },
  behind: { label: "מאחור", variant: "destructive" },
};

export function SemesterTargetsPanel({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listSemesterTargets);
  const upsertFn = useServerFn(upsertSemesterTarget);
  const delFn = useServerFn(deleteSemesterTarget);
  const tasksFn = useServerFn(listScheduleTasks);

  const [semester, setSemester] = useState<SemesterKey>(semesterOf(new Date()));
  const range = useMemo(() => semesterRange(semester), [semester]);
  const from = isoDate(range.start);
  const to = isoDate(range.end);

  const { data: targets = [] } = useQuery({
    queryKey: ["semester-targets", classId],
    queryFn: () => listFn({ data: { classId } }),
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["schedule-tasks", classId, from, to],
    queryFn: () => tasksFn({ data: { classId, from, to } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["semester-targets", classId] });
    qc.invalidateQueries({ queryKey: ["schedule-tasks", classId] });
  };
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "שגיאה");

  const saveM = useMutation({ mutationFn: upsertFn, onSuccess: () => { invalidate(); setSubject(""); setUnits("10"); toast.success("היעד נשמר"); }, onError });
  const delM = useMutation({ mutationFn: delFn, onSuccess: invalidate, onError });

  const [subject, setSubject] = useState("");
  const [units, setUnits] = useState("10");

  const rows = targets as SemesterTargetRow[];
  const progress = useMemo(
    () =>
      computeSemesterProgress(
        rows.map((r) => ({ subject: r.subject, semester: r.semester, target_units: r.target_units })),
        (tasks as ScheduleTask[]).map((t) => ({ subject: t.subject, date: t.date, done: t.done })),
        semester,
      ),
    [rows, tasks, semester],
  );

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">יעדי מחצית והספק</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={semester} onValueChange={(v) => setSemester(v as SemesterKey)}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="h1">מחצית א׳</SelectItem>
              <SelectItem value="h2">מחצית ב׳</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline" size="sm"
            onClick={() =>
              printHtmlTable({
                title: `יעדי ${semester === "h1" ? "מחצית א׳" : "מחצית ב׳"}`,
                subtitle: `${from} – ${to}`,
                head: ["מקצוע", "יעד", "הושלם", "נותר", "שבועות שנותרו", "נדרש לשבוע", "מצב"],
                rows: progress.map((p) => [
                  p.subject, String(p.target), String(p.done), String(p.remaining),
                  String(p.weeksLeft), String(p.perWeekNeeded), STATUS[p.status]!.label,
                ]),
              })
            }
          >
            <Printer className="ms-1 h-4 w-4" /> הדפסה
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          הזינו מראש כמה יחידות/פרקים צריך להספיק בכל מקצוע במחצית. כל משימה או הספק שמסומן כבוצע נספר אוטומטית,
          והמערכת מסמנת אם אתם בקצב או מאחור.
        </p>

        <div className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
          <div>
            <Label className="text-xs">מקצוע</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="גמרא" />
          </div>
          <div>
            <Label className="text-xs">יעד יחידות</Label>
            <Input type="number" min={0} value={units} onChange={(e) => setUnits(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => {
                if (!subject.trim()) { toast.error("חובה להזין מקצוע"); return; }
                saveM.mutate({ data: { classId, semester, subject: subject.trim(), targetUnits: Number(units) || 0 } });
              }}
            >
              <Plus className="ms-1 h-4 w-4" /> שמור יעד
            </Button>
          </div>
        </div>

        {progress.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין יעדים למחצית הזו.</p>
        ) : (
          <ul className="space-y-3">
            {progress.map((p) => {
              const row = rows.find((r) => r.subject === p.subject && r.semester === semester);
              const pct = p.target > 0 ? Math.min(100, Math.round((p.done / p.target) * 100)) : 0;
              return (
                <li key={p.subject} className="rounded-xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{p.subject}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS[p.status]!.variant}>{STATUS[p.status]!.label}</Badge>
                      {row && (
                        <Button variant="ghost" size="icon" aria-label={`מחק יעד ${p.subject}`} onClick={() => delM.mutate({ data: { id: row.id } })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Progress value={pct} className="mt-2" />
                  <div className="mt-1.5 text-[11px] text-muted-foreground">
                    {p.done} מתוך {p.target} · נותרו {p.remaining} · {p.weeksLeft} שבועות · נדרש {p.perWeekNeeded} לשבוע
                    {" · "}צפוי עד כה: {p.expectedByNow}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
