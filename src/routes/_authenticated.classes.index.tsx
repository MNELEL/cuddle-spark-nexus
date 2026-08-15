import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getRecentClassIds } from "@/lib/recent-classes";
import { getClassesOverview, deleteClass, setClassStatus } from "@/lib/classes.functions";
import {
  type ClassMetrics,
  type ClassSort,
  CLASS_SORT_STORAGE_KEY,
  compareClasses,
  isClassSort,
  metricsFor,
} from "@/lib/classes-overview";
import { getMyInstitution } from "@/lib/institution-dashboard.functions";
import { listUnreadClassNotifications, markNotificationRead } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trash2, ChevronLeft, Search, Archive, ArchiveRestore, X, Building2,
  Users, FileEdit, CalendarClock, ChevronDown,
} from "lucide-react";
import { NewClassWizard } from "@/components/new-class-wizard";
import { ClassAssignmentsTable } from "@/components/class-assignments-table";
import { OnboardingProgressCard } from "@/components/onboarding-progress-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/classes/")({
  component: ClassesPage,
  head: () => ({
    meta: [
      { title: "הכיתות שלי · הכיתה שלי" },
      { name: "description", content: "נהל את הכיתות, התלמידים והאילוצים הפדגוגיים שלך במקום אחד עם הכיתה שלי." },
      { property: "og:title", content: "הכיתות שלי · הכיתה שלי" },
      { property: "og:description", content: "נהל את הכיתות, התלמידים והאילוצים הפדגוגיים שלך במקום אחד עם הכיתה שלי." },
      { property: "og:url", content: "https://hakitasheli.lovable.app/classes" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://hakitasheli.lovable.app/classes" }],
  }),
});

function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex-1 rounded-xl border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold font-mono-tabular">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ClassesPage() {
  const overview = useServerFn(getClassesOverview);
  const remove = useServerFn(deleteClass);
  const setStatus = useServerFn(setClassStatus);
  const fetchInstitution = useServerFn(getMyInstitution);
  const fetchNotifications = useServerFn(listUnreadClassNotifications);
  const markRead = useServerFn(markNotificationRead);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [sort, setSort] = useState<ClassSort>("recent");
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    setRecentIds(getRecentClassIds());
    try {
      const saved = window.localStorage.getItem(CLASS_SORT_STORAGE_KEY);
      if (isClassSort(saved)) setSort(saved);
    } catch { /* storage unavailable — keep default */ }
  }, []);

  const changeSort = (v: string) => {
    if (!isClassSort(v)) return;
    setSort(v);
    try { window.localStorage.setItem(CLASS_SORT_STORAGE_KEY, v); } catch { /* ignore */ }
  };

  const { data: notifications = [] } = useQuery({
    queryKey: ["class-notifications"],
    queryFn: () => fetchNotifications(),
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-notifications"] }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["classes-overview"],
    queryFn: () => overview(),
  });
  const classes = data?.classes ?? [];
  const perClass = (data?.perClass ?? {}) as Record<string, ClassMetrics>;
  const stats = data?.stats;

  const invalidateClasses = () => {
    qc.invalidateQueries({ queryKey: ["classes-overview"] });
    qc.invalidateQueries({ queryKey: ["classes"] });
  };

  const { data: institution } = useQuery({
    queryKey: ["my-institution"],
    queryFn: () => fetchInstitution(),
    retry: false,
  });

  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      invalidateClasses();
      toast.success("הכיתה נמחקה");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const statusM = useMutation({
    mutationFn: (v: { id: string; status: "active" | "archived" }) => setStatus({ data: v }),
    onSuccess: (_r, v) => {
      invalidateClasses();
      toast.success(v.status === "archived" ? "הכיתה הועברה לארכיון" : "הכיתה הוחזרה לפעילות");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (classes as Array<Record<string, unknown>>).filter((c) => {
      const status = (c.status as string) ?? "active";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (term && !String(c.name ?? "").toLowerCase().includes(term)) return false;
      return true;
    }).sort(
      compareClasses(sort, recentIds, perClass) as unknown as (a: Record<string, unknown>, b: Record<string, unknown>) => number,
    ) as typeof classes;
  }, [classes, q, statusFilter, recentIds, sort, perClass]);

  const hasFilters = q.trim().length > 0 || statusFilter !== "active";
  const clearFilters = () => { setQ(""); setStatusFilter("active"); };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">הכיתות שלי</h1>
        <p className="text-sm text-muted-foreground">בחר כיתה כדי להתחיל לנהל תלמידים ואילוצים</p>
      </div>

      {notifications.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Archive className="h-4 w-4 shrink-0 text-amber" aria-hidden="true" />
                <span className="truncate">הכיתה ״{n.class_name}״ הועברה לארכיון</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0"
                aria-label={`סגור התראה על הכיתה ${n.class_name}`}
                disabled={dismiss.isPending}
                onClick={() => dismiss.mutate(n.id)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3 sm:flex-row" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[74px] flex-1 rounded-xl" />)}
        </div>
      ) : stats ? (
        <div className="flex flex-col gap-3 sm:flex-row" aria-label="סיכום מצב">
          <StatTile label="סה״כ תלמידים" value={stats.totalStudents} hint="בכיתות פעילות" />
          <StatTile label="כיתות פעילות" value={stats.activeClasses} hint={`מתוך ${stats.totalClasses} כיתות`} />
          <StatTile
            label="פעולות ממתינות"
            value={stats.pendingActions + notifications.length}
            hint="עלונים בטיוטה והתראות"
          />
        </div>
      ) : null}

      {!isLoading && classes.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              className="rounded-xl pe-9"
              type="search"
              placeholder="חיפוש כיתה לפי שם..."
              aria-label="חיפוש כיתה לפי שם"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sort} onValueChange={changeSort}>
              <SelectTrigger className="h-9 w-[150px] rounded-xl" aria-label="מיון כיתות">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">לאחרונה</SelectItem>
                <SelectItem value="name">לפי שם (א-ב)</SelectItem>
                <SelectItem value="students">לפי מספר תלמידים</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)} dir="rtl">
              <TabsList aria-label="סינון לפי סטטוס">
                <TabsTrigger value="active">פעילות</TabsTrigger>
                <TabsTrigger value="archived">בארכיון</TabsTrigger>
                <TabsTrigger value="all">הכל</TabsTrigger>
              </TabsList>
            </Tabs>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="rounded-xl" onClick={clearFilters}>
                <X className="ms-1 h-4 w-4" aria-hidden="true" /> נקה
              </Button>
            )}
          </div>
        </div>
      )}

      {!isLoading && classes.length > 0 && (
        <p className="text-xs text-muted-foreground font-mono-tabular" aria-live="polite">
          {filtered.length} מתוך {classes.length} כיתות
        </p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="טוען כיתות">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden rounded-2xl" aria-hidden="true">
              <CardContent className="flex flex-col gap-3 p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">עדיין אין כיתות. צור את הראשונה למטה.</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
            <span>לא נמצאו כיתות התואמות לחיפוש</span>
            <Button variant="outline" className="rounded-xl" onClick={clearFilters}>נקה סינון</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const status = ((c as { status?: string }).status ?? "active") as "active" | "archived";
            const m = metricsFor(perClass, c.id);
            return (
            <Card
              key={c.id}
              className="overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <Link
                  to="/classes/$classId"
                  params={{ classId: c.id }}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-display text-lg font-bold">{c.name}</span>
                      {status === "archived" && <Badge variant="secondary">בארכיון</Badge>}
                      {recentIds[0] === c.id && <Badge className="shrink-0">הכיתה הקבועה שלי</Badge>}
                      {(c as { academic_year?: string | null }).academic_year && (
                        <Badge variant="outline" className="font-mono-tabular">
                          {(c as { academic_year?: string | null }).academic_year}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground font-mono-tabular">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{m.studentCount} תלמידים</span>
                      <span aria-hidden="true">·</span>
                      <span>גריד {c.grid_cols}×{c.grid_rows}</span>
                    </div>
                    {(m.draftBulletins > 0 || m.upcomingExams > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {m.draftBulletins > 0 && (
                          <Badge variant="outline" className="gap-1 border-amber/50 text-amber">
                            <FileEdit className="h-3 w-3" aria-hidden="true" /> עלון בטיוטה
                          </Badge>
                        )}
                        {m.upcomingExams > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <CalendarClock className="h-3 w-3" aria-hidden="true" /> מבחן קרוב
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
                <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={status === "archived" ? `החזר את הכיתה ${c.name} לפעילות` : `העבר את הכיתה ${c.name} לארכיון`}
                  className="text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
                  disabled={statusM.isPending}
                  onClick={() => statusM.mutate({ id: c.id, status: status === "archived" ? "active" : "archived" })}
                >
                  {status === "archived" ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                </Button>
                {status === "archived" ? (
                  <span className="text-xs text-muted-foreground">לצפייה בלבד</span>
                ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`מחק את הכיתה ${c.name}`} className="text-destructive transition-colors hover:bg-destructive/10 motion-reduce:transition-none">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>למחוק את הכיתה?</AlertDialogTitle>
                      <AlertDialogDescription>פעולה זו תמחק לצמיתות את {c.name} ואת כל התלמידים והאילוצים שלה.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeM.mutate(c.id)}>מחק</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                )}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <Card className="rounded-2xl">
        <CardContent className="flex flex-col gap-2 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            פתיחת כיתה לשנה חדשה? האשף יציע לקשר לכיתה של השנה הקודמת ולהעביר את התלמידים.
          </p>
          <NewClassWizard />
        </CardContent>
      </Card>

      <OnboardingProgressCard />

      <Collapsible>
        <Card className="rounded-2xl">
          <CardContent className="pt-6">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between rounded-xl px-2">
                <span className="text-sm font-medium">ניהול ושיוכים</span>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {institution && (
                <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>דשבורד המוסד שלי — {institution.name}</span>
                  </div>
                  <Button asChild variant="outline" size="sm" className="rounded-xl">
                    <Link to="/institution">
                      פתח דשבורד <ChevronLeft className="ms-1 h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              )}
              {classes.length > 0 && <ClassAssignmentsTable />}
            </CollapsibleContent>
          </CardContent>
        </Card>
      </Collapsible>
    </div>
  );
}
