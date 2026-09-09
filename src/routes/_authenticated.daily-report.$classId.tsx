import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { ArrowRight, CalendarDays, FileSpreadsheet, FileText, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HebrewRangeFilter, type DateRange } from "@/components/hebrew-range-filter";
import { CertificateTemplateSelect } from "@/components/certificate-template-select";
import type { CertTemplateDesign } from "@/lib/ai-certificate.functions";

import { useHebrewAnchor } from "@/components/hebrew-anchor";
import { DailyReportDayDialog } from "@/components/daily-report-day-dialog";
import { hebrewRangePresets, hebrewDayInfo, isoOf } from "@/lib/hebrew-calendar";
import { toHebrewDateFull, hebrewDateTime } from "@/lib/hebrew-date";
import { listStudents } from "@/lib/students.functions";
import {
  getDailyReport,
  getDailyReportDetails,
  type DailyReportDay,
} from "@/lib/daily-report.functions";

type ReportSearch = { from?: string; to?: string; studentId?: string };

export const Route = createFileRoute("/_authenticated/daily-report/$classId")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  validateSearch: (search: Record<string, unknown>): ReportSearch => ({
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
    studentId: typeof search.studentId === "string" ? search.studentId : undefined,
  }),
  component: DailyLogReportPage,
});

/** כל הימים בטווח (כולל ימים ללא נתונים), מהחדש לישן. */
function daysInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(isoOf(d));
  return out.reverse();
}

const emptyDay = (date: string): DailyReportDay => ({
  date,
  notes: null,
  attendance: { present: 0, absent: 0, late: 0, excused: 0, total: 0 },
  grades: { count: 0, avgPct: null },
  insights: { total: 0, high: 0, medium: 0, low: 0 },
  approvals: 0,
});

const STATUS_LABEL: Record<string, string> = {
  present: "נוכח",
  absent: "נעדר",
  late: "איחור",
  excused: "מאושר",
};
const SEVERITY_LABEL: Record<string, string> = {
  low: "רגילה",
  medium: "לתשומת לב",
  high: "דחופה",
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function DailyLogReportPage() {
  const { classId } = Route.useParams();
  const search = Route.useSearch();
  const { date: anchorDate } = useHebrewAnchor();
  const [range, setRange] = useState<DateRange>(() => {
    if (search.from && search.to && ISO.test(search.from) && ISO.test(search.to)) {
      return { from: search.from, to: search.to };
    }
    const presets = hebrewRangePresets(anchorDate);
    const p = presets.find((x) => x.id === "month") ?? presets[0]!;
    return { from: p.from, to: p.to };
  });
  const [studentId, setStudentId] = useState<string>(search.studentId ?? "all");
  const [onlyWithData, setOnlyWithData] = useState(false);
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateDesign, setTemplateDesign] = useState<CertTemplateDesign | undefined>(undefined);
  const [templateName, setTemplateName] = useState<string | null>(null);

  const fetchReport = useServerFn(getDailyReport);
  const fetchDetails = useServerFn(getDailyReportDetails);
  const studentsFn = useServerFn(listStudents);

  const { data: students = [] } = useQuery({
    queryKey: ["students", classId],
    queryFn: () => studentsFn({ data: { classId } }),
  });

  const scopedStudent = studentId === "all" ? null : studentId;

  const { data, isLoading } = useQuery({
    queryKey: ["daily-log-report", classId, range.from, range.to, scopedStudent],
    queryFn: () =>
      fetchReport({
        data: { classId, from: range.from, to: range.to, studentId: scopedStudent },
      }),
  });

  const rows = useMemo(() => {
    const map = new Map((data?.days ?? []).map((d) => [d.date, d]));
    const all = daysInRange(range.from, range.to).map((iso) => map.get(iso) ?? emptyDay(iso));
    return onlyWithData
      ? all.filter(
          (d) =>
            d.notes ||
            d.attendance.total > 0 ||
            d.grades.count > 0 ||
            d.insights.total > 0 ||
            d.approvals > 0,
        )
      : all;
  }, [data, range, onlyWithData]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, d) => {
          acc.present += d.attendance.present;
          acc.absent += d.attendance.absent;
          acc.late += d.attendance.late;
          acc.logs += d.notes ? 1 : 0;
          acc.insights += d.insights.total;
          acc.approvals += d.approvals;
          if (d.grades.avgPct !== null) {
            acc.gradeSum += d.grades.avgPct * d.grades.count;
            acc.gradeCount += d.grades.count;
          }
          return acc;
        },
        {
          present: 0,
          absent: 0,
          late: 0,
          logs: 0,
          insights: 0,
          approvals: 0,
          gradeSum: 0,
          gradeCount: 0,
        },
      ),
    [rows],
  );

  const rangeLabel = useMemo(() => {
    const hit = hebrewRangePresets(anchorDate).find(
      (p) => p.from === range.from && p.to === range.to,
    );
    return (
      hit?.label ??
      `${toHebrewDateFull(range.from) ?? range.from} – ${toHebrewDateFull(range.to) ?? range.to}`
    );
  }, [anchorDate, range]);

  /** ייצוא בדיוק של השורות המוצגות — אותו טווח עברי, אותו תלמיד ואותו סינון. */
  const runExport = async (kind: "xlsx" | "pdf") => {
    if (!data) return;
    setBusy(kind);
    try {
      const suffix = data.student ? `-${data.student.name}` : "";
      if (kind === "xlsx") {
        const details = await fetchDetails({
          data: { classId, from: range.from, to: range.to, studentId: scopedStudent },
        });
        const shown = new Set(rows.map((d) => d.date));
        const heb = (iso: string) => toHebrewDateFull(iso) ?? iso;
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            rows.map((d) => ({
              "תאריך עברי": heb(d.date),
              תאריך: d.date,
              נוכחים: d.attendance.present,
              נעדרים: d.attendance.absent,
              איחורים: d.attendance.late,
              מאושרים: d.attendance.excused,
              "סה״כ נוכחות": d.attendance.total,
              "מספר ציונים": d.grades.count,
              "ממוצע ציונים (%)": d.grades.avgPct === null ? "" : Math.round(d.grades.avgPct),
              תובנות: d.insights.total,
              "תובנות חמורות": d.insights.high,
              "אישורי מלמד": d.approvals,
              "תיעוד יומי": d.notes ?? "",
            })),
          ),
          "סיכום יומי",
        );

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            details.attendance
              .filter((r) => shown.has(r.date))
              .map((r) => ({
                "תאריך עברי": heb(r.date),
                תאריך: r.date,
                תלמיד: r.student,
                נוכחות: STATUS_LABEL[r.status] ?? r.status,
                הערה: r.notes,
              })),
          ),
          "נוכחות",
        );

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            details.grades
              .filter((r) => shown.has(r.date))
              .map((r) => ({
                "תאריך עברי": heb(r.date),
                תאריך: r.date,
                תלמיד: r.student,
                מקצוע: r.subject,
                ציון: r.value,
                מתוך: r.max_value,
                "אחוז": Math.round((r.value / (r.max_value || 100)) * 100),
              })),
          ),
          "ציונים",
        );

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            details.insights
              .filter((r) => shown.has(r.date))
              .map((r) => ({
                "תאריך עברי": heb(r.date),
                תאריך: r.date,
                תלמיד: r.student,
                חשיבות: SEVERITY_LABEL[r.severity] ?? r.severity,
                כותרת: r.title,
                פירוט: r.description,
              })),
          ),
          "תובנות",
        );

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            details.approvals
              .filter((r) => shown.has(r.date))
              .map((r) => ({
                "תאריך עברי": heb(r.date),
                תאריך: r.date,
                תלמיד: r.student,
                "אושר על ידי": r.approver,
                "הערת אישור": r.notes,
              })),
          ),
          "אישורים",
        );

        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            details.history.map((h) => ({
              מתי: hebrewDateTime(h.date),
              שינוי: h.message,
            })),
          ),
          "היסטוריית שינויים",
        );

        XLSX.writeFile(
          wb,
          `דוח-תיעוד-יומי-${data.class.name}${suffix}-${range.from}-${range.to}.xlsx`,
        );
      } else {
        const [{ buildDailyReportPdf }, { downloadPdfBlob }, details] = await Promise.all([
          import("@/lib/pdf/daily-report-pdf"),
          import("@/lib/pdf/pdf-builder"),
          fetchDetails({
            data: { classId, from: range.from, to: range.to, studentId: scopedStudent },
          }),
        ]);
        const shown = new Set(rows.map((d) => d.date));
        /** שורה לכל תלמיד ליום: נוכחות, ציון ותובנה יחד. */
        const perStudent = new Map<
          string,
          { date: string; student: string; attendance: string; grade: string; insight: string }
        >();
        const entry = (date: string, student: string) => {
          const key = `${date}|${student}`;
          let e = perStudent.get(key);
          if (!e) {
            e = { date, student, attendance: "", grade: "", insight: "" };
            perStudent.set(key, e);
          }
          return e;
        };
        for (const r of details.attendance) {
          if (!shown.has(r.date)) continue;
          const e = entry(r.date, r.student);
          e.attendance = [STATUS_LABEL[r.status] ?? r.status, r.notes].filter(Boolean).join(" · ");
        }
        for (const r of details.grades) {
          if (!shown.has(r.date)) continue;
          const e = entry(r.date, r.student);
          const one = `${r.subject ? `${r.subject}: ` : ""}${r.value}/${r.max_value}`;
          e.grade = e.grade ? `${e.grade} · ${one}` : one;
        }
        for (const r of details.insights) {
          if (!shown.has(r.date)) continue;
          const e = entry(r.date, r.student);
          const one = `${r.title}${r.description ? ` — ${r.description}` : ""}`;
          e.insight = e.insight ? `${e.insight} · ${one}` : one;
        }
        const entries = Array.from(perStudent.values()).sort((a, b) =>
          a.date === b.date ? a.student.localeCompare(b.student, "he") : a.date < b.date ? 1 : -1,
        );
        const { blob, filename } = await buildDailyReportPdf({
          className: data.student ? `${data.class.name} — ${data.student.name}` : data.class.name,
          range: { from: range.from, to: range.to },
          rangeLabel,
          studentCount: data.student ? 1 : data.studentCount,
          days: rows,
          entries,
          design: templateDesign,
          ...(templateName ? { templateName } : {}),
        });
        downloadPdfBlob(blob, filename);
      }
      toast.success(`יוצאו ${rows.length} ימים`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הייצוא נכשל");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div dir="rtl" className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 font-display text-xl">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
          דוח תיעוד יומי{data ? ` — ${data.class.name}` : ""}
          {data?.student ? ` · ${data.student.name}` : ""}
        </h1>
        <Button asChild variant="ghost" size="sm">
          <Link to="/classes/$classId" params={{ classId }}>
            <ArrowRight className="ms-1 h-4 w-4" aria-hidden />
            חזרה לכיתה
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">טווח לוח עברי וסינון</CardTitle>
          <CardDescription>
            כל ימי הלוח העברי בטווח מוצגים — גם ימים בלי תיעוד, כדי לזהות פערים.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <HebrewRangeFilter value={range} onChange={setRange} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dr-student">תלמיד</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger id="dr-student">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל הכיתה</SelectItem>
                  {(students as { id: string; name: string }[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Checkbox
                id="only-with-data"
                checked={onlyWithData}
                onCheckedChange={(v) => setOnlyWithData(v === true)}
              />
              <Label htmlFor="only-with-data" className="text-sm font-normal">
                הצג רק ימים עם נתונים
              </Label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">ימי תיעוד: {totals.logs}</Badge>
            <Badge variant="outline">נוכחים: {totals.present}</Badge>
            <Badge variant="outline">נעדרים: {totals.absent}</Badge>
            <Badge variant="outline">איחורים: {totals.late}</Badge>
            <Badge variant="outline">
              ממוצע ציונים:{" "}
              {totals.gradeCount ? `${Math.round(totals.gradeSum / totals.gradeCount)}%` : "—"}
            </Badge>
            <Badge variant="outline">תובנות: {totals.insights}</Badge>
            <Badge variant="outline">אישורי מלמד: {totals.approvals}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!data || busy !== null}
              onClick={() => runExport("xlsx")}
            >
              {busy === "xlsx" ? (
                <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FileSpreadsheet className="ms-1 h-4 w-4" aria-hidden />
              )}
              ייצוא ל-Excel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!data || busy !== null}
              onClick={() => runExport("pdf")}
            >
              {busy === "pdf" ? (
                <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FileText className="ms-1 h-4 w-4" aria-hidden />
              )}
              ייצוא ל-PDF
            </Button>
            <CertificateTemplateSelect
              value={templateId}
              onChange={(id, design) => {
                setTemplateId(id);
                setTemplateDesign(design);
                setTemplateName((design as { name?: string } | undefined)?.name ?? null);
              }}
              label="תבנית ל-PDF"
            />
          </div>

          {templateDesign && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-xs">
              <span className="font-medium">תבנית הסגנון לדוח:</span>
              <Badge variant="secondary">{templateName ?? "תבנית שמורה"}</Badge>
              <span
                className="inline-block h-4 w-4 rounded border"
                style={{ background: templateDesign.primary_color }}
                aria-label="צבע ראשי"
              />
              <span
                className="inline-block h-4 w-4 rounded border"
                style={{ background: templateDesign.accent_color }}
                aria-label="צבע הדגשה"
              />
              <span className="text-muted-foreground">
                ה-PDF יכלול שורה לכל תלמיד: שם, כיתה, תאריך עברי, נוכחות, ציון ותובנה.
              </span>
            </div>
          )}


        </CardContent>
      </Card>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">טוען דוח…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">אין ימים בטווח שנבחר.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((d) => {
            const info = hebrewDayInfo(new Date(`${d.date}T00:00:00`));
            const empty =
              !d.notes &&
              d.attendance.total === 0 &&
              d.grades.count === 0 &&
              d.insights.total === 0 &&
              d.approvals === 0;
            return (
              <li
                key={d.date}
                className={`rounded-lg border p-3 ${empty ? "bg-muted/30" : "bg-card"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{info.full}</span>
                    <span className="text-xs text-muted-foreground">{d.date}</span>
                    {info.holidays?.map((h) => (
                      <Badge key={h} variant="secondary">
                        {h}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 text-[11px]">
                    {d.attendance.total > 0 && (
                      <Badge variant="outline">
                        נוכחות: {d.attendance.present}/{d.attendance.total}
                        {d.attendance.late > 0 ? ` · ${d.attendance.late} איחורים` : ""}
                      </Badge>
                    )}
                    {d.grades.count > 0 && (
                      <Badge variant="outline">
                        ציונים: {d.grades.count} · ממוצע {Math.round(d.grades.avgPct ?? 0)}%
                      </Badge>
                    )}
                    {d.insights.total > 0 && (
                      <Badge variant={d.insights.high > 0 ? "destructive" : "secondary"}>
                        תובנות: {d.insights.total}
                      </Badge>
                    )}
                    {d.approvals > 0 && <Badge>אושר ({d.approvals})</Badge>}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditDate(d.date)}
                      aria-label={`עריכת ${info.full}`}
                    >
                      <Pencil className="ms-1 h-4 w-4" aria-hidden />
                      עריכה
                    </Button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {d.notes || "אין תיעוד ליום זה."}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <DailyReportDayDialog
        classId={classId}
        date={editDate}
        open={editDate !== null}
        onOpenChange={(v) => !v && setEditDate(null)}
      />
    </div>
  );
}
