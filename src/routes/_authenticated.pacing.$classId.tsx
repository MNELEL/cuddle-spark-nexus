import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Calculator, Check, Plus, Save, Trash2 } from "lucide-react";
import {
  approvePacingPlan, computePacingPlan, deletePacingSubject, getPacingOverview, respreadPacing,
  savePacingBuffer, savePacingSubject, updatePacingWeek,
  type PacingMode, type PacingSubjectPlan, type PacingTopic, type PacingWeekRow,
} from "@/lib/pacing-plan.functions";
import { fmtNum, rangeText, teachingLessonCount } from "@/lib/pacing-math";
import { addDaysIso, isoDate, parseIso } from "@/lib/schedule-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/pacing/$classId")({
  head: () => ({
    meta: [
      { title: "תכנון קצב שנתי · הכיתה שלי" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PacingPage,
});

const MODE_LABEL: Record<PacingMode, string> = {
  amount: "כמות כוללת",
  topics: "רשימת נושאים",
  both: "כמות ונושאים",
};
const fmtWeek = (ws: string) => {
  const a = parseIso(ws);
  const b = parseIso(addDaysIso(ws, 5));
  return `${a.getDate()}.${a.getMonth() + 1}–${b.getDate()}.${b.getMonth() + 1}`;
};

function PacingPage() {
  const { classId } = Route.useParams();
  const qc = useQueryClient();
  const overviewFn = useServerFn(getPacingOverview);
  const computeFn = useServerFn(computePacingPlan);
  const approveFn = useServerFn(approvePacingPlan);
  const bufferFn = useServerFn(savePacingBuffer);

  const [today, setToday] = useState<string | null>(null);
  useEffect(() => { setToday(isoDate(new Date())); }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pacing", classId, today],
    enabled: !!today,
    queryFn: () => overviewFn({ data: { classId, today: today! } }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["pacing", classId] });
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "הפעולה נכשלה");

  const computeM = useMutation({
    mutationFn: () => computeFn({ data: { classId, today: today! } }),
    onSuccess: (r) => {
      refresh();
      const skipped = r.summary.filter((s) => s.skipped);
      toast.success(`חושבה תוכנית ל-${r.summary.length - skipped.length} מקצועות`);
      if (skipped.length) toast.message(skipped.map((s) => `${s.subject}: ${s.skipped}`).join(" · "));
    },
    onError,
  });
  const approveM = useMutation({
    mutationFn: () => approveFn({ data: { classId, today: today! } }),
    onSuccess: (r) => { refresh(); toast.success(`אושר. עודכנו היעדים ב-${r.lessonsUpdated} שיעורים`); },
    onError,
  });
  const bufferM = useMutation({ mutationFn: (v: number) => bufferFn({ data: { classId, bufferPercent: v } }), onSuccess: refresh, onError });

  const weeksBySubject = useMemo(() => {
    const m = new Map<string, PacingWeekRow[]>();
    for (const w of data?.weeks ?? []) m.set(w.subject, [...(m.get(w.subject) ?? []), w]);
    return m;
  }, [data]);
  const hasDraft = (data?.weeks ?? []).some((w) => w.status === "draft");
  const hasPlans = (data?.plans.length ?? 0) > 0;

  if (isLoading || !today) {
    return (
      <div className="mx-auto max-w-4xl space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg space-y-3 py-12 text-center">
        <p className="text-sm text-muted-foreground" role="alert">{error instanceof Error ? error.message : "טעינת התכנון נכשלה."}</p>
        <Link to="/classes/$classId" params={{ classId }}><Button variant="outline">חזרה לכיתה</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to="/classes/$classId" params={{ classId }} className="flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowRight className="h-4 w-4" aria-hidden="true" /> חזרה לכיתה
      </Link>
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold">תכנון קצב שנתי</h1>
        <p className="text-sm text-muted-foreground">
          מגדירים לכל מקצוע מה צריך להספיק, והמערכת מחשבת כמה בכל שבוע וכמה בכל שיעור, לפי השיעורים שנשארו במערכת אחרי חופשות וחגים. אפשר לערוך ידנית ולאשר, והיעדים נכנסים לשיעורים.
        </p>
      </header>

      <section aria-labelledby="subjects" className="space-y-2">
        <h2 id="subjects" className="font-bold">1. מה צריך להספיק</h2>
        {data.subjects.length === 0 && (
          <Card><CardContent className="py-6 text-sm text-muted-foreground">
            אין שיעורים במערכת מהיום והלאה. אפשר להוסיף ב<Link to="/weekly-schedule/$classId" params={{ classId }} className="underline">מערכת השבועית</Link>.
          </CardContent></Card>
        )}
        <div className="grid gap-2">
          {data.subjects.map((s) => (
            <SubjectCard
              key={s.name}
              classId={classId}
              name={s.name}
              remaining={s.remainingLessons}
              bufferPercent={data.bufferPercent}
              plan={data.plans.find((p) => p.subject === s.name) ?? null}
              onChanged={refresh}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="calc" className="space-y-3">
        <h2 id="calc" className="font-bold">2. חישוב ואישור</h2>
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 py-4">
            <label className="space-y-1 text-sm">
              <span className="block text-xs text-muted-foreground">רזרבה לחזרה ולמבחנים (%)</span>
              <Input
                key={data.bufferPercent}
                type="number" min={0} max={60} className="h-9 w-24"
                defaultValue={data.bufferPercent}
                onBlur={(e) => {
                  const v = Math.min(60, Math.max(0, Math.round(Number(e.target.value) || 0)));
                  if (v !== data.bufferPercent) bufferM.mutate(v);
                }}
              />
            </label>
            <Button onClick={() => computeM.mutate()} disabled={!hasPlans || computeM.isPending}>
              <Calculator className="ms-1 h-4 w-4" /> {computeM.isPending ? "מחשב..." : "חשב תוכנית"}
            </Button>
            <Button
              variant="secondary"
              disabled={!hasDraft || approveM.isPending}
              onClick={() => {
                if (window.confirm("האישור כותב יעדים להערות השיעורים בשבועות הקרובים. הערות שכתבת בעצמך לא יידרסו. להמשיך?")) approveM.mutate();
              }}
            >
              <Check className="ms-1 h-4 w-4" /> {approveM.isPending ? "מאשר..." : "אשר ויישם בשיעורים"}
            </Button>
            {!hasPlans && <span className="text-xs text-muted-foreground">שמרו תחילה מה צריך להספיק לפחות במקצוע אחד.</span>}
          </CardContent>
        </Card>
      </section>

      {data.plans.filter((p) => weeksBySubject.has(p.subject)).map((p) => (
        <SubjectPlanTable
          key={p.subject}
          classId={classId}
          plan={p}
          rows={weeksBySubject.get(p.subject)!}
          onChanged={refresh}
        />
      ))}
    </div>
  );
}

/* ---------------------------- הגדרת מקצוע ---------------------------- */
function SubjectCard({ classId, name, remaining, bufferPercent, plan, onChanged }: {
  classId: string; name: string; remaining: number; bufferPercent: number; plan: PacingSubjectPlan | null; onChanged: () => void;
}) {
  const saveFn = useServerFn(savePacingSubject);
  const delFn = useServerFn(deletePacingSubject);
  const [mode, setMode] = useState<PacingMode>(plan?.mode ?? "amount");
  const [total, setTotal] = useState(plan?.total_amount != null ? String(plan.total_amount) : "");
  const [unit, setUnit] = useState(plan?.unit_label ?? "דפים");
  const [start, setStart] = useState(String(plan?.start_number ?? 1));
  const [topics, setTopics] = useState<PacingTopic[]>(plan?.topics ?? []);
  const [open, setOpen] = useState(false);
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה");

  const saveM = useMutation({
    mutationFn: () => saveFn({
      data: {
        classId, subject: name, mode,
        totalAmount: mode === "topics" || total.trim() === "" ? null : Math.max(0, Number(total) || 0),
        unitLabel: unit.trim() || "יחידות",
        startNumber: Number(start) || 0,
        topics: topics.filter((t) => t.title.trim()).map((t) => ({ title: t.title.trim(), lessons: Math.max(1, Math.round(t.lessons) || 1) })),
      },
    }),
    onSuccess: () => { toast.success("נשמר"); onChanged(); },
    onError,
  });
  const delM = useMutation({
    mutationFn: () => delFn({ data: { classId, subject: name } }),
    onSuccess: () => { toast.success("התוכנית נמחקה"); setOpen(false); onChanged(); },
    onError,
  });

  const teach = teachingLessonCount(remaining, bufferPercent);
  const topicsSum = topics.reduce((n, t) => n + (Number(t.lessons) || 0), 0);
  const showAmount = mode !== "topics";
  const showTopics = mode !== "amount";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle as="h3" className="flex items-center gap-2 text-base">
            {name}
            {plan && <Badge variant="secondary">{plan.mode === "topics" ? "נושאים" : `${plan.total_amount ?? 0} ${plan.unit_label}`}</Badge>}
          </CardTitle>
          <CardDescription>{remaining} שיעורים עד סוף השנה, מהם {teach} ללימוד חדש</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {open ? "סגור" : plan ? "עריכה" : "הגדרה"}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="space-y-1 text-sm">
              <span className="block text-xs text-muted-foreground">איך מגדירים</span>
              <Select value={mode} onValueChange={(v) => setMode(v as PacingMode)}>
                <SelectTrigger className="h-9 w-44" aria-label="סוג ההגדרה"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODE_LABEL) as PacingMode[]).map((m) => <SelectItem key={m} value={m}>{MODE_LABEL[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            {showAmount && (
              <>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs text-muted-foreground">כמה להספיק עד סוף השנה</span>
                  <Input type="number" min={0} className="h-9 w-28" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="120" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs text-muted-foreground">יחידה</span>
                  <Input className="h-9 w-28" maxLength={20} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="דפים" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="block text-xs text-muted-foreground">מתחילים מיחידה מספר</span>
                  <Input type="number" min={0} className="h-9 w-28" value={start} onChange={(e) => setStart(e.target.value)} />
                </label>
              </>
            )}
          </div>

          {showTopics && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                נושאים לפי הסדר, ולכל נושא כמה שיעורים הוא דורש. אם הסכום ({topicsSum}) שונה ממספר שיעורי הלימוד ({teach}), המערכת מותחת או מכווצת את הנושאים באופן יחסי.
              </p>
              <ul className="space-y-1.5">
                {topics.map((t, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Input
                      aria-label={`שם נושא ${i + 1}`} className="h-9" maxLength={80} placeholder="שם הנושא"
                      value={t.title}
                      onChange={(e) => setTopics((l) => l.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    />
                    <Input
                      aria-label={`מספר שיעורים לנושא ${i + 1}`} type="number" min={1} className="h-9 w-20"
                      value={t.lessons}
                      onChange={(e) => setTopics((l) => l.map((x, j) => (j === i ? { ...x, lessons: Number(e.target.value) } : x)))}
                    />
                    <Button type="button" variant="ghost" size="icon" aria-label={`הסר נושא ${i + 1}`} onClick={() => setTopics((l) => l.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="outline" size="sm" onClick={() => setTopics((l) => [...l, { title: "", lessons: 5 }])}>
                <Plus className="ms-1 h-4 w-4" /> הוסף נושא
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => saveM.mutate()} disabled={saveM.isPending}>
              <Save className="ms-1 h-4 w-4" /> שמור
            </Button>
            {plan && (
              <Button variant="ghost" onClick={() => { if (window.confirm(`למחוק את התוכנית של ${name}?`)) delM.mutate(); }} disabled={delM.isPending}>
                מחק תוכנית
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ---------------------------- טבלת שבועות ---------------------------- */
function SubjectPlanTable({ classId, plan, rows, onChanged }: {
  classId: string; plan: PacingSubjectPlan; rows: PacingWeekRow[]; onChanged: () => void;
}) {
  const updateFn = useServerFn(updatePacingWeek);
  const respreadFn = useServerFn(respreadPacing);
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : "הפעולה נכשלה");
  const updateM = useMutation({ mutationFn: (v: { id: string; amount: number }) => updateFn({ data: { classId, id: v.id, amount: v.amount } }), onSuccess: onChanged, onError });
  const respreadM = useMutation({ mutationFn: () => respreadFn({ data: { classId, subject: plan.subject } }), onSuccess: () => { toast.success("החלוקה עודכנה"); onChanged(); }, onError });

  const planned = rows.reduce((n, r) => n + r.amount, 0);
  const target = plan.mode !== "topics" ? plan.total_amount ?? 0 : null;
  const diff = target != null ? planned - Math.round(target) : 0;
  const draft = rows.some((r) => r.status === "draft");
  const showAmount = plan.mode !== "topics";
  const showTopics = plan.mode !== "amount";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle as="h2" className="flex items-center gap-2 text-base">
          {plan.subject}
          <Badge variant={draft ? "outline" : "secondary"}>{draft ? "טיוטה" : "מאושר"}</Badge>
        </CardTitle>
        {target != null && (
          <div className="flex items-center gap-2 text-sm" aria-live="polite">
            <span>
              מתוכנן {fmtNum(planned)} מתוך {fmtNum(target)} {plan.unit_label}
            </span>
            {diff !== 0 && (
              <>
                <Badge variant="destructive">{diff > 0 ? `עודף ${diff}` : `חסר ${-diff}`}</Badge>
                <Button size="sm" variant="outline" onClick={() => respreadM.mutate()} disabled={respreadM.isPending || rows.every((r) => r.edited)}>
                  חלק מחדש את השאר
                </Button>
              </>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">תכנון שבועי למקצוע {plan.subject}</caption>
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground">
              <th scope="col" className="border-b p-2 text-start font-medium">שבוע</th>
              <th scope="col" className="border-b p-2 text-center font-medium">שיעורים</th>
              {showAmount && <th scope="col" className="border-b p-2 text-center font-medium">כמות</th>}
              {showAmount && <th scope="col" className="border-b p-2 text-start font-medium">טווח</th>}
              {showAmount && <th scope="col" className="border-b p-2 text-center font-medium">בכל שיעור</th>}
              {showTopics && <th scope="col" className="border-b p-2 text-start font-medium">נושאים</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.edited ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}>
                <th scope="row" className="border-b p-2 text-start font-mono text-xs font-medium">{fmtWeek(r.week_start)}</th>
                <td className="border-b p-2 text-center">{r.lessons}</td>
                {showAmount && (
                  <td className="border-b p-1 text-center">
                    <Input
                      key={`${r.id}-${r.amount}`}
                      type="number" min={0} className="mx-auto h-8 w-16 text-center"
                      aria-label={`כמות בשבוע ${fmtWeek(r.week_start)}`}
                      defaultValue={r.amount}
                      onBlur={(e) => {
                        const v = Math.max(0, Math.round(Number(e.target.value) || 0));
                        if (v !== r.amount) updateM.mutate({ id: r.id, amount: v });
                      }}
                    />
                  </td>
                )}
                {showAmount && (
                  <td className="border-b p-2 text-xs">
                    {r.from_label != null && r.to_label != null ? rangeText(plan.unit_label, Number(r.from_label), Number(r.to_label)) : "—"}
                  </td>
                )}
                {showAmount && (
                  <td className="border-b p-2 text-center text-xs text-muted-foreground">
                    {r.amount > 0 && r.lessons > 0 ? `${fmtNum(Math.round((r.amount / r.lessons) * 10) / 10)}` : "—"}
                  </td>
                )}
                {showTopics && <td className="border-b p-2 text-xs">{r.topics ?? "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
