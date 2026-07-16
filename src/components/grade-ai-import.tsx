import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, Sparkles, Loader2, Check, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { KODESH_SUBJECTS } from "@/lib/kodesh-subjects";
import { parseGradesFromText, bulkInsertGrades, ocrGradesImage, type ParsedGradeRow } from "@/lib/ai-grades.functions";

type Student = { id: string; name: string };

// Minimal Web Speech API typing
type SpeechRec = {
  start: () => void;
  stop: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: (e: unknown) => void;
};

function getRecognition(): SpeechRec | null {
  const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.continuous = true;
  r.interimResults = false;
  r.lang = "he-IL";
  return r;
}

const today = () => new Date().toISOString().slice(0, 10);

export function GradeAiImport({ classId, students }: { classId: string; students: Student[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="ms-1 h-4 w-4" /> קליטה חכמה
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> קליטת ציונים בטקסט חופשי / הקלטה
          </DialogTitle>
        </DialogHeader>
        {open && <Inner classId={classId} students={students} onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Inner({ classId, students, onClose }: { classId: string; students: Student[]; onClose: () => void }) {
  const qc = useQueryClient();
  const parse = useServerFn(parseGradesFromText);
  const save = useServerFn(bulkInsertGrades);
  const ocr = useServerFn(ocrGradesImage);

  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [maxVal, setMaxVal] = useState("100");
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState<ParsedGradeRow[] | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  useEffect(() => () => { recRef.current?.stop(); }, []);

  const onPickImage = () => fileRef.current?.click();

  const onImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("יש לבחור קובץ תמונה"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("התמונה גדולה מדי (מקסימום 10MB)"); return; }
    setOcrLoading(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const s = String(r.result || "");
          const i = s.indexOf(",");
          resolve(i >= 0 ? s.slice(i + 1) : s);
        };
        r.onerror = () => reject(new Error("קריאת הקובץ נכשלה"));
        r.readAsDataURL(file);
      });
      const res = await ocr({ data: {
        classId, imageBase64: b64, mimeType: file.type,
        defaultSubject: subject, defaultMax: Number(maxVal) || 100,
      }});
      if (!res.text) { toast.warning("לא זוהו ציונים בתמונה"); return; }
      setText((t) => (t ? t + "\n" : "") + res.text);
      toast.success("הציונים מהתמונה נוספו לטקסט");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בעיבוד התמונה");
    } finally {
      setOcrLoading(false);
    }
  };

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    const r = getRecognition();
    if (!r) { toast.error("הדפדפן לא תומך בהקלטת קול"); return; }
    recRef.current = r;
    r.onresult = (e) => {
      let chunk = "";
      for (let i = 0; i < e.results.length; i++) chunk += e.results[i][0].transcript + " ";
      setText((t) => (t ? t + " " : "") + chunk.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); toast.error("שגיאה בהקלטה"); };
    r.start();
    setListening(true);
  };

  const parseM = useMutation({
    mutationFn: () => parse({ data: {
      classId, text: text.trim(),
      defaultSubject: subject, defaultMax: Number(maxVal) || 100,
    }}),
    onSuccess: (r) => {
      setRows(r.rows);
      if (!r.rows.length) toast.warning("לא זוהו ציונים. נסה לנסח אחרת.");
      else toast.success(`זוהו ${r.rows.length} ציונים`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const saveM = useMutation({
    mutationFn: () => {
      const valid = (rows ?? []).filter((r) => r.matched && r.student_id);
      return save({ data: {
        class_id: classId, date,
        rows: valid.map((r) => ({
          student_id: r.student_id!,
          subject: r.subject || subject,
          value: r.value,
          max_value: r.max_value || Number(maxVal) || 100,
          notes: r.notes,
        })),
      }});
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["grades", classId] });
      qc.invalidateQueries({ queryKey: ["score-inputs", classId] });
      toast.success(`נשמרו ${r.count} ציונים`);
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const updateRow = (i: number, patch: Partial<ParsedGradeRow>) =>
    setRows((rs) => rs?.map((r, idx) => idx === i ? { ...r, ...patch } : r) ?? null);
  const removeRow = (i: number) =>
    setRows((rs) => rs?.filter((_, idx) => idx !== i) ?? null);

  const matchedCount = (rows ?? []).filter((r) => r.matched).length;

  return (
    <div className="space-y-4">
      {!rows && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 sm:col-span-1">
              <Label>מקצוע / מסכת</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>
                  {KODESH_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>מתוך</Label>
              <Input type="number" value={maxVal} onChange={(e) => setMaxVal(e.target.value)} />
            </div>
            <div>
              <Label>תאריך</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>טקסט חופשי</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onPickImage}
                  disabled={ocrLoading}
                >
                  {ocrLoading
                    ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> מזהה תמונה...</>
                    : <><ImageIcon className="ms-1 h-4 w-4" /> העלה תמונה</>}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onImageChange}
                />
                <Button
                  type="button"
                  size="sm"
                  variant={listening ? "destructive" : "outline"}
                  onClick={toggleMic}
                >
                  {listening ? <MicOff className="ms-1 h-4 w-4" /> : <Mic className="ms-1 h-4 w-4" />}
                  {listening ? "עצור הקלטה" : "הקלט"}
                </Button>
              </div>
            </div>
            <Textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='לדוגמה: "משה כהן 85, יוסי לוי קיבל 92, חיים 78 מתוך 100, אברהם נכשל עם 55"'
            />
            <p className="mt-1 text-xs text-muted-foreground">
              הכיתה: {students.length} תלמידים. ה-AI יתאים אוטומטית לפי שם. ניתן להעלות צילום דף ציונים.
            </p>
          </div>

          <Button
            className="w-full"
            onClick={() => parseM.mutate()}
            disabled={!text.trim() || parseM.isPending}
          >
            {parseM.isPending
              ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> מנתח...</>
              : <><Sparkles className="ms-1 h-4 w-4" /> נתח עם AI</>}
          </Button>
        </>
      )}

      {rows && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-semibold">{matchedCount}</span> מתוך {rows.length} תלמידים זוהו
            </div>
            <Button size="sm" variant="ghost" onClick={() => setRows(null)}>חזור לעריכה</Button>
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto">
            {rows.map((r, i) => (
              <Card key={i} className={r.matched ? "" : "border-destructive/40"}>
                <CardContent className="space-y-2 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Select
                        value={r.student_id ?? ""}
                        onValueChange={(v) => updateRow(i, { student_id: v, matched: true })}
                      >
                        <SelectTrigger className={r.matched ? "" : "border-destructive"}>
                          <SelectValue placeholder={r.student_name || "בחר תלמיד"} />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeRow(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="מקצוע"
                      value={r.subject}
                      onChange={(e) => updateRow(i, { subject: e.target.value })}
                    />
                    <Input
                      type="number" placeholder="ציון"
                      value={r.value}
                      onChange={(e) => updateRow(i, { value: Number(e.target.value) })}
                    />
                    <Input
                      type="number" placeholder="מתוך"
                      value={r.max_value}
                      onChange={(e) => updateRow(i, { max_value: Number(e.target.value) || 100 })}
                    />
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
                  <div className="flex items-center justify-between">
                    <Badge variant={r.matched ? "secondary" : "destructive"}>
                      {r.matched ? <><Check className="ms-1 h-3 w-3" /> זוהה</> : "לא זוהה — בחר ידנית"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">ביטחון: {Math.round(r.confidence * 100)}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>ביטול</Button>
            <Button
              onClick={() => saveM.mutate()}
              disabled={matchedCount === 0 || saveM.isPending}
            >
              {saveM.isPending
                ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> שומר...</>
                : `שמור ${matchedCount} ציונים`}
            </Button>
          </DialogFooter>
        </>
      )}
    </div>
  );
}