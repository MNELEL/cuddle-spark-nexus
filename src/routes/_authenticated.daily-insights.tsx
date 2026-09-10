import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lightbulb, Plus, Trash2, Pencil, Loader2, History, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { HebrewDatePanel } from "@/components/hebrew-date-panel";
import { useHebrewAnchor } from "@/components/hebrew-anchor";
import { HebrewRangeFilter, type DateRange } from "@/components/hebrew-range-filter";
import { hebrewDateTime, toHebrewDateFull } from "@/lib/hebrew-date";
import { hebrewDayInfo, hebrewMonthBounds, shiftHebrew } from "@/lib/hebrew-calendar";
import { listClasses } from "@/lib/classes.functions";
import { listStudents } from "@/lib/students.functions";
import {
  listManualInsights, createManualInsight, updateManualInsight,
  deleteManualInsight, listManualInsightHistory,
} from "@/lib/manual-insights.functions";

export const Route = createFileRoute("/_authenticated/daily-insights")({
  component: DailyInsightsPage,
  head: () => ({
    meta: [
      { title: "תובנות יומיות · הכיתה שלי" },
      {
        name: "description",
        content: "מסך תובנות יומיות: הזנה, עריכה וסילוק תובנות לכיתה ולתלמיד לפי הלוח העברי.",
      },
      { property: "og:title", content: "תובנות יומיות · הכיתה שלי" },
      {
        property: "og:description",
        content: "ניהול תובנות יומיות לפי תאריך עברי — כולל נוכחות, ציונים ואירועים.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const SEVERITY_LABEL: Record<string, string> = { low: "רגילה", medium: "לתשומת לב", high: "דחופה" };

function DailyInsightsPage() {
  const { info, elapsedFromInfo, elapsedFrom } = useHebrewAnchor();
  /** תאריך-החלוף הבא — תחילת החודש העברי הבא, נגזר מהלוח האמיתי בלי הזנה ידנית. */
  const nextAnchor = useMemo(
    () => hebrewDayInfo(hebrewMonthBounds(shiftHebrew(elapsedFrom, "month", 1)).start),
    [elapsedFrom],
  );
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  // ברירת המחדל היא תאריך-החלוף עד היום הפעיל, כדי שהתובנות ילכו עם הלוח העברי.
  const [range, setRange] = useState<DateRange>({
    from: elapsedFromInfo.iso < info.iso ? elapsedFromInfo.iso : info.monthRange.from,
    to: info.iso,
  });

  const [showHistory, setShowHistory] = useState(false);
  const [filterStudent, setFilterStudent] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  const [date, setDate] = useState(info.iso);
  const [studentId, setStudentId] = useState("class");
  const [severity, setSeverity] = useState("low");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  /**
   * הטווח והתאריך מתעדכנים לבד מהלוח העברי: כל שינוי בתאריך-החלוף או ביום הפעיל
   * מתגלגל מיד למסך, בלי כפתור עדכון חיצוני. בחירה ידנית של טווח עוצרת את העדכון האוטומטי.
   */
  const autoRange = useRef<DateRange | null>(null);
  const autoDate = useRef<string | null>(null);
  const [manualRange, setManualRange] = useState(false);
  const autoFrom = elapsedFromInfo.iso < info.iso ? elapsedFromInfo.iso : info.monthRange.from;
  useEffect(() => {
    if (manualRange) return;
    const next = { from: autoFrom, to: info.iso };
    if (autoRange.current?.from === next.from && autoRange.current?.to === next.to) return;
    autoRange.current = next;
    setRange(next);
  }, [autoFrom, info.iso, manualRange]);
  useEffect(() => {
    if (editId) return;
    if (autoDate.current === info.iso) return;
    autoDate.current = info.iso;
    setDate(info.iso);
  }, [info.iso, editId]);

  const onRangeChange = (r: DateRange) => {
    setManualRange(true);
    setRange(r);
  };


  const classesFn = useServerFn(listClasses);
  const studentsFn = useServerFn(listStudents);
  const listFn = useServerFn(listManualInsights);
  const createFn = useServerFn(createManualInsight);
  const updateFn = useServerFn(updateManualInsight);
  const deleteFn = useServerFn(deleteManualInsight);
  const historyFn = useServerFn(listManualInsightHistory);

  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => classesFn() });
  useEffect(() => {
    const first = (classes as { id: string }[])[0]?.id;
    if (!classId && first) setClassId(first);
  }, [classes, classId]);

  const { data: students = [] } = useQuery({
    queryKey: ["students", classId],
    queryFn: () => studentsFn({ data: { classId } }),
    enabled: !!classId,
  });

  const insights = useQuery({
    queryKey: ["manual-insights", classId, range.from, range.to],
    queryFn: () => listFn({ data: { classId, from: range.from, to: range.to } }),
    enabled: !!classId,
  });

  const hist = useQuery({
    queryKey: ["manual-insights-history", classId],
    queryFn: () => historyFn({ data: { classId } }),
    enabled: showHistory && !!classId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["manual-insights", classId, range.from, range.to] });
    qc.invalidateQueries({ queryKey: ["manual-insights-history", classId] });
    qc.invalidateQueries({ queryKey: ["daily-briefing"] });
    qc.invalidateQueries({ queryKey: ["daily-log-report"] });
  };

  const resetForm = () => {
    setEditId(null); setTitle(""); setDescription(""); setSeverity("low"); setStudentId("class");
    setDate(info.iso);
  };

  const saveM = useMutation<unknown, Error>({
    mutationFn: () =>
      editId
        ? updateFn({ data: { id: editId, severity: severity as "low", title, description, date } })
        : createFn({
            data: {
              classId,
              studentId: studentId === "class" ? null : studentId,
              date,
              severity: severity as "low",
              title,
              description,
            },
          }),
    onSuccess: () => {
      toast.success(editId ? "התובנה עודכנה" : "התובנה נוספה");
      resetForm();
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("התובנה נמחקה"); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "המחיקה נכשלה"),
  });

  /** סינון התוצאות לפי תלמיד ולפי יום בודד, בנוסף לטווח העברי. */
  const filtered = (insights.data ?? []).filter((i) => {
    if (filterStudent === "class-only" && i.student_id) return false;
    if (filterStudent !== "all" && filterStudent !== "class-only" && i.student_id !== filterStudent)
      return false;
    if (filterDate && i.insight_date !== filterDate) return false;
    return true;
  });

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Lightbulb className="h-6 w-6 text-primary" aria-hidden="true" />
            תובנות יומיות
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            הזן תובנות יומיות לכיתה או לתלמיד לפי התאריך העברי. כל תובנה מופיעה מיד במסך התובנות
            ובדוח התיעוד היומי.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/insights">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            למסך התובנות
          </Link>
        </Button>
      </div>

      <HebrewDatePanel />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">
            {editId ? "עריכת תובנה" : "תובנה חדשה"}
          </CardTitle>
          <CardDescription>התאריך מוזן בעברית או בלועזי, וברירת המחדל היא היום הפעיל.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="di-class">כיתה</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger id="di-class"><SelectValue placeholder="בחר כיתה" /></SelectTrigger>
                <SelectContent>
                  {(classes as { id: string; name: string }[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="di-student">תלמיד (או כלל־כיתתי)</Label>
              <Select value={studentId} onValueChange={setStudentId} disabled={!!editId}>
                <SelectTrigger id="di-student"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">כלל־כיתתי</SelectItem>
                  {(students as { id: string; name: string }[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="di-date">תאריך</Label>
              <Input id="di-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">{toHebrewDateFull(date) ?? ""}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="di-sev">חשיבות</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="di-sev"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SEVERITY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="di-title">כותרת</Label>
            <Input id="di-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: ירידה בהשתתפות בשיעור גמרא" />
          </div>
          <Textarea
            aria-label="פירוט התובנה"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="פירוט (לא חובה)"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => saveM.mutate()} disabled={!classId || title.trim().length < 2 || saveM.isPending}>
              {saveM.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              {editId ? "שמור שינויים" : "הוסף תובנה"}
            </Button>
            {editId && (
              <Button type="button" variant="ghost" onClick={resetForm}>ביטול עריכה</Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
              <History className="h-4 w-4" aria-hidden />
              {showHistory ? "הסתר היסטוריה" : "היסטוריית שינויים"}
            </Button>
          </div>
          {showHistory && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {(hist.data ?? []).length === 0 && <li>אין שינויים רשומים.</li>}
              {(hist.data ?? []).map((h) => (
                <li key={h.id} className="border-t pt-1">{h.message} — {hebrewDateTime(h.created_at)}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">תובנות בטווח</CardTitle>
          <CardDescription>סנן לפי כיתה, תלמיד, טווח עברי או יום בודד.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <HebrewRangeFilter value={range} onChange={onRangeChange} />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {manualRange ? (
              <>
                טווח נבחר ידנית.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => setManualRange(false)}
                >
                  חזרה לעדכון אוטומטי מהלוח
                </button>
              </>
            ) : (
              <>
                מתעדכן לבד מהלוח העברי: תאריך-החלוף {elapsedFromInfo.full} · היום {info.full} ·
                תאריך-החלוף הבא {nextAnchor.full}
              </>
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="di-filter-student">תלמיד</Label>
              <Select value={filterStudent} onValueChange={setFilterStudent}>
                <SelectTrigger id="di-filter-student"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הכיתה</SelectItem>
                  <SelectItem value="class-only">כלל־כיתתי בלבד</SelectItem>
                  {(students as { id: string; name: string }[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="di-filter-date">יום בודד</Label>
              <Input
                id="di-filter-date"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {filterDate ? (toHebrewDateFull(filterDate) ?? "") : "ריק = כל הטווח"}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {filterDate && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFilterDate("")}>
                  נקה יום
                </Button>
              )}
              <Button asChild variant="outline" size="sm" disabled={!classId}>
                <Link
                  to="/daily-report/$classId"
                  params={{ classId }}
                  search={{
                    from: filterDate || range.from,
                    to: filterDate || range.to,
                    ...(filterStudent !== "all" && filterStudent !== "class-only"
                      ? { studentId: filterStudent }
                      : {}),
                  }}
                >
                  לדוח התיעוד היומי המסונן
                </Link>
              </Button>
            </div>
          </div>
          {insights.isLoading && <p className="text-sm text-muted-foreground">טוען…</p>}
          {!insights.isLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">אין תובנות ידניות לסינון הזה.</p>
          )}
          <ul className="space-y-2">
            {filtered.map((i) => (
              <li key={i.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {toHebrewDateFull(i.insight_date) ?? i.insight_date} ·{" "}
                      {i.student_name ?? "כלל־כיתתי"} · {SEVERITY_LABEL[i.severity] ?? i.severity}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={i.severity === "high" ? "destructive" : "secondary"}>
                      {SEVERITY_LABEL[i.severity] ?? i.severity}
                    </Badge>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`עריכת התובנה ${i.title}`}
                      onClick={() => {
                        setEditId(i.id);
                        setTitle(i.title);
                        setDescription(i.description ?? "");
                        setSeverity(i.severity);
                        setDate(i.insight_date);
                      }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`מחיקת התובנה ${i.title}`}
                      onClick={() => deleteM.mutate(i.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                    </Button>
                  </div>
                </div>
                {i.description && <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
