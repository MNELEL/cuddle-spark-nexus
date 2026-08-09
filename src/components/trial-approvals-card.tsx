import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BadgeCheck, Inbox, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  listUserTrials,
  extendUserTrial,
  listPendingTrialRequests,
  reviewTrialRequest,
} from "@/lib/trial.functions";

function fmt(iso: string | null) {
  if (!iso) return "לא הוגדר";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

/** Matches a row against a focus token (user id or email). */
function isFocused(token: string | undefined, row: { userId: string; email: string | null }) {
  if (!token) return false;
  const t = token.toLowerCase();
  return row.userId.toLowerCase() === t || (row.email ?? "").toLowerCase() === t;
}

/** Pending self-service extension requests: approve (and extend) or reject in one click. */
function PendingTrialRequests({ highlightUser }: { highlightUser?: string }) {
  const qc = useQueryClient();
  const listPending = useServerFn(listPendingTrialRequests);
  const review = useServerFn(reviewTrialRequest);
  const [busyId, setBusyId] = useState<string | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pending-trial-requests"],
    queryFn: () => listPending(),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (v: { requestId: string; decision: "approve" | "reject"; days?: number }) =>
      review({ data: v }),
    onSuccess: (_res, v) => {
      toast.success(v.decision === "approve" ? "הבקשה אושרה והגישה הוארכה" : "הבקשה נדחתה");
      qc.invalidateQueries({ queryKey: ["pending-trial-requests"] });
      qc.invalidateQueries({ queryKey: ["admin-user-trials"] });
      qc.invalidateQueries({ queryKey: ["my-trial-status"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "עדכון הבקשה נכשל"),
    onSettled: () => setBusyId(null),
  });

  function act(requestId: string, decision: "approve" | "reject", days?: number) {
    setBusyId(requestId);
    mutation.mutate({ requestId, decision, days });
  }

  if (isError) return null;

  const rows = data ?? [];

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (highlightUser && focusRef.current) {
      focusRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [highlightUser, rows.length]);

  return (
    <div className="mb-6 rounded-lg border border-amber/40 bg-amber/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Inbox className="h-4 w-4 text-amber" aria-hidden="true" />
        <h3 className="font-display text-sm font-semibold">בקשות הארכה ממתינות</h3>
        {rows.length > 0 && <Badge variant="destructive">{rows.length}</Badge>}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">טוען בקשות...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין בקשות ממתינות.</p>
      ) : (
        <div className="divide-y divide-amber/20">
          {rows.map((r) => {
            const busy = busyId === r.id && mutation.isPending;
            const focused = isFocused(highlightUser, r);
            return (
              <div
                key={r.id}
                ref={focused ? focusRef : undefined}
                className={`flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 ${
                  focused ? "rounded-lg bg-amber/10 px-3 ring-2 ring-amber" : ""
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{r.displayName || r.email}</p>
                  <p className="truncate text-sm text-muted-foreground">{r.email}</p>
                  {r.institutionName && <p className="text-xs text-muted-foreground">מוסד: {r.institutionName}</p>}
                  {r.message && <p className="max-w-prose text-xs">{r.message}</p>}
                  <p className="text-xs text-muted-foreground">
                    נשלחה: {fmt(r.createdAt)} · בתוקף עד: {fmt(r.endsAt)}
                    {r.active ? ` · נותרו ${r.daysLeft} ימים` : " · אינו פעיל"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act(r.id, "approve", 30)}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "אישור +30 יום"}
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => act(r.id, "approve", 365)}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "אישור לשנה"}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(r.id, "reject")}>
                    דחייה
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Admin-only card: approve or extend users' access in one click. */
export function TrialApprovalsCard() {
  const qc = useQueryClient();
  const list = useServerFn(listUserTrials);
  const extend = useServerFn(extendUserTrial);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-trials"],
    queryFn: () => list(),
  });

  const mutation = useMutation({
    mutationFn: (v: { userId: string; days: number }) => extend({ data: v }),
    onSuccess: () => {
      toast.success("האישור עודכן בהצלחה");
      qc.invalidateQueries({ queryKey: ["admin-user-trials"] });
      qc.invalidateQueries({ queryKey: ["my-trial-status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "עדכון האישור נכשל"),
    onSettled: () => setPendingId(null),
  });

  const rows = (data ?? []).filter(
    (r) =>
      r.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.displayName.toLowerCase().includes(search.toLowerCase())
  );

  function approve(userId: string, days: number) {
    setPendingId(userId);
    mutation.mutate({ userId, days });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BadgeCheck className="h-5 w-5 text-amber" /> אישורי מנוי ותקופות ניסיון
        </CardTitle>
        <CardDescription>
          אישור בלחיצה אחת: הארכת הגישה של משתמש ב-30 יום או אישור לשנה שלמה.
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
        <PendingTrialRequests />
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">טוען מצב מנויים...</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">לא נמצאו משתמשים.</div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => {
              const busy = pendingId === r.userId && mutation.isPending;
              return (
                <div key={r.userId} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.displayName || r.email}</p>
                    <p className="truncate text-sm text-muted-foreground">{r.email}</p>
                    <p className="text-xs text-muted-foreground">בתוקף עד: {fmt(r.endsAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.active ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">פעיל · {r.daysLeft} ימים</Badge>
                    ) : (
                      <Badge variant="destructive">אינו פעיל</Badge>
                    )}
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => approve(r.userId, 30)}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "+30 יום"}
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => approve(r.userId, 365)}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "אישור לשנה"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
