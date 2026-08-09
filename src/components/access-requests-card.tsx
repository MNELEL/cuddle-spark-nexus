import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Inbox, X } from "lucide-react";
import { toast } from "sonner";
import { listAccessRequests, resolveAccessRequest } from "@/lib/access-requests.functions";
import type { Role } from "@/lib/user-roles.functions";

const ROLE_LABELS: Record<Role, string> = {
  admin: "מנהל מערכת",
  principal: "מנהל מוסד",
  teacher: "מלמד",
  secretary: "מזכירה",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתינה",
  approved: "אושרה",
  denied: "נדחתה",
};

/** Review queue for access requests. Approving/denying is admin-only. */
export function AccessRequestsCard({ canResolve }: { canResolve: boolean }) {
  const listFn = useServerFn(listAccessRequests);
  const resolveFn = useServerFn(resolveAccessRequest);
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["access-requests"],
    queryFn: () => listFn(),
  });

  const resolveMutation = useMutation({
    mutationFn: async (vars: { request_id: string; status: "approved" | "denied" }) =>
      await resolveFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-log"] });
      toast.success("הבקשה עודכנה");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "עדכון הבקשה נכשל"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Inbox className="h-5 w-5 text-primary" /> בקשות הרשאה
        </CardTitle>
        <CardDescription>
          {canResolve
            ? "אישור או דחייה של בקשות גישה שנשלחו מהמשתמשים."
            : "בקשות הגישה שהתקבלו. האישור מתבצע על ידי מנהל המערכת."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">טוען בקשות...</div>
        ) : (requests ?? []).length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">אין בקשות הרשאה.</div>
        ) : (
          <div className="divide-y">
            {(requests ?? []).map((req) => (
              <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{req.email ?? req.user_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[req.requested_role as Role]}
                    {req.institution_name ? ` · ${req.institution_name}` : ""} ·{" "}
                    {new Date(req.created_at).toLocaleString("he-IL")}
                  </p>
                  {req.message && <p className="mt-1 text-xs text-muted-foreground">{req.message}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={req.status === "pending" ? "secondary" : "default"}>
                    {STATUS_LABELS[req.status] ?? req.status}
                  </Badge>
                  {canResolve && req.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        disabled={resolveMutation.isPending}
                        onClick={() => resolveMutation.mutate({ request_id: req.id, status: "approved" })}
                      >
                        <Check className="me-1 h-4 w-4" /> אישור
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolveMutation.isPending}
                        onClick={() => resolveMutation.mutate({ request_id: req.id, status: "denied" })}
                      >
                        <X className="me-1 h-4 w-4" /> דחייה
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
