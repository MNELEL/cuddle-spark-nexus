import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bell, Check, Megaphone, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  listClassAnnouncements, createClassAnnouncement, deleteClassAnnouncement, setAnnouncementState,
} from "@/lib/class-announcements.functions";
import { hebrewDate } from "@/lib/hebrew-date";

type Severity = "info" | "warning" | "critical";

const SEVERITY: Record<Severity, { label: string; box: string; badge: string }> = {
  info: { label: "רגיל", box: "border-primary/40 bg-primary/5", badge: "bg-primary/15 text-primary" },
  warning: { label: "חשוב", box: "border-amber-500/50 bg-amber-500/10", badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
  critical: { label: "דחוף", box: "border-destructive/50 bg-destructive/10", badge: "bg-destructive/20 text-destructive" },
};

export function ClassAnnouncementsBanner({ classId, readOnly = false }: { classId: string; readOnly?: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listClassAnnouncements);
  const createFn = useServerFn(createClassAnnouncement);
  const deleteFn = useServerFn(deleteClassAnnouncement);
  const stateFn = useServerFn(setAnnouncementState);
  const [showDismissed, setShowDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<Severity>("warning");

  const key = ["class-announcements", classId];
  const { data: items = [] } = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: { classId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const createM = useMutation({
    mutationFn: () => createFn({ data: { class_id: classId, title, body: body || undefined, severity } }),
    onSuccess: () => {
      setOpen(false); setTitle(""); setBody(""); setSeverity("warning");
      refresh();
      toast.success("ההודעה נוספה לבאנר הכיתה");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שמירת ההודעה נכשלה"),
  });

  const stateM = useMutation({
    mutationFn: (v: { announcement_id: string; action: "read" | "unread" | "dismiss" | "restore" }) =>
      stateFn({ data: v }),
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "עדכון ההודעה נכשל"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { refresh(); toast.success("ההודעה נמחקה"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקת ההודעה נכשלה"),
  });

  const active = items.filter((a) => a.active);
  const visible = active.filter((a) => !a.dismissed_at);
  const dismissed = active.filter((a) => a.dismissed_at);
  const unreadCount = visible.filter((a) => !a.read_at).length;

  const AddDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-xl">
          <Plus className="ms-1 h-4 w-4" /> הודעה חשובה
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>הודעה חשובה לכיתה</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ann-title">כותרת</Label>
            <Input id="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
              placeholder="לדוגמה: מבחן בגמרא ביום שלישי" />
          </div>
          <div>
            <Label htmlFor="ann-body">פרטים (אופציונלי)</Label>
            <Textarea id="ann-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={4} />
          </div>
          <div>
            <Label>דרגת חשיבות</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="info">רגיל</SelectItem>
                <SelectItem value="warning">חשוב</SelectItem>
                <SelectItem value="critical">דחוף</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => createM.mutate()} disabled={!title.trim() || createM.isPending}>שמור הודעה</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (visible.length === 0 && dismissed.length === 0) {
    return readOnly ? null : (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-dashed p-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Megaphone className="h-4 w-4" /> אין הודעות חשובות לכיתה זו</span>
        {AddDialog}
      </div>
    );
  }

  return (
    <section aria-label="הודעות חשובות לכיתה" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Bell className="h-4 w-4" /> הודעות חשובות
          {unreadCount > 0 && <Badge variant="secondary" className="font-mono-tabular">{unreadCount} לא נקראו</Badge>}
        </h2>
        <div className="flex items-center gap-2">
          {dismissed.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setShowDismissed((v) => !v)}>
              <RotateCcw className="ms-1 h-4 w-4" />
              {showDismissed ? "הסתר הודעות שנסגרו" : `הודעות שנסגרו (${dismissed.length})`}
            </Button>
          )}
          {!readOnly && AddDialog}
        </div>
      </div>

      {visible.map((a) => {
        const meta = SEVERITY[(a.severity as Severity) ?? "info"];
        return (
          <div key={a.id} data-testid="class-announcement"
            className={`rounded-2xl border p-3 ${meta.box} ${a.read_at ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {a.severity === "critical" && <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />}
                  <span className="text-sm font-semibold">{a.title}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.badge}`}>{meta.label}</span>
                  {a.read_at && <span className="text-[10px] text-muted-foreground">נקרא</span>}
                </div>
                {a.body && <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{a.body}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground font-mono-tabular">
                  {hebrewDate(a.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" title={a.read_at ? "סמן כלא נקרא" : "סמן כנקרא"}
                  onClick={() => stateM.mutate({ announcement_id: a.id, action: a.read_at ? "unread" : "read" })}>
                  <Check className="ms-1 h-4 w-4" /> {a.read_at ? "לא נקרא" : "נקרא"}
                </Button>
                <Button size="sm" variant="ghost" aria-label="סגור הודעה" title="סגור — אפשר לשחזר בכל עת"
                  onClick={() => stateM.mutate({ announcement_id: a.id, action: "dismiss" })}>
                  <X className="h-4 w-4" />
                </Button>
                {!readOnly && (
                  <Button size="sm" variant="ghost" className="text-destructive" aria-label="מחק הודעה"
                    onClick={() => deleteM.mutate(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {showDismissed && dismissed.map((a) => (
        <div key={a.id} data-testid="class-announcement-dismissed"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/40 p-2 text-xs">
          <span className="truncate">{a.title}</span>
          <Button size="sm" variant="ghost" onClick={() => stateM.mutate({ announcement_id: a.id, action: "restore" })}>
            <RotateCcw className="ms-1 h-3.5 w-3.5" /> שחזר לבאנר
          </Button>
        </div>
      ))}
    </section>
  );
}