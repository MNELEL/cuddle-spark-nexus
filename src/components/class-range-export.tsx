import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HebrewRangeFilter, type DateRange } from "@/components/hebrew-range-filter";
import { useHebrewAnchor } from "@/components/hebrew-anchor";
import { hebrewRangePresets } from "@/lib/hebrew-calendar";
import { toHebrewDateFull } from "@/lib/hebrew-date";
import { getClassRangeExport } from "@/lib/class-range-export.functions";

const EVENT_LABEL: Record<string, string> = {
  birthday: "יום הולדת",
  exam: "מבחן",
  special_exam: "בחינה מיוחדת",
  trip: "טיול",
  holiday: "חג",
  meeting: "אסיפה",
  celebration: "שמחה",
  other: "אחר",
};
const SEVERITY_LABEL: Record<string, string> = { high: "גבוהה", medium: "בינונית", low: "נמוכה" };

/**
 * ייצוא נתוני הכיתה (תלמידים, אירועים, תיעוד יומי ותובנות) ל-Excel או PDF
 * לפי טווח תאריכים עברי — הטווחים נגזרים מהתאריך העברי הפעיל.
 */
export function ClassRangeExportCard({ classId }: { classId: string }) {
  const { date } = useHebrewAnchor();
  const presets = useMemo(() => hebrewRangePresets(date), [date]);
  const [range, setRange] = useState<DateRange>(() => {
    const p = hebrewRangePresets(date).find((x) => x.id === "month") ?? hebrewRangePresets(date)[0];
    return { from: p!.from, to: p!.to };
  });
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);
  const fetchData = useServerFn(getClassRangeExport);

  const rangeLabel = useMemo(() => {
    const hit = presets.find((p) => p.from === range.from && p.to === range.to);
    return hit
      ? hit.label
      : `${toHebrewDateFull(range.from) ?? range.from} – ${toHebrewDateFull(range.to) ?? range.to}`;
  }, [presets, range]);

  const run = async (kind: "xlsx" | "pdf") => {
    setBusy(kind);
    try {
      const data = await fetchData({ data: { classId, from: range.from, to: range.to } });
      const nameOf = (id: string | null) =>
        (id && data.students.find((s) => s.id === id)?.name) || "";

      if (kind === "xlsx") {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            data.students.map((s, i) => ({
              "#": i + 1,
              "שם": s.name,
              "שם פרטי": s.first_name ?? "",
              "שם משפחה": s.last_name ?? "",
              "תאריך לידה": s.birth_date ? (toHebrewDateFull(s.birth_date) ?? s.birth_date) : "",
              "שורה": s.seat_row !== null ? s.seat_row + 1 : "",
              "עמודה": s.seat_col !== null ? s.seat_col + 1 : "",
              "הערות": s.notes ?? "",
            })),
          ),
          "תלמידים",
        );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            data.events.map((e) => ({
              "תאריך עברי": toHebrewDateFull(e.date) ?? e.date,
              "תאריך": e.date,
              "סוג": EVENT_LABEL[e.type] ?? e.type,
              "כותרת": e.title,
              "תלמיד": nameOf(e.student_id),
              "הערות": e.notes ?? "",
            })),
          ),
          "אירועים",
        );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            data.dailyLogs.map((l) => ({
              "תאריך עברי": toHebrewDateFull(l.date) ?? l.date,
              "תאריך": l.date,
              "תיעוד": l.notes ?? "",
            })),
          ),
          "תיעוד יומי",
        );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            data.insights.map((i) => ({
              "תאריך עברי": toHebrewDateFull(i.created_at.slice(0, 10)) ?? i.created_at.slice(0, 10),
              "חומרה": SEVERITY_LABEL[i.severity] ?? i.severity,
              "סוג": i.insight_type,
              "כותרת": i.title,
              "תיאור": i.description,
              "המלצה": i.suggested_action ?? "",
              "תלמיד": nameOf(i.student_id),
            })),
          ),
          "תובנות",
        );
        XLSX.writeFile(wb, `${data.class.name}-${range.from}-${range.to}.xlsx`);
      } else {
        const [{ buildClassRangePdf }, { downloadPdfBlob }] = await Promise.all([
          import("@/lib/pdf/class-range-pdf"),
          import("@/lib/pdf/pdf-builder"),
        ]);
        const { blob, filename } = await buildClassRangePdf(data, { rangeLabel });
        downloadPdfBlob(blob, filename);
      }
      toast.success(
        `יוצאו ${data.students.length} תלמידים, ${data.events.length} אירועים, ${data.dailyLogs.length} תיעודים ו-${data.insights.length} תובנות`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הייצוא נכשל");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base">ייצוא נתוני הכיתה לפי טווח עברי</CardTitle>
        <CardDescription>
          בחר טווח תאריכים עברי וייצא תלמידים, אירועים, תיעוד יומי ותובנות ל-Excel או PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <HebrewRangeFilter value={range} onChange={setRange} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy !== null} onClick={() => run("xlsx")}>
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
            disabled={busy !== null}
            onClick={() => run("pdf")}
          >
            {busy === "pdf" ? (
              <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileText className="ms-1 h-4 w-4" aria-hidden />
            )}
            ייצוא ל-PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
