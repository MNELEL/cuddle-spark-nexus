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
import { InstitutionStaffCard } from "@/components/institution-staff-card";
import { InstitutionClassAssignmentsCard } from "@/components/institution-class-assignments-card";
import { Textarea } from "@/components/ui/textarea";
import { renameInstitutionTeacher } from "@/lib/institution-staff.functions";
import { Search, ChevronLeft, Pencil, Building2, Users, GraduationCap, Archive, UserPlus, Loader2 } from "lucide-react";
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
  updateTeacherNotes,
  findUserByEmail,
  type FoundUser,
} from "@/lib/institution-teachers.functions";
import { assignRole } from "@/lib/user-roles.functions";

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

      <Tabs defaultValue="classes" dir="rtl" className="space-y-6">
        <TabsList aria-label="מדורי המוסד">
          <TabsTrigger value="classes">כיתות</TabsTrigger>
          <TabsTrigger value="teachers">מלמדים</TabsTrigger>
          <TabsTrigger value="staff">צוות ורבנים</TabsTrigger>
        </TabsList>

        <TabsContent value="classes" className="space-y-6">
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
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <Button asChild variant="ghost" size="sm" className="rounded-xl">
                      <Link to="/weekly-schedule/$classId" params={{ classId: c.id }}>
                        פגישות ומטלות
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm" className="rounded-xl">
                      <Link to="/classes/$classId" params={{ classId: c.id }}>
                        פרטים וקצב <ChevronLeft className="ms-1 h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
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
        </TabsContent>

        <TabsContent value="teachers">
          <div className="space-y-6">
            <TeachersTab canEdit={institution.role === "admin"} institutionId={institution.id} />
            <InstitutionClassAssignmentsCard canEdit={institution.role === "admin"} />
          </div>
        </TabsContent>

        <TabsContent value="staff">
          <InstitutionStaffCard canEdit />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TeachersTab({ canEdit, institutionId }: { canEdit: boolean; institutionId: string }) {
  const qc = useQueryClient();
  const fetchTeachers = useServerFn(listInstitutionTeachers);
  const invite = useServerFn(inviteTeacherToInstitution);
  const remove = useServerFn(removeTeacherFromInstitution);
  const rename = useServerFn(renameInstitutionTeacher);
  const saveNotes = useServerFn(updateTeacherNotes);
  const findUser = useServerFn(findUserByEmail);
  const attachRole = useServerFn(assignRole);
  const [renameTarget, setRenameTarget] = useState<{ userId: string; name: string } | null>(null);
  const [notesTarget, setNotesTarget] = useState<{ userId: string; name: string; notes: string } | null>(null);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const [attachOpen, setAttachOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [attachedId, setAttachedId] = useState<string | null>(null);


  const teachersQ = useQuery({
    queryKey: ["institution-teachers"],
    queryFn: () => fetchTeachers(),
  });

  const inviteM = useMutation({
    mutationFn: (value: string) => invite({ data: { email: value } }),
    onSuccess: () => {
      toast.success("ההזמנה נשלחה במייל");
      setOpen(false);
      setEmail("");
      setEmailError(null);
      void qc.invalidateQueries({ queryKey: ["institution-teachers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שליחת ההזמנה נכשלה"),
  });

  const removeM = useMutation({
    mutationFn: (userId: string) => remove({ data: { userId } }),
    onSuccess: () => {
      toast.success("המלמד הוסר מהמוסד");
      void qc.invalidateQueries({ queryKey: ["institution-teachers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הסרת המלמד נכשלה"),
  });

  const renameM = useMutation({
    mutationFn: (v: { userId: string; name: string }) => rename({ data: { teacherId: v.userId, name: v.name } }),
    onSuccess: () => {
      toast.success("שם המלמד עודכן");
      setRenameTarget(null);
      void qc.invalidateQueries({ queryKey: ["institution-teachers"] });
      void qc.invalidateQueries({ queryKey: ["institution-classes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "עדכון השם נכשל"),
  });

  const notesM = useMutation({
    mutationFn: (v: { userId: string; notes: string }) => saveNotes({ data: { teacherId: v.userId, notes: v.notes } }),
    onSuccess: () => {
      toast.success("ההערות נשמרו");
      setNotesTarget(null);
      void qc.invalidateQueries({ queryKey: ["institution-teachers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שמירת ההערות נכשלה"),
  });

  const searchM = useMutation({
    mutationFn: (value: string) => findUser({ data: { email: value } }),
    onSuccess: (res) => {
      setFoundUser(res ?? null);
      setSearched(true);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "החיפוש נכשל"),
  });

  const attachM = useMutation({
    mutationFn: (targetId: string) =>
      attachRole({ data: { user_id: targetId, role: "teacher", institution_id: institutionId } }),
    onSuccess: (_, targetId) => {
      toast.success("המלמד שויך למוסד");
      setAttachedId(targetId);
      void qc.invalidateQueries({ queryKey: ["institution-teachers"] });
      void qc.invalidateQueries({ queryKey: ["institution-class-assignments"] });
      // סוגרים את הדיאלוג אחרי השיוך, אך שומרים את מזהה השיוך למניעת ניסיונות חוזרים
      window.setTimeout(() => {
        setAttachOpen(false);
        resetAttach();
      }, 900);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שיוך המלמד נכשל"),
  });

  function resetAttach() {
    setSearchEmail("");
    setSearchError(null);
    setSearched(false);
    setFoundUser(null);
    setAttachedId(null);
  }

  function submitSearch() {
    const value = searchEmail.trim();
    if (!value) { setSearchError("נדרשת כתובת מייל"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { setSearchError("כתובת מייל לא תקינה"); return; }
    setSearchError(null);
    setSearched(false);
    setFoundUser(null);
    setAttachedId(null);
    searchM.mutate(value);
  }


  function submitInvite() {
    const value = email.trim();
    if (!value) { setEmailError("נדרשת כתובת מייל"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { setEmailError("כתובת מייל לא תקינה"); return; }
    setEmailError(null);
    inviteM.mutate(value);
  }

  const teachers = teachersQ.data ?? [];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">מלמדי המוסד</CardTitle>
        {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEmailError(null); }}>
          <DialogTrigger asChild>
            <Button className="rounded-xl">
              <UserPlus className="me-1 h-4 w-4" aria-hidden="true" /> הזמן מלמד
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>הזמנת מלמד למוסד</DialogTitle>
              <DialogDescription>
                תישלח הזמנה במייל. לאחר ההרשמה המלמד ישויך אוטומטית למוסד שלך.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="invite-email">כתובת מייל</Label>
              <Input
                id="invite-email"
                type="email"
                dir="ltr"
                maxLength={255}
                className="rounded-xl"
                placeholder="teacher@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") submitInvite(); }}
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? "invite-email-error" : undefined}
              />
              {emailError && (
                <p id="invite-email-error" className="text-sm text-destructive">{emailError}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                className="rounded-xl"
                onClick={submitInvite}
                disabled={inviteM.isPending}
              >
                {inviteM.isPending && <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />}
                שלח הזמנה
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={attachOpen} onOpenChange={(v) => { setAttachOpen(v); if (!v) resetAttach(); }}>
          <DialogTrigger asChild>
            <Button variant="outline" className="rounded-xl">
              <Search className="me-1 h-4 w-4" aria-hidden="true" /> שייך מלמד קיים
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>שיוך מלמד קיים למוסד</DialogTitle>
              <DialogDescription>
                חפש לפי כתובת המייל של חשבון קיים במערכת, ושייך אותו כמלמד במוסד שלך.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="attach-email">כתובת מייל</Label>
              <div className="flex gap-2">
                <Input
                  id="attach-email"
                  type="email"
                  dir="ltr"
                  maxLength={255}
                  className="rounded-xl"
                  placeholder="teacher@example.com"
                  value={searchEmail}
                  onChange={(e) => { setSearchEmail(e.target.value); setSearchError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }}
                  aria-invalid={Boolean(searchError)}
                  aria-describedby={searchError ? "attach-email-error" : undefined}
                />
                <Button className="rounded-xl" onClick={submitSearch} disabled={searchM.isPending}>
                  {searchM.isPending && <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />}
                  חפש
                </Button>
              </div>
              {searchError && (
                <p id="attach-email-error" className="text-sm text-destructive">{searchError}</p>
              )}

              {searched && !foundUser && (
                <p className="text-sm text-muted-foreground">לא נמצא משתמש עם אימייל זה במערכת</p>
              )}
              {foundUser && (
                <div className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{foundUser.displayName}</p>
                  <p dir="ltr" className="text-muted-foreground">{foundUser.email}</p>
                  {foundUser.alreadyTeacherHere ? (
                    <p className="mt-2 text-muted-foreground">המשתמש כבר מלמד במוסד זה</p>
                  ) : attachedId === foundUser.id ? (
                    <p className="mt-2 font-medium text-green-600">המלמד שויך למוסד בהצלחה</p>
                  ) : (
                    <Button
                      className="mt-3 rounded-xl"
                      onClick={() => attachM.mutate(foundUser.id)}
                      disabled={attachM.isPending}
                    >
                      {attachM.isPending && <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />}
                      שייך למוסד
                    </Button>
                  )}

                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        </div>
        )}
      </CardHeader>
      <CardContent>
        {teachersQ.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="טוען מלמדים">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : teachersQ.isError ? (
          <p className="py-6 text-center text-sm text-destructive">טעינת המלמדים נכשלה. רענן את הדף.</p>
        ) : teachers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">אין מלמדים משויכים למוסד זה עדיין.</p>
        ) : (
          <ul className="divide-y">
            {teachers.map((t) => (
              <li key={t.userId} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono-tabular">{t.classCount}</span> כיתות ·{" "}
                      <span className="font-mono-tabular">{t.studentCount}</span> תלמידים
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                  {canEdit && (
                  <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setRenameTarget({ userId: t.userId, name: t.name })}
                  >
                    <Pencil className="me-1 h-3.5 w-3.5" aria-hidden="true" /> שינוי שם
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setNotesTarget({ userId: t.userId, name: t.name, notes: t.teachingNotes })}
                  >
                    סגנון הוראה והערות
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="rounded-xl text-destructive">
                        הסר מהמוסד
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>להסיר את {t.name} מהמוסד?</AlertDialogTitle>
                        <AlertDialogDescription>
                          החשבון והכיתות שלו יישארו כפי שהם — רק השיוך למוסד יוסר.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeM.mutate(t.userId)}>הסר</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  </>
                  )}
                  </div>
                </div>
                {t.teachingNotes && (
                  <p className="mt-1 whitespace-pre-wrap rounded-xl bg-muted/50 p-2 text-xs text-muted-foreground">
                    <span className="font-medium">סגנון הוראה והערות: </span>{t.teachingNotes}
                  </p>
                )}
                {t.style && (
                  <Accordion type="single" collapsible>
                    <AccordionItem value="style" className="border-0">
                      <AccordionTrigger className="py-2 text-xs text-muted-foreground">
                        פרופיל ההוראה
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2 text-sm">
                        {t.style.preferredSubjects.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-xs text-muted-foreground">מקצועות מועדפים:</span>
                            {t.style.preferredSubjects.map((s) => (
                              <Badge key={s} variant="outline">{s}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          משאבים בספרייה: <span className="font-mono-tabular">{t.style.resourceCount}</span>
                          {t.style.lastUpdatedAt && (
                            <> · עודכן: {new Date(t.style.lastUpdatedAt).toLocaleDateString("he-IL")}</>
                          )}
                        </div>
                        {t.style.lastAiSummary && (
                          <p className="text-muted-foreground">{t.style.lastAiSummary}</p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={renameTarget !== null} onOpenChange={(o) => !o && setRenameTarget(null)}>
        {/* rename dialog */}
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>שינוי שם המלמד</DialogTitle>
            <DialogDescription>
              השם יופיע בכל הכיתות של המלמד, בדוחות ובדשבורד המוסד.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="teacher-rename">שם מלא</Label>
            <Input
              id="teacher-rename"
              className="rounded-xl"
              maxLength={80}
              value={renameTarget?.name ?? ""}
              onChange={(e) => setRenameTarget((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setRenameTarget(null)}>ביטול</Button>
            <Button
              className="rounded-xl"
              disabled={renameM.isPending}
              onClick={() => {
                if (!renameTarget) return;
                if (renameTarget.name.trim().length < 2) return toast.error("נדרש שם מלא");
                renameM.mutate({ userId: renameTarget.userId, name: renameTarget.name.trim() });
              }}
            >
              {renameM.isPending && <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />}
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={notesTarget !== null} onOpenChange={(o) => !o && setNotesTarget(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>סגנון הוראה והערות — {notesTarget?.name}</DialogTitle>
            <DialogDescription>
              תיעוד פנימי של המוסד: סגנון ההוראה, חוזקות, מקצועות מועדפים והערות ליווי. גלוי למנהלי המוסד בלבד.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="teacher-notes">הערות</Label>
            <Textarea
              id="teacher-notes"
              className="min-h-32 rounded-xl"
              maxLength={2000}
              placeholder="לדוגמה: מלמד גמרא בגישת חברותות, מצטיין בהעברת סוגיות מורכבות, זקוק לתמיכה בניהול כיתה גדולה."
              value={notesTarget?.notes ?? ""}
              onChange={(e) => setNotesTarget((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setNotesTarget(null)}>ביטול</Button>
            <Button
              className="rounded-xl"
              disabled={notesM.isPending}
              onClick={() => {
                if (!notesTarget) return;
                notesM.mutate({ userId: notesTarget.userId, notes: notesTarget.notes });
              }}
            >
              {notesM.isPending && <Loader2 className="me-1 h-4 w-4 animate-spin" aria-hidden="true" />}
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}