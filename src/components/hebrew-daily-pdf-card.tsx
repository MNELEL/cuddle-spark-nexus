import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CertificateTemplateSelect } from "@/components/certificate-template-select";
import { useHebrewAnchor } from "@/components/hebrew-anchor";
import type { CertTemplateDesign } from "@/lib/ai-certificate.functions";
import { getDailyReport, getDailyReportDetails } from "@/lib/daily-report.functions";
import { isoOf } from "@/lib/hebrew-calendar";

const STATUS_LABEL: Record<string, string> = {
  present: "נוכח",
  absent: "נעדר",
  late: "איחור",
  excused: "מאושר",
};

type ClassOption = { id: string; name: string };

/**
 * הפקת PDF של התיעוד היומי לתאריך הפעיל בלוח העברי, לפי תבנית הסגנון שנבחרה.
 * התאריך נגזר מהלוח עצמו ומתעדכן לבד.
 */
export function HebrewDailyPdfCard({ classes }: { classes: ClassOption[] }) {
  const { date, info, elapsedFromInfo } = useHebrewAnchor();
  const iso = isoOf(date);
  const [classId, setClassId] = useState<string>(classes[0]?.id ?? "");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [design, setDesign] = useState<CertTemplateDesign | undefined>(undefined);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reportFn = useServerFn(getDailyReport);
  const detailsFn = useServerFn(getDailyReportDetails);

  const activeClassId = classId || classes[0]?.id || "";

  const { data: report } = useQuery({
    queryKey: ["daily-log-report", activeClassId, iso, iso, null],
    queryFn: () => reportFn({ data: { classId: activeClassId, from: iso, to: iso, studentId: null } }),
    enabled: Boolean(activeClassId),
  });

  const day = report?.days?.[0];

  const run = async () => {
    if (!activeClassId || !report) return;
    setBusy(true);
    try {
      const [{ buildDailyReportPdf }, { downloadPdfBlob }, details] = await Promise.all([
        import("@/lib/pdf/daily-report-pdf"),
        import("@/lib/pdf/pdf-builder"),
        detailsFn({ data: { classId: activeClassId, from: iso, to: iso, studentId: null } }),
      ]);
      const perStudent = new Map<
        string,
        {
          date: string;
          student: string;
          attendance: string;
          grade: string;
          insight: string;
          approvedAt?: string;
          approvedBy?: string;
        }
      >();
      const entry = (d: string, student: string) => {
        const key = `${d}|${student}`;
        let e = perStudent.get(key);
        if (!e) {
          e = { date: d, student, attendance: "", grade: "", insight: "" };
          perStudent.set(key, e);
        }
        return e;
      };
      for (const r of details.attendance) {
        const e = entry(r.date, r.student);
        e.attendance = [STATUS_LABEL[r.status] ?? r.status, r.notes].filter(Boolean).join(" · ");
      }
      for (const r of details.grades) {
        const e = entry(r.date, r.student);
        const one = `${r.subject ? `${r.subject}: ` : ""}${r.value}/${r.max_value}`;
        e.grade = e.grade ? `${e.grade} · ${one}` : one;
      }
      for (const r of details.insights) {
        const e = entry(r.date, r.student);
        const one = `${r.title}${r.description ? ` — ${r.description}` : ""}`;
        e.insight = e.insight ? `${e.insight} · ${one}` : one;
      }
      for (const r of details.approvals) {
        const e = entry(r.date, r.student);
        e.approvedAt = r.date;
        if (r.approver) e.approvedBy = r.approver;
      }
      const { blob, filename } = await buildDailyReportPdf({
        className: report.class.name,
        range: { from: iso, to: iso },
        rangeLabel: info.full,
        studentCount: report.studentCount,
        days: report.days.length ? report.days : [],
        entries: Array.from(perStudent.values()),
        design,
        ...(templateName ? { templateName } : {}),
      });
      downloadPdfBlob(blob, filename);
      toast.success("ה-PDF של תיעוד היום הופק");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הפקת ה-PDF נכשלה");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base">PDF של תיעוד היום</CardTitle>
        <CardDescription>
          התאריך נלקח מהלוח עצמו: {info.full} · תאריך-החלוף: {elapsedFromInfo.full}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hpdf-class">כיתה</Label>
            <Select value={activeClassId} onValueChange={setClassId}>
              <SelectTrigger id="hpdf-class">
                <SelectValue placeholder="בחר כיתה" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <CertificateTemplateSelect
              value={templateId}
              onChange={(id, d) => {
                setTemplateId(id);
                setDesign(d);
                setTemplateName(id ? (d as { name?: string } | undefined)?.name ?? null : null);
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">נוכחות {day?.attendance.total ?? 0}</Badge>
          <Badge variant="outline">ציונים {day?.grades.count ?? 0}</Badge>
          <Badge variant="outline">תובנות {day?.insights.total ?? 0}</Badge>
          <Badge variant="outline">אישורים {day?.approvals ?? 0}</Badge>
          {day?.notes && <Badge className="bg-accent text-accent-foreground">הערת מלמד</Badge>}
        </div>
        <Button type="button" onClick={run} disabled={busy || !activeClassId}>
          {busy ? (
            <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileText className="ms-1 h-4 w-4" aria-hidden />
          )}
          הפק PDF לתאריך זה
        </Button>
      </CardContent>
    </Card>
  );
}
