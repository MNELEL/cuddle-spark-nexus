import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HardDrive, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { GoogleDrivePicker } from "@/components/drive/google-drive-picker";
import { recomputeStyleProfile } from "@/lib/teacher-style.functions";
import { KODESH_SUBJECTS } from "@/lib/kodesh-subjects";
import { RESOURCE_TYPES, RESOURCE_TYPE_LABELS, type ResourceType } from "@/lib/teaching-resources.functions";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * דיאלוג ייבוא מ-Google Drive לספרייה: ניווט לתיקיות, ייבוא מרובה,
 * ובסיום — למידת סגנון מחדש כדי לעדכן את פרופיל ההוראה.
 */
export function GoogleDrivePanel({ open, onClose }: Props) {
  const qc = useQueryClient();
  const recomputeFn = useServerFn(recomputeStyleProfile);
  const [subject, setSubject] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType | "">("");

  const onComplete = (importedCount: number) => {
    if (importedCount <= 0) return;
    qc.invalidateQueries({ queryKey: ["teaching-resources"] });
    // למידת סגנון אוטומטית — כשל כאן לא יכשיל את הייבוא
    void recomputeFn()
      .then(() => toast.success("פרופיל הסגנון עודכן", { icon: <Sparkles className="h-4 w-4 text-amber" /> }))
      .catch(() => toast.info("פרופיל הסגנון לא עודכן הפעם — הייבוא עצמו הצליח"));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <HardDrive className="h-4 w-4 text-amber" aria-hidden="true" /> ייבוא מ-Google Drive
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>מקצוע (אופציונלי)</Label>
            <Select value={subject || "none"} onValueChange={(v) => setSubject(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="כללי" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">כללי</SelectItem>
                {KODESH_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>סוג חומר (אופציונלי)</Label>
            <Select value={resourceType || "none"} onValueChange={(v) => setResourceType(v === "none" ? "" : (v as ResourceType))}>
              <SelectTrigger><SelectValue placeholder="אחר" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">אחר</SelectItem>
                {RESOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <GoogleDrivePicker
          open={open}
          onClose={onClose}
          subject={subject}
          resourceType={resourceType}
          onComplete={onComplete}
        />
      </DialogContent>
    </Dialog>
  );
}
