import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Mail, MessageCircle, Sparkles, Wand2 } from "lucide-react";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  studentId: string;
  studentName: string;
};

export function ParentEmailComposer({ open, onOpenChange, classId, studentId, studentName }: Props) {
  const draft = useServerFn(draftParentEmail);
  const [templateKey, setTemplateKey] = useState<TemplateKey>("weekly_positive");
  const [customNote, setCustomNote] = useState("");
  const [usePolish, setUsePolish] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [polished, setPolished] = useState(false);

  const draftM = useMutation({
    mutationFn: () => draft({ data: { classId, studentId, templateKey, customNote, usePolish } }),
    onSuccess: (res) => {
      setSubject(res.subject);
      setBody(res.body);
      setPolished(res.polished);
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

          <Button onClick={() => draftM.mutate()} disabled={draftM.isPending}>
            <Sparkles className="ms-1 h-4 w-4" />
            {draftM.isPending ? "מרכיב טיוטה..." : "צור טיוטה"}
          </Button>

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