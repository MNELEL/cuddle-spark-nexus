import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Mail, MessageCircle, Sparkles, Wand2, FileText, Download } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PARENT_TEMPLATE_LABELS, type TemplateKey } from "@/lib/parent-email-templates";
import { draftParentEmail } from "@/lib/parent-emails.functions";
import { buildClassReport } from "@/lib/reports.functions";
import { buildStudentDailyPdf, downloadPdfBlob } from "@/lib/pdf/student-daily-pdf";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  studentId: string;
  studentName: string;
};

export function ParentEmailComposer({ open, onOpenChange, classId, studentId, studentName }: Props) {
  const draft = useServerFn(draftParentEmail);
  const buildReport = useServerFn(buildClassReport);
  const [templateKey, setTemplateKey] = useState<TemplateKey>("weekly_positive");
  const [customNote, setCustomNote] = useState("");
  const [usePolish, setUsePolish] = useState(false);
  const [attachPdf, setAttachPdf] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [polished, setPolished] = useState(false);
  const [pdfReady, setPdfReady] = useState<{ blob: Blob; filename: string } | null>(null);

  const generatePdf = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const report = await buildReport({ data: { classId, from, to: today } });
    const result = await buildStudentDailyPdf({ report, studentId, date: today });
    downloadPdfBlob(result.blob, result.filename);
    return result;
  };

  const draftM = useMutation({
    mutationFn: async () => {
      const res = await draft({ data: { classId, studentId, templateKey, customNote, usePolish } });
      let pdfRes: { blob: Blob; filename: string } | null = null;
      if (attachPdf) {
        try {
          pdfRes = await generatePdf();
        } catch (e) {
          toast.error(e instanceof Error ? `הפקת ה-PDF נכשלה: ${e.message}` : "הפקת ה-PDF נכשלה");
        }
      }
      return { ...res, pdf: pdfRes };
    },
    onSuccess: (res) => {
      const suffix = res.pdf ? `\n\n— מצורף קובץ: ${res.pdf.filename} —` : "";
      setSubject(res.subject);
      setBody(res.body + suffix);
      setPolished(res.polished);
      setPdfReady(res.pdf);
      if (res.pdf) toast.success("הקובץ ירד — גרור אותו לחלון המייל שייפתח");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה ביצירת הטיוטה"),
  });

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      toast.success("הועתק ללוח");
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  };
  const onMail = () => {
    const href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  };
  const onWa = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`*${subject}*\n\n${body}`)}`;
    window.open(url, "_blank");
  };
  const onRedownload = () => {
    if (pdfReady) downloadPdfBlob(pdfReady.blob, pdfReady.filename);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Mail className="h-5 w-5 text-amber" />
            טיוטת מייל להורי {studentName}
          </DialogTitle>
          <DialogDescription>
            בחר תבנית, הוסף הערה אישית — והמערכת תרכיב מייל אישי לפי הנתונים האחרונים של התלמיד.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <Label>תבנית</Label>
            <Select value={templateKey} onValueChange={(v) => setTemplateKey(v as TemplateKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PARENT_TEMPLATE_LABELS) as TemplateKey[]).map((k) => (
                  <SelectItem key={k} value={k}>{PARENT_TEMPLATE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>הערה אישית (אופציונלי)</Label>
            <Textarea
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="למשל: ראוי לציון שהשבוע הוא חזר היטב על הסוגיה ואף עזר לחבריו..."
            />
          </div>
          <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-amber" />
              <span className="text-sm">שפר עם AI בסגנון האישי שלך</span>
            </div>
            <Switch checked={usePolish} onCheckedChange={setUsePolish} />
          </div>
          <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber" />
              <div className="text-sm leading-tight">
                <div>צרף סיכום PDF אישי (30 ימים)</div>
                <div className="text-xs text-muted-foreground">הקובץ יורד אוטומטית — תגרור אותו לחלון המייל</div>
              </div>
            </div>
            <Switch checked={attachPdf} onCheckedChange={setAttachPdf} />
          </div>

          <Button onClick={() => draftM.mutate()} disabled={draftM.isPending}>
            <Sparkles className="ms-1 h-4 w-4" />
            {draftM.isPending ? "מרכיב טיוטה ומפיק PDF..." : "צור טיוטה"}
          </Button>

          {pdfReady && (
            <div className="flex items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span className="font-medium">{pdfReady.filename} ירד למחשב</span>
              </div>
              <Button size="sm" variant="ghost" onClick={onRedownload}>
                <Download className="ms-1 h-3.5 w-3.5" /> הורד שוב
              </Button>
            </div>
          )}

          {(subject || body) && (
            <div className="space-y-3 border-t pt-3">
              <div>
                <Label>נושא</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <Label>גוף המייל {polished && <span className="text-xs text-amber">· שופר ע״י AI</span>}</Label>
                <Textarea rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>סגור</Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onCopy} disabled={!body}>
              <Copy className="ms-1 h-4 w-4" /> העתק
            </Button>
            <Button variant="outline" onClick={onWa} disabled={!body}>
              <MessageCircle className="ms-1 h-4 w-4" /> וואטסאפ
            </Button>
            <Button onClick={onMail} disabled={!body}>
              <Mail className="ms-1 h-4 w-4" /> פתח במייל
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}