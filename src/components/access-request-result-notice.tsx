import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { acknowledgeAccessRequestResult } from "@/lib/access-requests.functions";
import type { Role } from "@/lib/user-roles.functions";

const ROLE_LABELS: Record<string, string> = {
  admin: "מנהל מערכת",
  principal: "מנהל מוסד",
  teacher: "מלמד",
  secretary: "מזכירה",
};

export interface AccessRequestResult {
  id: string;
  status: string;
  requested_role: string;
  granted_role?: string | null;
  granted_institution_name?: string | null;
  review_note?: string | null;
  reviewed_at?: string | null;
}

/** Short result summary shown to the requester after an admin approved or denied. */
export function AccessRequestResultNotice({ request }: { request: AccessRequestResult }) {
  const ackFn = useServerFn(acknowledgeAccessRequestResult);
  const queryClient = useQueryClient();
  const approved = request.status === "approved";
  const role = (request.granted_role ?? request.requested_role) as Role;
  const date = request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString("he-IL") : null;

  const ack = useMutation({
    mutationFn: async () => await ackFn({ data: { request_id: request.id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-access-requests"] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "סימון ההודעה נכשל"),
  });

  return (
    <div
      role="status"
      className={`rounded-md border p-3 text-sm ${
        approved ? "border-primary/40 bg-primary/10" : "border-destructive/40 bg-destructive/10"
      }`}
    >
      <div className="flex items-start gap-2">
        {approved ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        ) : (
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        )}
        <div className="min-w-0 space-y-1">
          <p className="font-medium">
            {approved
              ? `בקשתך אושרה — שויך לך התפקיד ${ROLE_LABELS[role] ?? role}`
              : `בקשתך נדחתה. התפקיד המבוקש: ${ROLE_LABELS[request.requested_role] ?? request.requested_role}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {approved && request.granted_institution_name
              ? `מוסד: ${request.granted_institution_name}`
              : null}
            {approved && request.granted_institution_name && date ? " · " : null}
            {date ? `תאריך: ${date}` : null}
          </p>
          {request.review_note && (
            <p className="text-xs text-muted-foreground">הערת המנהל: {request.review_note}</p>
          )}
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="outline" disabled={ack.isPending} onClick={() => ack.mutate()}>
          הבנתי
        </Button>
      </div>
    </div>
  );
}