import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Library, Check, Search, Sparkles, ListChecks, X, Eye, ChevronDown, ArrowRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  suggestResourcesForBulletin, listQuestionsFromResource,
} from "@/lib/bulletin-sync.functions";
import { listResources, RESOURCE_TYPE_LABELS } from "@/lib/teaching-resources.functions";
import type { QuizQuestion } from "@/lib/bulletins.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bulletinId: string;
  /** Called with the questions the teacher picked; caller appends them to the draft. */
  onImport: (questions: QuizQuestion[]) => void;
};

/** סוגי החומרים שנושאים שאלות חזרה — הסינון בדיאלוג. */
const TYPE_FILTERS = [
  { value: "all", label: "הכל" },
  { value: "question_bank", label: RESOURCE_TYPE_LABELS.question_bank },
  { value: "worksheet", label: RESOURCE_TYPE_LABELS.worksheet },
] as const;

type TypeFilter = (typeof TYPE_FILTERS)[number]["value"];

/** גודל דף בטעינה מדורגת של חומרי הספרייה. */
const PAGE_SIZE = 20;

/** ייבוא שאלות חזרה מחומרים קיימים בספריית החומרים אל תוך העלון. */
export function BulletinImportQuestionsDialog({ open, onOpenChange, bulletinId, onImport }: Props) {
  const suggest = useServerFn(suggestResourcesForBulletin);
  const search = useServerFn(listResources);
  const listQuestions = useServerFn(listQuestionsFromResource);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [term, setTerm] = useState("");
  /** מונח חיפוש מושהה (debounce) — לא שולחים בקשה על כל הקשה. */
  const [debounced, setDebounced] = useState("");
  const [pages, setPages] = useState(1);
  const [questionTerm, setQuestionTerm] = useState("");
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(term.trim()); setPages(1); }, 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => { setPages(1); }, [typeFilter]);

  const { data: suggested = [], isFetching: loadingSuggested } = useQuery({
    queryKey: ["bulletin-import-suggest", bulletinId],
    queryFn: () => suggest({ data: { bulletin_id: bulletinId, limit: 12 } }),
    enabled: open && debounced.length === 0,
  });

  const { data: searched = [], isFetching: loadingSearched } = useQuery({
    queryKey: ["bulletin-import-search", debounced, typeFilter, pages],
    queryFn: () => search({ data: {
      search: debounced,
      ...(typeFilter === "all" ? {} : { resource_type: typeFilter }),
      limit: pages * PAGE_SIZE,
      offset: 0,
    } }),
    enabled: open && debounced.length > 0,
    placeholderData: (prev) => prev,
  });

  const isSearching = debounced.length > 0;
  const loadingResources = isSearching ? loadingSearched : loadingSuggested;
  const canLoadMore = isSearching && searched.length >= pages * PAGE_SIZE;
  const resources = useMemo(() => {
    const rows = isSearching
      ? searched.map((r) => ({ id: r.id, title: r.title, resource_type: r.resource_type, subject: r.subject }))
      : suggested.map((r) => ({ id: r.id, title: r.title, resource_type: r.resource_type, subject: r.subject }));
    return typeFilter === "all" ? rows : rows.filter((r) => r.resource_type === typeFilter);
  }, [isSearching, searched, suggested, typeFilter]);

  const { data: loaded, isFetching: loadingQuestions } = useQuery({
    queryKey: ["bulletin-import-questions", resourceId],
    queryFn: () => listQuestions({ data: { resource_id: resourceId! } }),
    enabled: open && !!resourceId,
  });

  const allQuestions = loaded?.questions ?? [];
  /** שומרים את האינדקס המקורי כדי שהסימון ישרוד סינון טקסט. */
  const questions = useMemo(() => {
    const t = questionTerm.trim();
    const indexed = allQuestions.map((q, i) => ({ ...q, i }));
    if (!t) return indexed;
    return indexed.filter((q) => `${q.question} ${q.answer}`.includes(t));
  }, [allQuestions, questionTerm]);

  const selected = useMemo(
    () => allQuestions.filter((_q, i) => picked[String(i)]).map((q) => ({ question: q.question, answer: q.answer })),
    [allQuestions, picked],
  );
  const allVisiblePicked = questions.length > 0 && questions.every((q) => picked[String(q.i)]);

  const reset = () => { setResourceId(null); setPicked({}); setQuestionTerm(""); setPreviewing(false); };

  const toggleAllVisible = () => {
    setPicked((p) => {
      const next = { ...p };
      for (const q of questions) next[String(q.i)] = !allVisiblePicked;
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}
    >
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-4 w-4 text-amber" aria-hidden="true" />
            ייבוא שאלות מהספרייה
          </DialogTitle>
          <DialogDescription>
            סנן לפי סוג, חפש בטקסט, ובחר כמה שאלות בבת אחת להוספה לשאלות החזרה של העלון.
          </DialogDescription>
        </DialogHeader>

        {previewing ? (
          <div className="space-y-2">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              ייובאו <strong>{selected.length}</strong> שאלות מהחומר "{loaded?.title || "חומר"}"
              והן יתווספו לסוף בלוק "שאלות חזרה" בעלון, בסדר שמוצג כאן.
            </div>
            <ScrollArea className="max-h-72">
              <ol className="space-y-2 pe-2">
                {selected.map((q, i) => (
                  <li key={i} className="rounded-md border bg-card p-2 text-sm">
                    <div className="font-medium">{i + 1}. {q.question}</div>
                    {q.answer && <div className="mt-1 text-xs text-muted-foreground">תשובה: {q.answer}</div>}
                  </li>
                ))}
              </ol>
            </ScrollArea>
          </div>
        ) : !resourceId ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="pointer-events-none absolute end-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  className="pe-8"
                  placeholder="חיפוש חומר בספרייה…"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-1" role="group" aria-label="סינון לפי סוג">
                {TYPE_FILTERS.map((t) => (
                  <Button
                    key={t.value}
                    size="sm"
                    variant={typeFilter === t.value ? "default" : "outline"}
                    onClick={() => setTypeFilter(t.value)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {isSearching
                ? <><Search className="h-3 w-3" aria-hidden="true" /> תוצאות חיפוש בספרייה</>
                : <><Sparkles className="h-3 w-3 text-amber" aria-hidden="true" /> הצעות מתאימות לתוכן העלון</>}
            </div>
            {loadingResources && resources.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> טוען חומרים…
              </div>
            )}
            {!loadingResources && resources.length === 0 && (
              <div className="text-sm text-muted-foreground">
                לא נמצאו חומרים מתאימים. נסה לשנות את הסינון או את מילות החיפוש.
              </div>
            )}
            <ScrollArea className="max-h-72">
              <ul className="space-y-1 pe-2">
                {resources.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => { setResourceId(r.id); setPicked({}); setQuestionTerm(""); }}
                      className="min-h-9 w-full rounded-md border bg-card px-3 py-2 text-right text-sm transition hover:border-amber/40 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="font-medium">{r.title}</span>
                      <span className="ms-2 text-xs text-muted-foreground">
                        {RESOURCE_TYPE_LABELS[r.resource_type as keyof typeof RESOURCE_TYPE_LABELS] ?? r.resource_type}
                        {r.subject ? ` · ${r.subject}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            {canLoadMore && (
              <Button
                size="sm" variant="outline" className="w-full"
                disabled={loadingSearched}
                onClick={() => setPages((p) => p + 1)}
              >
                {loadingSearched
                  ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden="true" /> טוען…</>
                  : <><ChevronDown className="ms-1 h-4 w-4" aria-hidden="true" /> טען עוד חומרים</>}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">{loaded?.title || "חומר"}</div>
              <Button size="sm" variant="ghost" onClick={reset}>בחר חומר אחר</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="pointer-events-none absolute end-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  className="pe-8"
                  placeholder="סינון שאלות לפי טקסט…"
                  value={questionTerm}
                  onChange={(e) => setQuestionTerm(e.target.value)}
                />
              </div>
              <Button size="sm" variant="outline" disabled={questions.length === 0} onClick={toggleAllVisible}>
                <ListChecks className="ms-1 h-4 w-4" aria-hidden="true" />
                {allVisiblePicked ? "בטל סימון הכל" : "סמן הכל"}
              </Button>
              {selected.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setPicked({})}>
                  <X className="ms-1 h-4 w-4" aria-hidden="true" /> נקה בחירה
                </Button>
              )}
            </div>
            {loadingQuestions && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> טוען שאלות…
              </div>
            )}
            {!loadingQuestions && questions.length === 0 && (
              <div className="text-sm text-muted-foreground">
                {allQuestions.length === 0 ? "בחומר הזה אין שאלות לייבוא." : "אין שאלות שמתאימות לסינון."}
              </div>
            )}
            <ScrollArea className="max-h-72">
              <ul className="space-y-2 pe-2">
                {questions.map((q) => (
                  <li key={q.i} className="flex items-start gap-2 rounded-md border p-2">
                    <Checkbox
                      id={`q-${q.i}`}
                      checked={!!picked[String(q.i)]}
                      onCheckedChange={(v) => setPicked((p) => ({ ...p, [String(q.i)]: !!v }))}
                    />
                    <Label htmlFor={`q-${q.i}`} className="flex-1 cursor-pointer text-sm font-normal">
                      <span className="font-medium">{q.question}</span>
                      {q.answer && (
                        <span className="mt-1 block text-xs text-muted-foreground">{q.answer}</span>
                      )}
                    </Label>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {selected.length > 0 && (
            <span className="me-auto self-center text-xs text-muted-foreground">
              נבחרו {selected.length} שאלות
            </span>
          )}
          {previewing && (
            <Button variant="outline" onClick={() => setPreviewing(false)}>
              <ArrowRight className="ms-1 h-4 w-4" aria-hidden="true" /> חזור לבחירה
            </Button>
          )}
          {!previewing ? (
            <Button variant="outline" disabled={selected.length === 0} onClick={() => setPreviewing(true)}>
              <Eye className="ms-1 h-4 w-4" aria-hidden="true" />
              תצוגה מקדימה {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
          ) : null}
          <Button
            disabled={selected.length === 0}
            onClick={() => {
              onImport(selected);
              toast.success(`יובאו ${selected.length} שאלות לעלון`);
              reset();
              onOpenChange(false);
            }}
          >
            <Check className="ms-1 h-4 w-4" aria-hidden="true" />
            ייבא {selected.length > 0 ? `(${selected.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}