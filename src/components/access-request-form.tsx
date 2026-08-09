import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send, Info } from "lucide-react";
import { toast } from "sonner";
import { submitAccessRequest, myAccessRequests } from "@/lib/access-requests.functions";
import type { Role } from "@/lib/user-roles.functions";


const ROLE_LABELS: Record<Role, string> = {
  admin: "מנהל מערכת",
  principal: "מנהל מוסד",
  teacher: "מלמד",
  secretary: "מזכירה",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "ממתינה לטיפול",
  approved: "אושרה",
  denied: "נדחתה",
};

/** Short in-app form letting any signed-in user request elevated access. */
export function AccessRequestForm() {
  const submitFn = useServerFn(submitAccessRequest);
  const listMineFn = useServerFn(myAccessRequests);
  const queryClient = useQueryClient();

  const [role, setRole] = useState<Role>("principal");
  const [institutionName, setInstitutionName] = useState("");
  const [message, setMessage] = useState("");

  const { data: mine } = useQuery({
    queryKey: ["my-access-requests"],
    queryFn: () => listMineFn(),
  });

  const submitMutation = useMutation({
    mutationFn: async () =>
      await submitFn({
        data: {
          requested_role: role,
          institution_name: institutionName.trim() || undefined,
          message: message.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message);
        setMessage("");
      } else {
        toast.info(res.message);
      }
      queryClient.invalidateQueries({ queryKey: ["my-access-requests"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "שליחת הבקשה נכשלה"),
  });

  const latest = (mine ?? [])[0];
  const hasPending = latest?.status === "pending";

  return (
    <div className="space-y-4 text-start">
      {latest && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          הבקשה האחרונה שלך ({ROLE_LABELS[latest.requested_role as Role]}):{" "}
          <Badge variant={latest.status === "approved" ? "default" : "secondary"}>
            {STATUS_LABELS[latest.status] ?? latest.status}
          </Badge>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="access-role">התפקיד המבוקש</Label>
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger id="access-role"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(["teacher", "secretary", "principal", "admin"] as Role[]).map((r) => (
              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="access-institution">שם המוסד (אופציונלי)</Label>
        <Input
          id="access-institution"
          value={institutionName}
          onChange={(e) => setInstitutionName(e.target.value)}
          placeholder="לדוגמה: תלמוד תורה אור החיים"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="access-message">הערה למנהל (אופציונלי)</Label>
        <Textarea
          id="access-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="ספר בקצרה למה נדרשת הגישה"
        />
      </div>

      <Button
        className="w-full"
        disabled={submitMutation.isPending || hasPending}
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? (
          <Loader2 className="me-2 h-4 w-4 animate-spin" />
        ) : (
          <Send className="me-2 h-4 w-4" />
        )}
        {hasPending ? "הבקשה שלך ממתינה לטיפול" : "בקשת גישה בלחיצה"}
      </Button>
    </div>
  );
}
