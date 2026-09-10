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
import { getStudentDaily } from "@/lib/student-daily.functions";
import { getDailyApproval } from "@/lib/daily-approvals.functions";
import { listStudents } from "@/lib/students.functions";
import { isoOf } from "@/lib/hebrew-calendar";

const STATUS_LABEL: Record<string, string> = {
  present: "נוכח",
  absent: "נעדר",
  late: "איחור",
  excused: "מאושר",
};

type ClassOption = { id: string; name: string };

/**
 * כרטיס תלמיד להפקת PDF של התיעוד המלא לתאריך הפעיל בלוח העברי.
 * הנתונים נטענים מאותם מפתחות שה-CRM מרענן, ולכן הכרטיס מתעדכן לבד.
 */
export function StudentDailyPdfCard({ classes }: { classes: ClassOption[] }) {
  const { date, info, elapsedFromInfo } = useHebrewAnchor();
  const iso = isoOf(date);
  const [classId, setClassId] = useState<string>(classes[0]?.id ?? "");
  const [studentId, setStudentId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [design, setDesign] = useState<CertTemplateDesign | undefined>(undefined);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeClassId = classId || classes[0]?.id || "";
  const studentsFn = useServerFn(listStudents);
  const dailyFn = useServerFn(getStudentDaily);
  const approvalFn = useServerFn(getDailyApproval);

  const { data: students = [] } = useQuery({
    queryKey: ["students", activeClassId],
    queryFn: () => studentsFn({ data: { classId: activeClassId } }),
    enabled: Boolean(activeClassId),
  });
  const list = students as { id: string; name: string }[];
  const activeStudentId = studentId || list[0]?.id || "";
  const activeStudent = list.find((s) => s.id === activeStudentId);

  const { data: daily } = useQuery({
    queryKey: ["student-daily", activeStudentId, iso],
    queryFn: () => dailyFn({ data: { studentId: activeStudentId, date: iso } }),
    enabled: Boolean(activeStudentId),
  });
  const { data: approval } = useQuery({
    queryKey: ["daily-approval", activeStudentId, iso],
    queryFn: () => approvalFn({ data: { studentId: activeStudentId, date: iso } }),
    enabled: Boolean(activeStudentId),
  });

  const run = async () => {
    if (!activeStudent || !daily) return;
    setBusy(true);
    try {
      const [{ buildStudentFullDailyPdf }, { downloadPdfBlob }] = await Promise.all([
        import("@/lib/pdf/student-full-daily-pdf"),
        import("@/lib/pdf/pdf-builder"),
      ]);
      const { blob, filename } = await buildStudentFullDailyPdf({
        studentName: activeStudent.name,
        className: classes.find((c) => c.id === activeClassId)?.name ?? "",
        date: iso,
        elapsedFrom: elapsedFromInfo.iso,
        attendance: daily.attendance,
        grades: daily.grades.map((g) => ({
          subject: g.subject,
          value: g.value,
          max_value: g.max_value,
        })),
        insights: daily.insights.map((i) => ({
          severity: i.severity,
          title: i.title,
          description: i.description,
        })),
        approval: approval
          ? { date: approval.date, approver: approval.approver_name, notes: approval.notes }
          : null,
        design,
        ...(templateName ? { templateName } : {}),
      });
      downloadPdfBlob(blob, filename);
      toast.success("ה-PDF של התיעוד המלא הופק");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הפקת ה-PDF נכשלה");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base">תיעוד מלא לתלמיד (PDF)</CardTitle>
        <CardDescription>
          לפי התאריך הפעיל בלוח: {info.full} · תאריך-החלוף: {elapsedFromInfo.full}. הכרטיס מתעדכן
          לבד לאחר כל שמירה ב-CRM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="spdf-class">כיתה</Label>
            <Select
              value={activeClassId}
              onValueChange={(v) => {
                setClassId(v);
                setStudentId("");
              }}
            >
              <SelectTrigger id="spdf-class">
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
          <div className="space-y-1.5">
            <Label htmlFor="spdf-student">תלמיד</Label>
            <Select value={activeStudentId} onValueChange={setStudentId}>
              <SelectTrigger id="spdf-student">
                <SelectValue placeholder="בחר תלמיד" />
              </SelectTrigger>
              <SelectContent>
                {list.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <CertificateTemplateSelect
          value={templateId}
          onChange={(id, d) => {
            setTemplateId(id);
            setDesign(d);
            setTemplateName(id ? (d as { name?: string } | undefined)?.name ?? null : null);
          }}
        />
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">
            נוכחות{" "}
            {daily?.attendance
              ? STATUS_LABEL[daily.attendance.status] ?? daily.attendance.status
              : "—"}
          </Badge>
          <Badge variant="outline">ציונים {daily?.grades.length ?? 0}</Badge>
          <Badge variant="outline">תובנות {daily?.insights.length ?? 0}</Badge>
          {approval ? (
            <Badge className="bg-accent text-accent-foreground">אושר</Badge>
          ) : (
            <Badge variant="outline">טרם אושר</Badge>
          )}
        </div>
        <Button type="button" onClick={run} disabled={busy || !activeStudentId}>
          {busy ? (
            <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileText className="ms-1 h-4 w-4" aria-hidden />
          )}
          הפק PDF תיעוד מלא
        </Button>
      </CardContent>
    </Card>
  );
}
