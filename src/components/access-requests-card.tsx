import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, Inbox, X } from "lucide-react";
import { toast } from "sonner";
import {
  listAccessRequests,
  resolveAccessRequest,
  approveAndAssignRole,
  canResolveAccessRequests,
} from "@/lib/access-requests.functions";
import { listInstitutions } from "@/lib/institutions.functions";
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

const NO_INSTITUTION = "__none__";

interface AccessRequest {
  id: string;
  user_id: string;
  email: string | null;
  requested_role: string;
  institution_name: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

/**
 * Review queue for access requests.
 * Only system admins may approve/deny; principals get a read-only view.
 * The prop is a hint only — the actual capability is verified server-side.
 */
export function AccessRequestsCard({ canResolve: canResolveHint }: { canResolve: boolean }) {
  const listFn = useServerFn(listAccessRequests);
  const resolveFn = useServerFn(resolveAccessRequest);
  const approveFn = useServerFn(approveAndAssignRole);
  const listInstitutionsFn = useServerFn(listInstitutions);
  const canResolveFn = useServerFn(canResolveAccessRequests);
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [denyDialogOpen, setDenyDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [role, setRole] = useState<Role>("teacher");
  const [institutionId, setInstitutionId] = useState<string>(NO_INSTITUTION);
  const [reviewNote, setReviewNote] = useState("");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["access-requests"],
    queryFn: () => listFn(),
  });

  const { data: capability } = useQuery({
    queryKey: ["can-resolve-access-requests"],
    queryFn: () => canResolveFn(),
  });

  // Admin-only: server-verified, and never wider than the caller's hint.
  const canResolve = canResolveHint && capability?.canResolve === true;

  const { data: institutions, isLoading: institutionsLoading } = useQuery({
    queryKey: ["institutions"],
    queryFn: () => listInstitutionsFn(),
    enabled: canResolve && dialogOpen,
  });

  const openApproveDialog = (req: AccessRequest) => {
    setSelectedRequest(req);
    setRole(req.requested_role as Role);
    setInstitutionId(NO_INSTITUTION);
    setReviewNote("");
    setDialogOpen(true);
  };

  const openDenyDialog = (req: AccessRequest) => {
    setSelectedRequest(req);
    setReviewNote("");
    setDenyDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDenyDialogOpen(false);
    setSelectedRequest(null);
    setReviewNote("");
  };

  const resolveMutation = useMutation({
    mutationFn: async (vars: {
      request_id: string;
      status: "approved" | "denied";
      review_note?: string;
    }) =>
      await resolveFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-log"] });
      toast.success("הבקשה עודכנה והמבקש יקבל הודעה עם סיכום ההחלטה");
      closeDialog();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "עדכון הבקשה נכשל"),
  });

  const approveMutation = useMutation({
    mutationFn: async (vars: {
      request_id: string;
      role: Role;
      institution_id?: string;
      review_note?: string;
    }) =>
      await approveFn({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["role-audit-log"] });
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      queryClient.invalidateQueries({ queryKey: ["institutions"] });
      toast.success("הבקשה אושרה, התפקיד שויך והמבקש יקבל הודעה עם סיכום ההחלטה");
      closeDialog();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "האישור נכשל"),
  });

  const handleApprove = () => {
    if (!selectedRequest) return;
    approveMutation.mutate({
      request_id: selectedRequest.id,
      role,
      institution_id: institutionId === NO_INSTITUTION ? undefined : institutionId,
      review_note: reviewNote.trim() || undefined,
    });
  };

  const requiresInstitution = role === "principal";
  const canSubmit =
    !approveMutation.isPending && (!requiresInstitution || institutionId !== NO_INSTITUTION);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Inbox className="h-5 w-5 text-primary" /> בקשות הרשאה
          </CardTitle>
          <CardDescription>
            {canResolve
              ? "אשר בקשות גישה ושייך את התפקיד המבוקש בקליק אחד. פעולה זו זמינה רק למנהל מערכת."
              : "תצוגה בלבד: הבקשות שהתקבלו. אישור או דחייה מתבצעים על ידי מנהל המערכת בלבד, במסך ניהול המשתמשים."}
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
                <div
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{req.email ?? req.user_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABELS[req.requested_role as Role]}
                      {req.institution_name ? ` · ${req.institution_name}` : ""} ·{" "}
                      {new Date(req.created_at).toLocaleString("he-IL")}
                    </p>
                    {req.message && (
                      <p className="mt-1 text-xs text-muted-foreground">{req.message}</p>
                    )}
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
                          onClick={() => openApproveDialog(req)}
                        >
                          <Check className="me-1 h-4 w-4" /> אישור ושיוך
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={resolveMutation.isPending}
                          onClick={() => openDenyDialog(req)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>אישור ושיוך תפקיד</DialogTitle>
            <DialogDescription>
              {selectedRequest
                ? `בקשה מ-${selectedRequest.email ?? selectedRequest.user_id} לתפקיד ${ROLE_LABELS[selectedRequest.requested_role as Role]}.`
                : "אישור בקשת גישה ושיוך התפקיד למשתמש."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="approve-role">תפקיד לשיוך</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger id="approve-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["teacher", "secretary", "principal", "admin"] as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {requiresInstitution && (
              <div className="grid gap-2">
                <Label htmlFor="approve-institution">מוסד</Label>
                <Select value={institutionId} onValueChange={setInstitutionId}>
                  <SelectTrigger id="approve-institution">
                    <SelectValue placeholder="בחר מוסד" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_INSTITUTION}>בחר מוסד</SelectItem>
                    {institutionsLoading ? (
                      <SelectItem value="__loading__" disabled>
                        טוען מוסדים...
                      </SelectItem>
                    ) : (
                      (institutions ?? []).map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          {inst.name}
                        </SelectItem>
                      )))
                    }
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  לתפקיד מנהל מוסד חובה לבחור מוסד. אם המוסד לא קיים, יש ליצור אותו קודם בעמוד זה.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="approve-note">הערה למבקש (אופציונלי)</Label>
              <Textarea
                id="approve-note"
                rows={2}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="תוצג למבקש יחד עם סיכום ההחלטה"
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row-reverse">
            <Button
              onClick={handleApprove}
              disabled={!canSubmit}
              className="w-full sm:w-auto"
            >
              {approveMutation.isPending ? (
                <span className="animate-pulse">מאשר...</span>
              ) : (
                <>
                  <Check className="me-1 h-4 w-4" /> אשר ושייך
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={closeDialog}
              disabled={approveMutation.isPending}
              className="w-full sm:w-auto"
            >
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={denyDialogOpen} onOpenChange={(o) => (o ? setDenyDialogOpen(true) : closeDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>דחיית בקשת גישה</DialogTitle>
            <DialogDescription>
              {selectedRequest
                ? `בקשה מ-${selectedRequest.email ?? selectedRequest.user_id} לתפקיד ${ROLE_LABELS[selectedRequest.requested_role as Role]}. המבקש יקבל הודעה עם סיכום ההחלטה.`
                : "דחיית בקשת גישה."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Label htmlFor="deny-note">הערה למבקש (אופציונלי)</Label>
            <Textarea
              id="deny-note"
              rows={2}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="סיבת הדחייה או הנחיה להמשך"
            />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row-reverse">
            <Button
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={resolveMutation.isPending || !selectedRequest}
              onClick={() =>
                selectedRequest &&
                resolveMutation.mutate({
                  request_id: selectedRequest.id,
                  status: "denied",
                  review_note: reviewNote.trim() || undefined,
                })
              }
            >
              <X className="me-1 h-4 w-4" /> דחה בקשה
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={closeDialog}
              disabled={resolveMutation.isPending}
            >
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
