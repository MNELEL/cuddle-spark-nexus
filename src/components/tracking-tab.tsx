import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, XCircle, Clock, FileCheck, Plus, Trash2, Pencil } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { listStudents } from "@/lib/students.functions";
import {
  listAttendanceByDate, upsertAttendance, bulkMarkAttendance,
  listGrades, upsertGrade, deleteGrade,
} from "@/lib/tracking.functions";
import { KODESH_SUBJECTS } from "@/lib/kodesh-subjects";

type Student = { id: string; name: string };
type Status = "present" | "absent" | "late" | "excused";

const STATUS_META: Record<Status, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  present: { label: "נוכח", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/15" },
  absent:  { label: "נעדר", icon: XCircle,     color: "text-red-600",     bg: "bg-red-500/15" },
  late:    { label: "איחור", icon: Clock,       color: "text-amber-600",   bg: "bg-amber-500/15" },
  excused: { label: "מאושר", icon: FileCheck,   color: "text-blue-600",    bg: "bg-blue-500/15" },
};

const today = () => new Date().toISOString().slice(0, 10);

export function TrackingTab({ classId }: { classId: string }) {
  return (
    <Tabs defaultValue="attendance" dir="rtl">
      <TabsList>
        <TabsTrigger value="attendance">נוכחות</TabsTrigger>
        <TabsTrigger value="grades">ציונים</TabsTrigger>
      </TabsList>
      <TabsContent value="attendance" className="mt-4">
        <AttendancePanel classId={classId} />
      </TabsContent>
      <TabsContent value="grades" className="mt-4">
        <GradesPanel classId={classId} />
      </TabsContent>
    </Tabs>
  );
}

/* ---------------- Attendance ---------------- */

function AttendancePanel({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const listS = useServerFn(listStudents);
  const listA = useServerFn(listAttendanceByDate);
  const upsert = useServerFn(upsertAttendance);
  const bulk = useServerFn(bulkMarkAttendance);

  const [date, setDate] = useState<string>(today());

  const { data: students = [] } = useQuery({
    queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }),
  }) as { data: Student[] };

  const { data: rows = [] } = useQuery({
    queryKey: ["attendance", classId, date],
    queryFn: () => listA({ data: { class_id: classId, date } }),
  });

  const byStudent = useMemo(() => {
    const m = new Map<string, { status: Status; notes: string | null }>();
    for (const r of rows as Array<{ student_id: string; status: Status; notes: string | null }>) {
      m.set(r.student_id, { status: r.status, notes: r.notes });
    }
    return m;
  }, [rows]);

  const mark = useMutation({
    mutationFn: (v: { student_id: string; status: Status; notes?: string }) =>
      upsert({ data: { class_id: classId, date, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance", classId, date] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const bulkM = useMutation({
    mutationFn: (status: Status) => bulk({ data: { class_id: classId, date, status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attendance", classId, date] }); toast.success("עודכן"); },
  });

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    for (const s of students) {
      const r = byStudent.get(s.id);
      if (!r) c.unmarked++;
      else c[r.status]++;
    }
    return c;
  }, [students, byStudent]);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex-1 min-w-[160px]">
            <Label>תאריך</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" onClick={() => bulkM.mutate("present")}>סמן הכל נוכח</Button>
            <Button size="sm" variant="outline" onClick={() => bulkM.mutate("absent")}>סמן הכל נעדר</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(["present","absent","late","excused"] as Status[]).map((s) => (
          <Badge key={s} variant="secondary" className={STATUS_META[s].bg}>
            {STATUS_META[s].label}: {counts[s]}
          </Badge>
        ))}
        {counts.unmarked > 0 && <Badge variant="outline">לא סומן: {counts.unmarked}</Badge>}
      </div>

      {students.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">אין תלמידים בכיתה.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {students.map((s) => {
            const cur = byStudent.get(s.id);
            return (
              <Card key={s.id}>
                <CardContent className="flex items-center justify-between gap-2 py-2">
                  <div className="font-medium">{s.name}</div>
                  <div className="flex gap-1">
                    {(["present","absent","late","excused"] as Status[]).map((st) => {
                      const meta = STATUS_META[st];
                      const Icon = meta.icon;
                      const active = cur?.status === st;
                      return (
                        <Button key={st} size="sm" variant={active ? "default" : "ghost"}
                          className={active ? "" : meta.color}
                          onClick={() => mark.mutate({ student_id: s.id, status: st })}
                          title={meta.label}>
                          <Icon className="h-4 w-4" />
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------- Grades ---------------- */

type Grade = {
  id: string; class_id: string; student_id: string;
  subject: string; value: number; max_value: number; date: string; notes: string | null;
};

function GradesPanel({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const listS = useServerFn(listStudents);
  const listG = useServerFn(listGrades);
  const remove = useServerFn(deleteGrade);

  const { data: students = [] } = useQuery({
    queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }),
  }) as { data: Student[] };
  const { data: grades = [] } = useQuery({
    queryKey: ["grades", classId], queryFn: () => listG({ data: { classId } }),
  }) as { data: Grade[] };

  const [filterStudent, setFilterStudent] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);

  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "?";

  const filtered = useMemo(() => grades.filter((g) =>
    (filterStudent === "all" || g.student_id === filterStudent) &&
    (!filterSubject || g.subject.toLowerCase().includes(filterSubject.toLowerCase()))
  ), [grades, filterStudent, filterSubject]);

  const avgByStudent = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    for (const g of grades) {
      const cur = m.get(g.student_id) ?? { total: 0, count: 0 };
      cur.total += (Number(g.value) / Number(g.max_value)) * 100;
      cur.count++;
      m.set(g.student_id, cur);
    }
    return m;
  }, [grades]);

  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["grades", classId] }); toast.success("נמחק"); },
  });

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="flex-1 min-w-[160px]">
            <Label>תלמיד</Label>
            <Select value={filterStudent} onValueChange={setFilterStudent}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל התלמידים</SelectItem>
                {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label>מקצוע / מסכת</Label>
            <Input value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} placeholder="חיפוש (גמרא, חומש, הלכה...)" />
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="ms-1 h-4 w-4" /> ציון חדש</Button>
            </DialogTrigger>
            <GradeDialog classId={classId} editing={editing} students={students}
              onClose={() => { setOpen(false); setEditing(null); }} />
          </Dialog>
        </CardContent>
      </Card>

      {filterStudent !== "all" && (
        <Card>
          <CardContent className="py-3 text-sm">
            ממוצע {nameOf(filterStudent)}:
            <span className="ms-2 font-semibold">
              {avgByStudent.get(filterStudent)
                ? (avgByStudent.get(filterStudent)!.total / avgByStudent.get(filterStudent)!.count).toFixed(1) + "%"
                : "—"}
            </span>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">אין ציונים.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((g) => {
            const pct = (Number(g.value) / Number(g.max_value)) * 100;
            return (
              <Card key={g.id}>
                <CardContent className="flex items-center justify-between gap-2 py-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{nameOf(g.student_id)}</span>
                      {g.subject && <Badge variant="secondary">{g.subject}</Badge>}
                      <span className="text-xs text-muted-foreground">{g.date}</span>
                    </div>
                    {g.notes && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{g.notes}</p>}
                  </div>
                  <div className="text-end">
                    <div className={`text-lg font-bold ${pct >= 60 ? "text-emerald-600" : "text-red-600"}`}>
                      {Number(g.value)}/{Number(g.max_value)}
                    </div>
                    <div className="text-xs text-muted-foreground">{pct.toFixed(0)}%</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(g); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeM.mutate(g.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GradeDialog({
  classId, editing, students, onClose,
}: {
  classId: string; editing: Grade | null; students: Student[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertGrade);
  const [studentId, setStudentId] = useState(editing?.student_id ?? "");
  const [subject, setSubject] = useState(editing?.subject ?? "");
  const [value, setValue] = useState<string>(editing ? String(editing.value) : "");
  const [maxValue, setMaxValue] = useState<string>(editing ? String(editing.max_value) : "100");
  const [date, setDate] = useState(editing?.date ?? today());
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const m = useMutation({
    mutationFn: () => upsert({ data: {
      id: editing?.id, class_id: classId, student_id: studentId,
      subject, value: Number(value), max_value: Number(maxValue) || 100, date, notes,
    }}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grades", classId] });
      toast.success(editing ? "עודכן" : "נשמר");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const valid = !!studentId && value !== "" && !Number.isNaN(Number(value));

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "עריכת ציון" : "ציון חדש"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>תלמיד</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
            <SelectContent>
              {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>מקצוע / מסכת</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="למשל: גמרא - בבא מציעא, חומש - וירא"
            list="kodesh-subjects"
          />
          <datalist id="kodesh-subjects">
            {KODESH_SUBJECTS.map((s) => <option key={s} value={s} />)}
          </datalist>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {KODESH_SUBJECTS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setSubject(s)}
                className="rounded-full border border-border bg-secondary/40 px-2.5 py-0.5 text-xs hover:border-primary hover:bg-primary/10"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>ציון</Label>
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div>
            <Label>מתוך</Label>
            <Input type="number" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} />
          </div>
          <div>
            <Label>תאריך</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>הערות</Label>
          <Textarea value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>ביטול</Button>
        <Button onClick={() => m.mutate()} disabled={!valid || m.isPending}>שמור</Button>
      </DialogFooter>
    </DialogContent>
  );
}