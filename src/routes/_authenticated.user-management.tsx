import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { ShieldCheck, Loader2, ArrowLeft, Trash2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import {
  isAdmin,
  listUsersWithRoles,
  assignRole,
  removeRole,
  bootstrapFirstAdmin,
  type Role,
} from "@/lib/user-roles.functions";

const ROLE_LABELS: Record<Role, string> = {
  admin: "מנהל מערכת",
  principal: "מנהל מוסד",
  teacher: "מלמד",
  secretary: "מזכירה",
};

const ROLE_OPTIONS: Role[] = ["teacher", "secretary", "principal", "admin"];

export const Route = createFileRoute("/_authenticated/user-management")({
  component: UserManagementPage,
  head: () => ({
    meta: [
      { title: "ניהול משתמשים ותפקידים · הכיתה שלי" },
      { name: "description", content: "ניהול הרשאות מוסדיות: מנהלים, מנהלי מוסדות, מלמדים ומזכירות." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function UserManagementPage() {
  const checkAdmin = useServerFn(isAdmin);
  const listUsers = useServerFn(listUsersWithRoles);
  const assignRoleFn = useServerFn(assignRole);
  const removeRoleFn = useServerFn(removeRole);
  const bootstrapFn = useServerFn(bootstrapFirstAdmin);
  const queryClient = useQueryClient();

  const { data: isAdminUser, isLoading: isAdminLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdmin(),
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: () => listUsers(),
    enabled: isAdminUser === true,
  });

  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | "">("");
  const [selectedRole, setSelectedRole] = useState<Role | "">("");

  const assignMutation = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: Role }) => {
      return await assignRoleFn({ data: { user_id, role } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      setSelectedRole("");
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
      toast.success("תפקיד הוסר");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "ההסרה נכשלה");
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

  if (!isAdminUser) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md text-center">
          <CardContent className="py-10">
            <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">גישה מוגבלת</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              דף זה זמין רק למנהלי מערכת. אם נדרשת גישה, פנה למנהל המוסד.
            </p>
            <Link to="/classes" className="mt-4 inline-block text-primary hover:underline">
              <ArrowLeft className="me-1 inline h-4 w-4" /> חזרה לכיתות
            </Link>
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
          </div>
          <Button
            disabled={!selectedUser || !selectedRole || assignMutation.isPending}
            onClick={() => assignMutation.mutate({ user_id: selectedUser, role: selectedRole as Role })}
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
    </div>
  );
}
