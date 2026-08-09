import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Search, ChevronLeft, Building2, Users, GraduationCap, Archive, UserPlus, Loader2 } from "lucide-react";
import {
  getMyInstitution,
  getInstitutionOverview,
  listMyInstitutionClasses,
  listMyInstitutionAudit,
} from "@/lib/institution-dashboard.functions";
import {
  listInstitutionTeachers,
  inviteTeacherToInstitution,
  removeTeacherFromInstitution,
} from "@/lib/institution-teachers.functions";

export const Route = createFileRoute("/_authenticated/institution")({
  component: InstitutionDashboardPage,
  head: () => ({
    meta: [
      { title: "דשבורד המוסד שלי · הכיתה שלי" },
      { name: "description", content: "תמונת מצב לניהול המוסד: הכיתות, המלמדים ויומן הפעילות — תצוגה לצפייה בלבד." },
      { property: "og:title", content: "דשבורד המוסד שלי · הכיתה שלי" },
      { property: "og:description", content: "תמונת מצב לניהול המוסד: הכיתות, המלמדים ויומן הפעילות — תצוגה לצפייה בלבד." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function InstitutionDashboardPage() {
  const fetchInstitution = useServerFn(getMyInstitution);
  const fetchOverview = useServerFn(getInstitutionOverview);
  const fetchClasses = useServerFn(listMyInstitutionClasses);
  const fetchAudit = useServerFn(listMyInstitutionAudit);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");

  const institutionQ = useQuery({
    queryKey: ["my-institution"],
    queryFn: () => fetchInstitution(),
  });
  const institution = institutionQ.data ?? null;
  const enabled = Boolean(institution);

  const overviewQ = useQuery({
    queryKey: ["institution-overview"],
    queryFn: () => fetchOverview(),
    enabled,
  });
  const classesQ = useQuery({
    queryKey: ["institution-classes"],
    queryFn: () => fetchClasses(),
    enabled,
  });
  const auditQ = useQuery({
    queryKey: ["institution-audit"],
    queryFn: () => fetchAudit(),
    enabled,
  });

  const classes = classesQ.data ?? [];
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return classes.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (term && !c.name.toLowerCase().includes(term) && !c.teacherName.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [classes, q, statusFilter]);

  if (institutionQ.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4" aria-busy="true" aria-label="טוען את נתוני המוסד">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <h1 className="font-display text-xl font-bold">אין לך הרשאת מנהל מוסד</h1>
            <p className="text-sm text-muted-foreground">
              דף זה זמין למנהלי מוסד בלבד. אם אתה סבור שזו טעות, פנה למנהל המערכת.
            </p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/classes">חזרה לכיתות שלי</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const o = overviewQ.data;
  const metrics = [
    { label: "כיתות פעילות", value: o?.activeClasses, icon: GraduationCap },
    { label: "כיתות בארכיון", value: o?.archivedClasses, icon: Archive },
    { label: "תלמידים", value: o?.students, icon: Users },
    { label: "מלמדים", value: o?.teachers, icon: Building2 },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">דשבורד המוסד שלי</h1>
        <p className="text-sm text-muted-foreground">{institution.name} · תמונת מצב לצפייה בלבד</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="rounded-2xl">
            <CardContent className="flex items-center gap-3 p-4">
              <m.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <div className="font-mono-tabular text-2xl font-bold">
                  {overviewQ.isLoading ? <Skeleton className="h-7 w-10" /> : (m.value ?? 0)}
                </div>
                <div className="truncate text-xs text-muted-foreground">{m.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {overviewQ.isError && (
        <p className="text-sm text-destructive">טעינת המדדים נכשלה. רענן את הדף.</p>
      )}

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">כיתות המוסד</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                className="rounded-xl pe-9"
                type="search"
                placeholder="חיפוש לפי כיתה או מלמד..."
                aria-label="חיפוש לפי כיתה או מלמד"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)} dir="rtl">
              <TabsList aria-label="סינון לפי סטטוס">
                <TabsTrigger value="active">פעילות</TabsTrigger>
                <TabsTrigger value="archived">בארכיון</TabsTrigger>
                <TabsTrigger value="all">הכל</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {classesQ.isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="טוען כיתות">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
            </div>
          ) : classesQ.isError ? (
            <p className="py-6 text-center text-sm text-destructive">טעינת הכיתות נכשלה. רענן את הדף.</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {classes.length === 0 ? "אין כיתות משויכות למוסד זה." : "לא נמצאו כיתות התואמות לחיפוש."}
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      {c.status === "archived" && <Badge variant="secondary">בארכיון</Badge>}
                      {c.academicYear && (
                        <Badge variant="outline" className="font-mono-tabular">{c.academicYear}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      מלמד: {c.teacherName} · <span className="font-mono-tabular">{c.studentCount}</span> תלמידים
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="rounded-xl shrink-0">
                    <Link to="/classes/$classId" params={{ classId: c.id }}>
                      צפייה <ChevronLeft className="ms-1 h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle className="text-base">יומן שינויים במוסד</CardTitle></CardHeader>
        <CardContent>
          {auditQ.isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="טוען יומן שינויים">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
            </div>
          ) : auditQ.isError ? (
            <p className="py-4 text-center text-sm text-destructive">טעינת היומן נכשלה.</p>
          ) : (auditQ.data ?? []).length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">אין רשומות עדיין.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(auditQ.data ?? []).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">{row.message}</span>
                  <span className="shrink-0 font-mono-tabular text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString("he-IL")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}