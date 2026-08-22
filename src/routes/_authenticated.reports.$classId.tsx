import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowRight, Printer, MessageCircle, Mail, FileDown, Sparkles, Sheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { buildClassReport } from "@/lib/reports.functions";
import { listGroups } from "@/lib/groups.functions";
import { exportClassGradesToSheet } from "@/lib/sheets-export.functions";
import { TEACHER_LABEL } from "@/lib/kodesh-subjects";
import { buildClassReportPdf } from "@/lib/pdf/class-report-pdf";
import { downloadPdfBlob } from "@/lib/pdf/pdf-builder";
import { useBrand } from "@/hooks/use-brand";
import { PdfPreviewModal } from "@/components/pdf-preview-modal";

export const Route = createFileRoute("/_authenticated/reports/$classId")({
  head: () => ({
    meta: [
      { title: "דוחות כיתה · הכיתה שלי" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReportsPage,
});

function today() { return new Date().toISOString().slice(0, 10); }
function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function ReportsPage() {
  const { classId } = Route.useParams();
  const { brand } = useBrand();
  const build = useServerFn(buildClassReport);
  const loadGroups = useServerFn(listGroups);
  const exportSheet = useServerFn(exportClassGradesToSheet);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [studentFilter, setStudentFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["report", classId, from, to],
    queryFn: () => build({ data: { classId, from, to } }),
  });

  const { data: groupsData } = useQuery({
    queryKey: ["groups", classId],
    queryFn: () => loadGroups({ data: { classId } }),
  });

  const groupMemberIds = useMemo(() => {
    if (groupFilter === "all" || !groupsData) return null;
    return new Set(
      groupsData.memberships
        .filter((m) => m.group_id === groupFilter)
        .map((m) => m.student_id),
    );
  }, [groupFilter, groupsData]);

  const groupName = useMemo(
    () => groupsData?.groups.find((g) => g.id === groupFilter)?.name ?? null,
    [groupsData, groupFilter],
  );

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.students;
    if (groupMemberIds) list = list.filter((s) => groupMemberIds.has(s.id));
    if (studentFilter !== "all") list = list.filter((s) => s.id === studentFilter);
    return list;
  }, [data, studentFilter, groupMemberIds]);

  const shareText = useMemo(() => {
    if (!data) return "";
    const header = `דוח כיתה ${data.class.name} (${data.range.from} — ${data.range.to})\n\n`;
    const body = filtered.map((s) => {
      const avg = s.avgPct !== null ? `ממוצע: ${s.avgPct.toFixed(1)}%` : "אין ציונים";
      const att = `נוכחות: נכח ${s.attendance.present}, נעדר ${s.attendance.absent}, איחור ${s.attendance.late}`;
      const beh = `התנהגות: +${s.behavior.positive} / -${s.behavior.negative}`;
      return `• ${s.name}\n  ${avg}\n  ${att}\n  ${beh}`;
    }).join("\n\n");
    return header + body;
  }, [data, filtered]);

  const onPrint = () => window.print();
  const onSheets = async () => {
    if (sheetBusy) return;
    setSheetBusy(true);
    try {
      const res = await exportSheet({ data: { classId, from, to } });
      toast.success(
        res.created
          ? `נוצר גיליון Google Sheets עם ${res.students} תלמידים`
          : `הגיליון הקיים עודכן (${res.students} תלמידים)`,
        {
          action: { label: "פתח גיליון", onClick: () => window.open(res.url, "_blank", "noopener") },
          duration: 10000,
        },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "הייצוא ל-Google Sheets נכשל");
    } finally {
      setSheetBusy(false);
    }
  };
  /** בניית ה-PDF עם הסינון והמיתוג הנוכחיים — משותפת להורדה ולתצוגה מקדימה. */
  const buildPdf = async () => {
    if (!data) throw new Error("אין נתונים");
    if (filtered.length === 0) throw new Error("אין תלמידים בסינון הנוכחי — שנה את הטווח או את הקבוצה");
    const scoped = { ...data, students: filtered };
    return buildClassReportPdf({
      report: scoped,
      schoolName: brand.school_name || undefined,
      teacherName: brand.teacher_name_default || undefined,
      groupName: groupName,
    });
  };
  const onPdf = async () => {
    try {
      const { blob, filename } = await buildPdf();
      downloadPdfBlob(blob, filename);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ייצוא ה-PDF נכשל");
    }
  };
  const onPreview = async () => {
    try {
      await buildPdf(); // ולידציה מוקדמת — תצוגה מקדימה תיפתח רק כשיש נתונים
      setPreviewOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ייצוא ה-PDF נכשל");
    }
  };
  const onWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  };
  const onEmail = () => {
    const subject = encodeURIComponent(`דוח כיתה ${data?.class.name ?? ""}`);
    const body = encodeURIComponent(shareText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("הועתק ללוח");
    } catch { toast.error("העתקה נכשלה"); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="no-print flex items-center justify-between">
        <Link to="/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
        <Link
          to="/pedagogical/$classId"
          params={{ classId }}
          className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
        >
          <Sparkles className="h-4 w-4" /> דוח פדגוגי (AI)
        </Link>
      </div>

      <Card className="no-print">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div>
            <Label>מתאריך</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>עד תאריך</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="min-w-[200px]">
            <Label>קבוצה</Label>
            <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v); setStudentFilter("all"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הקבוצות</SelectItem>
                {(groupsData?.groups ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px]">
            <Label>תלמיד</Label>
            <Select value={studentFilter} onValueChange={setStudentFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הכיתה</SelectItem>
                {(groupMemberIds ? (data?.students ?? []).filter((s) => groupMemberIds.has(s.id)) : (data?.students ?? [])).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ms-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => refetch()}>רענן</Button>
            <Button variant="outline" onClick={onCopy}><FileDown className="ms-1 h-4 w-4" /> העתק טקסט</Button>
            <Button variant="outline" onClick={onEmail}><Mail className="ms-1 h-4 w-4" /> מייל</Button>
            <Button variant="outline" onClick={onWhatsApp}><MessageCircle className="ms-1 h-4 w-4" /> וואטסאפ</Button>
            <Button variant="outline" onClick={onPdf}><FileDown className="ms-1 h-4 w-4" /> הורד PDF</Button>
            <Button variant="outline" onClick={onSheets} disabled={sheetBusy}>
              {sheetBusy ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Sheet className="ms-1 h-4 w-4" />}
              ייצוא ל-Google Sheets
            </Button>
            <Button onClick={onPrint}><Printer className="ms-1 h-4 w-4" /> הדפס / PDF</Button>
          </div>
        </CardContent>
      </Card>

      <div id="report-printable" className="report-print-area space-y-4 bg-card rounded-2xl border p-8 print:border-0 print:shadow-none print:p-0">
        <header className="border-b pb-4">
          <h1 className="font-display text-3xl font-bold">דוח כיתה — {data?.class.name ?? "..."}</h1>
          <p className="mt-1 text-sm text-muted-foreground font-mono-tabular">
            תקופה: {from} — {to} · הופק: {today()} · {TEACHER_LABEL} המלמד
            {groupName ? ` · קבוצה: ${groupName}` : ""}
            {` · ${filtered.length} תלמידים`}
          </p>
        </header>

        {isLoading && <p className="text-muted-foreground">טוען נתונים...</p>}

        {!isLoading && filtered.length === 0 && (
          <p className="text-muted-foreground">אין נתונים בטווח הזה.</p>
        )}

        <div className="space-y-5">
          {filtered.map((s) => (
            <section key={s.id} className="rounded-xl border p-5 break-inside-avoid">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-xl font-bold">{s.name}</h2>
                <div className="flex flex-wrap gap-2 text-sm">
                  {s.avgPct !== null && (
                    <Badge variant={s.avgPct >= 75 ? "default" : s.avgPct >= 60 ? "secondary" : "destructive"}>
                      ממוצע {s.avgPct.toFixed(1)}%
                    </Badge>
                  )}
                  <Badge variant="outline">נכח {s.attendance.present}</Badge>
                  <Badge variant="outline">נעדר {s.attendance.absent}</Badge>
                  <Badge variant="outline">איחור {s.attendance.late}</Badge>
                  <Badge variant="outline">התנהגות +{s.behavior.positive} / −{s.behavior.negative}</Badge>
                </div>
              </div>

              {s.grades.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">ציונים</h3>
                  <table className="mt-1 w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr><th className="text-right py-1">מקצוע / מסכת</th><th className="text-right">ציון</th><th className="text-right">תאריך</th><th className="text-right">הערות</th></tr>
                    </thead>
                    <tbody>
                      {s.grades.map((g, i) => (
                        <tr key={i} className="border-t border-border/40">
                          <td className="py-1">{g.subject || "—"}</td>
                          <td className="font-mono-tabular">{g.value}/{g.max_value}</td>
                          <td className="font-mono-tabular text-muted-foreground">{g.date}</td>
                          <td className="text-muted-foreground">{g.notes || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {s.discipline.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-muted-foreground">משמעת ואירועים</h3>
                  <ul className="mt-1 space-y-1 text-sm">
                    {s.discipline.map((e, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-mono-tabular text-muted-foreground">{e.date}</span>
                        <span className={e.type === "positive" ? "text-emerald-600" : "text-red-600"}>
                          {e.type === "positive" ? "+" : "−"} {e.category}
                        </span>
                        <span>{e.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>

    </div>
  );
}