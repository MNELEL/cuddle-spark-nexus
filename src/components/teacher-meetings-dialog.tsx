import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileDown, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CertificateTemplateSelect } from "@/components/certificate-template-select";
import type { CertTemplateDesign } from "@/lib/ai-certificate.functions";
import { hebrewDate } from "@/lib/hebrew-date";
import {
  listTeacherMeetings, createTeacherMeeting, updateTeacherMeeting, deleteTeacherMeeting,
  type TeacherMeeting,
} from "@/lib/teacher-meetings.functions";

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** מפיק PDF לפגישה בודדת לפי תבנית הסגנון שנבחרה. */
export async function exportMeetingPdf(
  teacherName: string,
  meetings: TeacherMeeting[],
  design?: CertTemplateDesign,
): Promise<void> {
  try {
    const { buildTeacherMeetingsPdf, downloadPdfBlob } = await import("@/lib/pdf/teacher-meeting-pdf");
    const { blob, filename } = await buildTeacherMeetingsPdf({ teacherName, meetings, ...(design ? { design } : {}) });
    downloadPdfBlob(blob, filename);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "הפקת ה-PDF נכשלה");
  }
}

export function TeacherMeetingsDialog({
  teacher,
  onClose,
  canEdit = false,
}: {
  teacher: { userId: string; name: string } | null;
  onClose: () => void;
  /** רק מנהל מערכת המשויך למוסד רואה עריכה/מחיקה ותיעוד פגישה חדשה. */
  canEdit?: boolean;
}) {
  const qc = useQueryClient();
  const fetchMeetings = useServerFn(listTeacherMeetings);
  const create = useServerFn(createTeacherMeeting);
  const update = useServerFn(updateTeacherMeeting);
  const remove = useServerFn(deleteTeacherMeeting);

  const [meetingDate, setMeetingDate] = useState(todayIso());
  const [summary, setSummary] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [design, setDesign] = useState<CertTemplateDesign | undefined>(undefined);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TeacherMeeting | null>(null);

  const teacherId = teacher?.userId ?? "";
  const meetingsQ = useQuery({
    queryKey: ["teacher-meetings", teacherId],
    queryFn: () => fetchMeetings({ data: { teacherId } }),
    enabled: Boolean(teacherId),
  });

  function resetForm() {
    setMeetingDate(todayIso());
    setSummary("");
    setActionItems("");
    setFollowUpDate("");
    setEditing(null);
  }

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["teacher-meetings", teacherId] });
    void qc.invalidateQueries({ queryKey: ["institution-meetings"] });
    void qc.invalidateQueries({ queryKey: ["teacher-audit-log"] });
  }

  const createM = useMutation({
    mutationFn: () =>
      create({
        data: {
          teacherId,
          meetingDate,
          summary: summary.trim(),
          ...(actionItems.trim() ? { actionItems: actionItems.trim() } : {}),
          ...(followUpDate ? { followUpDate } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("הפגישה תועדה");
      resetForm();
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שמירת הפגישה נכשלה"),
  });

  const updateM = useMutation({
    mutationFn: (m: TeacherMeeting) =>
      update({
        data: {
          id: m.id,
          summary: m.summary.trim(),
          actionItems: m.actionItems?.trim() ?? "",
          followUpDate: m.followUpDate || null,
        },
      }),
    onSuccess: () => {
      toast.success("הפגישה עודכנה");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "עדכון הפגישה נכשל"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("הפגישה נמחקה");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "מחיקת הפגישה נכשלה"),
  });

  const meetings = meetingsQ.data ?? [];

  return (
    <Dialog
      open={teacher !== null}
      onOpenChange={(o) => {
        if (!o) { resetForm(); onClose(); }
      }}
    >
      <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>פגישות עם {teacher?.name}</DialogTitle>
          <DialogDescription>
            יומן פגישות אישיות בין מנהל המוסד למלמד: סיכום, מטלות להמשך ותאריך מעקב. גלוי למנהלי המוסד בלבד.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <CertificateTemplateSelect
            value={templateId}
            onChange={(id, d) => { setTemplateId(id); setDesign(d); }}
          />
          {meetings.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => void exportMeetingPdf(teacher?.name ?? "", meetings, design)}
            >
              <FileDown className="me-1 h-4 w-4" aria-hidden="true" />
              PDF לכל היומן
            </Button>
          )}
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">פגישות מתועדות</h3>
          {meetingsQ.isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="טוען פגישות">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : meetingsQ.isError ? (
            <p className="py-4 text-center text-sm text-destructive">טעינת הפגישות נכשלה. נסה שוב.</p>
          ) : meetings.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">אין עדיין פגישות מתועדות</p>
          ) : (
            <ul className="space-y-2">
              {meetings.map((m) => (
                <li key={m.id} className="rounded-xl bg-muted/50 p-3 text-sm">
                  {editing?.id === m.id ? (
                    <div className="space-y-2">
                      <Label htmlFor={`edit-summary-${m.id}`}>סיכום הפגישה</Label>
                      <Textarea
                        id={`edit-summary-${m.id}`}
                        className="min-h-24 rounded-xl"
                        maxLength={4000}
                        value={editing.summary}
                        onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                      />
                      <Label htmlFor={`edit-actions-${m.id}`}>מטלות להמשך</Label>
                      <Textarea
                        id={`edit-actions-${m.id}`}
                        className="min-h-20 rounded-xl"
                        maxLength={4000}
                        value={editing.actionItems ?? ""}
                        onChange={(e) => setEditing({ ...editing, actionItems: e.target.value })}
                      />
                      <Label htmlFor={`edit-followup-${m.id}`}>תאריך מעקב</Label>
                      <Input
                        id={`edit-followup-${m.id}`}
                        type="date"
                        className="rounded-xl"
                        value={editing.followUpDate ?? ""}
                        onChange={(e) => setEditing({ ...editing, followUpDate: e.target.value || null })}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="rounded-xl"
                          disabled={updateM.isPending}
                          onClick={() => {
                            if (editing.summary.trim().length < 2) return toast.error("נדרש סיכום פגישה");
                            updateM.mutate(editing);
                          }}
                        >
                          {updateM.isPending && <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />}
                          שמירה
                        </Button>
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setEditing(null)}>
                          ביטול
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {hebrewDate(m.meetingDate)} · {m.adminName}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{m.summary}</p>
                        {m.actionItems && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                            <span className="font-medium">מטלות להמשך: </span>{m.actionItems}
                          </p>
                        )}
                        {m.followUpDate && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium">תאריך מעקב: </span>{hebrewDate(m.followUpDate)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl"
                          aria-label="הפקת PDF לפגישה"
                          onClick={() => void exportMeetingPdf(teacher?.name ?? "", [m], design)}
                        >
                          <FileDown className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        {canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-xl"
                              aria-label="עריכת הפגישה"
                              onClick={() => setEditing(m)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-xl text-destructive"
                              aria-label="מחיקת הפגישה"
                              disabled={deleteM.isPending}
                              onClick={() => deleteM.mutate(m.id)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {canEdit ? (
          <section className="space-y-3 border-t pt-3">
            <h3 className="text-sm font-medium">תיעוד פגישה חדשה</h3>
            <div className="space-y-2">
              <Label htmlFor="meeting-date">תאריך הפגישה</Label>
              <Input
                id="meeting-date"
                type="date"
                className="rounded-xl"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{meetingDate ? hebrewDate(meetingDate) : ""}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-summary">סיכום הפגישה</Label>
              <Textarea
                id="meeting-summary"
                className="min-h-24 rounded-xl"
                maxLength={4000}
                placeholder="לדוגמה: שיחת ליווי על ניהול הכיתה, התקדמות בגמרא והספק מול תוכנית הלימודים."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-actions">מטלות להמשך (אופציונלי)</Label>
              <Textarea
                id="meeting-actions"
                className="min-h-20 rounded-xl"
                maxLength={4000}
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting-followup">תאריך מעקב (אופציונלי)</Label>
              <Input
                id="meeting-followup"
                type="date"
                className="rounded-xl"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
              {followUpDate && <p className="text-xs text-muted-foreground">{hebrewDate(followUpDate)}</p>}
            </div>
            <Button
              className="rounded-xl"
              disabled={createM.isPending}
              onClick={() => {
                if (summary.trim().length < 2) return toast.error("נדרש סיכום פגישה");
                if (!meetingDate) return toast.error("נדרש תאריך פגישה");
                createM.mutate();
              }}
            >
              {createM.isPending && <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />}
              שמירת הפגישה
            </Button>
          </section>
        ) : (
          <p className="border-t pt-3 text-xs text-muted-foreground">
            תצוגה לצפייה בלבד — רק מנהל מערכת המשויך למוסד יכול לתעד, לערוך או למחוק פגישות.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
