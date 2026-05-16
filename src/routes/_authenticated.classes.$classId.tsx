import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getClass } from "@/lib/classes.functions";
import {
  listStudents, upsertStudent, deleteStudent,
  listRelations, createRelation, deleteRelation,
} from "@/lib/students.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Heart, Ban, MoveHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SeatingGrid } from "@/components/seating-grid";
import { GroupsTab } from "@/components/groups-tab";
import { ImportExportBar } from "@/components/import-export";

export const Route = createFileRoute("/_authenticated/classes/$classId")({
  component: ClassDetail,
});

type Student = {
  id: string; class_id: string; name: string; notes: string | null;
  height: "low" | "mid" | "high"; row_pref: "front" | "mid" | "back" | "any"; corner_pref: boolean;
};

function ClassDetail() {
  const { classId } = Route.useParams();
  const getC = useServerFn(getClass);
  const listS = useServerFn(listStudents);
  const listR = useServerFn(listRelations);

  const { data: cls } = useQuery({ queryKey: ["class", classId], queryFn: () => getC({ data: { id: classId } }) });
  const { data: students = [] } = useQuery({ queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }) });
  const { data: relations = [] } = useQuery({ queryKey: ["relations", classId], queryFn: () => listR({ data: { classId } }) });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/classes" className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתות
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{cls?.name ?? "..."}</h1>
        <p className="text-sm text-muted-foreground">
          {students.length} תלמידים · {relations.length} אילוצים
        </p>
      </div>

      <Tabs defaultValue="students" dir="rtl">
        <TabsList>
          <TabsTrigger value="students">תלמידים</TabsTrigger>
          <TabsTrigger value="relations">אילוצים</TabsTrigger>
          <TabsTrigger value="groups">קבוצות</TabsTrigger>
          <TabsTrigger value="seating">סידור</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          <div className="mb-3"><ImportExportBar classId={classId} /></div>
          <StudentsTab classId={classId} students={students as Student[]} />
        </TabsContent>

        <TabsContent value="relations" className="mt-4">
          <RelationsTab classId={classId} students={students as Student[]} relations={relations as never} />
        </TabsContent>

        <TabsContent value="groups" className="mt-4">
          <GroupsTab classId={classId} />
        </TabsContent>

        <TabsContent value="seating" className="mt-4">
          <div className="mb-3"><ImportExportBar classId={classId} /></div>
          <SeatingGrid classId={classId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Students ---------------- */

const heightLabel = { low: "נמוך", mid: "בינוני", high: "גבוה" };
const rowLabel = { front: "קדמית", mid: "אמצעית", back: "אחורית", any: "לא משנה" };

function StudentsTab({ classId, students }: { classId: string; students: Student[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="ms-1 h-4 w-4" /> הוסף תלמיד</Button>
          </DialogTrigger>
          <StudentDialog classId={classId} editing={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      {students.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">אין תלמידים. הוסף את הראשון.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {students.map((s) => (
            <StudentRow key={s.id} student={s}
              onEdit={() => { setEditing(s); setOpen(true); }} />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentRow({ student, onEdit }: { student: Student; onEdit: () => void }) {
  const remove = useServerFn(deleteStudent);
  const qc = useQueryClient();
  const removeM = useMutation({
    mutationFn: () => remove({ data: { id: student.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students", student.class_id] });
      qc.invalidateQueries({ queryKey: ["relations", student.class_id] });
      toast.success("התלמיד נמחק");
    },
  });

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-3">
        <div>
          <div className="font-semibold">{student.name}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="secondary">גובה: {heightLabel[student.height]}</Badge>
            <Badge variant="secondary">שורה: {rowLabel[student.row_pref]}</Badge>
            {student.corner_pref && <Badge variant="secondary">פינה</Badge>}
          </div>
          {student.notes && <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{student.notes}</p>}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeM.mutate()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentDialog({ classId, editing, onClose }: { classId: string; editing: Student | null; onClose: () => void }) {
  const upsert = useServerFn(upsertStudent);
  const qc = useQueryClient();
  const [name, setName] = useState(editing?.name ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [height, setHeight] = useState<Student["height"]>(editing?.height ?? "mid");
  const [rowPref, setRowPref] = useState<Student["row_pref"]>(editing?.row_pref ?? "any");
  const [corner, setCorner] = useState(editing?.corner_pref ?? false);

  const m = useMutation({
    mutationFn: () => upsert({ data: {
      id: editing?.id, class_id: classId, name: name.trim(),
      notes, height, row_pref: rowPref, corner_pref: corner,
    }}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students", classId] });
      toast.success(editing ? "עודכן" : "התלמיד נוסף");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "עריכת תלמיד" : "הוספת תלמיד"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>שם</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>גובה</Label>
            <Select value={height} onValueChange={(v) => setHeight(v as Student["height"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">נמוך</SelectItem>
                <SelectItem value="mid">בינוני</SelectItem>
                <SelectItem value="high">גבוה</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>העדפת שורה</Label>
            <Select value={rowPref} onValueChange={(v) => setRowPref(v as Student["row_pref"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">לא משנה</SelectItem>
                <SelectItem value="front">קדמית</SelectItem>
                <SelectItem value="mid">אמצעית</SelectItem>
                <SelectItem value="back">אחורית</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="corner" checked={corner} onCheckedChange={(v) => setCorner(!!v)} />
          <Label htmlFor="corner" className="cursor-pointer">מעדיף ישיבה בפינה</Label>
        </div>
        <div>
          <Label>הערות פדגוגיות</Label>
          <Textarea value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>ביטול</Button>
        <Button onClick={() => m.mutate()} disabled={!name.trim() || m.isPending}>
          {editing ? "שמור" : "הוסף"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------------- Relations ---------------- */

const kindMeta = {
  friend: { label: "חברים", icon: Heart, color: "text-rose-500" },
  avoid: { label: "להפריד", icon: Ban, color: "text-red-600" },
  distance: { label: "ריחוק", icon: MoveHorizontal, color: "text-amber-600" },
} as const;

function RelationsTab({
  classId, students, relations,
}: {
  classId: string;
  students: Student[];
  relations: { id: string; student_a: string; student_b: string; kind: keyof typeof kindMeta }[];
}) {
  const create = useServerFn(createRelation);
  const remove = useServerFn(deleteRelation);
  const qc = useQueryClient();
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const [kind, setKind] = useState<keyof typeof kindMeta>("friend");

  const createM = useMutation({
    mutationFn: () => create({ data: { class_id: classId, student_a: a, student_b: b, kind } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relations", classId] });
      setA(""); setB("");
      toast.success("האילוץ נוסף");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["relations", classId] }),
  });

  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "?";

  if (students.length < 2) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">צריך לפחות שני תלמידים כדי להגדיר אילוצים.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>תלמיד א'</Label>
              <Select value={a} onValueChange={setA}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>תלמיד ב'</Label>
              <Select value={b} onValueChange={setB}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>
                  {students.filter((s) => s.id !== a).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>סוג קשר</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as keyof typeof kindMeta)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="friend">חברים (לשבת ביחד)</SelectItem>
                  <SelectItem value="avoid">להפריד (חיכוך)</SelectItem>
                  <SelectItem value="distance">ריחוק מרחבי</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button className="w-full" disabled={!a || !b || createM.isPending} onClick={() => createM.mutate()}>
                <Plus className="ms-1 h-4 w-4" /> הוסף אילוץ
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {relations.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">עדיין אין אילוצים.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {relations.map((r) => {
            const meta = kindMeta[r.kind];
            const Icon = meta.icon;
            return (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                    <div>
                      <div className="font-medium">{nameOf(r.student_a)} ↔ {nameOf(r.student_b)}</div>
                      <div className="text-xs text-muted-foreground">{meta.label}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeM.mutate(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}