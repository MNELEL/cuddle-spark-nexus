import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CalendarClock, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { myTrialExtensionRequests, requestTrialExtension } from "@/lib/trial.functions";
import { hebrewDate } from "@/lib/hebrew-date";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return hebrewDate(iso);
}

type Props = {
  /** Button styling for the surface it sits on. */
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default";
  className?: string;
};

/**
 * Self-service trial extension: the user asks for more time, an admin approves in one click.
 * Renders a pending/approved status pill instead of the button when a request already exists.
 */
export function TrialExtensionRequestButton({ variant = "default", size = "default", className }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [institution, setInstitution] = useState("");
  const [message, setMessage] = useState("");

  const listFn = useServerFn(myTrialExtensionRequests);
  const submitFn = useServerFn(requestTrialExtension);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["my-trial-requests"],
    queryFn: () => listFn(),
    staleTime: 60_000,
  });

  const latest = requests?.[0];
  const pending = requests?.find((r) => r.status === "pending");

  const mutation = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          institution_name: institution.trim() || undefined,
          message: message.trim() || undefined,
          requested_days: 30,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message);
        setOpen(false);
        setMessage("");
      } else {
        toast.info(res.message);
      }
      qc.invalidateQueries({ queryKey: ["my-trial-requests"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "שליחת הבקשה נכשלה, נסה שוב"),
  });

  if (isLoading) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <Loader2 className="me-1 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        טוען...
      </Button>
    );
  }

  if (pending) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-3 py-1.5 text-xs font-medium ${className ?? ""}`}
      >
        <Clock className="h-3.5 w-3.5 text-amber" aria-hidden="true" />
        הבקשה נשלחה ({fmt(pending.created_at)}) — ממתינה לאישור מנהל
      </span>
    );
  }

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <CalendarClock className="me-1 h-4 w-4" aria-hidden="true" /> בקשת הארכה
      </Button>

      {latest?.status === "rejected" && (
        <p className="mt-2 text-xs text-muted-foreground">
          הבקשה הקודמת נדחתה{latest.review_note ? `: ${latest.review_note}` : ""}. אפשר לשלוח בקשה חדשה.
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader className="text-right">
            <DialogTitle>בקשת הארכת גישה</DialogTitle>
            <DialogDescription>
              הבקשה נשלחת למנהל המערכת, שמאשר אותה בלחיצה אחת. אין צורך במייל או בטלפון.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="trial-req-institution">שם המוסד (רשות)</Label>
              <Input
                id="trial-req-institution"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="תלמוד תורה / חיידר"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trial-req-message">סיבה או הערה (רשות)</Label>
              <Textarea
                id="trial-req-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="למשל: אנחנו בעיצומה של השנה ורוצים להמשיך עם הכיתות שכבר הוקמו"
                maxLength={500}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="me-1 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : null}
              שליחת הבקשה
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
