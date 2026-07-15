import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Sparkles, Loader2, Save, Trash2, Printer, Plus, Search,
  BookOpen, FileText, FolderPlus, X, ArrowRight, Tag, Library,
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
  RESOURCE_TYPES, RESOURCE_TYPE_LABELS,
  type ResourceRow, type ResourceContent, type ResourceType,
} from "@/lib/teaching-resources.functions";
import { getPersonalRecommendations, recomputeStyleProfile } from "@/lib/teacher-style.functions";
import { Wand2 } from "lucide-react";
import { WeeklyPaceCard } from "@/components/weekly-pace-card";

export const Route = createFileRoute("/_authenticated/resources")({
  component: ResourcesPage,
  head: () => ({
    meta: [
      { title: "ספריית חומרי הוראה · ClassAlign Studio" },
      { name: "description", content: "ספרייה חכמה של דפי עבודה, מבחנים ושאלות לפי מקצועות קודש — ניתן לחפש, לסנן, לערוך ולייצא." },
      { property: "og:title", content: "ספריית חומרי הוראה · ClassAlign Studio" },
      { property: "og:description", content: "ספרייה חכמה של דפי עבודה, מבחנים ושאלות לפי מקצועות קודש." },
      { property: "og:url", content: "https://cuddle-spark-nexus.lovable.app/resources" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const GRADE_LEVELS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"] as const;

type Filters = {
  search: string;
  resource_type: ResourceType | "";
  subject: string;
  grade_level: string;
  tag: string;
  collection_id: string;
};

const emptyFilters: Filters = {
  search: "", resource_type: "", subject: "", grade_level: "", tag: "", collection_id: "",
};

function ResourcesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listResources);
  const del = useServerFn(deleteResource);
  const listColls = useServerFn(listCollections);

  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [editing, setEditing] = useState<Partial<ResourceRow> | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [collOpen, setCollOpen] = useState(false);

  const queryArgs = {
    search: filters.search || undefined,
    resource_type: filters.resource_type || undefined,
    subject: filters.subject || undefined,
    grade_level: filters.grade_level || undefined,
    tag: filters.tag || undefined,
    collection_id: filters.collection_id || undefined,
  };

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["teaching-resources", filters],
    queryFn: () => list({ data: queryArgs }),
  });

  const { data: collections = [] } = useQuery({
    queryKey: ["resource-collections"],
    queryFn: () => listColls(),
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
          <h1 className="font-display text-3xl font-bold tracking-tight">חומרי הוראה ועזרים</h1>
          <p className="mt-1 text-sm text-muted-foreground">
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

      <WeeklyPaceCard />

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
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">סוג</Label>
              <Select value={filters.resource_type || "all"}
                onValueChange={(v) => setFilters((f) => ({ ...f, resource_type: v === "all" ? "" : v as ResourceType }))}>
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
                onValueChange={(v) => setFilters((f) => ({ ...f, subject: v === "all" ? "" : v }))}>
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
                onValueChange={(v) => setFilters((f) => ({ ...f, grade_level: v === "all" ? "" : v }))}>
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
                onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))} />
            </div>
            {collections.length > 0 && (
              <div>
                <Label className="text-xs">אוסף</Label>
                <Select value={filters.collection_id || "all"}
                  onValueChange={(v) => setFilters((f) => ({ ...f, collection_id: v === "all" ? "" : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">הכל</SelectItem>
                    {collections.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full"
              onClick={() => setFilters(emptyFilters)}>
              <X className="ms-1 h-3 w-3" /> נקה סינון
            </Button>
          </CardContent>
        </Card>

        {/* Grid */}
        <div className="space-y-3">
          {isLoading && (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" /> טוען חומרים…
            </CardContent></Card>
          )}
          {!isLoading && resources.length === 0 && (
            <Card><CardContent className="py-16 text-center">
              <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <div className="text-muted-foreground">אין עדיין חומרים — צור את הראשון עם AI ✨</div>
              <Button className="mt-4" onClick={() => setAiOpen(true)}>
                <Sparkles className="ms-1 h-4 w-4" /> צור עם AI
              </Button>
            </CardContent></Card>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {resources.map((r) => (
              <ResourceCard key={r.id} resource={r} onOpen={() => setEditing(r)} />
            ))}
          </div>
        </div>
      </div>

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
        onClose={() => setAiOpen(false)}
        onGenerated={(draft) => { setAiOpen(false); setEditing(draft); }}
      />

      {/* Collections manager */}
      <CollectionsDialog open={collOpen} onClose={() => setCollOpen(false)} />
    </div>
  );
}

/* -------------------- card -------------------- */

function ResourceCard({ resource, onOpen }: { resource: ResourceRow; onOpen: () => void }) {
  return (
    <div className="group rounded-xl border bg-card p-4 text-right transition hover:border-amber/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="line-clamp-2 font-semibold">{resource.title}</div>
        {resource.ai_generated && (
          <Sparkles className="h-4 w-4 shrink-0 text-amber" />
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="outline" className="text-[10px]">
          {RESOURCE_TYPE_LABELS[resource.resource_type] ?? resource.resource_type}
        </Badge>
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
        <Button asChild size="sm" variant="outline" className="flex-1">
          <Link to="/resources/$resourceId" params={{ resourceId: resource.id }}>פתח</Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpen}>ערוך</Button>
      </div>
    </div>
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
  open, onClose, onGenerated,
}: {
  open: boolean; onClose: () => void;
  onGenerated: (draft: Partial<ResourceRow>) => void;
}) {
  const gen = useServerFn(generateResourceWithAI);
  const [prompt, setPrompt] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("worksheet");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");

  const m = useMutation({
    mutationFn: () => gen({ data: { prompt: prompt.trim(), resource_type: resourceType, subject, grade_level: gradeLevel } }),
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber" /> יצירת חומר עם AI
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

function CollectionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      <DialogContent>
        <DialogHeader><DialogTitle>אוספים</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם האוסף…" />
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-16 p-1" />
            <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>הוסף</Button>
          </div>
          {collections.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              עדיין אין אוספים. צור אוסף כדי לארגן חומרים נושאיים (לדוגמה: "חומרים לחודש אלול")
            </div>
          )}
          {collections.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border p-2">
              <div className="h-6 w-6 rounded" style={{ background: c.color }} />
              <div className="flex-1 font-medium">{c.name}</div>
              <Button variant="ghost" size="icon" className="text-destructive"
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