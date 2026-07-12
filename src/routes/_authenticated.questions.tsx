import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Search, Copy, FileDown, Save, Loader2, X, Library, CheckSquare, Square, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { KODESH_SUBJECTS } from "@/lib/kodesh-subjects";
import {
  listResourceQuestions, upsertResource, RESOURCE_TYPES, RESOURCE_TYPE_LABELS,
  type QuestionItem, type ResourceType,
} from "@/lib/teaching-resources.functions";
import { exportQuestionsPdf } from "@/lib/pdf/question-bank-pdf";

export const Route = createFileRoute("/_authenticated/questions")({
  component: QuestionsBankPage,
});

const GRADE_LEVELS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"] as const;

type Filters = {
  search: string;
  resource_type: ResourceType | "";
  subject: string;
  grade_level: string;
  tag: string;
};

const empty: Filters = { search: "", resource_type: "", subject: "", grade_level: "", tag: "" };

function keyOf(q: QuestionItem) { return `${q.resource_id}::${q.index}`; }

function QuestionsBankPage() {
  const qc = useQueryClient();
  const list = useServerFn(listResourceQuestions);
  const upsert = useServerFn(upsertResource);

  const [filters, setFilters] = useState<Filters>(empty);
  const [selected, setSelected] = useState<Record<string, QuestionItem>>({});
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveSubject, setSaveSubject] = useState("");
  const [saveGrade, setSaveGrade] = useState("");
  const [withAnswers, setWithAnswers] = useState(true);

  const qq = useQuery({
    queryKey: ["question-bank", filters],
    queryFn: () => list({
      data: {
        search: filters.search || undefined,
        resource_type: filters.resource_type || undefined,
        subject: filters.subject || undefined,
        grade_level: filters.grade_level || undefined,
        tag: filters.tag || undefined,
      },
    }),
  });

  const items = qq.data ?? [];
  const selectedItems = useMemo(() => Object.values(selected), [selected]);
  const allSelected = items.length > 0 && items.every((it) => selected[keyOf(it)]);

  const toggle = (it: QuestionItem) => {
    const k = keyOf(it);
    setSelected((s) => {
      const next = { ...s };
      if (next[k]) delete next[k]; else next[k] = it;
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) { setSelected({}); return; }
    const next: Record<string, QuestionItem> = { ...selected };
    for (const it of items) next[keyOf(it)] = it;
    setSelected(next);
  };
  const clearAll = () => setSelected({});

  const copySelected = async () => {
    if (!selectedItems.length) return;
    const text = selectedItems.map((it, i) => {
      const line = `${i + 1}. ${it.q}`;
      return withAnswers && it.a ? `${line}\n   תשובה: ${it.a}` : line;
    }).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${selectedItems.length} שאלות הועתקו ללוח`);
    } catch { toast.error("העתקה נכשלה"); }
  };

  const exportPdf = async () => {
    if (!selectedItems.length) return;
    try {
      await exportQuestionsPdf(selectedItems, {
        title: saveTitle || "מאגר שאלות נבחר",
        withAnswers,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "יצוא נכשל");
    }
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      return upsert({
        data: {
          title: saveTitle.trim() || "מאגר שאלות חדש",
          description: `נבנה מ-${selectedItems.length} שאלות שנבחרו מהספרייה`,
          subject: saveSubject,
          grade_level: saveGrade,
          resource_type: "question_bank" as ResourceType,
          content: {
            questions: selectedItems.map((it) => ({ q: it.q, a: it.a || undefined })),
          },
          tags: [],
          ai_generated: false,
          source_prompt: "",
        },
      });
    },
    onSuccess: () => {
      toast.success("נשמר כמאגר חדש בספרייה");
      qc.invalidateQueries({ queryKey: ["teaching-resources"] });
      qc.invalidateQueries({ queryKey: ["question-bank"] });
      setSaveOpen(false);
      setSelected({});
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const activeChips = ([
    ["חיפוש", filters.search, () => setFilters((f) => ({ ...f, search: "" }))],
    ["סוג", filters.resource_type ? RESOURCE_TYPE_LABELS[filters.resource_type] : "", () => setFilters((f) => ({ ...f, resource_type: "" }))],
    ["מקצוע", filters.subject, () => setFilters((f) => ({ ...f, subject: "" }))],
    ["כיתה", filters.grade_level, () => setFilters((f) => ({ ...f, grade_level: "" }))],
    ["תגית", filters.tag, () => setFilters((f) => ({ ...f, tag: "" }))],
  ] as [string, string, () => void][]).filter(([, v]) => Boolean(v));

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/resources"><ArrowRight className="ms-1 h-4 w-4" /> חזרה לספרייה</Link>
        </Button>
        <div className="ms-auto text-xs text-muted-foreground">
          <Library className="ms-1 inline h-3.5 w-3.5" /> מאגר שאלות מכלל הספרייה
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="font-display text-2xl font-bold tracking-tight">מאגר שאלות</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          חיפוש, סינון ובחירה של שאלות מוכנות מכל חומרי הספרייה, לשימוש חוזר במבחנים ודפי עבודה.
        </p>
      </div>

      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute end-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="חפש בטקסט השאלה או בתשובה…"
                className="pe-8"
              />
            </div>
            <Select
              value={filters.resource_type || "__all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, resource_type: v === "__all" ? "" : (v as ResourceType) }))}
            >
              <SelectTrigger className="w-40"><SelectValue placeholder="סוג" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">כל הסוגים</SelectItem>
                {RESOURCE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.subject || "__all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, subject: v === "__all" ? "" : v }))}
            >
              <SelectTrigger className="w-36"><SelectValue placeholder="מקצוע" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">כל המקצועות</SelectItem>
                {KODESH_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select
              value={filters.grade_level || "__all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, grade_level: v === "__all" ? "" : v }))}
            >
              <SelectTrigger className="w-28"><SelectValue placeholder="כיתה" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">כל הכיתות</SelectItem>
                {GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              value={filters.tag}
              onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))}
              placeholder="תגית"
              className="w-28"
            />
          </div>
          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              {activeChips.map(([label, v, clear]) => (
                <button
                  key={label}
                  onClick={clear}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs hover:bg-muted"
                >
                  <span className="text-muted-foreground">{label}:</span> {v}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button onClick={() => setFilters(empty)} className="ms-2 text-xs text-primary hover:underline">
                נקה הכל
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="sticky top-16 z-10 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleAll} disabled={items.length === 0}>
            {allSelected ? <CheckSquare className="ms-1 h-4 w-4" /> : <Square className="ms-1 h-4 w-4" />}
            {allSelected ? "בטל בחירה מהעמוד" : "בחר את כל התוצאות"}
          </Button>
          <Badge variant="secondary">
            {selectedItems.length} נבחרו · {items.length} תוצאות
          </Badge>
          {selectedItems.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="ms-1 h-4 w-4" /> נקה בחירה
            </Button>
          )}
          <label className="ms-2 inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
            <Checkbox checked={withAnswers} onCheckedChange={(v) => setWithAnswers(Boolean(v))} />
            כלול תשובות
          </label>
          <div className="ms-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!selectedItems.length} onClick={copySelected}>
              <Copy className="ms-1 h-4 w-4" /> העתק
            </Button>
            <Button variant="outline" size="sm" disabled={!selectedItems.length} onClick={exportPdf}>
              <FileDown className="ms-1 h-4 w-4" /> יצוא PDF
            </Button>
            <Button size="sm" disabled={!selectedItems.length} onClick={() => setSaveOpen(true)}>
              <Save className="ms-1 h-4 w-4" /> שמור כמאגר חדש
            </Button>
          </div>
        </div>
      </div>

      {qq.isLoading ? (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> טוען שאלות…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">
          לא נמצאו שאלות. נסה לשנות סינון או הוסף חומרים לספרייה עם שאלות.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const k = keyOf(it);
            const on = Boolean(selected[k]);
            return (
              <li key={k}>
                <label
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition hover:bg-accent/40 ${on ? "border-primary/50 bg-primary/5" : "bg-card"}`}
                >
                  <Checkbox checked={on} onCheckedChange={() => toggle(it)} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium leading-relaxed">{it.q}</div>
                    {it.a && withAnswers && (
                      <div className="mt-1 rounded bg-muted/40 p-2 text-xs text-muted-foreground">
                        <span className="font-semibold">תשובה:</span> {it.a}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {RESOURCE_TYPE_LABELS[it.resource_type]}
                      </Badge>
                      {it.subject && <Badge variant="secondary" className="text-[10px]">{it.subject}</Badge>}
                      {it.grade_level && <Badge variant="secondary" className="text-[10px]">כיתה {it.grade_level}</Badge>}
                      <span className="mx-1">·</span>
                      <Link
                        to="/resources/$resourceId"
                        params={{ resourceId: it.resource_id }}
                        className="hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {it.resource_title}
                      </Link>
                    </div>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>שמור כמאגר שאלות חדש</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>כותרת</Label>
              <Input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder="מבחן חזרה על פרשת השבוע" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>מקצוע</Label>
                <Select value={saveSubject || "__none"} onValueChange={(v) => setSaveSubject(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">ללא</SelectItem>
                    {KODESH_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>כיתה</Label>
                <Select value={saveGrade || "__none"} onValueChange={(v) => setSaveGrade(v === "__none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="ללא" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">ללא</SelectItem>
                    {GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              יישמר בספרייה כ״מאגר שאלות״ עם {selectedItems.length} שאלות. תוכל להשתמש בו במבחנים עתידיים.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>ביטול</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Save className="ms-1 h-4 w-4" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}