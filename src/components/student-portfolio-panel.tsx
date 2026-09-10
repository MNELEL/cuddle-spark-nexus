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
import { Plus, Trash2, History } from "lucide-react";
import {
  getStudentPortfolio, addPortfolioItem, deletePortfolioItem,
  PORTFOLIO_KINDS, portfolioKindLabel, type PortfolioKind,
} from "@/lib/portfolio.functions";
import { hebrewDate } from "@/lib/hebrew-date";

export function StudentPortfolioPanel({ studentId }: { studentId: string }) {
  const load = useServerFn(getStudentPortfolio);
  const add = useServerFn(addPortfolioItem);
  const remove = useServerFn(deletePortfolioItem);
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
                  </div>
                  {i.description && <p className="mt-1 text-xs text-muted-foreground">{i.description}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground font-mono-tabular">{hebrewDate(i.item_date)}</p>
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
