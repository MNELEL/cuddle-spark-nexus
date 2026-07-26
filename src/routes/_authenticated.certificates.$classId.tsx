import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, Award, Camera, Download, Plus, Settings, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { getClass } from "@/lib/classes.functions";
import { getCertificateData } from "@/lib/certificates.functions";
import { analyzeCertificatePhoto, suggestCertificateNotes } from "@/lib/ai-certificate.functions";
import {
  listCertificateNotes,
  upsertCertificateNote,
} from "@/lib/certificate-notes.functions";
import { useBrand } from "@/hooks/use-brand";
import { setPdfBrand } from "@/lib/pdf/pdf-builder";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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
  conducts: { key: string; label: BehaviorLabel }[];
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
    conducts: [
      { key: "הליכות", label: conduct },
      { key: "שקידה", label: conduct },
      { key: "דרך ארץ", label: conduct },
    ],
    attendance: { present, absent, late },
    teacherNote: "",
    principalNote: "",
  };
}

function CertificatesPage() {
  const { classId } = Route.useParams();
  const getC = useServerFn(getClass);
  const getData = useServerFn(getCertificateData);
  const ocrCert = useServerFn(analyzeCertificatePhoto);
  const listNotes = useServerFn(listCertificateNotes);
  const saveNote = useServerFn(upsertCertificateNote);
  const suggestNotes = useServerFn(suggestCertificateNotes);
  const { brand } = useBrand();

  const [periodKind, setPeriodKind] = useState<PeriodKind>("half_a");
  const [customFrom, setCustomFrom] = useState(periodRange("half_a").from);
  const [customTo, setCustomTo] = useState(periodRange("half_a").to);
  const [academicYear, setAcademicYear] = useState(HEBREW_YEAR);
  const [schoolName, setSchoolName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [isCorrection, setIsCorrection] = useState(false);

  // Pre-fill from brand settings once loaded (only if the field is still empty).
  useMemo(() => {
    if (brand.school_name && !schoolName) setSchoolName(brand.school_name);
    if (brand.teacher_name_default && !teacherName) setTeacherName(brand.teacher_name_default);
    if (brand.principal_name_default && !principalName) setPrincipalName(brand.principal_name_default);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand.school_name, brand.teacher_name_default, brand.principal_name_default]);

  const period = useMemo(() => {
    if (periodKind === "custom") return { from: customFrom, to: customTo, label: "טווח מותאם" };
    return periodRange(periodKind);
  }, [periodKind, customFrom, customTo]);

  const periodKey = `${period.from}_${period.to}`;

  const { data: cls } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => getC({ data: { id: classId } }),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["cert-data", classId, period.from, period.to],
    queryFn: () => getData({ data: { classId, from: period.from, to: period.to } }),
  });
  const { data: savedNotes } = useQuery({
    queryKey: ["cert-notes", classId, periodKey],
    queryFn: () => listNotes({ data: { classId, periodKey } }),
  });

  const [rows, setRows] = useState<Record<string, StudentRow>>({});

  // Recompute rows whenever the underlying data or saved notes change.
  useMemo(() => {
    if (!data) return;
    const notesById = new Map<string, (typeof savedNotes extends undefined ? never : NonNullable<typeof savedNotes>[number])>();
    for (const n of savedNotes ?? []) notesById.set(n.student_id, n);
    const next: Record<string, StudentRow> = {};
    for (const s of data.students) {
      const base = computeStudentRow(s, data.grades, data.behavior, data.attendance);
      const saved = notesById.get(s.id);
      if (!saved) { next[s.id] = base; continue; }
      const savedSubjects = Array.isArray(saved.subjects) && saved.subjects.length
        ? (saved.subjects as unknown as CertificateSubject[])
        : base.subjects;
      const savedConducts = Array.isArray(saved.conducts) && saved.conducts.length
        ? (saved.conducts as unknown as { key: string; label: BehaviorLabel }[])
        : base.conducts;
      next[s.id] = {
        ...base,
        subjects: savedSubjects,
        conducts: savedConducts,
        teacherNote: saved.teacher_note,
        principalNote: saved.principal_note,
      };
    }
    setRows(next);
  }, [data, savedNotes]);

  const persistRow = async (
    id: string,
    override?: Partial<Pick<StudentRow, "teacherNote" | "principalNote" | "subjects" | "conducts">>,
  ) => {
    const row = rows[id];
    if (!row) return;
    const merged = { ...row, ...(override ?? {}) };
    try {
      await saveNote({
        data: {
          classId,
          studentId: id,
          periodKey,
          teacherNote: merged.teacherNote,
          principalNote: merged.principalNote,
          subjects: merged.subjects,
          conducts: merged.conducts,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "השמירה נכשלה");
    }
  };
  const persistNote = persistRow;

  const patchRow = (id: string, patch: Partial<StudentRow>) =>
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const patchSubject = (id: string, idx: number, patch: Partial<CertificateSubject>) =>
    setRows((r) => {
      const row = r[id];
      if (!row) return r;
      const subjects = row.subjects.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      return { ...r, [id]: { ...row, subjects } };
    });

  const addSubject = (id: string) => {
    let nextSubjects: CertificateSubject[] = [];
    setRows((r) => {
      const row = r[id]; if (!row) return r;
      nextSubjects = [...row.subjects, { subject: "", label: "טוב", note: "" }];
      return { ...r, [id]: { ...row, subjects: nextSubjects } };
    });
    void persistRow(id, { subjects: nextSubjects });
  };

  const removeSubject = (id: string, idx: number) => {
    let nextSubjects: CertificateSubject[] = [];
    setRows((r) => {
      const row = r[id]; if (!row) return r;
      nextSubjects = row.subjects.filter((_, i) => i !== idx);
      return { ...r, [id]: { ...row, subjects: nextSubjects } };
    });
    void persistRow(id, { subjects: nextSubjects });
  };

  const patchConduct = (id: string, idx: number, patch: Partial<{ key: string; label: BehaviorLabel }>) =>
    setRows((r) => {
      const row = r[id];
      if (!row) return r;
      const conducts = row.conducts.map((c, i) => (i === idx ? { ...c, ...patch } : c));
      return { ...r, [id]: { ...row, conducts } };
    });

  const addConduct = (id: string) => {
    let nextConducts: { key: string; label: BehaviorLabel }[] = [];
    setRows((r) => {
      const row = r[id]; if (!row) return r;
      nextConducts = [...row.conducts, { key: "", label: "נאות" as BehaviorLabel }];
      return { ...r, [id]: { ...row, conducts: nextConducts } };
    });
    void persistRow(id, { conducts: nextConducts });
  };

  const removeConduct = (id: string, idx: number) => {
    let nextConducts: { key: string; label: BehaviorLabel }[] = [];
    setRows((r) => {
      const row = r[id]; if (!row) return r;
      if (row.conducts.length <= 1) {
        toast.info("צריך להישאר לפחות קטגוריית הליכות אחת");
        nextConducts = row.conducts;
        return r;
      }
      nextConducts = row.conducts.filter((_, i) => i !== idx);
      return { ...r, [id]: { ...row, conducts: nextConducts } };
    });
    if (nextConducts.length) void persistRow(id, { conducts: nextConducts });
  };

  const applyOcrToRow = async (id: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("התמונה גדולה מ-10MB"); return; }
    const b64 = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => { const s = String(r.result || ""); const i = s.indexOf(","); res(i >= 0 ? s.slice(i + 1) : s); };
      r.onerror = () => rej(new Error("קריאה נכשלה"));
      r.readAsDataURL(file);
    });
    const t = toast.loading("מזהה תעודה…");
    try {
      const result = await ocrCert({ data: { imageBase64: b64, mimeType: file.type } });
      setRows((r) => {
        const row = r[id]; if (!row) return r;
        const merged = [...row.subjects.filter((s) => s.subject)];
        for (const s of result.subjects) {
          const idx = merged.findIndex((m) => m.subject === s.subject);
          const label = ((GRADE_LABELS as readonly string[]).includes(s.label ?? "")
            ? (s.label as GradeLabel)
            : (typeof s.percent === "number" ? labelForPercent(s.percent) : "טוב"));
          const note = s.note ?? (typeof s.percent === "number" ? `${Math.round(s.percent)}%` : "");
          const merged_row: CertificateSubject = { subject: s.subject, label, note };
          if (idx >= 0) merged[idx] = merged_row; else merged.push(merged_row);
        }
        const behaviorLike = (v?: string): BehaviorLabel | undefined =>
          v && (BEHAVIOR_LABELS as readonly string[]).includes(v) ? (v as BehaviorLabel) : undefined;
        const nextConducts = [...row.conducts];
        const setConduct = (key: string, val?: string) => {
          const lab = behaviorLike(val);
          if (!lab) return;
          const idx = nextConducts.findIndex((c) => c.key === key);
          if (idx >= 0) nextConducts[idx] = { key, label: lab };
          else nextConducts.push({ key, label: lab });
        };
        setConduct("הליכות", result.conduct);
        setConduct("שקידה", result.diligence);
        setConduct("דרך ארץ", result.manners);
        return {
          ...r,
          [id]: {
            ...row,
            subjects: merged.length ? merged : row.subjects,
            conducts: nextConducts,
            teacherNote: result.teacherNote || row.teacherNote,
            principalNote: result.principalNote || row.principalNote,
          },
        };
      });
      // Persist the OCR-derived edits after the state update flushes.
      queueMicrotask(() => void persistRow(id));
      toast.success(result.summary || "הזיהוי הושלם", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הזיהוי נכשל", { id: t });
    }
  };

  /* ---- AI note suggestions dialog state ---- */
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestFor, setSuggestFor] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const openSuggest = async (studentId: string) => {
    setSuggestFor(studentId);
    setSuggestions([]);
    setSuggestOpen(true);
    setSuggestBusy(true);
    try {
      const res = await suggestNotes({
        data: { classId, studentId, from: period.from, to: period.to },
      });
      setSuggestions(res.map((r) => r.text));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ההצעות נכשלו");
      setSuggestOpen(false);
    } finally {
      setSuggestBusy(false);
    }
  };

  const applySuggestion = (text: string) => {
    if (!suggestFor) return;
    patchRow(suggestFor, { teacherNote: text });
    setSuggestOpen(false);
    void persistNoteFor(suggestFor, { teacherNote: text });
  };

  const persistNoteFor = (
    id: string,
    override: Partial<Pick<StudentRow, "teacherNote" | "principalNote">>,
  ) => persistRow(id, override);

  const buildForStudent = async (row: StudentRow, kind: "regular" | "correction" = "regular") => {
    setPdfBrand({
      schoolName: brand.school_name || schoolName || "מוסד חינוכי",
      headerLine: brand.header_line,
      logoDataUrl: brand.logo_data_url,
      primaryColor: brand.primary_color,
    });
    const blob = await buildCertificatePdfBlob({
      schoolName: schoolName || "מוסד חינוכי",
      className: cls?.name ?? "כיתה",
      studentName: row.name,
      period: `${period.label} – ${academicYear}`,
      academicYear,
      subjects: row.subjects,
      behavior: {
        conduct: row.conducts[0]?.label ?? "טוב",
        extras: row.conducts,
      },
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
    setPdfBrand({
      schoolName: brand.school_name || schoolName || "מוסד חינוכי",
      headerLine: brand.header_line,
      logoDataUrl: brand.logo_data_url,
      primaryColor: brand.primary_color,
    });
    const blob = await buildConferencePdfBlob({
      schoolName: schoolName || "מוסד חינוכי",
      className: cls?.name ?? "כיתה",
      studentName: row.name,
      period: `${period.label} – ${academicYear}`,
      strengths: row.teacherNote,
      challenges: row.principalNote,
      actionItems: "",
      gradesSummary: row.subjects.map((s) => ({ subject: s.subject, label: s.label })),
      behavior: { conduct: row.conducts[0]?.label ?? "טוב" },
      teacherName,
    });
    downloadPdfBlob(blob, `הכנה_לפגישה_${row.name}.pdf`);
  };

  const list = Object.values(rows);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link to="/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
        <Link to="/settings/brand" className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <Settings className="h-4 w-4" /> מיתוג המוסד
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
                onAddSubject={() => addSubject(row.id)}
                onRemoveSubject={(i) => removeSubject(row.id, i)}
                onOcrPhoto={(f) => applyOcrToRow(row.id, f)}
                onExport={() => buildForStudent(row, isCorrection ? "correction" : "regular")}
                onSaveNotes={() => persistNote(row.id)}
                onSuggestNotes={() => openSuggest(row.id)}
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

      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>הצעות AI להערת מחנך</DialogTitle>
          </DialogHeader>
          {suggestBusy ? (
            <p className="text-sm text-muted-foreground py-6 text-center">מכין הצעות…</p>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">לא התקבלו הצעות.</p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => applySuggestion(s)}
                  className="w-full rounded-lg border p-3 text-right text-sm hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="text-xs text-muted-foreground mb-1">הצעה {i + 1}</div>
                  {s}
                </button>
              ))}
              <p className="text-xs text-muted-foreground">
                לחיצה על הצעה תמלא את שדה "הערות המחנך" — ניתן לערוך אחר כך.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuggestOpen(false)}>סגור</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentCertCard({
  row, onPatch, onPatchSubject, onAddSubject, onRemoveSubject, onPatchConduct, onAddConduct, onRemoveConduct, onPersistConducts, onOcrPhoto, onExport, onSaveNotes, onSuggestNotes,
}: {
  row: StudentRow;
  onPatch: (p: Partial<StudentRow>) => void;
  onPatchSubject: (idx: number, p: Partial<CertificateSubject>) => void;
  onAddSubject: () => void;
  onRemoveSubject: (idx: number) => void;
  onPatchConduct: (idx: number, p: Partial<{ key: string; label: BehaviorLabel }>) => void;
  onAddConduct: () => void;
  onRemoveConduct: (idx: number) => void;
  onPersistConducts: () => void;
  onOcrPhoto: (f: File) => void;
  onExport: () => void;
  onSaveNotes: () => void;
  onSuggestNotes: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold text-lg">{row.name}</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Camera className="ms-1 h-4 w-4" /> העלה צילום תעודה
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]; e.target.value = "";
                if (f) onOcrPhoto(f);
              }}
            />
            <Button size="sm" onClick={onExport}>
              <Download className="ms-1 h-4 w-4" /> הפק תעודה
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          {row.subjects.map((s, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
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
                placeholder="חומרים / הערה / אחוז"
              />
              <Button variant="ghost" size="icon" aria-label="מחק מקצוע" onClick={() => onRemoveSubject(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={onAddSubject} className="w-fit">
            <Plus className="ms-1 h-4 w-4" /> הוסף מקצוע / נושא
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">הליכות ומידות</Label>
            <Button type="button" variant="outline" size="sm" onClick={onAddConduct} className="h-7 px-2 text-xs">
              <Plus className="ms-1 h-3.5 w-3.5" /> הוסף קטגוריה
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {row.conducts.map((c, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">שם הקטגוריה</Label>
                  <Input
                    value={c.key}
                    placeholder="למשל: השתתפות בתפילה"
                    onChange={(e) => onPatchConduct(i, { key: e.target.value })}
                    onBlur={onPersistConducts}
                  />
                </div>
                <div className="w-40">
                  <Label className="text-xs text-muted-foreground">הערכה</Label>
                  <Select
                    value={c.label}
                    onValueChange={(v) => { onPatchConduct(i, { label: v as BehaviorLabel }); onPersistConducts(); }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BEHAVIOR_LABELS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="מחק קטגוריה"
                  disabled={row.conducts.length <= 1}
                  onClick={() => onRemoveConduct(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <Label>הערות המחנך / הרב</Label>
              <Button type="button" variant="ghost" size="sm" onClick={onSuggestNotes} className="h-7 gap-1 px-2 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> הצע הערות AI
              </Button>
            </div>
            <Textarea
              rows={3}
              value={row.teacherNote}
              onChange={(e) => onPatch({ teacherNote: e.target.value })}
              onBlur={onSaveNotes}
            />
          </div>
          <div>
            <Label>הערות ההנהלה</Label>
            <Textarea
              rows={3}
              value={row.principalNote}
              onChange={(e) => onPatch({ principalNote: e.target.value })}
              onBlur={onSaveNotes}
            />
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