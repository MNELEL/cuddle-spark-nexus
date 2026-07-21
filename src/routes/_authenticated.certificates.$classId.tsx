import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowRight, Award, Download, Users } from "lucide-react";
import { toast } from "sonner";

import { getClass } from "@/lib/classes.functions";
import { getCertificateData } from "@/lib/certificates.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  buildCertificatePdfBlob,
  buildConferencePdfBlob,
  certificateFilename,
  labelForPercent,
  GRADE_LABELS,
  BEHAVIOR_LABELS,
  type GradeLabel,
  type BehaviorLabel,
  type CertificateSubject,
} from "@/lib/pdf/certificate-pdf";
import { downloadPdfBlob } from "@/lib/pdf/pdf-builder";

export const Route = createFileRoute("/_authenticated/certificates/$classId")({
  component: CertificatesPage,
  head: () => ({
    meta: [
      { title: "הפקת תעודות · ClassAlign Studio" },
      { name: "description", content: "הפקת תעודות מעקב, ציונים והליכות בסגנון קלאסי — חצי שנתי, שליש שנתי ושנתי, כולל דף הכנה לפגישת הורים ומורים." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

/* ---------------- Period presets ---------------- */

type PeriodKind = "half_a" | "half_b" | "third_a" | "third_b" | "third_c" | "year" | "custom";

const HEBREW_YEAR = "תשפ״ו";

function currentAcademicYearStart(): number {
  const now = new Date();
  const year = now.getFullYear();
  // Academic year starts in Sept
  return now.getMonth() >= 7 ? year : year - 1;
}

function periodRange(kind: PeriodKind): { from: string; to: string; label: string } {
  const y = currentAcademicYearStart();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  switch (kind) {
    case "half_a":
      return { from: `${y}-09-01`, to: `${y + 1}-01-31`, label: "מחצית א'" };
    case "half_b":
      return { from: `${y + 1}-02-01`, to: `${y + 1}-06-30`, label: "מחצית ב'" };
    case "third_a":
      return { from: `${y}-09-01`, to: `${y}-12-15`, label: "שליש א'" };
    case "third_b":
      return { from: `${y}-12-16`, to: `${y + 1}-03-31`, label: "שליש ב'" };
    case "third_c":
      return { from: `${y + 1}-04-01`, to: `${y + 1}-06-30`, label: "שליש ג'" };
    case "year":
      return { from: `${y}-09-01`, to: `${y + 1}-06-30`, label: "סיכום שנתי" };
    default: {
      const today = iso(new Date());
      return { from: `${y}-09-01`, to: today, label: "טווח מותאם" };
    }
  }
}

type StudentRow = {
  id: string;
  name: string;
  subjects: CertificateSubject[];
  conduct: BehaviorLabel;
  diligence: BehaviorLabel;
  manners: BehaviorLabel;
  attendance: { present: number; absent: number; late: number };
  teacherNote: string;
  principalNote: string;
};

function computeStudentRow(
  student: { id: string; name: string },
  grades: { student_id: string; subject: string; value: number; max_value: number }[],
  behavior: { student_id: string; points: number }[],
  attendance: { student_id: string; status: string }[],
): StudentRow {
  const mine = grades.filter((g) => g.student_id === student.id);
  const bySubject = new Map<string, { sum: number; max: number }>();
  for (const g of mine) {
    const subj = (g.subject || "כללי").trim();
    const cur = bySubject.get(subj) ?? { sum: 0, max: 0 };
    cur.sum += Number(g.value) || 0;
    cur.max += Number(g.max_value) || 100;
    bySubject.set(subj, cur);
  }
  const subjects: CertificateSubject[] = Array.from(bySubject.entries()).map(([subject, v]) => {
    const pct = v.max > 0 ? (v.sum / v.max) * 100 : 0;
    return { subject, label: labelForPercent(pct), note: `${Math.round(pct)}%` };
  });

  const bp = behavior.filter((b) => b.student_id === student.id).reduce((s, b) => s + Number(b.points || 0), 0);
  const conduct: BehaviorLabel =
    bp >= 10 ? "ראוי לשבח" : bp >= 0 ? "נאות" : bp >= -5 ? "בינוני" : "טעון שיפור";

  const att = attendance.filter((a) => a.student_id === student.id);
  const present = att.filter((a) => a.status === "present").length;
  const absent = att.filter((a) => a.status === "absent").length;
  const late = att.filter((a) => a.status === "late").length;

  return {
    id: student.id,
    name: student.name,
    subjects: subjects.length ? subjects : [{ subject: "כללי", label: "טוב", note: "" }],
    conduct,
    diligence: conduct,
    manners: conduct,
    attendance: { present, absent, late },
    teacherNote: "",
    principalNote: "",
  };
}

function CertificatesPage() {
  const { classId } = Route.useParams();
  const getC = useServerFn(getClass);
  const getData = useServerFn(getCertificateData);

  const [periodKind, setPeriodKind] = useState<PeriodKind>("half_a");
  const [customFrom, setCustomFrom] = useState(periodRange("half_a").from);
  const [customTo, setCustomTo] = useState(periodRange("half_a").to);
  const [academicYear, setAcademicYear] = useState(HEBREW_YEAR);
  const [schoolName, setSchoolName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [isCorrection, setIsCorrection] = useState(false);

  const period = useMemo(() => {
    if (periodKind === "custom") return { from: customFrom, to: customTo, label: "טווח מותאם" };
    return periodRange(periodKind);
  }, [periodKind, customFrom, customTo]);

  const { data: cls } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getC({ data: { id: classId } }),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["cert-data", classId, period.from, period.to],
    queryFn: () => getData({ data: { classId, from: period.from, to: period.to } }),
  });

  const [rows, setRows] = useState<Record<string, StudentRow>>({});

  // Recompute rows whenever the underlying data changes.
  useMemo(() => {
    if (!data) return;
    const next: Record<string, StudentRow> = {};
    for (const s of data.students) {
      next[s.id] = computeStudentRow(s, data.grades, data.behavior, data.attendance);
    }
    setRows(next);
  }, [data]);

  const patchRow = (id: string, patch: Partial<StudentRow>) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const patchSubject = (id: string, idx: number, patch: Partial<CertificateSubject>) =>
    setRows((r) => {
      const row = r[id];
      if (!row) return r;
      const subjects = row.subjects.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      return { ...r, [id]: { ...row, subjects } };
    });

  const buildForStudent = async (row: StudentRow, kind: "regular" | "correction" = "regular") => {
    const blob = await buildCertificatePdfBlob({
      schoolName: schoolName || "מוסד חינוכי",
      className: cls?.name ?? "כיתה",
      studentName: row.name,
      period: `${period.label} – ${academicYear}`,
      academicYear,
      subjects: row.subjects,
      behavior: { conduct: row.conduct, diligence: row.diligence, manners: row.manners },
      attendance: row.attendance,
      teacherNote: row.teacherNote,
      principalNote: row.principalNote,
      teacherName,
      principalName,
      issueDate: new Date().toISOString().slice(0, 10),
      type: kind,
    });
    downloadPdfBlob(blob, certificateFilename(row.name, period.label));
  };

  const generateAll = async () => {
    const list = Object.values(rows);
    if (!list.length) return toast.error("אין תלמידים");
    toast.info(`מפיק ${list.length} תעודות…`);
    for (const row of list) {
      await buildForStudent(row, isCorrection ? "correction" : "regular");
    }
    toast.success("הופקו כל התעודות");
  };

  const buildConference = async (row: StudentRow) => {
    const blob = await buildConferencePdfBlob({
      schoolName: schoolName || "מוסד חינוכי",
      className: cls?.name ?? "כיתה",
      studentName: row.name,
      period: `${period.label} – ${academicYear}`,
      strengths: row.teacherNote,
      challenges: row.principalNote,
      actionItems: "",
      gradesSummary: row.subjects.map((s) => ({ subject: s.subject, label: s.label })),
      behavior: { conduct: row.conduct },
      teacherName,
    });
    downloadPdfBlob(blob, `הכנה_לפגישה_${row.name}.pdf`);
  };

  const list = Object.values(rows);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
      </div>

      <div className="rounded-2xl border bg-card bg-mesh p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Award className="h-8 w-8 text-amber-500" />
          <div>
            <h1 className="font-display text-3xl font-bold">הפקת תעודות</h1>
            <p className="text-sm text-muted-foreground">
              כיתה {cls?.name ?? "…"} · תעודות בסגנון קלאסי (מצוין / טוב מאוד / …) עם הליכות ונוכחות
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">הגדרות תעודה</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>תקופה</Label>
            <Select value={periodKind} onValueChange={(v) => setPeriodKind(v as PeriodKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="half_a">מחצית א'</SelectItem>
                <SelectItem value="half_b">מחצית ב'</SelectItem>
                <SelectItem value="third_a">שליש א'</SelectItem>
                <SelectItem value="third_b">שליש ב'</SelectItem>
                <SelectItem value="third_c">שליש ג'</SelectItem>
                <SelectItem value="year">סיכום שנתי</SelectItem>
                <SelectItem value="custom">טווח מותאם</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">{period.from} — {period.to}</p>
          </div>
          <div>
            <Label>שנה"ל</Label>
            <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
          </div>
          <div>
            <Label>שם המוסד</Label>
            <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="ת״ת / ישיבה / ביה״ס" />
          </div>
          <div>
            <Label>שם המחנך / הרב</Label>
            <Input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} />
          </div>
          <div>
            <Label>שם ההנהלה</Label>
            <Input value={principalName} onChange={(e) => setPrincipalName(e.target.value)} />
          </div>
          {periodKind === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>מתאריך</Label>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              </div>
              <div>
                <Label>עד תאריך</Label>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </div>
            </div>
          )}
          <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-2 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isCorrection}
                onChange={(e) => setIsCorrection(e.target.checked)}
                className="h-4 w-4"
              />
              סמן כתעודת תיקון
            </label>
            <Button onClick={generateAll} disabled={!list.length}>
              <Download className="ms-1 h-4 w-4" /> הפק תעודות לכל הכיתה
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="certs" dir="rtl">
        <TabsList>
          <TabsTrigger value="certs">תעודות ({list.length})</TabsTrigger>
          <TabsTrigger value="conference">הכנה לפגישת הורים</TabsTrigger>
        </TabsList>

        <TabsContent value="certs" className="mt-4 space-y-3">
          {isLoading ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">טוען נתונים…</CardContent></Card>
          ) : list.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">אין נתונים בטווח הנבחר.</CardContent></Card>
          ) : (
            list.map((row) => (
              <StudentCertCard
                key={row.id}
                row={row}
                onPatch={(p) => patchRow(row.id, p)}
                onPatchSubject={(i, p) => patchSubject(row.id, i, p)}
                onExport={() => buildForStudent(row, isCorrection ? "correction" : "regular")}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="conference" className="mt-4 space-y-3">
          {list.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">אין נתונים.</CardContent></Card>
          ) : (
            list.map((row) => (
              <Card key={row.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{row.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.subjects.slice(0, 3).map((s) => (
                        <Badge key={s.subject} variant="secondary">{s.subject}: {s.label}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => buildConference(row)}>
                    <Users className="ms-1 h-4 w-4" /> הפק דף הכנה
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StudentCertCard({
  row, onPatch, onPatchSubject, onExport,
}: {
  row: StudentRow;
  onPatch: (p: Partial<StudentRow>) => void;
  onPatchSubject: (idx: number, p: Partial<CertificateSubject>) => void;
  onExport: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold text-lg">{row.name}</div>
          <Button size="sm" onClick={onExport}>
            <Download className="ms-1 h-4 w-4" /> הפק תעודה
          </Button>
        </div>

        <div className="grid gap-2">
          {row.subjects.map((s, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <Input
                value={s.subject}
                onChange={(e) => onPatchSubject(i, { subject: e.target.value })}
                placeholder="מקצוע"
              />
              <Select value={s.label} onValueChange={(v) => onPatchSubject(i, { label: v as GradeLabel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRADE_LABELS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                value={s.note ?? ""}
                onChange={(e) => onPatchSubject(i, { note: e.target.value })}
                placeholder="הערה / אחוז"
              />
            </div>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <BehaviorSelect label="הליכות" value={row.conduct} onChange={(v) => onPatch({ conduct: v })} />
          <BehaviorSelect label="שקידה" value={row.diligence} onChange={(v) => onPatch({ diligence: v })} />
          <BehaviorSelect label="דרך ארץ" value={row.manners} onChange={(v) => onPatch({ manners: v })} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>הערות המחנך / הרב</Label>
            <Textarea rows={2} value={row.teacherNote} onChange={(e) => onPatch({ teacherNote: e.target.value })} />
          </div>
          <div>
            <Label>הערות ההנהלה</Label>
            <Textarea rows={2} value={row.principalNote} onChange={(e) => onPatch({ principalNote: e.target.value })} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">נוכח: {row.attendance.present}</Badge>
          <Badge variant="secondary">נעדר: {row.attendance.absent}</Badge>
          <Badge variant="secondary">איחורים: {row.attendance.late}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function BehaviorSelect({
  label, value, onChange,
}: { label: string; value: BehaviorLabel; onChange: (v: BehaviorLabel) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as BehaviorLabel)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {BEHAVIOR_LABELS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}