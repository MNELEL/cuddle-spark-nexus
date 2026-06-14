import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowRight, Printer, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { buildClassReport } from "@/lib/reports.functions";
import { TEACHER_LABEL } from "@/lib/kodesh-subjects";
import { ParentEmailComposer } from "@/components/parent-email-composer";

export const Route = createFileRoute("/_authenticated/daily/$classId")({
  component: DailySummaryPage,
});

function todayStr() { return new Date().toISOString().slice(0, 10); }
function hebrewDate(iso: string) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
}

function DailySummaryPage() {
  const { classId } = Route.useParams();
  const build = useServerFn(buildClassReport);
  const [date, setDate] = useState(todayStr());
  const [mode, setMode] = useState<"class" | "student">("class");
  const [studentId, setStudentId] = useState<string>("");
  const [classNotes, setClassNotes] = useState("");
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
  const [composer, setComposer] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["daily-report", classId, date],
    queryFn: () => build({ data: { classId, from: date, to: date } }),
  });

  const list = useMemo(() => {
    if (!data) return [];
    if (mode === "student" && studentId) return data.students.filter((s) => s.id === studentId);
    return data.students;
  }, [data, mode, studentId]);

  // Class-level attendance totals
  const totals = useMemo(() => {
    const t = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const s of data?.students ?? []) {
      t.present += s.attendance.present;
      t.absent += s.attendance.absent;
      t.late += s.attendance.late;
      t.excused += s.attendance.excused;
    }
    const total = t.present + t.absent + t.late + t.excused;
    return { ...t, total, pct: total ? Math.round(((t.present + t.excused) / total) * 100) : null };
  }, [data]);

  const shareText = useMemo(() => {
    if (!data) return "";
    const head = `סיכום יומי — ${data.class.name} — ${hebrewDate(date)}\n\n`;
    if (mode === "class") {
      const summary = totals.total
        ? `נוכחות: נכחו ${totals.present}, נעדרו ${totals.absent}, איחרו ${totals.late} (${totals.pct}%)\n`
        : "אין רישומי נוכחות להיום.\n";
      const notes = classNotes ? `\nהערות ${TEACHER_LABEL} המלמד:\n${classNotes}\n` : "";
      return head + summary + notes;
    }
    const s = list[0];
    if (!s) return head;
    const grades = s.grades.length
      ? s.grades.map((g) => `• ${g.subject || "—"}: ${g.value}/${g.max_value}`).join("\n")
      : "אין ציונים להיום.";
    const disc = s.discipline.length
      ? s.discipline.map((e) => `• ${e.type === "positive" ? "+" : "−"} ${e.category}: ${e.description}`).join("\n")
      : "אין אירועי התנהגות.";
    const notes = studentNotes[s.id] ? `\nהערות ${TEACHER_LABEL}:\n${studentNotes[s.id]}\n` : "";
    return `${head}תלמיד: ${s.name}\n\nציונים:\n${grades}\n\nאירועים:\n${disc}\n${notes}`;
  }, [data, mode, list, totals, classNotes, studentNotes, date]);

  const onPrint = () => window.print();
  const onEmail = () => {
    const subject = encodeURIComponent(`סיכום יומי — ${data?.class.name ?? ""} — ${date}`);
    const body = encodeURIComponent(shareText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };
  const onWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="no-print flex items-center justify-between">
        <Link to="/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
        <Link to="/reports/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline">
          דוח טווח תאריכים →
        </Link>
      </div>

      <Card className="no-print">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div>
            <Label>תאריך</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="min-w-[160px]">
            <Label>היקף</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "class" | "student")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="class">כל הכיתה</SelectItem>
                <SelectItem value="student">תלמיד יחיד</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "student" && (
            <div className="min-w-[220px]">
              <Label>תלמיד</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="בחר תלמיד" /></SelectTrigger>
                <SelectContent>
                  {(data?.students ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="ms-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={onEmail}><Mail className="ms-1 h-4 w-4" /> מייל להורים</Button>
            <Button variant="outline" onClick={onWhatsApp}><MessageCircle className="ms-1 h-4 w-4" /> וואטסאפ</Button>
            <Button onClick={onPrint}><Printer className="ms-1 h-4 w-4" /> הדפס / PDF (A4)</Button>
          </div>
        </CardContent>
      </Card>

      {/* Teacher notes editor — live updates the document below */}
      <Card className="no-print">
        <CardContent className="py-4 space-y-3">
          {mode === "class" ? (
            <div>
              <Label>הערות {TEACHER_LABEL} (כלל-כיתתי)</Label>
              <Textarea
                rows={3}
                value={classNotes}
                onChange={(e) => setClassNotes(e.target.value)}
                placeholder="לדוגמה: היום למדנו את סוגיית הפותח עם רב... התקדמות יפה. מחר נמשיך מדף..."
              />
            </div>
          ) : (
            studentId && (
              <div>
                <Label>הערות {TEACHER_LABEL} על התלמיד</Label>
                <Textarea
                  rows={3}
                  value={studentNotes[studentId] ?? ""}
                  onChange={(e) => setStudentNotes((m) => ({ ...m, [studentId]: e.target.value }))}
                  placeholder="משוב אישי, חוזקות, מה לחזק..."
                />
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Printable A4 document */}
      <div id="daily-printable" className="space-y-5 bg-card rounded-2xl border p-8 print:border-0 print:shadow-none print:p-0 print:bg-white">
        <header className="border-b pb-4">
          <h1 className="font-display text-3xl font-bold">
            סיכום יומי — {data?.class.name ?? "..."}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground font-mono-tabular">
            {hebrewDate(date)} · הופק {todayStr()} · {TEACHER_LABEL} המלמד
          </p>
        </header>

        {isLoading && <p className="text-muted-foreground">טוען נתונים...</p>}

        {/* Class-wide attendance summary */}
        {!isLoading && mode === "class" && (
          <section className="rounded-xl border p-5 break-inside-avoid">
            <h2 className="font-display text-xl font-bold mb-3">נוכחות הכיתה</h2>
            {totals.total ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <StatTile label="נכחו" value={totals.present} tone="emerald" />
                  <StatTile label="איחרו" value={totals.late} tone="amber" />
                  <StatTile label="נעדרו" value={totals.absent} tone="rose" />
                  <StatTile label="מאושר" value={totals.excused} tone="slate" />
                </div>
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                  <div className="bg-emerald-500" style={{ width: `${(totals.present / totals.total) * 100}%` }} />
                  <div className="bg-amber-500" style={{ width: `${(totals.late / totals.total) * 100}%` }} />
                  <div className="bg-rose-500" style={{ width: `${(totals.absent / totals.total) * 100}%` }} />
                  <div className="bg-slate-400" style={{ width: `${(totals.excused / totals.total) * 100}%` }} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  אחוז נוכחות פעילה: <span className="font-bold text-foreground">{totals.pct}%</span>
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">אין רישומי נוכחות לתאריך זה.</p>
            )}
            {classNotes && (
              <div className="mt-4 rounded-md bg-amber/10 border border-amber/30 p-3">
                <h3 className="text-sm font-bold mb-1">הערות {TEACHER_LABEL}</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{classNotes}</p>
              </div>
            )}
          </section>
        )}

        {/* Per-student rows */}
        {!isLoading && mode === "class" && (
          <section>
            <h2 className="font-display text-xl font-bold mb-3">פירוט תלמידים</h2>
            <table className="w-full text-sm border-collapse">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="text-right py-2">שם</th>
                  <th className="text-right">נוכחות</th>
                  <th className="text-right">ציונים היום</th>
                  <th className="text-right">התנהגות</th>
                  <th className="text-right no-print"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const att = s.attendance.present ? "נכח" : s.attendance.late ? "איחור" : s.attendance.absent ? "נעדר" : s.attendance.excused ? "מאושר" : "—";
                  return (
                    <tr key={s.id} className="border-b border-border/40 break-inside-avoid">
                      <td className="py-2 font-medium">{s.name}</td>
                      <td>{att}</td>
                      <td className="font-mono-tabular">
                        {s.grades.length ? s.grades.map((g, i) => (
                          <span key={i} className="me-2">{g.subject}: {g.value}/{g.max_value}</span>
                        )) : "—"}
                      </td>
                      <td>
                        {s.behavior.positive || s.behavior.negative ? (
                          <span>
                            <span className="text-emerald-600">+{s.behavior.positive}</span>
                            {" / "}
                            <span className="text-rose-600">−{s.behavior.negative}</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td className="no-print">
                        <Button size="sm" variant="ghost" onClick={() => setComposer({ id: s.id, name: s.name })}>
                          <Mail className="ms-1 h-3.5 w-3.5" /> מייל
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Individual student view */}
        {!isLoading && mode === "student" && list[0] && (() => {
          const s = list[0];
          const note = studentNotes[s.id];
          return (
            <section className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="font-display text-2xl font-bold">{s.name}</h2>
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="outline">נכח {s.attendance.present}</Badge>
                  <Badge variant="outline">איחור {s.attendance.late}</Badge>
                  <Badge variant="outline">נעדר {s.attendance.absent}</Badge>
                  <Badge variant="outline">התנהגות +{s.behavior.positive} / −{s.behavior.negative}</Badge>
                  <Button size="sm" variant="outline" className="no-print"
                    onClick={() => setComposer({ id: s.id, name: s.name })}>
                    <Mail className="ms-1 h-3.5 w-3.5" /> טיוטת מייל להורים
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border p-4 break-inside-avoid">
                <h3 className="font-bold mb-2">ציונים</h3>
                {s.grades.length ? (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr><th className="text-right">מקצוע</th><th className="text-right">ציון</th><th className="text-right">הערות</th></tr>
                    </thead>
                    <tbody>
                      {s.grades.map((g, i) => (
                        <tr key={i} className="border-t border-border/40">
                          <td className="py-1">{g.subject || "—"}</td>
                          <td className="font-mono-tabular">{g.value}/{g.max_value}</td>
                          <td className="text-muted-foreground">{g.notes || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-muted-foreground text-sm">אין ציונים להיום.</p>}
              </div>

              <div className="rounded-xl border p-4 break-inside-avoid">
                <h3 className="font-bold mb-2">אירועי התנהגות</h3>
                {s.discipline.length ? (
                  <ul className="space-y-1 text-sm">
                    {s.discipline.map((e, i) => (
                      <li key={i} className="flex gap-2">
                        <span className={e.type === "positive" ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                          {e.type === "positive" ? "+" : "−"}
                        </span>
                        <span className="font-medium">{e.category}:</span>
                        <span>{e.description}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-muted-foreground text-sm">אין אירועי התנהגות להיום.</p>}
              </div>

              {note && (
                <div className="rounded-xl bg-amber/10 border border-amber/30 p-4 break-inside-avoid">
                  <h3 className="font-bold mb-1">הערות {TEACHER_LABEL}</h3>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{note}</p>
                </div>
              )}
            </section>
          );
        })()}
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print, header[role="banner"], nav { display: none !important; }
          #daily-printable { box-shadow: none !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      {composer && (
        <ParentEmailComposer
          open={!!composer}
          onOpenChange={(o) => !o && setComposer(null)}
          classId={classId}
          studentId={composer.id}
          studentName={composer.name}
        />
      )}
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" | "slate" }) {
  const colors = {
    emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    rose: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    slate: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  }[tone];
  return (
    <div className={`rounded-lg border p-3 ${colors}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="font-display text-2xl font-bold">{value}</div>
    </div>
  );
}