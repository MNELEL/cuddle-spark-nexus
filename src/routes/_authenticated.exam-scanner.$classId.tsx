import { createFileRoute, Link } from "@tanstack/react-router";
import { ACCEPT_IMAGE } from "@/lib/upload-accept";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Camera, Loader2, Save, ScanText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { analyzeExamPhoto, type ExamScanResult, type ExamRubricItem } from "@/lib/ai-exam.functions";
import { listStudents } from "@/lib/students.functions";
import { upsertGrade } from "@/lib/tracking.functions";
import { getClass } from "@/lib/classes.functions";
import { KODESH_SUBJECTS } from "@/lib/kodesh-subjects";

export const Route = createFileRoute("/_authenticated/exam-scanner/$classId")({
  component: ExamScannerPage,
  head: () => ({
    meta: [
      { title: "סורק מבחנים · הכיתה שלי" },
      { name: "description", content: "צלם מבחן בכתב-יד — הבינה המלאכותית מזהה שם, מנקדת לפי מחוון ושומרת את הציון." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || "");
      const idx = s.indexOf(",");
      resolve({ base64: idx >= 0 ? s.slice(idx + 1) : s, mime: file.type || "image/jpeg" });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function today() { return new Date().toISOString().slice(0, 10); }

function ExamScannerPage() {
  const { classId } = Route.useParams();
  const getCls = useServerFn(getClass);
  const list = useServerFn(listStudents);
  const analyze = useServerFn(analyzeExamPhoto);
  const save = useServerFn(upsertGrade);

  const { data: cls } = useQuery({ queryKey: ["class", classId], queryFn: () => getCls({ data: { id: classId } }) });
  const { data: students } = useQuery({ queryKey: ["students", classId], queryFn: () => list({ data: { classId } }) });

  const [subject, setSubject] = useState<string>("גמרא");
  const [totalMax, setTotalMax] = useState<number>(100);
  const [rubric, setRubric] = useState<string>(
    "שאלה 1 — הבנת הסוגיה (25)\nשאלה 2 — פירוש רש\"י (25)\nשאלה 3 — הלכה למעשה (25)\nשאלה 4 — סיכום ומסקנות (25)",
  );
  const [preview, setPreview] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExamScanResult | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (f: File | null) => {
    setFile(f);
    setResult(null);
    if (!f) { setPreview(""); return; }
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const scan = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("בחר צילום של המבחן");
      const { base64, mime } = await fileToBase64(file);
      return analyze({ data: { imageBase64: base64, mimeType: mime, subject, rubric, totalMax } });
    },
    onSuccess: (r) => {
      setResult(r);
      // try to auto-match student
      if (students && r.studentName) {
        const norm = r.studentName.trim();
        const match = students.find((s) => s.name.trim() === norm)
          ?? students.find((s) => s.name.includes(norm) || norm.includes(s.name));
        if (match) setSelectedStudentId(match.id);
      }
      toast.success("המבחן נותח בהצלחה");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הניתוח נכשל"),
  });

  const persist = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("אין תוצאה לשמור");
      if (!selectedStudentId) throw new Error("בחר תלמיד לשיוך");
      await save({
        data: {
          class_id: classId,
          student_id: selectedStudentId,
          subject: subject || result.subject || "",
          value: result.totalAwarded,
          max_value: result.totalMax,
          date: today(),
          notes: result.summary?.slice(0, 500) || "",
        },
      });
    },
    onSuccess: () => toast.success("הציון נשמר בטבלת הציונים"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  const patchItem = (idx: number, patch: Partial<ExamRubricItem>) => {
    if (!result) return;
    const items = result.items.map((it, i) => i === idx ? { ...it, ...patch } : it);
    const totalAwarded = items.reduce((s, i) => s + i.awarded, 0);
    const totalMax = items.reduce((s, i) => s + i.maxPoints, 0) || result.totalMax;
    setResult({ ...result, items, totalAwarded, totalMax, percent: Math.round((totalAwarded / totalMax) * 100) });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <Link to="/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה {cls?.name ?? ""}
        </Link>
        <Badge variant="secondary" className="gap-1"><ScanText className="h-3 w-3" /> סורק מבחנים</Badge>
      </div>
      <div>
        <h1 className="text-2xl font-bold">סורק מבחנים בכתב-יד</h1>
        <p className="text-sm text-muted-foreground">צלם דף מבחן, ה-AI יזהה את שם התלמיד וינקד לפי המחוון שהוגדר.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">הגדרות המבחן</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>מקצוע</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KODESH_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>סה"כ נקודות</Label>
              <Input type="number" min={1} max={1000} value={totalMax}
                     onChange={(e) => setTotalMax(Math.max(1, Math.min(1000, Number(e.target.value) || 100)))} />
            </div>
            <div>
              <Label>מחוון (שאלה — נקודות)</Label>
              <Textarea rows={7} value={rubric} onChange={(e) => setRubric(e.target.value)}
                        placeholder="שאלה 1 — הבנת הסוגיה (25)…" />
              <p className="mt-1 text-xs text-muted-foreground">כתוב שורה לכל שאלה עם מספר הנקודות המרבי בסוגריים.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">צילום המבחן</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_IMAGE}
              capture="environment"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => inputRef.current?.click()} variant="outline">
                <Camera className="ms-1 h-4 w-4" /> בחר / צלם
              </Button>
              <Button onClick={() => scan.mutate()} disabled={!file || scan.isPending}>
                {scan.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Sparkles className="ms-1 h-4 w-4" />}
                נתח מבחן
              </Button>
            </div>
            {preview && (
              <div className="overflow-hidden rounded-md border bg-muted/30">
                <img src={preview} alt="תצוגת המבחן שנבחר" className="max-h-72 w-full object-contain" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>תוצאה</span>
              <span className="text-2xl font-bold text-primary">{result.totalAwarded}/{result.totalMax} · {result.percent}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>שם התלמיד שזוהה</Label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{result.studentName || "לא זוהה"}</div>
              </div>
              <div>
                <Label>שיוך לתלמיד בכיתה</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger><SelectValue placeholder="בחר תלמיד" /></SelectTrigger>
                  <SelectContent>
                    {(students ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs">
                  <tr>
                    <th className="px-2 py-2 text-start">שאלה</th>
                    <th className="px-2 py-2 w-24">נקודות</th>
                    <th className="px-2 py-2 w-24">מקסימום</th>
                    <th className="px-2 py-2 text-start">הערה</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((it, i) => (
                    <tr key={it.id + i} className="border-t">
                      <td className="px-2 py-2">{it.title}</td>
                      <td className="px-2 py-1"><Input type="number" value={it.awarded} min={0} max={it.maxPoints}
                        onChange={(e) => patchItem(i, { awarded: Math.max(0, Math.min(it.maxPoints, Number(e.target.value) || 0)) })} /></td>
                      <td className="px-2 py-1"><Input type="number" value={it.maxPoints} min={0}
                        onChange={(e) => patchItem(i, { maxPoints: Math.max(0, Number(e.target.value) || 0) })} /></td>
                      <td className="px-2 py-1"><Input value={it.note ?? ""} onChange={(e) => patchItem(i, { note: e.target.value })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.summary && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="mb-1 font-semibold">סיכום</div>
                <p>{result.summary}</p>
                {result.strengths && <p className="mt-2 text-emerald-700 dark:text-emerald-400"><b>נקודות חוזק:</b> {result.strengths}</p>}
                {result.improvements && <p className="mt-1 text-amber-700 dark:text-amber-400"><b>לשיפור:</b> {result.improvements}</p>}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => persist.mutate()} disabled={!selectedStudentId || persist.isPending}>
                {persist.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Save className="ms-1 h-4 w-4" />}
                שמור ציון לתלמיד
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}