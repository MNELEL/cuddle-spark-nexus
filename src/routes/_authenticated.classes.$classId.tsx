import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
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
import { listClassProfiles } from "@/lib/student-profiles.functions";
import { buildHandoffPdfBlob, handoffPdfFilename } from "@/lib/pdf/handoff-report-pdf";
import { downloadPdfBlob } from "@/lib/pdf/pdf-builder";
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
import { isValidClassId } from "@/lib/class-id-guard";
import { nextHebrewBirthday, daysUntilLabel, toHebrewDateLabel } from "@/lib/hebrew-date";
import { phoneHref, whatsappHref } from "@/lib/student-field-validation";

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

/* ---------------- Archive / year chain ---------------- */

function ArchivedBanner({ classId }: { classId: string }) {
  const setStatus = useServerFn(setClassStatus);
  const qc = useQueryClient();
  const restoreM = useMutation({
    mutationFn: () => setStatus({ data: { id: classId, status: "active" as const } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class", classId] });
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast.success("הכיתה הוחזרה לפעילות");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm">
        כיתה זו בארכיון — הנתונים נשמרים לצפייה בלבד ולא ניתן לערוך אותם.
      </p>
      <Button size="sm" variant="outline" className="rounded-xl" disabled={restoreM.isPending} onClick={() => restoreM.mutate()}>
        החזר לפעילות
      </Button>
    </div>
  );
}

function YearChain({ classId }: { classId: string }) {
  const chainFn = useServerFn(getClassChain);
  const { data } = useQuery({
    queryKey: ["class-chain", classId],
    queryFn: () => chainFn({ data: { classId } }),
  });
  const prev = data?.previous ?? null;
  const nextList = data?.next ?? [];
  if (!prev && nextList.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {prev && (
        <Link
          to="/classes/$classId"
          params={{ classId: prev.id }}
          className="rounded-xl border px-3 py-1.5 text-muted-foreground transition-colors hover:text-primary"
        >
          שנה קודמת: {prev.name}{prev.academicYear ? ` · ${prev.academicYear}` : ""}
        </Link>
      )}
      {nextList.map((n) => (
        <Link
          key={n.id}
          to="/classes/$classId"
          params={{ classId: n.id }}
          className="rounded-xl border px-3 py-1.5 text-muted-foreground transition-colors hover:text-primary"
        >
          שנה הבאה: {n.name}{n.academicYear ? ` · ${n.academicYear}` : ""}
        </Link>
      ))}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/classes/$classId")({
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
  first_name?: string | null; last_name?: string | null;
  national_id?: string | null; birth_date?: string | null; address?: string | null;
  father_name?: string | null; father_id?: string | null; father_phone?: string | null;
  mother_name?: string | null; mother_id?: string | null; mother_phone?: string | null;
  seat_row?: number | null; seat_col?: number | null;
};

function ClassDetail() {
  const { classId } = Route.useParams();
  const validClass = isValidClassId(classId);
  const [tab, setTab] = useState("students");
  const getC = useServerFn(getClass);
  const listS = useServerFn(listStudents);
  const listR = useServerFn(listRelations);
  const listInputs = useServerFn(listClassScoreInputs);

  const { data: cls, isLoading: clsLoading } = useQuery({ queryKey: ["class", classId], queryFn: () => getC({ data: { id: classId } }), enabled: validClass });
  const { data: students = [] } = useQuery({ queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }), enabled: validClass });
  const { data: relations = [] } = useQuery({ queryKey: ["relations", classId], queryFn: () => listR({ data: { classId } }), enabled: validClass });
  const { data: scoreInputs } = useQuery({ queryKey: ["score-inputs", classId], queryFn: () => listInputs({ data: { classId } }), enabled: validClass });
  const isArchived = (cls as { status?: string } | undefined)?.status === "archived";
  const academicYear = (cls as { academic_year?: string | null } | undefined)?.academic_year ?? null;

  if (!validClass) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="font-display text-2xl font-bold">כיתה לא נמצאה</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          הקישור שהגעת אליו אינו מפנה לכיתה קיימת.
        </p>
        <Link to="/classes" className="mt-4 inline-flex">
          <Button variant="outline"><ArrowRight className="ms-1 h-4 w-4" /> חזרה לכיתות</Button>
        </Link>
      </div>
    );
  }

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

/* ---- sorting ---- */

const SORT_OPTIONS = {
  first_name: "שם פרטי",
  last_name: "שם משפחה",
  parent_name: "שם הורה",
  birthday: "יום הולדת קרוב",
  score: "ציון (גבוה→נמוך)",
  seat: "מקום ישיבה",
} as const;
type SortKey = keyof typeof SORT_OPTIONS;

function sortStorageKey(classId: string) { return `students-sort:${classId}`; }

function parentSortName(s: Student): string {
  return (s.father_name?.trim() || s.mother_name?.trim() || "");
}

function sortStudents(
  students: Student[],
  key: SortKey,
  scoreOf: (id: string) => number | null,
): Student[] {
  const he = (a: string, b: string) => a.localeCompare(b, "he");
  const rows = [...students];
  switch (key) {
    case "first_name":
      return rows.sort((a, b) => he(a.first_name?.trim() || a.name, b.first_name?.trim() || b.name));
    case "last_name":
      return rows.sort((a, b) => he(a.last_name?.trim() || a.name, b.last_name?.trim() || b.name));
    case "parent_name":
      return rows.sort((a, b) => {
        const pa = parentSortName(a);
        const pb = parentSortName(b);
        // students with no parent name at all sink to the bottom
        if (!pa && !pb) return he(a.name, b.name);
        if (!pa) return 1;
        if (!pb) return -1;
        return he(pa, pb) || he(a.name, b.name);
      });
    case "birthday":
      return rows.sort((a, b) => {
        const da = nextHebrewBirthday(a.birth_date)?.daysUntil;
        const db = nextHebrewBirthday(b.birth_date)?.daysUntil;
        if (da == null && db == null) return he(a.name, b.name);
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
    case "score":
      return rows.sort((a, b) => {
        const sa = scoreOf(a.id);
        const sb = scoreOf(b.id);
        if (sa == null && sb == null) return he(a.name, b.name);
        if (sa == null) return 1;
        if (sb == null) return -1;
        return sb - sa;
      });
    case "seat":
      return rows.sort((a, b) => {
        const seated = (s: Student) => s.seat_row != null && s.seat_col != null;
        if (!seated(a) && !seated(b)) return he(a.name, b.name);
        if (!seated(a)) return 1;
        if (!seated(b)) return -1;
        return (a.seat_row! - b.seat_row!) || (a.seat_col! - b.seat_col!);
      });
  }
}

/* ---- upcoming Hebrew birthdays banner ---- */

function UpcomingBirthdays({ students }: { students: Student[] }) {
  const upcoming = students
    .map((s) => ({ s, b: nextHebrewBirthday(s.birth_date) }))
    .filter((x): x is { s: Student; b: NonNullable<ReturnType<typeof nextHebrewBirthday>> } =>
      !!x.b && x.b.daysUntil <= 14)
    .sort((a, b) => a.b.daysUntil - b.b.daysUntil);

  if (upcoming.length === 0) return null;
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CalendarDays className="h-4 w-4" /> ימי הולדת קרובים (14 הימים הבאים)
      </p>
      <ul className="mt-2 flex flex-wrap gap-2 text-xs">
        {upcoming.map(({ s, b }) => (
          <li key={s.id} className="rounded-lg border bg-background px-2 py-1">
            <span className="font-medium">{s.name}</span>
            <span className="text-muted-foreground"> · {b.hebrewLabel} · {daysUntilLabel(b.daysUntil)}</span>
            {b.age != null && <span className="text-muted-foreground"> · גיל {b.age}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StudentsTab({
  classId, students, scoreInputs,
}: {
  classId: string; students: Student[];
  scoreInputs?: { grades: { student_id: string; value: number; max_value: number }[]; attendance: { student_id: string; status: string }[]; behavior: { student_id: string; points: number }[] };
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [fileFor, setFileFor] = useState<Student | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("first_name");
  useEffect(() => {
    const saved = localStorage.getItem(sortStorageKey(classId));
    if (saved && saved in SORT_OPTIONS) setSortKey(saved as SortKey);
  }, [classId]);
  const changeSort = (k: SortKey) => {
    setSortKey(k);
    localStorage.setItem(sortStorageKey(classId), k);
  };

  const scoreOf = (id: string) =>
    scoreInputs
      ? computeStudentScore(id, scoreInputs.grades, scoreInputs.attendance, scoreInputs.behavior)?.score ?? null
      : null;
  const sorted = useMemo(
    () => sortStudents(students, sortKey, scoreOf),
    [students, sortKey, scoreInputs],
  );
  const className = "רשימת תלמידים";
  const profilesFn = useServerFn(listClassProfiles);
  const handoffM = useMutation({
    mutationFn: async () => {
      const rows = await profilesFn({ data: { classId } });
      if (rows.length === 0) throw new Error("אין פרופילי תלמידים מתועדים");
      const blob = await buildHandoffPdfBlob("הכיתה", rows);
      downloadPdfBlob(blob, handoffPdfFilename("class"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

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
        <div className="me-auto flex items-center gap-2">
          <Label htmlFor="students-sort" className="text-xs text-muted-foreground">מיון</Label>
          <Select value={sortKey} onValueChange={(v) => changeSort(v as SortKey)}>
            <SelectTrigger id="students-sort" className="h-9 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_OPTIONS).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={doPrint}><Printer className="ms-1 h-4 w-4" /> הדפסה</Button>
        <Button variant="outline" size="sm" onClick={doCopy}><Copy className="ms-1 h-4 w-4" /> העתק שמות</Button>
        <Button variant="outline" size="sm" disabled={handoffM.isPending} onClick={() => handoffM.mutate()}>
          <FileText className="ms-1 h-4 w-4" /> {handoffM.isPending ? "מכין…" : "מסמך מסירה PDF"}
        </Button>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="ms-1 h-4 w-4" /> הוסף תלמיד</Button>
          </DialogTrigger>
          <StudentDialog classId={classId} editing={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      <UpcomingBirthdays students={students} />

      {students.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">אין תלמידים. הוסף את הראשון.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {sorted.map((s) => (
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

/* ---- compact personal details line on the student card ---- */

function PhoneLink({ label, phone }: { label: string; phone: string }) {
  const tel = phoneHref(phone);
  const wa = whatsappHref(phone);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted-foreground">{label}:</span>
      {tel ? (
        <a href={`tel:${tel}`} className="font-mono-tabular hover:underline" onClick={(e) => e.stopPropagation()}>{phone}</a>
      ) : (
        <span className="font-mono-tabular">{phone}</span>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`וואטסאפ ל${label}`} className="text-emerald-600 hover:underline" onClick={(e) => e.stopPropagation()}>
          <MessageSquare className="h-3 w-3" />
        </a>
      )}
    </span>
  );
}

function StudentDetailsLine({ student }: { student: Student }) {
  const bday = nextHebrewBirthday(student.birth_date);
  const hebLabel = toHebrewDateLabel(student.birth_date);
  const items: React.ReactNode[] = [];

  if (student.national_id?.trim()) {
    items.push(<span key="id"><span className="text-muted-foreground">ת.ז.:</span> <span className="font-mono-tabular">{student.national_id}</span></span>);
  }
  if (student.birth_date) {
    items.push(
      <span key="bd">
        <span className="text-muted-foreground">לידה:</span>{" "}
        <span className="font-mono-tabular">{student.birth_date}</span>
        {hebLabel && <span> · {hebLabel}</span>}
        {bday && <span className="text-amber-700 dark:text-amber-400"> · {daysUntilLabel(bday.daysUntil)}</span>}
      </span>,
    );
  }
  if (student.address?.trim()) {
    items.push(<span key="addr"><span className="text-muted-foreground">כתובת:</span> {student.address}</span>);
  }
  if (student.father_name?.trim()) {
    items.push(<span key="f"><span className="text-muted-foreground">אב:</span> {student.father_name}</span>);
  }
  if (student.father_phone?.trim()) {
    items.push(<PhoneLink key="fp" label="טל׳ אב" phone={student.father_phone} />);
  }
  if (student.mother_name?.trim()) {
    items.push(<span key="m"><span className="text-muted-foreground">אם:</span> {student.mother_name}</span>);
  }
  if (student.mother_phone?.trim()) {
    items.push(<PhoneLink key="mp" label="טל׳ אם" phone={student.mother_phone} />);
  }

  if (items.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {items}
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
          <StudentDetailsLine student={student} />
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
  const [firstName, setFirstName] = useState(
    editing?.first_name ?? (editing ? (editing.name ?? "").trim().split(/\s+/)[0] ?? "" : ""),
  );
  const [lastName, setLastName] = useState(
    editing?.last_name ?? (editing ? (editing.name ?? "").trim().split(/\s+/).slice(1).join(" ") : ""),
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [height, setHeight] = useState<Student["height"]>(editing?.height ?? "mid");
  const [rowPref, setRowPref] = useState<Student["row_pref"]>(editing?.row_pref ?? "any");
  const [corner, setCorner] = useState(editing?.corner_pref ?? false);
  const [special, setSpecial] = useState(editing?.has_special_accommodation ?? false);
  const [accNote, setAccNote] = useState(editing?.accommodation_note ?? "");

  const m = useMutation({
    mutationFn: () => upsert({ data: {
      id: editing?.id, class_id: classId,
      name: [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="st-first">שם פרטי</Label>
            <Input id="st-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="st-last">שם משפחה</Label>
            <Input id="st-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
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
        <Button onClick={() => m.mutate()} disabled={!firstName.trim() || m.isPending}>
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