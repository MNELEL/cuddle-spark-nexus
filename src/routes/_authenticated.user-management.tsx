import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck,
  Loader2,
  ArrowLeft,
  Trash2,
  Plus,
  Search,
  Building2,
  GraduationCap,
  ScrollText,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  canManageUsers,
  listUsersWithRoles,
  assignRole,
  removeRole,
  bootstrapFirstAdmin,
  type Role,
} from "@/lib/user-roles.functions";
import {
  listInstitutions,
  createInstitution,
  listInstitutionClasses,
  listRoleAuditLog,
  attachTeacherClassesToInstitution,
  deleteInstitution,
} from "@/lib/institutions.functions";
import { TrialApprovalsCard } from "@/components/trial-approvals-card";
import { AccessRequestForm } from "@/components/access-request-form";
import { AccessRequestsCard } from "@/components/access-requests-card";
import { SystemAdminsCard } from "@/components/system-admins-card";

const NO_INSTITUTION = "__none__";
const INSTITUTIONS_PAGE_SIZE = 10;

const ROLE_LABELS: Record<Role, string> = {
  admin: "מנהל מערכת",
  principal: "מנהל מוסד",
  teacher: "מלמד",
  secretary: "מזכירה",
};

const ROLE_OPTIONS: Role[] = ["teacher", "secretary", "principal", "admin"];

export const Route = createFileRoute("/_authenticated/user-management")({
  component: UserManagementPage,
  validateSearch: (search: Record<string, unknown>): { focus?: "trials"; trialUser?: string } => ({
    focus: search["focus"] === "trials" ? "trials" : undefined,
    trialUser: typeof search["trialUser"] === "string" ? search["trialUser"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "ניהול משתמשים ותפקידים · הכיתה שלי" },
      { name: "description", content: "ניהול הרשאות מוסדיות: מנהלים, מנהלי מוסדות, מלמדים ומזכירות." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function UserManagementPage() {
  const { focus, trialUser } = Route.useSearch();
  const checkAccess = useServerFn(canManageUsers);
  const listUsers = useServerFn(listUsersWithRoles);
  const assignRoleFn = useServerFn(assignRole);
  const attachClassesFn = useServerFn(attachTeacherClassesToInstitution);
  const removeRoleFn = useServerFn(removeRole);
  const bootstrapFn = useServerFn(bootstrapFirstAdmin);
  const listInstitutionsFn = useServerFn(listInstitutions);
  const createInstitutionFn = useServerFn(createInstitution);
  const listInstitutionClassesFn = useServerFn(listInstitutionClasses);
  const deleteInstitutionFn = useServerFn(deleteInstitution);
  const listAuditLogFn = useServerFn(listRoleAuditLog);
  const queryClient = useQueryClient();

  const { data: access, isLoading: isAdminLoading } = useQuery({
    queryKey: ["can-manage-users"],
    queryFn: () => checkAccess(),
  });
  const isAdminUser = access?.isAdmin === true;
  const canManage = access?.canManage === true;

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: () => listUsers(),
    enabled: isAdminUser === true,
  });

  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | "">("");
  const [selectedRole, setSelectedRole] = useState<Role | "">("");
  const [selectedInstitution, setSelectedInstitution] = useState<string>(NO_INSTITUTION);
  const [newInstitutionName, setNewInstitutionName] = useState("");
  const [autoAssignClasses, setAutoAssignClasses] = useState(true);
  const [institutionSearch, setInstitutionSearch] = useState("");
  const [institutionPage, setInstitutionPage] = useState(1);
  const [classesInstitution, setClassesInstitution] = useState<string>("");

  const { data: institutions, isLoading: institutionsLoading } = useQuery({
    queryKey: ["institutions"],
    queryFn: () => listInstitutionsFn(),
    enabled: isAdminUser === true,
  });

  const { data: institutionClasses, isLoading: classesLoading, isError: classesError } = useQuery({
    queryKey: ["institution-classes", classesInstitution],
    queryFn: () => listInstitutionClassesFn({ data: { institution_id: classesInstitution } }),
    enabled: isAdminUser === true && classesInstitution !== "",
  });

  const { data: auditLog, isLoading: auditLoading } = useQuery({
    queryKey: ["role-audit-log"],
    queryFn: () => listAuditLogFn(),
    enabled: isAdminUser === true,
  });

  const createInstitutionMutation = useMutation({
    mutationFn: async (name: string) => await createInstitutionFn({ data: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["institutions"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-log"] });
      setNewInstitutionName("");
      toast.success("המוסד נוצר בהצלחה");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "יצירת המוסד נכשלה");
    },
  });

  const deleteInstitutionMutation = useMutation({
    mutationFn: async (id: string) => await deleteInstitutionFn({ data: { institution_id: id } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["institutions"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-log"] });
      setClassesInstitution("");
      toast.success(`המוסד ${res.name} נמחק`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "מחיקת המוסד נכשלה");
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      user_id,
      role,
      institution_id,
      attach_classes,
    }: { user_id: string; role: Role; institution_id?: string; attach_classes?: boolean }) => {
      await assignRoleFn({ data: { user_id, role, institution_id } });
      if (attach_classes && institution_id) {
        return await attachClassesFn({ data: { user_id, institution_id } });
      }
      return null;
    },
    onSuccess: (res) => {
      if (res && res.attached > 0) {
        toast.success(`${res.attached} כיתות של המלמד שויכו למוסד`);
      } else if (res && res.skippedArchived > 0) {
        toast.info(`${res.skippedArchived} כיתות בארכיון לא שויכו — החזר אותן לפעילות תחילה`);
      }
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-log"] });
      queryClient.invalidateQueries({ queryKey: ["system-admins"] });
      queryClient.invalidateQueries({ queryKey: ["class-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["institution-classes"] });
      setSelectedRole("");
      setSelectedInstitution(NO_INSTITUTION);
      toast.success("תפקיד הוקצה בהצלחה");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "ההקצאה נכשלה");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (roleId: string) => {
      return await removeRoleFn({ data: { role_id: roleId } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-log"] });
      queryClient.invalidateQueries({ queryKey: ["system-admins"] });
      toast.success("תפקיד הוסר");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "ההסרה נכשלה");
    },
  });

  const bootstrapMutation = useMutation({
    mutationFn: async () => {
      return await bootstrapFn();
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message);
        queryClient.invalidateQueries({ queryKey: ["can-manage-users"] });
        queryClient.invalidateQueries({ queryKey: ["system-admins"] });
      } else {
        toast.info(res.message);
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "האתחול נכשל");
    },
  });

  if (isAdminLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="ms-2 h-5 w-5 animate-spin" />
        בודק הרשאות...
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <CardTitle as="h1" className="mt-2 text-xl">גישה מוגבלת</CardTitle>
            <CardDescription>
              מסך ניהול המשתמשים פתוח למנהל מערכת ולמנהל מוסד בלבד.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SystemAdminsCard />
            <div className="rounded-lg border bg-muted/30 p-4">
              <h2 className="mb-3 font-display text-base font-semibold">אז מה עושים?</h2>
              <ol className="list-decimal space-y-2 pr-5 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">מלא את טופס בקשת הגישה</strong> — הוסף את
                  תפקיד הרצוי (מלמד, מזכירה, מנהל מוסד) ופרטי המוסד.
                </li>
                <li>
                  <strong className="text-foreground">מנהל המערכת יבדוק ויאשר</strong> — הוא נכנס
                  לעמוד זה, רואה בכרטיסייה "בקשות הרשאה" את כל הבקשות הממתינות, ולוחץ "אישור ושיוך".
                </li>
                <li>
                  <strong className="text-foreground">חזור לכאן</strong> — לאחר האישור, עמוד זה יוצג
                  לך עם הכלים המותאמים לתפקיד שלך.
                </li>
              </ol>
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                מנהל מערכת הוא משתמש עם תפקיד <strong>admin</strong> בטבלת התפקידים. בלחיצה על "אתחל מנהל מערכת ראשון"
                (כאשר אין עדיין מנהל) או על ידי הקצאת תפקיד admin על ידי מנהל קיים.
              </p>
            </div>

            <AccessRequestForm />

            <div className="grid gap-3 sm:grid-cols-2">
              <Button asChild variant="outline">
                <a href="mailto:nm0527603669@gmail.com?subject=בקשת%20הרשאות%20לניהול%20משתמשים">
                  יצירת קשר עם מנהל המערכת
                </a>
              </Button>
              <Button
                variant="ghost"
                disabled={bootstrapMutation.isPending}
                onClick={() => bootstrapMutation.mutate()}
              >
                {bootstrapMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                אתחל מנהל מערכת ראשון
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              כפתור האתחול פועל רק כאשר אין עדיין מנהל במערכת.
              אחרי הלחיצה, החשבון שלך יקבל תפקיד מנהל מערכת באופן מיידי — בלי צורך באישור נוסף —
              ותוכל לנהל משתמשים ותפקידים בעמוד זה. השינוי משפיע על הרשאות הניהול מיד,
              אך לא על רשימות הכיתות או התלמידים הקיימות.
            </p>
            <Link to="/classes" className="inline-block text-sm text-primary hover:underline">
              <ArrowLeft className="me-1 inline h-4 w-4" /> חזרה לכיתות
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdminUser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">ניהול משתמשים ותפקידים</h1>
            <p className="text-sm text-muted-foreground">
              כמנהל מוסד אתה רואה את בקשות ההרשאה. הקצאת תפקידים מתבצעת על ידי מנהל המערכת.
            </p>
          </div>
          <Link to="/classes">
            <Button variant="outline"><ArrowLeft className="me-2 h-4 w-4" /> חזרה</Button>
          </Link>
        </div>
        <AccessRequestsCard canResolve={false} />
        <SystemAdminsCard />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ניהול המוסד שלך</CardTitle>
            <CardDescription>מלמדים, כיתות ומדדים מוסדיים.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/institution">
                <Building2 className="me-2 h-4 w-4" /> לדשבורד המוסד
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredUsers = (users ?? []).filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const institutionRequired = selectedRole !== "" && selectedRole !== "admin";
  const institutionMissing = institutionRequired && selectedInstitution === NO_INSTITUTION;

  const allInstitutions = institutions ?? [];
  const matchedInstitutions = allInstitutions.filter((inst) =>
    inst.name.toLowerCase().includes(institutionSearch.trim().toLowerCase())
  );
  const institutionPages = Math.max(1, Math.ceil(matchedInstitutions.length / INSTITUTIONS_PAGE_SIZE));
  const safePage = Math.min(institutionPage, institutionPages);
  const pagedInstitutions = matchedInstitutions.slice(
    (safePage - 1) * INSTITUTIONS_PAGE_SIZE,
    safePage * INSTITUTIONS_PAGE_SIZE
  );

  const handleAssign = () => {
    if (!selectedUser || !selectedRole) return;
    if (institutionMissing) {
      toast.error(`לתפקיד ${ROLE_LABELS[selectedRole as Role]} חובה לבחור מוסד`);
      return;
    }
    assignMutation.mutate({
      user_id: selectedUser,
      role: selectedRole as Role,
      institution_id: selectedInstitution === NO_INSTITUTION ? undefined : selectedInstitution,
      attach_classes: autoAssignClasses,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">ניהול משתמשים ותפקידים</h1>
          <p className="text-sm text-muted-foreground">הקצאת תפקידים מוסדיים וניהול הרשאות.</p>
        </div>
        <Link to="/classes">
          <Button variant="outline"><ArrowLeft className="me-2 h-4 w-4" /> חזרה</Button>
        </Link>
      </div>

      <SystemAdminsCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" /> מוסדות
          </CardTitle>
          <CardDescription>רשימת המוסדות במערכת ויצירת מוסד חדש.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="חיפוש מוסד לפי שם..."
              value={institutionSearch}
              onChange={(e) => {
                setInstitutionSearch(e.target.value);
                setInstitutionPage(1);
              }}
              className="pe-4 ps-10"
              aria-label="חיפוש מוסד"
            />
          </div>
          {institutionsLoading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">טוען מוסדות...</div>
          ) : matchedInstitutions.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {allInstitutions.length === 0 ? "אין מוסדות עדיין." : "לא נמצאו מוסדות מתאימים."}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {pagedInstitutions.map((inst) => (
                  <Badge key={inst.id} variant="secondary" className="gap-1.5 ps-1.5">
                    {inst.name}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          aria-label={`מחק את המוסד ${inst.name}`}
                          className="rounded-full p-0.5 text-destructive transition-colors hover:bg-destructive/10 motion-reduce:transition-none"
                          disabled={deleteInstitutionMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>למחוק את המוסד {inst.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            כל שיוכי התפקידים למוסד יוסרו. חשבונות המלמדים והכיתות שלהם יישארו כפי
                            שהם. אם עדיין משויכות כיתות למוסד, יש לנתק אותן קודם.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>ביטול</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteInstitutionMutation.mutate(inst.id)}>
                            מחק מוסד
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </Badge>
                ))}
              </div>
              {institutionPages > 1 && (
                <div className="flex items-center justify-between gap-2 border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    עמוד {safePage} מתוך {institutionPages} · {matchedInstitutions.length} מוסדות
                  </span>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="העמוד הקודם"
                      disabled={safePage <= 1}
                      onClick={() => setInstitutionPage(safePage - 1)}
                    >
                      <ChevronRight className="h-4 w-4" /> הקודם
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="העמוד הבא"
                      disabled={safePage >= institutionPages}
                      onClick={() => setInstitutionPage(safePage + 1)}
                    >
                      הבא <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="new-institution">שם מוסד חדש</Label>
              <Input
                id="new-institution"
                className="mt-1.5"
                placeholder="לדוגמה: תלמוד תורה אור החיים"
                value={newInstitutionName}
                onChange={(e) => setNewInstitutionName(e.target.value)}
              />
            </div>
            <Button
              disabled={newInstitutionName.trim().length < 2 || createInstitutionMutation.isPending}
              onClick={() => createInstitutionMutation.mutate(newInstitutionName.trim())}
            >
              {createInstitutionMutation.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              <Plus className="me-2 h-4 w-4" /> צור מוסד
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5 text-primary" /> כיתות
          </CardTitle>
          <CardDescription>בחר מוסד כדי לראות את הכיתות המשויכות אליו.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">איך משייכים כיתות, מלמדים וספריות?</p>
            <ol className="mt-2 list-decimal space-y-1.5 pe-5 text-muted-foreground">
              <li>
                <span className="text-foreground">מלמד למוסד:</span> בכרטיס "הקצאת תפקיד" למטה — בוחרים משתמש,
                תפקיד "מלמד" ואת המוסד. זה השיוך היחיד שנדרש.
              </li>
              <li>
                <span className="text-foreground">כיתה למוסד:</span> אין צורך לשייך ידנית. כשמלמד פותח כיתה
                חדשה ב-<Link to="/classes" className="text-primary underline-offset-2 hover:underline">מסך הכיתות</Link>,
                הכיתה משויכת אוטומטית למוסד שבתפקיד שלו.
              </li>
              <li>
                <span className="text-foreground">ספרייה:</span> חומרי ההוראה ב-
                <Link to="/resources" className="text-primary underline-offset-2 hover:underline">ספריית חומרי הוראה</Link>{" "}
                שייכים למלמד, ומתחברים לכיתה כשמשבצים אותם בשיעור או בעלון השבועי.
              </li>
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              כיתה שלא מופיעה כאן נוצרה לפני שהמלמד קיבל תפקיד במוסד — הקצאת התפקיד ולאחריה פתיחת כיתה חדשה
              (או מעבר שנה) תשייך אותה.
            </p>
          </div>
          <div>
            <Label htmlFor="classes-institution-select">מוסד</Label>
            <Select value={classesInstitution} onValueChange={setClassesInstitution}>
              <SelectTrigger id="classes-institution-select" className="mt-1.5">
                <SelectValue placeholder="בחר מוסד" />
              </SelectTrigger>
              <SelectContent>
                {allInstitutions.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {classesInstitution === "" ? (
            <div className="py-4 text-center text-sm text-muted-foreground">לא נבחר מוסד.</div>
          ) : classesLoading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">טוען כיתות...</div>
          ) : classesError ? (
            <div className="py-4 text-center text-sm text-destructive">שליפת הכיתות נכשלה.</div>
          ) : (institutionClasses ?? []).length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              אין כיתות משויכות למוסד זה.
            </div>
          ) : (
            <div className="divide-y">
              {(institutionClasses ?? []).map((cls) => (
                <div key={cls.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium">{cls.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {cls.academicYear ? `שנת ${cls.academicYear} · ` : ""}
                      {cls.studentCount} תלמידים
                    </p>
                  </div>
                  <Badge variant="secondary">{cls.status === "active" ? "פעילה" : cls.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">הקצאת תפקיד</CardTitle>
          <CardDescription>בחר משתמש ותפקיד כדי להוסיף הרשאה.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="user-select">משתמש</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger id="user-select" className="mt-1.5">
                  <SelectValue placeholder="בחר משתמש" />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.displayName} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="role-select">תפקיד</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as Role)}>
                <SelectTrigger id="role-select" className="mt-1.5">
                  <SelectValue placeholder="בחר תפקיד" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="institution-select">
                מוסד {institutionRequired ? <span className="text-destructive">*</span> : "(אופציונלי)"}
              </Label>
              <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                <SelectTrigger
                  id="institution-select"
                  className="mt-1.5"
                  aria-invalid={institutionMissing}
                  aria-describedby={institutionMissing ? "institution-select-error" : undefined}
                >
                  <SelectValue placeholder="בחר מוסד" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_INSTITUTION}>ללא מוסד (מנהל מערכת)</SelectItem>
                  {(institutions ?? []).map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {institutionMissing && (
                <p id="institution-select-error" className="mt-1.5 text-xs text-destructive">
                  לתפקיד {ROLE_LABELS[selectedRole as Role]} חובה לבחור מוסד.
                </p>
              )}
            </div>
          </div>
          {selectedInstitution !== NO_INSTITUTION && (
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <Checkbox
                checked={autoAssignClasses}
                onCheckedChange={(v) => setAutoAssignClasses(!!v)}
                aria-label="שייך אוטומטית את הכיתות הקיימות של המלמד למוסד"
              />
              <span>
                שייך אוטומטית את הכיתות הקיימות של המלמד למוסד זה
                <span className="block text-xs text-muted-foreground">
                  כיתות בארכיון יידלגו. אפשר לנתק או לשייך מחדש בכל עת בטבלת שיוכי הכיתות במסך הכיתות.
                </span>
              </span>
            </label>
          )}
          <Button
            disabled={!selectedUser || !selectedRole || institutionMissing || assignMutation.isPending}
            onClick={handleAssign}
          >
            {assignMutation.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            <Plus className="me-2 h-4 w-4" /> הוסף תפקיד
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">רשימת משתמשים</CardTitle>
          <CardDescription>
            <div className="relative mt-2">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי אימייל או שם..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pe-4 ps-10"
              />
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="py-8 text-center text-muted-foreground">טוען משתמשים...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">לא נמצאו משתמשים.</div>
          ) : (
            <div className="divide-y">
              {filteredUsers.map((u) => (
                <div key={u.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{u.displayName || u.email}</p>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles.length === 0 ? (
                        <Badge variant="secondary">ללא תפקיד</Badge>
                      ) : (
                        u.roles.map((r) => (
                          <Badge key={r.id} variant={r.role === "admin" ? "default" : "secondary"} className="gap-1">
                            {ROLE_LABELS[r.role]}
                            <button
                              type="button"
                              aria-label={`הסר תפקיד ${ROLE_LABELS[r.role]}`}
                              disabled={removeMutation.isPending}
                              onClick={() => removeMutation.mutate(r.id)}
                              className="rounded-full p-0.5 hover:bg-primary/20 focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TrialApprovalsCard
        initialSearch={trialUser}
        highlightUser={focus === "trials" ? trialUser : undefined}
      />

      <AccessRequestsCard canResolve />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5 text-primary" /> יומן שינויים
          </CardTitle>
          <CardDescription>20 הפעולות האחרונות בניהול מוסדות ותפקידים.</CardDescription>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">טוען יומן...</div>
          ) : (auditLog ?? []).length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">אין רשומות ביומן.</div>
          ) : (
            <div className="divide-y">
              {(auditLog ?? []).map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">{entry.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString("he-IL")}
                    </p>
                  </div>
                  {entry.action && <Badge variant="secondary">{entry.action}</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
