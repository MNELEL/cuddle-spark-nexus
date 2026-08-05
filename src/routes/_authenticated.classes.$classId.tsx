import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getClass, getClassChain, setClassStatus } from "@/lib/classes.functions";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Heart, Ban, MoveHorizontal, Pencil, Plus, Trash2, FolderOpen, FileText, Sparkles, Trophy, Users, Library, Monitor, Upload, Printer, Copy, Dices, Globe2, Award, ScanText, TrendingUp, CalendarDays, Wand2, MessageSquare, MoreHorizontal, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { copyList, printList } from "@/lib/print-list";
import { SeatingGrid } from "@/components/seating-grid";
import { GroupsTab } from "@/components/groups-tab";
import { ImportExportBar } from "@/components/import-export";
import { TrackingTab } from "@/components/tracking-tab";
import { CrmTab } from "@/components/crm-tab";
import { listClassScoreInputs } from "@/lib/scoring.functions";
import { computeStudentScore } from "@/lib/performance-score";
import { ScoreBadge } from "@/components/score-badge";
import { StudentFileSheet } from "@/components/student-file-sheet";
import { AiAssistantDock } from "@/components/ai-assistant-dock";
import { LessonsTab } from "@/components/lessons-tab";
import { SeatFillGrid } from "@/components/seat-fill-grid";
import { openCommandPalette } from "@/components/global-command-palette";

/* ---------------- Action grid (responsive toolbar) ---------------- */

function ActionBtn({ icon: Icon, label, variant = "outline" }: { icon: typeof Upload; label: string; variant?: "default" | "outline" }) {
  return (
    <Button
      variant={variant}
      size="sm"
      className="w-full justify-start whitespace-normal text-start leading-tight transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <Icon className="ms-1 h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Button>
  );
}

function ClassActionGrid({ classId, onSeating }: { classId: string; onSeating: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Button size="sm" className="w-full justify-start transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0" onClick={onSeating}>
        <LayoutGrid className="ms-1 h-4 w-4 shrink-0" />
        <span className="truncate">סידור הושבה</span>
      </Button>
      <Link to="/ingest" search={{ classId }}><ActionBtn icon={Upload} label="העלאה חכמה" /></Link>
      <Link to="/daily/$classId" params={{ classId }}><ActionBtn icon={FileText} label="סיכום יומי" /></Link>
      <Button variant="outline" size="sm" className="w-full justify-start transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0" onClick={openCommandPalette}>
        <MoreHorizontal className="ms-1 h-4 w-4 shrink-0" />
        <span className="truncate">עוד כלים</span>
      </Button>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/classes/$classId")({

/* ---------------- Archive / year chain ---------------- */
  component: ClassDetail,
  loader: async ({ params }) => {
    const { getClass } = await import("@/lib/classes.functions");
    try {
      const cls = await getClass({ data: { id: params.classId } });
      return { className: cls?.name ?? "כיתה" };
    } catch {
      return { className: "כיתה" };
    }
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.className ?? "כיתה";
    const url = `https://cuddle-spark-nexus.lovable.app/classes/${params.classId}`;
    return {
      meta: [
        { title: `${name} · ניהול כיתה · הכיתה שלי` },
        { name: "description", content: `סידור הושבה, ציונים, התנהגות וקשר עם הורים עבור כיתה ${name} ב-״הכיתה שלי״.` },
        { property: "og:title", content: `${name} · ניהול כיתה · הכיתה שלי` },
        { property: "og:description", content: `סידור הושבה, ציונים, התנהגות וקשר עם הורים עבור כיתה ${name}.` },
        { property: "og:url", content: url },
        { name: "robots", content: "noindex, nofollow" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

type Student = {
  id: string; class_id: string; name: string; notes: string | null;
  height: "low" | "mid" | "high"; row_pref: "front" | "mid" | "back" | "any"; corner_pref: boolean;
  has_special_accommodation?: boolean; accommodation_note?: string | null;
};

function ClassDetail() {
  const { classId } = Route.useParams();
  const [tab, setTab] = useState("students");
  const getC = useServerFn(getClass);
  const listS = useServerFn(listStudents);
  const listR = useServerFn(listRelations);
  const listInputs = useServerFn(listClassScoreInputs);

  const { data: cls, isLoading: clsLoading } = useQuery({ queryKey: ["class", classId], queryFn: () => getC({ data: { id: classId } }) });
  const { data: students = [] } = useQuery({ queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }) });
  const { data: relations = [] } = useQuery({ queryKey: ["relations", classId], queryFn: () => listR({ data: { classId } }) });
  const { data: scoreInputs } = useQuery({ queryKey: ["score-inputs", classId], queryFn: () => listInputs({ data: { classId } }) });
  const isArchived = (cls as { status?: string } | undefined)?.status === "archived";
  const academicYear = (cls as { academic_year?: string | null } | undefined)?.academic_year ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/classes" className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתות
        </Link>
      </div>
      {isArchived ? <ArchivedBanner classId={classId} /> : <ClassActionGrid classId={classId} onSeating={() => setTab("seating")} />}
      <div className="relative overflow-hidden rounded-2xl border bg-primary p-6 text-primary-foreground shadow-sm">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <SeatFillGrid rows={4} cols={12} className="h-full" />
        </div>
        <div className="relative z-10">
          {clsLoading ? (
            <div aria-busy="true" aria-label="טוען פרטי כיתה">
              <div aria-hidden="true">
                <Skeleton className="h-9 w-52 bg-primary-foreground/20" />
                <Skeleton className="mt-2 h-4 w-40 bg-primary-foreground/20" />
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-bold tracking-tight">{cls?.name ?? "כיתה"}</h1>
                {academicYear && (
                  <Badge variant="secondary" className="font-mono-tabular">{academicYear}</Badge>
                )}
                {isArchived && <Badge variant="secondary">בארכיון · לצפייה בלבד</Badge>}
              </div>
              <p className="mt-1 text-sm text-primary-foreground/85 font-mono-tabular">
                {students.length} תלמידים · {relations.length} אילוצים
              </p>
            </>
          )}
        </div>
      </div>

      <YearChain classId={classId} />

      <Tabs value={tab} onValueChange={setTab} dir="rtl">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="students">תלמידים</TabsTrigger>
          <TabsTrigger value="relations">אילוצים</TabsTrigger>
          <TabsTrigger value="groups">קבוצות</TabsTrigger>
          <TabsTrigger value="seating">סידור הושבה</TabsTrigger>
          <TabsTrigger value="tracking">ציונים ונוכחות</TabsTrigger>
          <TabsTrigger value="crm">CRM פדגוגי</TabsTrigger>
          <TabsTrigger value="lessons">הקלטות שיעור</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          <div className="mb-3"><ImportExportBar classId={classId} /></div>
          <StudentsTab classId={classId} students={students as Student[]} scoreInputs={scoreInputs} />
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

        <TabsContent value="tracking" className="mt-4">
          <TrackingTab classId={classId} />
        </TabsContent>

        <TabsContent value="crm" className="mt-4">
          <CrmTab classId={classId} />
        </TabsContent>

        <TabsContent value="lessons" className="mt-4">
          <LessonsTab classId={classId} />
        </TabsContent>
      </Tabs>
      <AiAssistantDock classId={classId} />
    </div>
  );
}

/* ---------------- Students ---------------- */

const heightLabel = { low: "נמוך", mid: "בינוני", high: "גבוה" };
const rowLabel = { front: "קדמית", mid: "אמצעית", back: "אחורית", any: "לא משנה" };

function StudentsTab({
  classId, students, scoreInputs,
}: {
  classId: string; students: Student[];
  scoreInputs?: { grades: { student_id: string; value: number; max_value: number }[]; attendance: { student_id: string; status: string }[]; behavior: { student_id: string; points: number }[] };
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [fileFor, setFileFor] = useState<Student | null>(null);
  const className = "רשימת תלמידים";

  const doPrint = () => {
    if (!students.length) return toast.error("אין תלמידים");
    printList(className, [{ title: className, items: students.map((s) => s.name) }]);
  };
  const doCopy = async () => {
    if (!students.length) return toast.error("אין תלמידים");
    await navigator.clipboard.writeText(copyList([{ title: className, items: students.map((s) => s.name) }]));
    toast.success("הועתק");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={doPrint}><Printer className="ms-1 h-4 w-4" /> הדפסה</Button>
        <Button variant="outline" size="sm" onClick={doCopy}><Copy className="ms-1 h-4 w-4" /> העתק שמות</Button>
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
            <StudentRow key={s.id} student={s} scoreInputs={scoreInputs}
              onEdit={() => { setEditing(s); setOpen(true); }}
              onOpenFile={() => setFileFor(s)} />
          ))}
        </div>
      )}

      {fileFor && (
        <StudentFileSheet
          open={!!fileFor}
          onOpenChange={(o) => { if (!o) setFileFor(null); }}
          classId={classId}
          studentId={fileFor.id}
          studentName={fileFor.name}
        />
      )}
    </div>
  );
}

function StudentRow({
  student, onEdit, onOpenFile, scoreInputs,
}: {
  student: Student; onEdit: () => void; onOpenFile: () => void;
  scoreInputs?: { grades: { student_id: string; value: number; max_value: number }[]; attendance: { student_id: string; status: string }[]; behavior: { student_id: string; points: number }[] };
}) {
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
  const score = scoreInputs
    ? computeStudentScore(student.id, scoreInputs.grades, scoreInputs.attendance, scoreInputs.behavior)
    : null;

  return (
    <Card className="transition hover:border-amber/40 hover:shadow-sm">
      <CardContent className="flex items-center justify-between py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{student.name}</span>
            {score && <ScoreBadge score={score} size="sm" />}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="secondary">גובה: {heightLabel[student.height]}</Badge>
            <Badge variant="secondary">שורה: {rowLabel[student.row_pref]}</Badge>
            {student.corner_pref && <Badge variant="secondary">פינה</Badge>}
          </div>
          {student.notes && <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{student.notes}</p>}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label={`פתח תיק תלמיד עבור ${student.name}`} onClick={onOpenFile} title="תיק תלמיד">
            <FolderOpen className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`ערוך את ${student.name}`} onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label={`מחק את ${student.name}`} className="text-destructive" onClick={() => removeM.mutate()}>
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
  const [special, setSpecial] = useState(editing?.has_special_accommodation ?? false);
  const [accNote, setAccNote] = useState(editing?.accommodation_note ?? "");

  const m = useMutation({
    mutationFn: () => upsert({ data: {
      id: editing?.id, class_id: classId, name: name.trim(),
      notes, height, row_pref: rowPref, corner_pref: corner,
      has_special_accommodation: special,
      accommodation_note: special ? (accNote || null) : null,
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
        <div className="rounded-md border p-3 space-y-2 bg-amber/5">
          <div className="flex items-center gap-2">
            <Checkbox id="special" checked={special} onCheckedChange={(v) => setSpecial(!!v)} />
            <Label htmlFor="special" className="cursor-pointer">התאמות / צרכים מיוחדים</Label>
          </div>
          {special && (
            <Textarea value={accNote} onChange={(e) => setAccNote(e.target.value)} rows={2} placeholder="למשל: זקוק לישיבה קדמית, קושי בריכוז, התאמות במבחן..." />
          )}
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
                  <Button variant="ghost" size="icon" aria-label="מחק יחס" className="text-destructive" onClick={() => removeM.mutate(r.id)}>
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