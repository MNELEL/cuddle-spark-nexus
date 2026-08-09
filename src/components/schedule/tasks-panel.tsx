import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Printer, Trash2 } from "lucide-react";
import {
  deleteScheduleTask, listScheduleTasks, setScheduleTaskDone, upsertScheduleTask,
  type ScheduleTask,
} from "@/lib/schedule-planning.functions";
import { KIND_LABEL } from "@/components/schedule/schedule-context";
import { printHtmlTable } from "@/lib/print-schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TasksPanel({ classId, from, to, defaultDate, heading = "משימות, מבחנים והספקים" }: {
  classId: string; from: string; to: string; defaultDate: string; heading?: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listScheduleTasks);
  const upsertFn = useServerFn(upsertScheduleTask);
  const doneFn = useServerFn(setScheduleTaskDone);
  const delFn = useServerFn(deleteScheduleTask);

  const key = ["schedule-tasks", classId, from, to];
  const { data: tasks = [] } = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: { classId, from, to } }),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["schedule-tasks", classId] });

  const [kind, setKind] = useState<"task" | "exam" | "pacing">("task");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(defaultDate);

  const addM = useMutation({
    mutationFn: upsertFn,
    onSuccess: () => { invalidate(); setTitle(""); toast.success("נשמר"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const doneM = useMutation({
    mutationFn: doneFn,
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const delM = useMutation({
    mutationFn: delFn,
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const rows = tasks as ScheduleTask[];
  const openCount = rows.filter((t) => !t.done).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">
          {heading} <span className="text-xs font-normal text-muted-foreground">({openCount} פתוחות)</span>
        </CardTitle>
        <Button
          variant="outline" size="sm"
          onClick={() =>
            printHtmlTable({
              title: heading,
              subtitle: `${from} – ${to}`,
              head: ["בוצע", "תאריך", "סוג", "כותרת", "מקצוע"],
              rows: rows.map((t) => [t.done ? "✓" : "☐", t.date, KIND_LABEL[t.kind] ?? t.kind, t.title, t.subject ?? "—"]),
            })
          }
        >
          <Printer className="ms-1 h-4 w-4" /> הדפסה
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[130px_1fr_140px_150px_auto]">
          <div>
            <Label className="text-xs">סוג</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="task">משימה</SelectItem>
                <SelectItem value="exam">מבחן</SelectItem>
                <SelectItem value="pacing">הספק</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">כותרת</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: מבחן בגמרא פרק ב׳" />
          </div>
          <div>
            <Label className="text-xs">מקצוע</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="גמרא" />
          </div>
          <div>
            <Label className="text-xs">תאריך</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              onClick={() => {
                if (!title.trim()) { toast.error("חובה להזין כותרת"); return; }
                addM.mutate({ data: { classId, kind, title: title.trim(), subject: subject.trim() || null, date } });
              }}
              disabled={addM.isPending}
            >
              <Plus className="ms-1 h-4 w-4" /> הוסף
            </Button>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין משימות בטווח הזה.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {rows.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-2.5">
                <Checkbox
                  checked={t.done}
                  onCheckedChange={(c) => doneM.mutate({ data: { id: t.id, done: Boolean(c) } })}
                  aria-label={`סמן ${t.title} כבוצע`}
                />
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm font-medium ${t.done ? "text-muted-foreground line-through" : ""}`}>
                    {t.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {t.date}{t.subject ? ` · ${t.subject}` : ""}
                  </div>
                </div>
                <Badge variant={t.kind === "exam" ? "destructive" : t.kind === "pacing" ? "default" : "secondary"}>
                  {KIND_LABEL[t.kind]}
                </Badge>
                <Button variant="ghost" size="icon" aria-label="מחק" onClick={() => delM.mutate({ data: { id: t.id } })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
