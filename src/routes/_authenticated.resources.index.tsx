import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, Loader2, Save, Trash2, Printer, Plus, Search,
  BookOpen, FileText, FolderPlus, X, ArrowRight, Tag, Library,
  ChevronDown, ChevronUp, Download, Eye, ListChecks,
  Star, Pencil, MessageCircleQuestion, Send, ScanText, ArrowUpDown,
  ChevronRight, ChevronLeft,
} from "lucide-react";
import { Rows3, LayoutGrid, Image as ImageIcon } from "lucide-react";
import { UploadCloud, FileArchive } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { KODESH_SUBJECTS } from "@/lib/kodesh-subjects";
import {
  listResources, upsertResource, deleteResource, generateResourceWithAI,
  listCollections, upsertCollection, deleteCollection, toggleCollectionItem,
  listCollectionItems, toggleResourceFavorite, askLibrary,
  getResourceSignedUrl,
  RESOURCE_TYPES, RESOURCE_TYPE_LABELS,
  DIFFICULTIES, DIFFICULTY_LABELS,
  type ResourceRow, type ResourceContent, type ResourceType,
  type Difficulty,
} from "@/lib/teaching-resources.functions";
import { getPersonalRecommendations, recomputeStyleProfile } from "@/lib/teacher-style.functions";
import { analyzeExistingResource, getResourceUsageCounts } from "@/lib/resource-understanding.functions";
import { getResourceDownloadLinks } from "@/lib/library-extras.functions";
import { downloadResourcesZip } from "@/lib/zip-download";
import { LibraryBulkUpload } from "@/components/library-bulk-upload";
import { GoogleDrivePanel } from "@/components/drive/google-drive-panel";
import { ResourceThumb } from "@/components/resource-thumb";
import { Wand2 } from "lucide-react";
import { WeeklyPaceCard } from "@/components/weekly-pace-card";
import { TopicTreeFilter } from "@/components/topic-tree-filter";
import { useTablistKeys } from "@/hooks/use-tablist-keys";
import { SummaryGenerator } from "@/components/summary-generator";
import { TaskGenerator } from "@/components/task-generator";

const VIEW_TABS = ["items", "ask"] as const;

const SORT_OPTIONS = [
  { id: "updated_desc", label: "עודכן לאחרונה" },
  { id: "updated_asc", label: "עודכן — הישן קודם" },
  { id: "created_desc", label: "הועלה לאחרונה" },
  { id: "created_asc", label: "הועלה — הישן קודם" },
  { id: "popularity", label: "פופולריות (שימוש בכיתות)" },
  { id: "title", label: "לפי כותרת (א-ת)" },
] as const;
type SortId = (typeof SORT_OPTIONS)[number]["id"];
const PAGE_SIZES = [12, 24, 48, 96] as const;

/** אופן תצוגת החומרים: רשימה / טורים / תמונות ממוזערות */
const VIEW_MODES = [
  { id: "list", label: "רשימה", icon: Rows3 },
  { id: "grid", label: "טורים", icon: LayoutGrid },
  { id: "thumbs", label: "תמונות", icon: ImageIcon },
] as const;
type ViewMode = (typeof VIEW_MODES)[number]["id"];
const VIEW_MODE_KEY = "library-view-mode";
const GRID_CLASS: Record<ViewMode, string> = {
  list: "grid gap-2",
  grid: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
  thumbs: "grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4",
};

export const Route = createFileRoute("/_authenticated/resources/")({
  component: ResourcesPage,
  head: () => ({
    meta: [
      { title: "ספריית חומרי הוראה · הכיתה שלי" },
      { name: "description", content: "ספרייה חכמה של דפי עבודה, מבחנים ושאלות לפי מקצועות קודש — ניתן לחפש, לסנן, לערוך ולייצא." },
      { property: "og:title", content: "ספריית חומרי הוראה · הכיתה שלי" },
      { property: "og:description", content: "ספרייה חכמה של דפי עבודה, מבחנים ושאלות לפי מקצועות קודש." },
      { property: "og:url", content: "https://hakitasheli.lovable.app/resources" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const GRADE_LEVELS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"] as const;

/** קטגוריות ראשיות לספרייה — כל קטגוריה מקבצת כמה סוגי עזר */
const LIBRARY_CATEGORIES: { id: string; label: string; types: ResourceType[] }[] = [
  { id: "all", label: "כל החומרים", types: [] },
  { id: "lesson_plan", label: "מערכי שיעור", types: ["lesson_plan"] },
  { id: "worksheet", label: "דפי עבודה", types: ["worksheet"] },
  { id: "exams", label: "מבחנים והכנה", types: ["question_bank", "worksheet"] },
  { id: "activities", label: "פעילויות ומשחקים", types: ["activity", "game", "riddle"] },
  { id: "summaries", label: "סיכומים", types: ["summary"] },
  { id: "stories", label: "סיפורים ושירים", types: ["story", "song"] },
  { id: "visual", label: "עזרים חזותיים", types: ["visual_aid"] },
  { id: "other", label: "אחר", types: ["other"] },
];

const CATEGORY_IDS = LIBRARY_CATEGORIES.map((c) => c.id);

/** סינון מהיר לפי סוג חומר — כדי למצוא גם חומרים ישנים בלחיצה אחת */
const MATERIAL_KINDS: { id: string; label: string; types: ResourceType[] }[] = [
  { id: "all", label: "הכל", types: [] },
  { id: "study", label: "חומרי לימוד", types: ["lesson_plan", "worksheet", "summary", "story", "song", "visual_aid", "activity", "game", "riddle", "other"] },
  { id: "exams", label: "מבחנים", types: ["question_bank", "worksheet"] },
  { id: "prep", label: "הכנה לחזרה", types: ["question_bank", "summary", "riddle"] },
];

/** Single, centralized filter state for the whole library screen. */
type FilterState = {
  search: string;
  resource_type: ResourceType | "";
  subject: string;
  grade_level: string;
  tag: string;
  tags: string[];
  searchInDocumentOnly: boolean;
  difficulty: Difficulty | "";
  favoritesOnly: boolean; hasOriginalOnly: boolean;
  topicIds: string[];
  collectionIds: string[];
};

const emptyFilters: FilterState = {
  search: "", resource_type: "", subject: "", grade_level: "", tag: "", tags: [],
  searchInDocumentOnly: false,
  difficulty: "", favoritesOnly: false, hasOriginalOnly: false,
  topicIds: [], collectionIds: [],
};

const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  easy: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medium: "border-amber/40 bg-amber/10 text-amber-700 dark:text-amber-300",
  hard: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

/** מונע פוקוס אוטומטי בשדה הראשון, אך ממקד את מסגרת הדיאלוג כדי שהמקלדת תמשיך משם באופן עקבי */
function focusDialogShell(e: Event) {
  e.preventDefault();
  const el = e.currentTarget as HTMLElement | null;
  if (el) {
    el.setAttribute("tabindex", "-1");
    el.focus();
  }
}

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
  const [materialKind, setMaterialKind] = useState("all");
  const [view, setView] = useState<"items" | "ask">("items");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<SortId>("updated_desc");
  const [pageSize, setPageSize] = useState(24);
  const [pageIndex, setPageIndex] = useState(0);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;
    if (saved && VIEW_MODES.some((m) => m.id === saved)) setViewMode(saved);
  }, []);

  const changeViewMode = (m: ViewMode) => {
    setViewMode(m);
    localStorage.setItem(VIEW_MODE_KEY, m);
  };

  const bundleFn = useServerFn(getResourceDownloadLinks);
  const zipMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const items = await bundleFn({ data: { ids } });
      return downloadResourcesZip(items);
    },
    onSuccess: (added) => {
      if (added === 0) toast.error("לא נמצאו קבצים או טקסט להורדה בפריטים שנבחרו");
      else toast.success(`נארזו ${added} קבצים לקובץ ZIP`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "ההורדה נכשלה"),
  });

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const viewKeys = useTablistKeys(VIEW_TABS, view, setView);
  const categoryKeys = useTablistKeys(CATEGORY_IDS, category, setCategory);

  const hasActiveFilters =
    category !== "all" ||
    materialKind !== "all" ||
    Boolean(filters.search || filters.resource_type || filters.subject || filters.grade_level || filters.difficulty) ||
    filters.favoritesOnly || filters.hasOriginalOnly ||
    filters.tags.length > 0 ||
    filters.collectionIds.length > 0 ||
    filters.topicIds.length > 0;

  // Server query holds only server-side filters; collection/topic filtering runs
  // client-side on the same dataset so no control overwrites another.
  const serverArgs = {
    search: filters.search || undefined,
    search_in_document_only: filters.searchInDocumentOnly || undefined,
    resource_type: filters.resource_type || undefined,
    subject: filters.subject || undefined,
    grade_level: filters.grade_level || undefined,
    tag: filters.tag || undefined,
    tags: filters.tags.length > 0 ? filters.tags : undefined,
    difficulty: filters.difficulty || undefined,
    favorites_only: filters.favoritesOnly || filters.hasOriginalOnly || undefined,
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

  const usageFn = useServerFn(getResourceUsageCounts);
  const { data: usageCounts = {} } = useQuery({
    queryKey: ["resource-usage-counts"],
    queryFn: () => usageFn(),
  });

  const analyzeFn = useServerFn(analyzeExistingResource);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const analyzeMut = useMutation({
    mutationFn: (v: { id: string; force: boolean }) => analyzeFn({ data: v }),
    onMutate: (v) => setAnalyzingId(v.id),
    onSettled: () => setAnalyzingId(null),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["teaching-resources"] });
      toast.success(
        res.ocr_added
          ? `הטקסט חולץ (${res.ocr_chars.toLocaleString("he-IL")} תווים) והחומר סווג`
          : "החומר נותח וסווג מחדש",
        { description: res.contexts.length > 0 ? `מתאים ל: ${res.contexts.slice(0, 3).join(" · ")}` : undefined },
      );
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "הניתוח נכשל"),
  });

  const visibleResources = useMemo(() => {
    let out = resources;
    const cat = LIBRARY_CATEGORIES.find((c) => c.id === category);
    if (cat && cat.types.length > 0) {
      out = out.filter((r) => cat.types.includes(r.resource_type as ResourceType));
    }
    const kind = MATERIAL_KINDS.find((k) => k.id === materialKind);
    if (kind && kind.types.length > 0) {
      out = out.filter((r) => kind.types.includes(r.resource_type as ResourceType));
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
    const cmp = (a: ResourceRow, b: ResourceRow) => {
      switch (sort) {
        case "updated_asc": return a.updated_at.localeCompare(b.updated_at);
        case "created_desc": return b.created_at.localeCompare(a.created_at);
        case "created_asc": return a.created_at.localeCompare(b.created_at);
        case "popularity": {
          const d = (usageCounts[b.id] ?? 0) - (usageCounts[a.id] ?? 0);
          return d !== 0 ? d : b.updated_at.localeCompare(a.updated_at);
        }
        case "title": return a.title.localeCompare(b.title, "he");
        default: return b.updated_at.localeCompare(a.updated_at);
      }
    };
    // favorites first, then by the chosen sort
    return [...out].sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || cmp(a, b));
  }, [resources, collectionItems, filters.collectionIds, filters.topicIds, category, materialKind, sort, usageCounts]);

  const pageCount = Math.max(1, Math.ceil(visibleResources.length / pageSize));
  const safePage = Math.min(pageIndex, pageCount - 1);
  const pagedResources = useMemo(
    () => visibleResources.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [visibleResources, safePage, pageSize],
  );
  // חוזרים לעמוד הראשון בכל שינוי סינון/מיון
  useEffect(() => {
    setPageIndex(0);
  }, [filters, category, materialKind, sort, pageSize]);

  /** ענן תגיות מתוך החומרים שקיימים בפועל */
  const tagCloud = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of resources) {
      for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
  }, [resources]);

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

  const bulkDeleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const rows = ids
        .map((id) => resources.find((r) => r.id === id))
        .filter((r): r is ResourceRow => Boolean(r));
      let success = 0;
      let failed = 0;
      const errors: string[] = [];
      for (const r of rows) {
        try {
          await del({ data: { id: r.id, file_path: r.file_path } });
          success++;
        } catch (e) {
          failed++;
          const msg = e instanceof Error ? e.message : "שגיאה לא ידועה";
          if (!errors.includes(msg)) errors.push(msg);
        }
      }
      return { success, failed, errors };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["teaching-resources"] });
      setSelectedIds([]);
      if (res.failed === 0) toast.success(`נמחקו ${res.success} חומרים`);
      else if (res.success === 0) toast.error(`המחיקה נכשלה: ${res.failed} חומרים לא נמחקו`, { description: res.errors.join(" · ") });
      else toast(`נמחקו ${res.success} חומרים, ${res.failed} נכשלו`, { description: res.errors.join(" · ") });
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
            כל חומרי הלימוד שלך במקום אחד — מסמכים שהעלית, מבחנים קודמים, חומרי הכנה, דפי עבודה ותוצרים חדשים
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/classes">
              חזרה לכיתות <ArrowRight className="ms-1 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCollOpen(true)}>
            <FolderPlus className="ms-1 h-4 w-4" /> אוספים ({collections.length})
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="ms-1 h-4 w-4" /> הוסף חומר
                <ChevronDown className="ms-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 text-right">
              <DropdownMenuLabel>הוספה לספרייה</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setEditing({})}>
                <FileText className="ms-1 h-4 w-4" /> כתיבה ידנית
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAiOpen(true)}>
                <Sparkles className="ms-1 h-4 w-4 text-amber" /> יצירה עם AI
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/ingest">
                  <Download className="ms-1 h-4 w-4" /> העלאת מסמך או הקלטה
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setBulkUploadOpen(true)}>
                <UploadCloud className="ms-1 h-4 w-4" /> העלאת כמה קבצים יחד (OCR אוטומטי)
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/resources/upload-log">
                  <ListChecks className="ms-1 h-4 w-4" /> יומן העלאות (הצלחות וכשלים)
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>הפקה מחומר קיים</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSummaryOpen(true)}>
                <FileText className="ms-1 h-4 w-4" /> מחולל סיכום
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTasksOpen(true)}>
                <ListChecks className="ms-1 h-4 w-4" /> מחולל משימות
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* מצב תצוגה: חומרים / שאל AI */}
      <div className="flex gap-2" role="tablist" aria-label="מצב תצוגה בספרייה">
        <button
          type="button"
          role="tab"
          aria-selected={view === "items"}
          tabIndex={view === "items" ? 0 : -1}
          onKeyDown={viewKeys}
          onClick={() => setView("items")}
          className={`min-h-9 rounded-full border px-4 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${view === "items" ? "border-primary bg-primary font-semibold text-primary-foreground" : "hover:bg-accent"}`}
        >
          <Library className="ms-1 inline h-4 w-4" /> החומרים שלי
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "ask"}
          tabIndex={view === "ask" ? 0 : -1}
          onKeyDown={viewKeys}
          onClick={() => setView("ask")}
          className={`min-h-9 rounded-full border px-4 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${view === "ask" ? "border-primary bg-primary font-semibold text-primary-foreground" : "hover:bg-accent"}`}
        >
          <MessageCircleQuestion className="ms-1 inline h-4 w-4" /> שאל AI על הספרייה
        </button>
      </div>

      {view === "ask" && <AskLibraryPanel />}

      {view === "items" && (
      <>
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-11 pe-10"
          placeholder="חפש בכל החומרים, המבחנים והמסמכים שהעלית…"
          value={filters.search}
          onChange={(e) => patch({ search: e.target.value })}
          aria-label="חיפוש בכל חומרי הספרייה"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-primary"
          checked={filters.searchInDocumentOnly}
          onChange={(e) => patch({ searchInDocumentOnly: e.target.checked })}
        />
        חפש רק בתוך טקסט המסמכים שהועלו
      </label>
      {/* סינון מהיר לפי סוג חומר */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="סינון לפי סוג חומר">
        {MATERIAL_KINDS.map((k) => {
          const on = materialKind === k.id;
          return (
            <button
              key={k.id}
              type="button"
              aria-pressed={on}
              onClick={() => setMaterialKind(k.id)}
              className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-primary bg-primary/10 font-semibold text-primary" : "hover:bg-accent"}`}
            >
              {k.label}
            </button>
          );
        })}
      </div>
      {tagCloud.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">תגיות:</span>
          {tagCloud.map(([t, n]) => {
            const on = filters.tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => patch({
                  tags: on ? filters.tags.filter((x) => x !== t) : [...filters.tags, t],
                })}
                className={`rounded-full border px-2 py-0.5 text-xs transition ${on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}
              >
                {t} <span className="opacity-60">({n})</span>
              </button>
            );
          })}
          {filters.tags.length > 0 && (
            <button type="button" className="text-xs underline text-muted-foreground" onClick={() => patch({ tags: [] })}>
              נקה תגיות
            </button>
          )}
        </div>
      )}
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
              tabIndex={on ? 0 : -1}
              onKeyDown={categoryKeys}
              onClick={() => setCategory(c.id)}
              className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${on ? "border-primary bg-primary font-semibold text-primary-foreground" : "hover:bg-accent"}`}
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
                aria-label={`הסר את האוסף ${c.name} מהסינון`}
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
        <Card className="h-fit lg:col-start-1">
          <CardHeader className="pb-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-medium"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4" /> סינון מתקדם
                {hasActiveFilters && <Badge variant="secondary" className="text-[10px]">פעיל</Badge>}
              </span>
              {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CardHeader>
          {filtersOpen && (
          <CardContent className="space-y-3">
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
                        aria-label={on ? `הסר את האוסף ${c.name} מהסינון` : `סנן לפי האוסף ${c.name}`}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-right text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "bg-accent font-medium" : ""}`}
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
              onClick={() => { setFilters(emptyFilters); setMaterialKind("all"); }}>
              <X className="ms-1 h-3 w-3" /> נקה סינון
            </Button>
          </CardContent>
          )}
        </Card>

        {filtersOpen && (
          <Card className="lg:col-start-1">
            <CardContent className="pt-4">
              <TopicTreeFilter value={filters.topicIds} onChange={(ids) => patch({ topicIds: ids })} />
            </CardContent>
          </Card>
        )}

        {/* Grid */}
        <div className="space-y-3 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          {/* סרגל אחד: מיון · אופן תצוגה · גודל עמוד · בחירה */}
          {!isLoading && visibleResources.length > 0 && (
            <div className="space-y-2 rounded-xl border bg-card px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Select value={sort} onValueChange={(v) => setSort(v as SortId)}>
                    <SelectTrigger id="library-sort" aria-label="מיון" className="h-8 w-[180px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1 rounded-lg border p-0.5" role="group" aria-label="אופן תצוגה">
                  {VIEW_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={viewMode === m.id}
                      title={m.label}
                      onClick={() => changeViewMode(m.id)}
                      className={`flex min-h-8 items-center gap-1 rounded-md px-2 text-xs transition ${viewMode === m.id ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
                    >
                      <m.icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">{m.label}</span>
                    </button>
                  ))}
                </div>

                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger id="library-page-size" aria-label="פריטים לעמוד" className="h-8 w-[92px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZES.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} לעמוד</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="ms-auto text-xs text-muted-foreground" aria-live="polite">
                  {visibleResources.length.toLocaleString("he-IL")} חומרים · עמוד {safePage + 1} מתוך {pageCount}
                </span>

                <Button
                  size="sm" variant="ghost" className="text-xs"
                  onClick={() => setSelectedIds(
                    pagedResources.every((r) => selectedIds.includes(r.id))
                      ? selectedIds.filter((id) => !pagedResources.some((r) => r.id === id))
                      : [...new Set([...selectedIds, ...pagedResources.map((r) => r.id)])],
                  )}
                >
                  {pagedResources.every((r) => selectedIds.includes(r.id)) ? "בטל בחירת העמוד" : "בחר את כל העמוד"}
                </Button>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
                  <span className="text-muted-foreground">נבחרו {selectedIds.length} חומרים</span>
                  <div className="ms-auto flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                      <X className="ms-1 h-4 w-4" /> נקה בחירה
                    </Button>
                    <Button
                      size="sm"
                      disabled={zipMut.isPending}
                      onClick={() => zipMut.mutate(selectedIds.slice(0, 60))}
                    >
                      {zipMut.isPending
                        ? <Loader2 className="ms-1 h-4 w-4 animate-spin" />
                        : <FileArchive className="ms-1 h-4 w-4" />}
                      הורדה מרוכזת (ZIP)
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive" disabled={bulkDeleteMut.isPending}>
                          {bulkDeleteMut.isPending
                            ? <Loader2 className="ms-1 h-4 w-4 animate-spin" />
                            : <Trash2 className="ms-1 h-4 w-4" />}
                          מחק את הנבחרים
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>למחוק את החומרים הנבחרים?</AlertDialogTitle>
                          <AlertDialogDescription>פעולה זו תמחק לצמיתות {selectedIds.length} חומרים מהספרייה.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>ביטול</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => bulkDeleteMut.mutate(selectedIds)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            מחק
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
            </div>
          )}
          {isLoading && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" /> טוען חומרים…
            </CardContent></Card>
          )}
          {!isLoading && visibleResources.length === 0 && (
            <Card><CardContent className="py-16 text-center" aria-live="polite">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <div className="text-muted-foreground">
                {hasActiveFilters ? "לא נמצאו חומרים מתאימים. נסה לנקות את הסינון." : "עדיין אין חומרים בספרייה"}
              </div>
              {hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={() => { setFilters(emptyFilters); setCategory("all"); setMaterialKind("all"); }}>
                  <X className="ms-1 h-4 w-4" /> נקה סינון
                </Button>
              )}
              {!hasActiveFilters && (
              <Button className="mt-4" asChild>
                <Link to="/ingest"><Download className="ms-1 h-4 w-4" /> העלה חומר ראשון</Link>
              </Button>
              )}
            </CardContent></Card>
          )}
          <div className={GRID_CLASS[viewMode]}>
            {pagedResources.map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                variant={viewMode}
                usageCount={usageCounts[r.id] ?? 0}
                analyzing={analyzingId === r.id}
                selected={selectedIds.includes(r.id)}
                onToggleSelected={() => toggleSelected(r.id)}
                onAnalyze={() => analyzeMut.mutate({ id: r.id, force: false })}
                onView={() => setViewing(r)}
                onEdit={() => setEditing(r)}
                onVariant={(src) => { setAiSource(src); setAiOpen(true); }}
                onToggleFavorite={() => favMut.mutate({ id: r.id, is_favorite: !r.is_favorite })}
                onDelete={(r) => deleteMut.mutate(r)}
              />
            ))}
          </div>
          {pageCount > 1 && (
            <nav className="flex items-center justify-center gap-2 pt-1" aria-label="דפדוף בין עמודי הספרייה">
              <Button
                size="sm" variant="outline" disabled={safePage === 0}
                onClick={() => setPageIndex(safePage - 1)}
              >
                <ChevronRight className="h-4 w-4" /> הקודם
              </Button>
              <div className="flex flex-wrap items-center gap-1">
                {Array.from({ length: pageCount }, (_, i) => i)
                  .filter((i) => i === 0 || i === pageCount - 1 || Math.abs(i - safePage) <= 1)
                  .map((i, idx, arr) => (
                    <span key={i} className="flex items-center gap-1">
                      {idx > 0 && arr[idx - 1] !== i - 1 && <span className="px-1 text-xs text-muted-foreground">…</span>}
                      <button
                        type="button"
                        aria-current={i === safePage ? "page" : undefined}
                        aria-label={`עמוד ${i + 1}`}
                        onClick={() => setPageIndex(i)}
                        className={`min-h-8 min-w-8 rounded-md border px-2 text-xs transition ${i === safePage ? "border-primary bg-primary font-semibold text-primary-foreground" : "hover:bg-accent"}`}
                      >
                        {i + 1}
                      </button>
                    </span>
                  ))}
              </div>
              <Button
                size="sm" variant="outline" disabled={safePage >= pageCount - 1}
                onClick={() => setPageIndex(safePage + 1)}
              >
                הבא <ChevronLeft className="h-4 w-4" />
              </Button>
            </nav>
          )}
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

      <LibraryBulkUpload open={bulkUploadOpen} onClose={() => setBulkUploadOpen(false)} />

      {/* מחולל סיכום מותאם */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          dir="rtl"
          onOpenAutoFocus={focusDialogShell}
        >
          <DialogHeader>
            <DialogTitle className="text-right">מחולל סיכום מותאם</DialogTitle>
          </DialogHeader>
          <SummaryGenerator />
        </DialogContent>
      </Dialog>

      {/* מחולל משימות */}
      <Dialog open={tasksOpen} onOpenChange={setTasksOpen}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          dir="rtl"
          onOpenAutoFocus={focusDialogShell}
        >
          <DialogHeader>
            <DialogTitle className="text-right">מחולל משימות</DialogTitle>
          </DialogHeader>
          <TaskGenerator />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- card -------------------- */

function ResourceCard({
  resource, onView, onEdit, onVariant, onToggleFavorite, onDelete,
  usageCount = 0, analyzing = false, onAnalyze, selected = false, onToggleSelected,
  variant = "grid",
}: {
  resource: ResourceRow;
  onView: () => void;
  onEdit: () => void;
  onVariant: (r: ResourceRow) => void;
  onToggleFavorite: () => void;
  onDelete?: (r: ResourceRow) => void;
  usageCount?: number;
  analyzing?: boolean;
  onAnalyze?: () => void;
  selected?: boolean;
  onToggleSelected?: () => void;
  variant?: ViewMode;
}) {
  const hasText = Boolean(resource.content?.original_text?.trim());
  const compact = variant === "list";
  const thumbs = variant === "thumbs";
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`פתח את "${resource.title}"`}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onView(); }
      }}
      className={`group cursor-pointer rounded-xl border bg-card text-right transition hover:border-amber/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${compact ? "px-3 py-2" : "p-4"} ${selected ? "border-amber ring-1 ring-amber/40" : ""}`}
    >
      {thumbs && (
        <ResourceThumb
          filePath={resource.file_path}
          mimeType={resource.mime_type}
          title={resource.title}
          className="mb-2"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {onToggleSelected && (
            <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelected()}
                aria-label={`בחר את "${resource.title}" להורדה מרוכזת`}
              />
            </span>
          )}
          <div className={`font-semibold ${compact ? "line-clamp-1 text-sm" : "line-clamp-2"}`}>{resource.title}</div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          aria-pressed={resource.is_favorite}
          aria-label={resource.is_favorite ? `הסר את "${resource.title}" מהמועדפים` : `הוסף את "${resource.title}" למועדפים`}
          className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star className={`h-4 w-4 ${resource.is_favorite ? "fill-amber text-amber" : "text-muted-foreground"}`} />
        </button>
      </div>
      <div className={`mt-2 flex flex-wrap gap-1 ${compact ? "text-[10px]" : ""}`}>
        <Badge variant="outline" className="text-[10px]">
          {RESOURCE_TYPE_LABELS[resource.resource_type] ?? resource.resource_type}
        </Badge>
        {!compact && resource.difficulty && (
          <Badge variant="outline" className={`text-[10px] ${DIFFICULTY_BADGE[resource.difficulty]}`}>
            {DIFFICULTY_LABELS[resource.difficulty]}
          </Badge>
        )}
        {!compact && resource.ai_generated && (
          <Badge variant="outline" className="gap-0.5 border-amber/40 bg-amber/10 text-[10px] text-amber-700 dark:text-amber-300">
            <Sparkles className="h-2.5 w-2.5" /> נוצר ב-AI
          </Badge>
        )}
        {!compact && resource.content?.source_kind === "upload" && (
          <Badge variant="outline" className="gap-0.5 text-[10px]">
            <Download className="h-2.5 w-2.5" /> הועלה כקובץ
          </Badge>
        )}
        {resource.content?.ai_understanding?.summary && (
          <Badge
            variant="outline"
            className="gap-0.5 border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300"
            title="החומר עבר ניתוח וסיווג אוטומטי עם AI"
          >
            <Sparkles className="h-2.5 w-2.5" /> נותח ב-AI
          </Badge>
        )}
        {resource.subject && <Badge variant="secondary" className="text-[10px]">{resource.subject}</Badge>}
        {resource.grade_level && <Badge variant="secondary" className="text-[10px]">כיתה {resource.grade_level}</Badge>}
        {!compact && usageCount > 0 && (
          <Badge variant="outline" className="text-[10px]">שימוש בכיתות: {usageCount}</Badge>
        )}
        {!compact && !hasText && (
          <Badge variant="outline" className="gap-0.5 border-dashed text-[10px] text-muted-foreground">
            <ScanText className="h-2.5 w-2.5" /> אין טקסט לחיפוש
          </Badge>
        )}
      </div>
      {!compact && !thumbs && resource.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{resource.description}</p>
      )}
      {!compact && !thumbs && resource.tags?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {resource.tags.slice(0, 4).map((t) => (
            <span key={t} className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <Tag className="h-2.5 w-2.5" /> {t}
            </span>
          ))}
        </div>
      )}
      <div className={`flex gap-2 ${compact ? "mt-1" : "mt-3"}`}>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label={`ערוך את "${resource.title}"`}>
          <Pencil className="ms-1 h-4 w-4" /> {compact ? "" : "ערוך"}
        </Button>
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onVariant(resource); }}
          title="צור וריאציה עם AI מפריט זה" aria-label={`צור וריאציה עם AI מ-"${resource.title}"`}>
          <Sparkles className="h-4 w-4 text-amber" />
        </Button>
        {onAnalyze && (
          <Button
            size="sm" variant="ghost" disabled={analyzing}
            onClick={(e) => { e.stopPropagation(); onAnalyze(); }}
            title={hasText ? "נתח מחדש וסווג עם AI" : "הפעל OCR וסיווג אוטומטי"}
            aria-label={`הפעל OCR וניתוח AI על "${resource.title}"`}
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
          </Button>
        )}
        {onDelete && (
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm" variant="ghost"
                className="text-destructive transition-colors hover:bg-destructive/10 motion-reduce:transition-none"
                onClick={(e) => e.stopPropagation()}
                aria-label={`מחק את "${resource.title}"`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle>למחוק את החומר?</AlertDialogTitle>
                <AlertDialogDescription>פעולה זו תמחק לצמיתות את "{resource.title}" מהספרייה.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteOpen(false)}>ביטול</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { onDelete(resource); setDeleteOpen(false); }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  מחק
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
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
  const [excerpts, setExcerpts] = useState<{ resource_id: string; title: string; text: string }[]>([]);

  const askMut = useMutation({
    mutationFn: (q: string) => ask({ data: { question: q } }),
    onSuccess: (res) => {
      setAnswer(res.answer);
      setSources(res.sources ?? []);
      setExcerpts(res.excerpts ?? []);
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
              {excerpts.length > 0 && (
                <div className="mt-3 space-y-2 border-t pt-2">
                  <div className="text-xs text-muted-foreground">ציטוטים מהמסמכים המקוריים שלך:</div>
                  {excerpts.map((ex, i) => (
                    <div key={`${ex.resource_id}-${i}`} className="rounded-md border bg-background p-2">
                      <Link to="/resources/$resourceId" params={{ resourceId: ex.resource_id }}
                        className="text-xs font-medium underline-offset-2 hover:underline">
                        {ex.title}
                      </Link>
                      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                        {ex.text.slice(0, 400)}{ex.text.length > 400 ? "…" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
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
  const hasOriginal = Boolean(c.original_text && c.original_text.trim());
  const [showOriginal, setShowOriginal] = useState(c.source_kind === "upload");
  const signUrl = useServerFn(getResourceSignedUrl);
  const openOriginalFile = async () => {
    if (!resource.file_path) return;
    try {
      const { url } = await signUrl({ data: { file_path: resource.file_path } });
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("לא הצלחנו לפתוח את הקובץ המקורי");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={focusDialogShell}
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
          {c.source_resource_id && (
            <p className="text-xs text-muted-foreground">
              נוצר מתוך:{" "}
              <Link
                to="/resources/$resourceId"
                params={{ resourceId: c.source_resource_id }}
                className="underline hover:text-foreground"
                onClick={onClose}
              >
                חומר המקור בספרייה
              </Link>
            </p>
          )}
          {c.body && !showOriginal && (
            <div className="whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-sm leading-relaxed">{c.body}</div>
          )}
          {hasOriginal && (
            <div className="rounded-lg border">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
                aria-expanded={showOriginal}
                onClick={() => setShowOriginal((v) => !v)}
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                   {showOriginal ? "מציג את המקור המלא כפי שהועלה" : "הצג את המקור המלא כפי שהועלה"}
                  {c.source_kind === "lesson_audio" && (
                    <Badge variant="secondary" className="text-[10px]">תמלול שיעור</Badge>
                  )}
                </span>
                {showOriginal ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showOriginal && (
                <div className="max-h-80 overflow-y-auto whitespace-pre-wrap border-t bg-muted/10 p-3 text-sm leading-relaxed">
                  {c.original_text}
                </div>
              )}
            </div>
          )}
          {resource.file_path && (
            <Button variant="outline" size="sm" onClick={openOriginalFile}>
              <Eye className="ms-1 h-4 w-4" /> פתח את הקובץ המקורי
            </Button>
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
  const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty ?? "medium");
  const [isFavorite, setIsFavorite] = useState<boolean>(initial.is_favorite ?? false);

  const saveMut = useMutation({
    mutationFn: () => save({
      data: {
        id: initial.id, title: title.trim(), description, subject, grade_level: gradeLevel,
        resource_type: resourceType,
        tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        content,
        difficulty,
        is_favorite: isFavorite,
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={focusDialogShell}>
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
            <div>
              <Label>רמת קושי</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{DIFFICULTY_LABELS[d]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                aria-pressed={isFavorite}
                onClick={() => setIsFavorite((v) => !v)}
                className={`flex h-9 w-full items-center justify-center gap-2 rounded-md border text-sm transition ${isFavorite ? "border-amber bg-amber/15 font-medium" : "hover:bg-accent"}`}
              >
                <Star className={`h-4 w-4 ${isFavorite ? "fill-amber text-amber" : "text-muted-foreground"}`} />
                {isFavorite ? "במועדפים" : "סמן כמועדף"}
              </button>
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
                      aria-label={`שאלה ${i + 1}`}
                      placeholder="שאלה…" value={q.q}
                      onChange={(e) => updateQ(i, { q: e.target.value })} />
                    <Input className="!text-sm !text-muted-foreground border-0 px-0 focus-visible:ring-0"
                      aria-label={`תשובה לשאלה ${i + 1}`}
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
  const [errors, setErrors] = useState<string[]>([]);

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
        difficulty: draft.difficulty,
        subject, grade_level: gradeLevel,
        ai_generated: true,
        source_prompt: prompt,
      });
      setPrompt("");
      toast.success("נוצר! ערוך לפי הצורך ולחץ שמור");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  /** All required fields must be filled before the request is sent. */
  const validate = (): string[] => {
    const list: string[] = [];
    if (!resourceType) list.push("יש לבחור סוג חומר");
    if (!subject.trim()) list.push("יש לבחור מקצוע");
    if (!gradeLevel.trim()) list.push("יש לבחור כיתה");
    if (prompt.trim().length < 10) list.push("יש לתאר את החומר הרצוי (10 תווים לפחות)");
    return list;
  };

  const onSubmit = () => {
    const list = validate();
    setErrors(list);
    if (list.length) {
      toast.error("לא ניתן ליצור את הדוח — יש להשלים את השדות החסרים");
      return;
    }
    m.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl" onOpenAutoFocus={focusDialogShell}>
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
          {errors.length > 0 && (
            <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <div className="font-semibold">חסרים פרטים ליצירת החומר:</div>
              <ul className="mt-1 list-disc space-y-0.5 pe-4">
                {errors.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
          )}
          {m.isError && (
            <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              הבקשה נכשלה: {m.error instanceof Error ? m.error.message : "שגיאה לא ידועה"} — נסה שוב או שנה את התיאור.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
          <Button disabled={m.isPending} onClick={onSubmit}>
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
      <DialogContent onOpenAutoFocus={focusDialogShell}>
        <DialogHeader><DialogTitle>אוספים</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">בחר אוספים כדי לסנן את רשימת החומרים.</p>
          <div className="flex gap-2">
            <Input autoFocus={false} value={name} onChange={(e) => setName(e.target.value)} placeholder="שם האוסף…" aria-label="שם אוסף חדש" />
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 p-1" aria-label="צבע האוסף החדש" />
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
                className="flex-1 rounded px-1 py-1 text-right font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-pressed={selectedIds.includes(c.id)}
                aria-label={selectedIds.includes(c.id) ? `בטל סינון לפי האוסף ${c.name}` : `סנן לפי האוסף ${c.name}`}
                onClick={() => onToggleSelected(c.id)}
              >
                {c.name}
                {selectedIds.includes(c.id) && <span className="ms-2 text-xs text-amber">מסונן</span>}
              </button>
              <Button variant="ghost" size="icon" className="min-h-9 min-w-9 text-destructive" aria-label={`מחק את האוסף ${c.name}`}
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