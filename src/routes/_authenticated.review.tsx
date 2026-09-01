import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, Check, ClipboardCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  listPendingUpdates,
  approvePendingUpdate,
  rejectPendingUpdate,
  type PendingUpdateItem,
} from "@/lib/pending-updates.functions";

export const Route = createFileRoute("/_authenticated/review")({
  component: ReviewPage,
  head: () => ({
    meta: [
      { title: "ממתין לאישור · הכיתה שלי" },
      { name: "description", content: "תור אירועים חריגים שממתינים לבדיקת הרב לפני שהם נרשמים בתיק התלמיד." },
      { property: "og:title", content: "ממתין לאישור · הכיתה שלי" },
      { property: "og:description", content: "אישור או דחייה של אירועים חריגים שהעוזר החכם הכין." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const SEVERITY_HE: Record<string, string> = { low: "קלה", medium: "בינונית", high: "חמורה" };

function ReviewPage() {
  const fetchList = useServerFn(listPendingUpdates);
  const runApprove = useServerFn(approvePendingUpdate);
  const runReject = useServerFn(rejectPendingUpdate);
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState<Record<string, boolean>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pending-updates"],
    queryFn: () => fetchList(),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["pending-updates"] });
  };

  const approveMut = useMutation({
    mutationFn: (id: string) =>
      runApprove({ data: { id, ...(notes[id] ? { reviewNotes: notes[id] } : {}) } }),
    onSuccess: () => {
      invalidate();
      toast.success("האירוע אושר ונרשם בתיק התלמיד");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "האישור נכשל"),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) =>
      runReject({ data: { id, ...(notes[id] ? { reviewNotes: notes[id] } : {}) } }),
    onSuccess: () => {
      invalidate();
      toast.success("הפריט נדחה ולא נרשם");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "הדחייה נכשלה"),
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="font-display text-2xl font-bold">ממתין לאישור</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          תור אירועים חריגים שהעוזר החכם הכין. כל אירוע ממתין כאן לבדיקה שלך —
          הוא נרשם בתיק התלמיד רק לאחר אישור.
        </p>
      </div>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">טוען פריטים…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ClipboardCheck className="h-8 w-8 text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">אין פריטים הממתינים לאישור</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id}>
              <PendingCard
                item={item}
                note={notes[item.id] ?? ""}
                onNoteChange={(v) => setNotes((p) => ({ ...p, [item.id]: v }))}
                rejectOpen={Boolean(rejectOpen[item.id])}
                onToggleReject={() =>
                  setRejectOpen((p) => ({ ...p, [item.id]: !p[item.id] }))
                }
                onApprove={() => approveMut.mutate(item.id)}
                onReject={() => rejectMut.mutate(item.id)}
                busy={approveMut.isPending || rejectMut.isPending}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PendingCard({
  item, note, onNoteChange, rejectOpen, onToggleReject, onApprove, onReject, busy,
}: {
  item: PendingUpdateItem;
  note: string;
  onNoteChange: (v: string) => void;
  rejectOpen: boolean;
  onToggleReject: () => void;
  onApprove: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  const severity = String(item.payload.severity ?? "");
  const category = String(item.payload.category ?? "");
  const description = String(item.payload.description ?? "");
  const date = String(item.payload.date ?? "");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
          <span className="min-w-0">{item.summary}</span>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
          {item.student_name && <Badge variant="secondary">{item.student_name}</Badge>}
          {item.class_name && <Badge variant="outline">{item.class_name}</Badge>}
          <span>נוצר: {new Date(item.created_at).toLocaleString("he-IL")}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid gap-2 rounded-md bg-muted/50 p-3 text-sm sm:grid-cols-2">
          {severity && (
            <div>
              <dt className="text-xs text-muted-foreground">חומרה</dt>
              <dd className="font-medium">{SEVERITY_HE[severity] ?? severity}</dd>
            </div>
          )}
          {category && (
            <div>
              <dt className="text-xs text-muted-foreground">קטגוריה</dt>
              <dd className="font-medium">{category}</dd>
            </div>
          )}
          {date && (
            <div>
              <dt className="text-xs text-muted-foreground">תאריך האירוע</dt>
              <dd className="font-medium">{date}</dd>
            </div>
          )}
          {description && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">תיאור</dt>
              <dd className="whitespace-pre-line leading-relaxed">{description}</dd>
            </div>
          )}
        </dl>

        {rejectOpen && (
          <div className="space-y-1">
            <label htmlFor={`note-${item.id}`} className="text-xs text-muted-foreground">
              הערה לדחייה (אופציונלי)
            </label>
            <Textarea
              id={`note-${item.id}`}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="למה הפריט נדחה?"
              rows={2}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onApprove}
            disabled={busy}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Check className="ms-2 h-4 w-4" aria-hidden />
            אשר
          </Button>
          {rejectOpen ? (
            <Button variant="destructive" onClick={onReject} disabled={busy}>
              <X className="ms-2 h-4 w-4" aria-hidden />
              אישור דחייה
            </Button>
          ) : (
            <Button variant="outline" onClick={onToggleReject} disabled={busy}>
              <X className="ms-2 h-4 w-4" aria-hidden />
              דחה
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
