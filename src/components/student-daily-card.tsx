import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { History, NotebookPen, Save, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useHebrewAnchor } from "@/components/hebrew-anchor";
import { DailyApprovalCard } from "@/components/daily-approval-card";
import { hebrewDateTime } from "@/lib/hebrew-date";
import {
  getStudentDaily, saveStudentDaily, listStudentDailyHistory,
} from "@/lib/student-daily.functions";
import { suggestStudentDailySummary } from "@/lib/ai-daily-summary.functions";

const STATUS_LABEL: Record<string, string> = {
  present: "נוכח", absent: "נעדר", late: "איחור", excused: "מאושר",
};

/**
 * תיעוד יומי לתלמיד: נוכחות, ציון ותובנה — הכל ליום העברי הפעיל,
 * כולל היסטוריית שינויים. שמירה מרעננת את דוח התיעוד היומי והתובנות.
 */
export function StudentDailyCard({
  classId,
  students,
}: {
  classId: string;
  students: { id: string; name: string }[];
}) {
  const { info, isCustom, elapsedFrom, elapsedFromInfo } = useHebrewAnchor();
  /** תאריך-החלוף הבא נגזר מהלוח האמיתי — תחילת החודש העברי הבא. */
  const nextAnchor = useMemo(
    () => hebrewDayInfo(hebrewMonthBounds(shiftHebrew(elapsedFrom, "month", 1)).start),
    [elapsedFrom],
  );
  const date = info.iso;
  const qc = useQueryClient();
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [status, setStatus] = useState<string>("");
  const [attNotes, setAttNotes] = useState("");
  const [subject, setSubject] = useState("");
  const [value, setValue] = useState("");
  const [maxValue, setMaxValue] = useState("100");
  const [severity, setSeverity] = useState("low");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const load = useServerFn(getStudentDaily);
  const save = useServerFn(saveStudentDaily);
  const history = useServerFn(listStudentDailyHistory);
  const suggest = useServerFn(suggestStudentDailySummary);

  /** תקציר אוטומטי מ-AI על בסיס הנוכחות, הציון וההערה של היום. */
  const suggestM = useMutation({
    mutationFn: () =>
      suggest({
        data: {
          studentId,
          date,
          draft: {
            status,
            attendanceNotes: attNotes,
            subject,
            value: value.trim() ? Number(value) : null,
            maxValue: Number(maxValue) || 100,
            note: description,
          },
          anchors: {
            elapsedFrom: elapsedFromInfo.full,
            today: info.full,
            next: nextAnchor.full,
          },
        },
      }),
    onSuccess: (r) => {
      setTitle(r.title);
      setDescription(r.description);
      toast.success("התקציר הוצע — אפשר לערוך ולשמור");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הצעת התקציר נכשלה"),
  });

  const existing = useQuery({
    queryKey: ["student-daily", studentId, date],
    queryFn: () => load({ data: { studentId, date } }),
    enabled: !!studentId,
  });

  const hist = useQuery({
    queryKey: ["student-daily-history", studentId],
    queryFn: () => history({ data: { studentId } }),
    enabled: showHistory && !!studentId,
  });

  const saveM = useMutation({
    mutationFn: () =>
      save({
        data: {
          studentId,
          date,
          status: status ? (status as "present") : null,
          attendanceNotes: attNotes,
          grade: value.trim() ? { subject, value: Number(value), max_value: Number(maxValue) || 100 } : null,
          insight: title.trim() ? { severity: severity as "low", title, description } : null,
        },
      }),
    onSuccess: (r) => {
      if (!r.changes) {
        toast.info("לא היה מה לשמור — מלא נוכחות, ציון או תובנה.");
        return;
      }
      toast.success("התיעוד היומי נשמר");
      setValue(""); setSubject(""); setTitle(""); setDescription("");
      qc.invalidateQueries({ queryKey: ["student-daily", studentId, date] });
      qc.invalidateQueries({ queryKey: ["student-daily-history", studentId] });
      qc.invalidateQueries({ queryKey: ["daily-briefing"] });
      qc.invalidateQueries({ queryKey: ["daily-log-report"] });
    qc.invalidateQueries({ queryKey: ["manual-insights"] });
    qc.invalidateQueries({ queryKey: ["manual-insights-history"] });
    qc.invalidateQueries({ queryKey: ["daily-approval"] });
    qc.invalidateQueries({ queryKey: ["daily-summary"] });
    qc.invalidateQueries({ queryKey: ["hebrew-days"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["grades", classId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 font-display text-base">
          <NotebookPen className="h-5 w-5 text-primary" aria-hidden />
          תיעוד יומי לתלמיד
          <Badge variant={isCustom ? "default" : "secondary"}>{info.full}</Badge>
        </CardTitle>
        <CardDescription>
          נוכחות, ציון ותובנה ליום העברי הפעיל. שינוי התאריך בלוח מחליף את היום שנרשם כאן.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sd-student">תלמיד</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger id="sd-student"><SelectValue placeholder="בחר תלמיד" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-status">נוכחות</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="sd-status"><SelectValue placeholder="ללא שינוי" /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sd-att-notes">הערת נוכחות</Label>
          <Input id="sd-att-notes" value={attNotes} onChange={(e) => setAttNotes(e.target.value)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="sd-subject">מקצוע</Label>
            <Input id="sd-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="גמרא" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-value">ציון</Label>
            <Input id="sd-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-max">מתוך</Label>
            <Input id="sd-max" type="number" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sd-title">תובנה יומית</Label>
            <Input id="sd-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: השתתפות מצוינת בשיעור" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sd-sev">חשיבות</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger id="sd-sev"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">רגילה</SelectItem>
                <SelectItem value="medium">לתשומת לב</SelectItem>
                <SelectItem value="high">דחופה</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Textarea
          aria-label="פירוט התובנה"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="פירוט (לא חובה)"
          rows={2}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => saveM.mutate()} disabled={!studentId || saveM.isPending}>
            {saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
            שמור תיעוד
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => suggestM.mutate()}
            disabled={!studentId || suggestM.isPending}
          >
            {suggestM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            הצע תקציר AI
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
            <History className="h-4 w-4" aria-hidden />
            {showHistory ? "הסתר היסטוריה" : "היסטוריית שינויים"}
          </Button>
        </div>

        {existing.data && (
          <div className="rounded-md border p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">מה כבר רשום ביום הזה</p>
            <p>
              נוכחות: {existing.data.attendance ? STATUS_LABEL[existing.data.attendance.status] : "—"} ·
              ציונים: {existing.data.grades.length} · תובנות: {existing.data.insights.length}
            </p>
          </div>
        )}

        {studentId && <DailyApprovalCard studentId={studentId} classId={classId} date={date} />}

        {showHistory && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {(hist.data ?? []).length === 0 && <li>אין שינויים רשומים.</li>}
            {(hist.data ?? []).map((h) => (
              <li key={h.id} className="border-t pt-1">
                {h.message} — {hebrewDateTime(h.created_at)}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
