import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowRight, Printer, MessageCircle, Mail, FileDown } from "lucide-react";
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
import { TEACHER_LABEL } from "@/lib/kodesh-subjects";

export const Route = createFileRoute("/_authenticated/reports/$classId")({
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
  const build = useServerFn(buildClassReport);
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [studentFilter, setStudentFilter] = useState<string>("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["report", classId, from, to],
    queryFn: () => build({ data: { classId, from, to } }),
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (studentFilter === "all") return data.students;
    return data.students.filter((s) => s.id === studentFilter);
  }, [data, studentFilter]);

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
            <Label>תלמיד</Label>
            <Select value={studentFilter} onValueChange={setStudentFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הכיתה</SelectItem>
                {(data?.students ?? []).map((s) => (
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
            <Button onClick={onPrint}><Printer className="ms-1 h-4 w-4" /> הדפס / PDF</Button>
          </div>
        </CardContent>
      </Card>

      <div id="report-printable" className="space-y-4 bg-card rounded-2xl border p-8 print:border-0 print:shadow-none print:p-0">
        <header className="border-b pb-4">
          <h1 className="font-display text-3xl font-bold">דוח כיתה — {data?.class.name ?? "..."}</h1>
          <p className="mt-1 text-sm text-muted-foreground font-mono-tabular">
            תקופה: {from} — {to} · הופק: {today()} · {TEACHER_LABEL} המלמד
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

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print, header[role="banner"], nav { display: none !important; }
          #report-printable { box-shadow: none !important; }
          @page { size: A4; margin: 16mm; }
        }
      `}</style>
    </div>
  );
}