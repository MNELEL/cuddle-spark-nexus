import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, History, Sparkles, CheckCircle2, Users } from "lucide-react";
import {
  getStudentPortfolio, addPortfolioItem, deletePortfolioItem,
  approvePortfolioItem, summarizePortfolioItem,
  listPortfolioMeetings, approveMeetingToPortfolio,
  PORTFOLIO_KINDS, portfolioKindLabel, type PortfolioKind,
} from "@/lib/portfolio.functions";
import { hebrewDate } from "@/lib/hebrew-date";

export function StudentPortfolioPanel({ studentId }: { studentId: string }) {
  const load = useServerFn(getStudentPortfolio);
  const add = useServerFn(addPortfolioItem);
  const remove = useServerFn(deletePortfolioItem);
  const summarize = useServerFn(summarizePortfolioItem);
  const approve = useServerFn(approvePortfolioItem);
  const loadMeetings = useServerFn(listPortfolioMeetings);
  const approveMeeting = useServerFn(approveMeetingToPortfolio);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["student-portfolio", studentId],
    queryFn: () => load({ data: { studentId } }),
  });

  const [kind, setKind] = useState<PortfolioKind>("achievement");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [schoolYear, setSchoolYear] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["student-portfolio", studentId] });

  const addM = useMutation({
    mutationFn: () => add({ data: { studentId, kind, title, description, school_year: schoolYear || null } }),
    onSuccess: () => {
      setTitle(""); setDescription(""); setSchoolYear("");
      invalidate();
      toast.success("הפריט נוסף לתיק");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("הפריט נמחק"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const summarizeM = useMutation({
    mutationFn: (id: string) => summarize({ data: { id } }),
    onSuccess: (r) => {
      invalidate();
      const s = (r as { sources?: { items: number; insights: number; meetings: number } }).sources;
      toast.success(
        s
          ? `הניתוח נוסף לפריט · ${s.items} פריטים, ${s.insights} תובנות, ${s.meetings} פגישות`
          : "הניתוח נוסף לפריט",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const approveM = useMutation({
    mutationFn: (v: { id: string; approved: boolean }) => approve({ data: v }),
    onSuccess: () => { invalidate(); toast.success("האישור עודכן"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const meetingsQ = useQuery({
    queryKey: ["student-portfolio-meetings", studentId],
    queryFn: () => loadMeetings({ data: { studentId } }),
  });

  const approveMeetingM = useMutation({
    mutationFn: (v: { meetingId: string; approved: boolean }) =>
      approveMeeting({ data: { studentId, ...v } }),
    onSuccess: (_r, v) => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["student-portfolio-meetings", studentId] });
      toast.success(v.approved ? "הפגישה אושרה לתיק ותיכלל בניתוח" : "אישור הפגישה בוטל");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const items = data?.items ?? [];
  const timeline = data?.timeline ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 pt-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="font-display text-lg">מסלול הלימודים</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            התיק נשמר לפי מזהה קבוע של התלמיד, כך שהוא נשמר גם כשהתלמיד עובר שנה.
          </p>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין עדיין רשומות שנים.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {timeline.map((t) => (
                <Badge key={t.studentId} variant={t.isCurrent ? "default" : "secondary"}>
                  {t.className}{t.academicYear ? ` · ${t.academicYear}` : ""}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" aria-hidden="true" />
            <h3 className="font-display text-lg">פגישות 1:1</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            אישור פגישה מוסיף אותה לתיק התלמיד, והיא נכללת בניתוח ה-AI של התיק.
          </p>
          {meetingsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">טוען…</p>
          ) : (meetingsQ.data?.meetings ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">אין פגישות 1:1 להצגה.</p>
          ) : (
            <div className="space-y-2">
              {(meetingsQ.data?.meetings ?? []).map((m) => (
                <div key={m.id} className="rounded-xl border p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium font-mono-tabular">
                      {hebrewDate(String(m.meeting_date).slice(0, 10))}
                    </span>
                    {m.approvedAt ? (
                      <Badge className="bg-accent text-accent-foreground">
                        אושר לתיק · {hebrewDate(String(m.approvedAt).slice(0, 10))}
                      </Badge>
                    ) : (
                      <Badge variant="outline">טרם אושר</Badge>
                    )}
                    {m.follow_up_date && (
                      <Badge variant="secondary">
                        מעקב · {hebrewDate(String(m.follow_up_date).slice(0, 10))}
                      </Badge>
                    )}
                  </div>
                  {m.summary && (
                    <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{m.summary}</p>
                  )}
                  {m.action_items && (
                    <p className="mt-1 text-xs">
                      <span className="font-medium">מטלות: </span>{m.action_items}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant={m.approvedAt ? "ghost" : "outline"}
                    className="mt-2 rounded-xl"
                    disabled={approveMeetingM.isPending}
                    onClick={() =>
                      approveMeetingM.mutate({ meetingId: m.id, approved: !m.approvedAt })
                    }
                  >
                    <CheckCircle2 className="me-1 h-4 w-4" aria-hidden="true" />
                    {m.approvedAt ? "בטל אישור" : "אשר לתיק"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-4">
          <h3 className="font-display text-lg">הוספת פריט לתיק</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pf-kind">סוג</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as PortfolioKind)}>
                <SelectTrigger id="pf-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PORTFOLIO_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{portfolioKindLabel[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pf-year">שנת לימודים</Label>
              <Input id="pf-year" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} placeholder="תשפ״ו" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="pf-title">כותרת</Label>
              <Input id="pf-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: סיים מסכת ברכות" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="pf-desc">פירוט</Label>
              <Textarea id="pf-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <Button
            className="w-full rounded-xl"
            disabled={addM.isPending || !title.trim()}
            onClick={() => addM.mutate()}
          >
            <Plus className="ms-1 h-4 w-4" aria-hidden="true" /> {addM.isPending ? "שומר…" : "הוסף לתיק"}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">טוען…</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">אין פריטים בתיק עדיין.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <Card key={i.id}>
              <CardContent className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{i.title}</span>
                    <Badge variant="secondary">{portfolioKindLabel[i.kind as PortfolioKind] ?? i.kind}</Badge>
                    {i.school_year && <Badge variant="outline" className="font-mono-tabular">{i.school_year}</Badge>}
                    {i.className && <Badge variant="outline">{i.className}</Badge>}
                    {i.approved_at ? (
                      <Badge className="bg-accent text-accent-foreground font-mono-tabular">
                        אושר · {hebrewDate(String(i.approved_at).slice(0, 10))}
                      </Badge>
                    ) : (
                      <Badge variant="outline">טרם אושר</Badge>
                    )}
                  </div>
                  {i.description && <p className="mt-1 text-xs text-muted-foreground">{i.description}</p>}
                  {i.ai_summary && (
                    <div className="mt-2 rounded-lg bg-muted/50 p-2 text-xs">
                      <div className="mb-1 font-medium">ניתוח AI</div>
                      <div className="whitespace-pre-wrap leading-relaxed">{i.ai_summary}</div>
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground font-mono-tabular">{hebrewDate(i.item_date)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={summarizeM.isPending}
                      onClick={() => summarizeM.mutate(i.id)}
                    >
                      <Sparkles className="me-1 h-4 w-4" aria-hidden="true" />
                      {i.ai_summary ? "רענן ניתוח AI" : "ניתוח AI מפורט"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl"
                      disabled={approveM.isPending}
                      onClick={() => approveM.mutate({ id: i.id, approved: !i.approved_at })}
                    >
                      <CheckCircle2 className="me-1 h-4 w-4" aria-hidden="true" />
                      {i.approved_at ? "בטל אישור" : "אשר"}
                    </Button>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive"
                  aria-label={`מחק את הפריט ${i.title}`}
                  onClick={() => removeM.mutate(i.id)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
