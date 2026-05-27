import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listStudents } from "@/lib/students.functions";
import {
  listReminders, upsertReminder, toggleReminderDone, deleteReminder,
  listBehaviorPoints, addBehaviorPoints, deleteBehaviorPoint,
} from "@/lib/crm.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Bell, Award, Star, Calendar as CalIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const categoryLabel: Record<string, string> = {
  participation: "השתתפות",
  seating: "ישיבה נכונה",
  helpfulness: "עזרה לחברים",
  academic: "הישג לימודי",
  other: "אחר",
};

type Student = { id: string; name: string };
type Reminder = {
  id: string; student_id: string; title: string; description: string | null;
  due_date: string | null; completed: boolean; created_at: string;
};
type Point = {
  id: string; student_id: string; category: string; points: number;
  note: string | null; date: string;
};

export function CrmTab({ classId }: { classId: string }) {
  const listS = useServerFn(listStudents);
  const listR = useServerFn(listReminders);
  const listP = useServerFn(listBehaviorPoints);

  const { data: students = [] } = useQuery({
    queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }),
  });
  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders", classId], queryFn: () => listR({ data: { classId } }),
  });
  const { data: points = [] } = useQuery({
    queryKey: ["points", classId], queryFn: () => listP({ data: { classId } }),
  });

  if (students.length === 0) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">הוסף תלמידים כדי להשתמש ב-CRM.</CardContent></Card>;
  }

  return (
    <Tabs defaultValue="reminders" dir="rtl">
      <TabsList>
        <TabsTrigger value="reminders"><Bell className="ms-1 h-4 w-4" /> תזכורות</TabsTrigger>
        <TabsTrigger value="points"><Award className="ms-1 h-4 w-4" /> נקודות התנהגות</TabsTrigger>
        <TabsTrigger value="leaderboard"><Star className="ms-1 h-4 w-4" /> טבלת מובילים</TabsTrigger>
      </TabsList>

      <TabsContent value="reminders" className="mt-4">
        <RemindersPanel classId={classId} students={students as Student[]} reminders={reminders as Reminder[]} />
      </TabsContent>
      <TabsContent value="points" className="mt-4">
        <PointsPanel classId={classId} students={students as Student[]} points={points as Point[]} />
      </TabsContent>
      <TabsContent value="leaderboard" className="mt-4">
        <Leaderboard students={students as Student[]} points={points as Point[]} />
      </TabsContent>
    </Tabs>
  );
}

/* ---------------- Reminders ---------------- */

function RemindersPanel({
  classId, students, reminders,
}: { classId: string; students: Student[]; reminders: Reminder[] }) {
  const [open, setOpen] = useState(false);
  const [filterStudent, setFilterStudent] = useState<string>("all");
  const [showDone, setShowDone] = useState(false);
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "?";

  const filtered = reminders.filter((r) => {
    if (!showDone && r.completed) return false;
    if (filterStudent !== "all" && r.student_id !== filterStudent) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px]">
          <Label>סינון לפי תלמיד</Label>
          <Select value={filterStudent} onValueChange={setFilterStudent}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל התלמידים</SelectItem>
              {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={showDone} onCheckedChange={(v) => setShowDone(!!v)} />
          הצג גם בוצעו
        </label>
        <div className="ms-auto">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="ms-1 h-4 w-4" /> תזכורת חדשה</Button>
            </DialogTrigger>
            <ReminderDialog classId={classId} students={students} onClose={() => setOpen(false)} />
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">אין תזכורות פעילות.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => <ReminderRow key={r.id} reminder={r} classId={classId} studentName={nameOf(r.student_id)} />)}
        </div>
      )}
    </div>
  );
}

function ReminderRow({ reminder, classId, studentName }: { reminder: Reminder; classId: string; studentName: string }) {
  const toggle = useServerFn(toggleReminderDone);
  const remove = useServerFn(deleteReminder);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["reminders", classId] });

  const toggleM = useMutation({ mutationFn: () => toggle({ data: { id: reminder.id, completed: !reminder.completed } }), onSuccess: refresh });
  const removeM = useMutation({ mutationFn: () => remove({ data: { id: reminder.id } }), onSuccess: refresh });

  const overdue = !reminder.completed && reminder.due_date && new Date(reminder.due_date) < new Date(new Date().toDateString());

  return (
    <Card className={reminder.completed ? "opacity-60" : ""}>
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="flex items-start gap-3 flex-1">
          <Checkbox checked={reminder.completed} onCheckedChange={() => toggleM.mutate()} className="mt-1" />
          <div className="flex-1">
            <div className={`font-medium ${reminder.completed ? "line-through" : ""}`}>{reminder.title}</div>
            <div className="mt-1 flex flex-wrap gap-1 text-xs">
              <Badge variant="outline">{studentName}</Badge>
              {reminder.due_date && (
                <Badge variant={overdue ? "destructive" : "secondary"} className="gap-1">
                  <CalIcon className="h-3 w-3" />
                  {new Date(reminder.due_date).toLocaleDateString("he-IL")}
                </Badge>
              )}
              {reminder.completed && <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> בוצע</Badge>}
            </div>
            {reminder.description && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">{reminder.description}</p>}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeM.mutate()}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function ReminderDialog({ classId, students, onClose }: { classId: string; students: Student[]; onClose: () => void }) {
  const upsert = useServerFn(upsertReminder);
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState<string>(students[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const m = useMutation({
    mutationFn: () => upsert({ data: {
      class_id: classId, student_id: studentId, title: title.trim(),
      description, due_date: dueDate || null,
    }}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders", classId] });
      toast.success("התזכורת נוספה");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>תזכורת חדשה</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>תלמיד</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>כותרת</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: לבדוק התקדמות בקריאה" />
        </div>
        <div>
          <Label>תאריך יעד (אופציונלי)</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <Label>תיאור</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>ביטול</Button>
        <Button onClick={() => m.mutate()} disabled={!title.trim() || !studentId || m.isPending}>שמור</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------------- Behavior Points ---------------- */

function PointsPanel({
  classId, students, points,
}: { classId: string; students: Student[]; points: Point[] }) {
  const [open, setOpen] = useState(false);
  const [filterStudent, setFilterStudent] = useState<string>("all");
  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "?";

  const filtered = points.filter((p) => filterStudent === "all" || p.student_id === filterStudent);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px]">
          <Label>סינון לפי תלמיד</Label>
          <Select value={filterStudent} onValueChange={setFilterStudent}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">כל התלמידים</SelectItem>
              {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ms-auto">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="ms-1 h-4 w-4" /> הענק נקודות</Button>
            </DialogTrigger>
            <PointsDialog classId={classId} students={students} onClose={() => setOpen(false)} />
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">עוד לא הוענקו נקודות.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((p) => <PointRow key={p.id} point={p} classId={classId} studentName={nameOf(p.student_id)} />)}
        </div>
      )}
    </div>
  );
}

function PointRow({ point, classId, studentName }: { point: Point; classId: string; studentName: string }) {
  const remove = useServerFn(deleteBehaviorPoint);
  const qc = useQueryClient();
  const removeM = useMutation({
    mutationFn: () => remove({ data: { id: point.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["points", classId] }),
  });
  const positive = point.points >= 0;
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-12 items-center justify-center rounded font-bold text-white ${positive ? "bg-emerald-500" : "bg-red-500"}`}>
            {positive ? "+" : ""}{point.points}
          </div>
          <div>
            <div className="font-medium">{studentName}</div>
            <div className="text-xs text-muted-foreground">
              {categoryLabel[point.category] ?? point.category} · {new Date(point.date).toLocaleDateString("he-IL")}
            </div>
            {point.note && <p className="mt-0.5 text-sm">{point.note}</p>}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeM.mutate()}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function PointsDialog({ classId, students, onClose }: { classId: string; students: Student[]; onClose: () => void }) {
  const add = useServerFn(addBehaviorPoints);
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState<string>(students[0]?.id ?? "");
  const [category, setCategory] = useState<string>("participation");
  const [pts, setPts] = useState<number>(1);
  const [note, setNote] = useState("");

  const m = useMutation({
    mutationFn: () => add({ data: {
      class_id: classId, student_id: studentId,
      category: category as "participation" | "seating" | "helpfulness" | "academic" | "other",
      points: pts, note,
    }}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["points", classId] });
      toast.success("הנקודות נוספו");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>הענקת נקודות התנהגות</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>תלמיד</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>קטגוריה</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabel).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>נקודות (שלילי = הפחתה)</Label>
            <Input type="number" min={-50} max={50} value={pts}
              onChange={(e) => setPts(parseInt(e.target.value) || 0)} />
          </div>
        </div>
        <div>
          <Label>הערה (אופציונלי)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>ביטול</Button>
        <Button onClick={() => m.mutate()} disabled={!studentId || pts === 0 || m.isPending}>הענק</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------------- Leaderboard ---------------- */

function Leaderboard({ students, points }: { students: Student[]; points: Point[] }) {
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of points) map.set(p.student_id, (map.get(p.student_id) ?? 0) + p.points);
    return students.map((s) => ({ ...s, total: map.get(s.id) ?? 0 }))
      .sort((a, b) => b.total - a.total);
  }, [students, points]);

  const max = Math.max(1, ...totals.map((t) => Math.abs(t.total)));

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">סך נקודות לכל תלמיד</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {totals.map((t, i) => (
          <div key={t.id} className="flex items-center gap-3">
            <div className="w-6 text-center text-sm font-bold text-muted-foreground">{i + 1}</div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <div className="font-medium">{t.name}</div>
                <div className={`font-bold ${t.total > 0 ? "text-emerald-600" : t.total < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                  {t.total > 0 ? "+" : ""}{t.total}
                </div>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded bg-muted">
                <div className={t.total >= 0 ? "h-full bg-emerald-500" : "h-full bg-red-500"}
                  style={{ width: `${(Math.abs(t.total) / max) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}