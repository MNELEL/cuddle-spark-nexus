import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, Loader2, Save, Trash2, Printer, Plus, Search,
  BookOpen, FileText, FolderPlus, X, ArrowRight, Tag, Library,
  ChevronDown, ChevronUp, Download, Eye,
  Star, Pencil, MessageCircleQuestion, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { KODESH_SUBJECTS } from "@/lib/kodesh-subjects";
import {
  listResources, upsertResource, deleteResource, generateResourceWithAI,
  listCollections, upsertCollection, deleteCollection, toggleCollectionItem,
  listCollectionItems, toggleResourceFavorite, askLibrary,
  RESOURCE_TYPES, RESOURCE_TYPE_LABELS,
  DIFFICULTIES, DIFFICULTY_LABELS,
  type ResourceRow, type ResourceContent, type ResourceType,
  type Difficulty,
} from "@/lib/teaching-resources.functions";
import { getPersonalRecommendations, recomputeStyleProfile } from "@/lib/teacher-style.functions";
import { Wand2 } from "lucide-react";
import { WeeklyPaceCard } from "@/components/weekly-pace-card";
import { TopicTreeFilter } from "@/components/topic-tree-filter";

export const Route = createFileRoute("/_authenticated/resources/")({
  component: ResourcesPage,
  head: () => ({
    meta: [
      { title: "ספריית חומרי הוראה · הכיתה שלי" },
      { name: "description", content: "ספרייה חכמה של דפי עבודה, מבחנים ושאלות לפי מקצועות קודש — ניתן לחפש, לסנן, לערוך ולייצא." },
      { property: "og:title", content: "ספריית חומרי הוראה · הכיתה שלי" },
      { property: "og:description", content: "ספרייה חכמה של דפי עבודה, מבחנים ושאלות לפי מקצועות קודש." },
      { property: "og:url", content: "https://cuddle-spark-nexus.lovable.app/resources" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const GRADE_LEVELS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"] as const;

/** קטגוריות ראשיות לספרייה — כל קטגוריה מקבצת כמה סוגי עזר */
const LIBRARY_CATEGORIES: { id: string; label: string; types: ResourceType[] }[] = [
  { id: "all", label: "הכל", types: [] },
  { id: "lesson_plan", label: "מערכי שיעור", types: ["lesson_plan"] },
  { id: "worksheet", label: "דפי עבודה", types: ["worksheet"] },
  { id: "exams", label: "מבחנים ושאלות", types: ["question_bank"] },
  { id: "activities", label: "פעילויות ומשחקים", types: ["activity", "game", "riddle"] },
  { id: "stories", label: "סיפורים ושירים", types: ["story", "song"] },
  { id: "visual", label: "עזרים חזותיים", types: ["visual_aid"] },
  { id: "other", label: "אחר", types: ["other"] },
];

/** Single, centralized filter state for the whole library screen. */
type FilterState = {
  search: string;
  resource_type: ResourceType | "";
  subject: string;
  grade_level: string;
  tag: string;
  difficulty: Difficulty | "";
  favoritesOnly: boolean;
  topicIds: string[];
  collectionIds: string[];
};

const emptyFilters: FilterState = {
  search: "", resource_type: "", subject: "", grade_level: "", tag: "",
  difficulty: "", favoritesOnly: false,
  topicIds: [], collectionIds: [],
};

const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  easy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medium: "border-amber/40 bg-amber/10 text-amber-700 dark:text-amber-300",
  hard: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function ResourcesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listResources);
  const del = useServerFn(deleteResource);
  const listColls = useServerFn(listCollections);
  const listCollItems = useServerFn(listCollectionItems);
  const toggleFav = useServerFn(toggleResourceFavorite);

  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const patch = (p: Partial<FilterState>) => setFilters((f) => ({ ...f, ...p }));
  const [editing, setEditing] = useState<Partial<ResourceRow> | null>(null);
  const [viewing, setViewing] = useState<ResourceRow | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSource, setAiSource] = useState<ResourceRow | null>(null);
  const [collOpen, setCollOpen] = useState(false);
  const [topOpen, setTopOpen] = useState(false);
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"items" | "ask">("items");

  // Server query holds only server-side filters; collection/topic filtering runs
  // client-side on the same dataset so no control overwrites another.
  const serverArgs = {
    search: filters.search || undefined,
    resource_type: filters.resource_type || undefined,
    subject: filters.subject || undefined,
    grade_level: filters.grade_level || undefined,
    tag: filters.tag || undefined,
    difficulty: filters.difficulty || undefined,
    favorites_only: filters.favoritesOnly || undefined,
  };

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["teaching-resources", serverArgs],
    queryFn: () => list({ data: serverArgs }),
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["resource-collections"],
    queryFn: () => listColls(),
  });
  const { data: collectionItems = [] } = useQuery({
    queryKey: ["resource-collection-items"],
    queryFn: () => listCollItems(),
  });

  const visibleResources = useMemo(() => {
    let out = resources;
    const cat = LIBRARY_CATEGORIES.find((c) => c.id === category);
    if (cat && cat.types.length > 0) {
      out = out.filter((r) => cat.types.includes(r.resource_type as ResourceType));
    }
    if (filters.collectionIds.length > 0) {
      const allowed = new Set(
        collectionItems
          .filter((i) => filters.collectionIds.includes(i.collection_id))
          .map((i) => i.resource_id),
      );
      out = out.filter((r) => allowed.has(r.id));
    }
    if (filters.topicIds.length > 0) {
      out = out.filter((r) => {
        const tid = (r as unknown as { topic_id: string | null }).topic_id;
        return tid !== null && filters.topicIds.includes(tid);
      });
    }
    // favorites first, then by recency (server already ordered by updated_at)
    return [...out].sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite));
  }, [resources, collectionItems, filters.collectionIds, filters.topicIds, category]);

  const favMut = useMutation({
    mutationFn: (v: { id: string; is_favorite: boolean }) => toggleFav({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teaching-resources"] }),
    onError: () => toast.error("לא הצלחנו לעדכן את המועדפים"),
  });

  const recs = useServerFn(getPersonalRecommendations);
  const recompute = useServerFn(recomputeStyleProfile);
  const { data: recommendations = [] } = useQuery({
    queryKey: ["resource-recommendations"],
    queryFn: () => recs({ data: { limit: 6 } }),
  });
  const recomputeMut = useMutation({
    mutationFn: () => recompute(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resource-recommendations"] });
      qc.invalidateQueries({ queryKey: ["teacher-style-profile"] });
      toast.success("הסגנון האישי עודכן");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (r: ResourceRow) => del({ data: { id: r.id, file_path: r.file_path } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teaching-resources"] });
      toast.success("נמחק");
      setEditing(null);
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Library className="h-3.5 w-3.5" /> ספרייה
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">חומרי הוראה ועזרים</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            מאגר אישי של דפי עבודה, חידות, סיפורים, מערכי שיעור ועזרים — עם יצירת תוכן ב-AI
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/classes">
              חזרה לכיתות <ArrowRight className="ms-1 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCollOpen(true)}>
            <FolderPlus className="ms-1 h-4 w-4" /> אוספים ({collections.length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing({})}>
            <Plus className="ms-1 h-4 w-4" /> חדש
          </Button>
          <Button size="sm" onClick={() => setAiOpen(true)}>
            <Sparkles className="ms-1 h-4 w-4" /> צור עם AI
          </Button>
        </div>
      </div>

      {/* מצב תצוגה: חומרים / שאל AI */}
      <div className="flex gap-2" role="tablist" aria-label="מצב תצוגה בספרייה">
        <button
          type="button"
          role="tab"
          aria-selected={view === "items"}
          onClick={() => setView("items")}
          className={`rounded-full border px-4 py-1.5 text-sm transition ${view === "items" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
        >
          <Library className="ms-1 inline h-4 w-4" /> החומרים שלי
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "ask"}
          onClick={() => setView("ask")}
          className={`rounded-full border px-4 py-1.5 text-sm transition ${view === "ask" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
        >
          <MessageCircleQuestion className="ms-1 inline h-4 w-4" /> שאל AI על הספרייה
        </button>
      </div>

      {view === "ask" && <AskLibraryPanel />}

      {view === "items" && (
      <>
      {/* קטגוריות ראשיות */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="קטגוריות ספרייה">
        {LIBRARY_CATEGORIES.map((c) => {
          const on = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* נושאים טעונים מראש */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          aria-pressed={!filters.subject}
          onClick={() => patch({ subject: "" })}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${!filters.subject ? "border-amber bg-amber/15 font-medium" : "hover:bg-accent"}`}
        >
          כל הנושאים
        </button>
        {KODESH_SUBJECTS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filters.subject === s}
            onClick={() => patch({ subject: filters.subject === s ? "" : s })}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${filters.subject === s ? "border-amber bg-amber/15 font-medium" : "hover:bg-accent"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {filters.collectionIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">אוספים מסוננים:</span>
          {collections
            .filter((c) => filters.collectionIds.includes(c.id))
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 hover:bg-accent"
                onClick={() => patch({ collectionIds: filters.collectionIds.filter((id) => id !== c.id) })}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.name} <X className="h-3 w-3" />
              </button>
            ))}
        </div>
      )}

      {/* Compact, collapsible top section — keeps the materials list high on mobile */}
      <div className="rounded-xl border bg-card">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
          onClick={() => setTopOpen((v) => !v)}
          aria-expanded={topOpen}
        >
          <span className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-amber" /> קצב ההפקה שלך והמלצות
          </span>
          {topOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {topOpen && (
          <div className="space-y-3 border-t p-3">
            <WeeklyPaceCard />
            {recommendations.length > 0 && (
        <Card className="border-amber/40 bg-amber/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-amber" /> מומלץ עבורך
              <span className="text-xs font-normal text-muted-foreground">לפי הסגנון והעדפות שלך</span>
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => recomputeMut.mutate()} disabled={recomputeMut.isPending}>
              {recomputeMut.isPending ? <Loader2 className="ms-1 h-3 w-3 animate-spin" /> : null}
              רענן המלצות
            </Button>
          </CardHeader>
          <CardContent className="flex gap-2 overflow-x-auto pb-2">
            {recommendations.map((r) => (
              <Link key={r.id} to="/resources/$resourceId" params={{ resourceId: r.id }}
                className="min-w-[200px] max-w-[240px] rounded-lg border bg-card p-3 text-right transition hover:border-amber/50 hover:shadow">
                <div className="line-clamp-2 text-sm font-semibold">{r.title}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    {RESOURCE_TYPE_LABELS[r.resource_type as ResourceType] ?? r.resource_type}
                  </Badge>
                  {r.subject && <Badge variant="secondary" className="text-[10px]">{r.subject}</Badge>}
                </div>
                {r.description && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{r.description}</p>}
              </Link>
            ))}
          </CardContent>
        </Card>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Filters */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">סינון</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">חיפוש</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input className="pe-7" placeholder="כותרת או תיאור…"
                  value={filters.search}
                  onChange={(e) => patch({ search: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">סוג</Label>
              <Select value={filters.resource_type || "all"}
                onValueChange={(v) => patch({ resource_type: v === "all" ? "" : (v as ResourceType) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  {RESOURCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">מקצוע</Label>
              <Select value={filters.subject || "all"}
                onValueChange={(v) => patch({ subject: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  {KODESH_SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">כיתה</Label>
              <Select value={filters.grade_level || "all"}
                onValueChange={(v) => patch({ grade_level: v === "all" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  {GRADE_LEVELS.map((g) => (
                    <SelectItem key={g} value={g}>כיתה {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">תגית</Label>
              <Input placeholder="פרשת ויצא…" value={filters.tag}
                onChange={(e) => patch({ tag: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">רמת קושי</Label>
              <Select value={filters.difficulty || "all"}
                onValueChange={(v) => patch({ difficulty: v === "all" ? "" : (v as Difficulty) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">הכל</SelectItem>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>{DIFFICULTY_LABELS[d]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              aria-pressed={filters.favoritesOnly}
              onClick={() => patch({ favoritesOnly: !filters.favoritesOnly })}
              className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition ${filters.favoritesOnly ? "border-amber bg-amber/15 font-medium" : "hover:bg-accent"}`}
            >
              <Star className={`h-4 w-4 ${filters.favoritesOnly ? "fill-amber text-amber" : "text-muted-foreground"}`} />
              מועדפים בלבד
            </button>
            {collections.length > 0 && (
              <div>
                <Label className="text-xs">אוספים</Label>
                <div className="mt-1 space-y-1">
                  {collections.map((c) => {
                    const on = filters.collectionIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-right text-sm hover:bg-accent ${on ? "bg-accent font-medium" : ""}`}
                        onClick={() =>
                          patch({
                            collectionIds: on
                              ? filters.collectionIds.filter((id) => id !== c.id)
                              : [...filters.collectionIds, c.id],
                          })
                        }
                      >
                        <span className="h-3 w-3 rounded" style={{ background: c.color }} />
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full"
              onClick={() => setFilters(emptyFilters)}>
              <X className="ms-1 h-3 w-3" /> נקה סינון
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-start-1">
          <CardContent className="pt-4">
            <TopicTreeFilter value={filters.topicIds} onChange={(ids) => patch({ topicIds: ids })} />
          </CardContent>
        </Card>

        {/* Grid */}
        <div className="space-y-3 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          {isLoading && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" /> טוען חומרים…
            </CardContent></Card>
          )}
          {!isLoading && visibleResources.length === 0 && (
            <Card><CardContent className="py-16 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <div className="text-muted-foreground">אין עדיין חומרים — צור את הראשון עם AI ✨</div>
              <Button className="mt-4" onClick={() => setAiOpen(true)}>
                <Sparkles className="ms-1 h-4 w-4" /> צור עם AI
              </Button>
            </CardContent></Card>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleResources.map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                onView={() => setViewing(r)}
                onEdit={() => setEditing(r)}
                onVariant={(src) => { setAiSource(src); setAiOpen(true); }}
                onToggleFavorite={() => favMut.mutate({ id: r.id, is_favorite: !r.is_favorite })}
              />
            ))}
          </div>
        </div>
      </div>
      </>
      )}

      {/* Document viewer */}
      {viewing && (
        <ResourceViewerDialog
          resource={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
        />
      )}

      {/* Editor / viewer */}
      {editing && (
        <ResourceEditorDialog
          open
          initial={editing}
          onClose={() => setEditing(null)}
          onDelete={(r) => { if (confirm("למחוק את החומר?")) deleteMut.mutate(r); }}
        />
      )}

      {/* AI generator */}
      <AIGeneratorDialog
        open={aiOpen}
        source={aiSource}
        onClose={() => { setAiOpen(false); setAiSource(null); }}
        onGenerated={(draft) => { setAiOpen(false); setAiSource(null); setEditing(draft); }}
      />

      {/* Collections manager */}
      <CollectionsDialog
        open={collOpen}
        onClose={() => setCollOpen(false)}
        selectedIds={filters.collectionIds}
        onToggleSelected={(id) =>
          patch({
            collectionIds: filters.collectionIds.includes(id)
              ? filters.collectionIds.filter((x) => x !== id)
              : [...filters.collectionIds, id],
          })
        }
      />
    </div>
  );
}

/* -------------------- card -------------------- */

function ResourceCard({
  resource, onView, onEdit, onVariant, onToggleFavorite,
}: {
  resource: ResourceRow;
  onView: () => void;
  onEdit: () => void;
  onVariant: (r: ResourceRow) => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="group rounded-xl border bg-card p-4 text-right transition hover:border-amber/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="line-clamp-2 font-semibold">{resource.title}</div>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={resource.is_favorite}
          aria-label={resource.is_favorite ? `הסר את "${resource.title}" מהמועדפים` : `הוסף את "${resource.title}" למועדפים`}
          className="shrink-0 rounded-md p-1 transition hover:bg-accent"
        >
          <Star className={`h-4 w-4 ${resource.is_favorite ? "fill-amber text-amber" : "text-muted-foreground"}`} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="outline" className="text-[10px]">
          {RESOURCE_TYPE_LABELS[resource.resource_type] ?? resource.resource_type}
        </Badge>
        {resource.difficulty && (
          <Badge variant="outline" className={`text-[10px] ${DIFFICULTY_BADGE[resource.difficulty]}`}>
            {DIFFICULTY_LABELS[resource.difficulty]}
          </Badge>
        )}
        {resource.ai_generated && (
          <Badge variant="outline" className="gap-0.5 border-amber/40 bg-amber/10 text-[10px] text-amber-700 dark:text-amber-300">
            <Sparkles className="h-2.5 w-2.5" /> נוצר ב-AI
          </Badge>
        )}
        {resource.subject && <Badge variant="secondary" className="text-[10px]">{resource.subject}</Badge>}
        {resource.grade_level && <Badge variant="secondary" className="text-[10px]">כיתה {resource.grade_level}</Badge>}
      </div>
      {resource.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{resource.description}</p>
      )}
      {resource.tags?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {resource.tags.slice(0, 4).map((t) => (
            <span key={t} className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <Tag className="h-2.5 w-2.5" /> {t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onView} aria-label={`פתח את "${resource.title}"`}>
          <Eye className="ms-1 h-4 w-4" /> פתח
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`ערוך את "${resource.title}"`}>
          <Pencil className="ms-1 h-4 w-4" /> ערוך
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onVariant(resource)}
          title="צור וריאציה עם AI מפריט זה" aria-label={`צור וריאציה עם AI מ-"${resource.title}"`}>
          <Sparkles className="h-4 w-4 text-amber" />
        </Button>
      </div>
    </div>
  );
}

/* -------------------- שאל AI על הספרייה -------------------- */

function AskLibraryPanel() {
  const ask = useServerFn(askLibrary);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<{ id: string; title: string }[]>([]);

  const askMut = useMutation({
    mutationFn: (q: string) => ask({ data: { question: q } }),
    onSuccess: (res) => {
      setAnswer(res.answer);
      setSources(res.sources ?? []);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "השאילתה נכשלה"),
  });

  const submit = () => {
    const q = question.trim();
    if (q.length < 3) { toast.error("כתוב שאלה מפורטת יותר"); return; }
    askMut.mutate(q);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageCircleQuestion className="h-4 w-4 text-amber" /> שאל AI על הספרייה שלך
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          ה-AI מחפש בין החומרים שלך ומשיב על בסיסם — למשל: "אילו חידות יש לי על פרשת ויצא?"
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="מה תרצה לדעת על החומרים שלך?"
            aria-label="שאלה על הספרייה"
          />
          <Button onClick={submit} disabled={askMut.isPending}>
            {askMut.isPending
              ? <><Loader2 className="ms-1 h-4 w-4 animate-spin" /> חושב…</>
              : <><Send className="ms-1 h-4 w-4" /> שאל</>}
          </Button>
        </div>
        <div aria-live="polite">
          {answer && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="whitespace-pre-wrap text-sm">{answer}</div>
              {sources.length > 0 && (
                <div className="mt-3 border-t pt-2">
                  <div className="mb-1 text-xs text-muted-foreground">מבוסס על:</div>
                  <div className="flex flex-wrap gap-2">
                    {sources.map((s) => (
                      <Link key={s.id} to="/resources/$resourceId" params={{ resourceId: s.id }}
                        className="rounded-full border px-2 py-0.5 text-xs hover:bg-accent">
                        {s.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------- viewer -------------------- */

function resourceToHtml(r: ResourceRow) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const c = r.content ?? {};
  const parts: string[] = [`<h1>${esc(r.title)}</h1>`];
  if (r.description) parts.push(`<p>${esc(r.description)}</p>`);
  if (c.body) parts.push(`<div style="white-space:pre-wrap">${esc(c.body)}</div>`);
  if (c.materials?.length) parts.push(`<h2>חומרים נדרשים</h2><ul>${c.materials.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`);
  if (c.steps?.length) parts.push(`<h2>מהלך הפעילות</h2><ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`);
  if (c.questions?.length)
    parts.push(`<h2>שאלות</h2><ol>${c.questions
      .map((q) => `<li>${esc(q.q)}${q.a ? `<div><em>תשובה: ${esc(q.a)}</em></div>` : ""}</li>`)
      .join("")}</ol>`);
  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${esc(r.title)}</title>
<style>body{font-family:'Heebo',system-ui,sans-serif;margin:2rem;line-height:1.7}h1{font-size:1.6rem}h2{font-size:1.1rem;margin-top:1.2rem}</style>
</head><body>${parts.join("\n")}</body></html>`;
}

function ResourceViewerDialog({
  resource, onClose, onEdit,
}: {
  resource: ResourceRow;
  onClose: () => void;
  onEdit: () => void;
}) {
  const c = resource.content ?? {};

  const printDoc = () => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { toast.error("החלון נחסם על ידי הדפדפן"); return; }
    w.document.write(resourceToHtml(resource));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const download = () => {
    const blob = new Blob([resourceToHtml(resource)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resource.title.replace(/[\\/:*?"<>|]/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const empty = !c.body && !c.questions?.length && !c.steps?.length && !c.materials?.length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-right">{resource.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-right" dir="rtl">
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{RESOURCE_TYPE_LABELS[resource.resource_type] ?? resource.resource_type}</Badge>
            {resource.subject && <Badge variant="secondary">{resource.subject}</Badge>}
            {resource.grade_level && <Badge variant="secondary">כיתה {resource.grade_level}</Badge>}
          </div>
          {resource.description && <p className="text-sm text-muted-foreground">{resource.description}</p>}
          {c.body && (
            <div className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm leading-relaxed">{c.body}</div>
          )}
          {c.materials && c.materials.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold">חומרים נדרשים</h3>
              <ul className="list-disc pe-5 text-sm">{c.materials.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </div>
          )}
          {c.steps && c.steps.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold">מהלך הפעילות</h3>
              <ol className="list-decimal pe-5 space-y-1 text-sm">{c.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
          )}
          {c.questions && c.questions.length > 0 && (
            <div>
              <h3 className="mb-1 font-semibold">שאלות</h3>
              <ol className="list-decimal pe-5 space-y-2 text-sm">
                {c.questions.map((q, i) => (
                  <li key={i}>
                    <div className="font-medium">{q.q}</div>
                    {q.a && <div className="mt-0.5 rounded bg-muted/40 p-1.5 text-muted-foreground">תשובה: {q.a}</div>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {empty && <p className="text-sm text-muted-foreground">אין תוכן שמור לחומר זה — לחץ "ערוך" כדי להוסיף.</p>}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" asChild className="me-auto">
            <Link to="/resources/$resourceId" params={{ resourceId: resource.id }}>לעמוד המלא</Link>
          </Button>
          <Button variant="outline" onClick={printDoc}><Printer className="ms-1 h-4 w-4" /> הדפס</Button>
          <Button variant="outline" onClick={download}><Download className="ms-1 h-4 w-4" /> הורד</Button>
          <Button onClick={onEdit}>ערוך</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- editor -------------------- */

function ResourceEditorDialog({
  open, initial, onClose, onDelete,
}: {
  open: boolean;
  initial: Partial<ResourceRow>;
  onClose: () => void;
  onDelete: (r: ResourceRow) => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(upsertResource);

  const [title, setTitle] = useState(initial.title ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [subject, setSubject] = useState(initial.subject ?? "");
  const [gradeLevel, setGradeLevel] = useState(initial.grade_level ?? "");
  const [resourceType, setResourceType] = useState<ResourceType>(initial.resource_type ?? "worksheet");
  const [tagsText, setTagsText] = useState((initial.tags ?? []).join(", "));
  const [content, setContent] = useState<ResourceContent>(initial.content ?? {});

  const saveMut = useMutation({
    mutationFn: () => save({
      data: {
        id: initial.id, title: title.trim(), description, subject, grade_level: gradeLevel,
        resource_type: resourceType,
        tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        content,
        ai_generated: initial.ai_generated ?? false,
        source_prompt: initial.source_prompt ?? "",
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teaching-resources"] });
      toast.success("נשמר");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  function updateQ(i: number, patch: Partial<{ q: string; a: string }>) {
    const arr = [...(content.questions ?? [])];
    arr[i] = { ...arr[i], ...patch };
    setContent({ ...content, questions: arr });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{initial.id ? "עריכת חומר" : "חומר חדש"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>כותרת</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: דף עבודה — פרשת ויצא" />
          </div>
          <div>
            <Label>תיאור</Label>
            <Textarea value={description} rows={2} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>סוג</Label>
              <Select value={resourceType} onValueChange={(v) => setResourceType(v as ResourceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>מקצוע</Label>
              <Select value={subject || "none"} onValueChange={(v) => setSubject(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {KODESH_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>כיתה</Label>
              <Select value={gradeLevel || "none"} onValueChange={(v) => setGradeLevel(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>כיתה {g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>תגיות (מופרדות בפסיק)</Label>
            <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="פרשת ויצא, יעקב, סולם" />
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <div className="text-sm font-semibold">תוכן</div>
            <div>
              <Label className="text-xs">טקסט / הוראות / סיפור</Label>
              <Textarea rows={5} value={content.body ?? ""}
                onChange={(e) => setContent({ ...content, body: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">שאלות (לדפי עבודה / חידות)</Label>
              <div className="space-y-2">
                {(content.questions ?? []).map((q, i) => (
                  <div key={i} className="rounded border bg-card p-2">
                    <Input className="!font-medium border-0 px-0 focus-visible:ring-0"
                      placeholder="שאלה…" value={q.q}
                      onChange={(e) => updateQ(i, { q: e.target.value })} />
                    <Input className="!text-sm !text-muted-foreground border-0 px-0 focus-visible:ring-0"
                      placeholder="תשובה…" value={q.a ?? ""}
                      onChange={(e) => updateQ(i, { a: e.target.value })} />
                  </div>
                ))}
                <Button variant="outline" size="sm"
                  onClick={() => setContent({ ...content, questions: [...(content.questions ?? []), { q: "", a: "" }] })}>
                  <Plus className="ms-1 h-3 w-3" /> הוסף שאלה
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">שלבים (שורה לכל שלב)</Label>
                <Textarea rows={4} value={(content.steps ?? []).join("\n")}
                  onChange={(e) => setContent({ ...content, steps: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
              </div>
              <div>
                <Label className="text-xs">חומרים נדרשים (שורה לכל פריט)</Label>
                <Textarea rows={4} value={(content.materials ?? []).join("\n")}
                  onChange={(e) => setContent({ ...content, materials: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {initial.id && (
            <Button variant="ghost" className="text-destructive me-auto"
              onClick={() => onDelete(initial as ResourceRow)}>
              <Trash2 className="ms-1 h-4 w-4" /> מחק
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="ms-1 h-4 w-4" /> הדפס
          </Button>
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
          <Button onClick={() => saveMut.mutate()} disabled={!title.trim() || saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Save className="ms-1 h-4 w-4" />}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- AI dialog -------------------- */

function AIGeneratorDialog({
  open, onClose, onGenerated, source,
}: {
  open: boolean; onClose: () => void;
  onGenerated: (draft: Partial<ResourceRow>) => void;
  source?: ResourceRow | null;
}) {
  const gen = useServerFn(generateResourceWithAI);
  const [prompt, setPrompt] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("worksheet");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");

  // Prefill from source resource when opening as a "variant"
  useEffect(() => {
    if (open && source) {
      setResourceType(source.resource_type);
      setSubject(source.subject || "");
      setGradeLevel(source.grade_level || "");
      setPrompt(`צור וריאציה של "${source.title}" — שנה נוסח, הוסף שאלות דומות ושמור על אותו סגנון ורמה.`);
    } else if (open && !source) {
      // fresh open (not variant) — leave user input
    }
  }, [open, source]);

  const m = useMutation({
    mutationFn: () => gen({ data: {
      prompt: prompt.trim(),
      resource_type: resourceType,
      subject,
      grade_level: gradeLevel,
      ...(source ? { source_resource_id: source.id } : {}),
    } }),
    onSuccess: (draft) => {
      onGenerated({
        title: draft.title,
        description: draft.description,
        tags: draft.tags,
        content: draft.content,
        resource_type: resourceType,
        subject, grade_level: gradeLevel,
        ai_generated: true,
        source_prompt: prompt,
      });
      setPrompt("");
      toast.success("נוצר! ערוך לפי הצורך ולחץ שמור");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber" />
            {source ? `וריאציה מ־"${source.title}"` : "יצירת חומר עם AI"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">סוג חומר</Label>
              <Select value={resourceType} onValueChange={(v) => setResourceType(v as ResourceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">מקצוע</Label>
              <Select value={subject || "none"} onValueChange={(v) => setSubject(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {KODESH_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">כיתה</Label>
              <Select value={gradeLevel || "none"} onValueChange={(v) => setGradeLevel(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>כיתה {g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>תאר את החומר הרצוי</Label>
            <Textarea
              rows={4}
              placeholder='למשל: "דף עבודה על פרשת ויצא לכיתה ג, עם 5 שאלות הבנה ועוד שאלת חידה אחת"'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
          <Button disabled={prompt.trim().length < 5 || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Sparkles className="ms-1 h-4 w-4" />}
            צור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- collections dialog -------------------- */

function CollectionsDialog({
  open, onClose, selectedIds, onToggleSelected,
}: {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  onToggleSelected: (id: string) => void;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listCollections);
  const save = useServerFn(upsertCollection);
  const del = useServerFn(deleteCollection);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#f59e0b");

  const { data: collections = [] } = useQuery({
    queryKey: ["resource-collections"], queryFn: () => list(), enabled: open,
  });

  const create = useMutation({
    mutationFn: () => save({ data: { name: name.trim(), color, description: "" } }),
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["resource-collections"] }); toast.success("נוסף"); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resource-collections"] }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader><DialogTitle>אוספים</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">בחר אוספים כדי לסנן את רשימת החומרים.</p>
          <div className="flex gap-2">
            <Input autoFocus={false} value={name} onChange={(e) => setName(e.target.value)} placeholder="שם האוסף…" />
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 p-1" />
            <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>הוסף</Button>
          </div>
          {collections.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              עדיין אין אוספים. צור אוסף כדי לארגן חומרים נושאיים (לדוגמה: "חומרים לחודש אלול")
            </div>
          )}
          {collections.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 rounded-lg border p-2 ${selectedIds.includes(c.id) ? "border-amber bg-amber/10" : ""}`}
            >
              <div className="h-6 w-6 rounded" style={{ background: c.color }} />
              <button
                type="button"
                className="flex-1 text-right font-medium"
                aria-pressed={selectedIds.includes(c.id)}
                onClick={() => onToggleSelected(c.id)}
              >
                {c.name}
                {selectedIds.includes(c.id) && <span className="ms-2 text-xs text-amber">מסונן</span>}
              </button>
              <Button variant="ghost" size="icon" className="text-destructive" aria-label={`מחק את ${c.name}`}
                onClick={() => remove.mutate(c.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>סגור</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Suppress unused FileText import warning
void FileText;