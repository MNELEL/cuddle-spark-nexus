import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  listResourceVersions,
  restoreResourceVersion,
  VERSION_SOURCE_LABELS,
} from "@/lib/resource-versions.functions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function ResourceVersionHistory({ resourceId }: { resourceId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const list = useServerFn(listResourceVersions);
  const restore = useServerFn(restoreResourceVersion);

  const versionsQ = useQuery({
    queryKey: ["resource-versions", resourceId],
    queryFn: () => list({ data: { resource_id: resourceId } }),
    enabled: open,
  });

  const restoreMut = useMutation({
    mutationFn: (versionId: string) => restore({ data: { version_id: versionId } }),
    onSuccess: () => {
      toast.success("החומר שוחזר לגרסה שנבחרה");
      void qc.invalidateQueries({ queryKey: ["resource", resourceId] });
      void qc.invalidateQueries({ queryKey: ["resources"] });
      void versionsQ.refetch();
    },
    onError: () => toast.error("השחזור נכשל. נסה שוב."),
  });

  const versions = versionsQ.data ?? [];

  return (
    <Card className="print:hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-6 py-4 text-sm font-medium"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 text-lg font-bold">
          <History className="h-5 w-5 text-muted-foreground" />
          היסטוריית גרסאות
        </span>
        {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>
      {open && (
        <CardContent className="border-t py-5">
          {versionsQ.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> טוען גרסאות…
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              עדיין אין גרסאות קודמות. כל שמירה או עדכון של החומר יישמרו כאן אוטומטית.
            </p>
          ) : (
            <ul className="space-y-2">
              {versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3 text-sm">
                  <span className="font-medium">{formatDate(v.created_at)}</span>
                  <Badge variant="secondary">{VERSION_SOURCE_LABELS[v.source] ?? v.source}</Badge>
                  <span className="text-xs text-muted-foreground truncate max-w-[16rem]">
                    {v.snapshot?.title}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ms-auto"
                    disabled={restoreMut.isPending}
                    onClick={() => {
                      if (confirm("לשחזר את החומר לגרסה זו? המצב הנוכחי יישמר כגרסה נוספת.")) {
                        restoreMut.mutate(v.id);
                      }
                    }}
                  >
                    {restoreMut.isPending && restoreMut.variables === v.id
                      ? <Loader2 className="ms-1 h-4 w-4 animate-spin" />
                      : <RotateCcw className="ms-1 h-4 w-4" />}
                    שחזר
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}
