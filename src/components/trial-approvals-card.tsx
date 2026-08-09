import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BadgeCheck, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { listUserTrials, extendUserTrial } from "@/lib/trial.functions";

function fmt(iso: string | null) {
  if (!iso) return "לא הוגדר";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
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
