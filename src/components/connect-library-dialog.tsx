import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";

import { connectClassLibrary, listClassLibraryTargets } from "@/lib/class-assignments.functions";
import { listResources } from "@/lib/teaching-resources.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LibraryLinkExplanation } from "@/components/library-link-info";

type Target = "lesson" | "bulletin";

/** "חבר ספרייה עכשיו" — picks a resource + a lesson/bulletin and links them. */
export function ConnectLibraryDialog({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Target>("lesson");
  const [targetId, setTargetId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const targetsFn = useServerFn(listClassLibraryTargets);
  const resourcesFn = useServerFn(listResources);
  const connectFn = useServerFn(connectClassLibrary);

  const { data: targets, isLoading: loadingTargets } = useQuery({
    queryKey: ["class-library-targets", classId],
    queryFn: () => targetsFn({ data: { classId } }),
    enabled: open,
  });

  const { data: resources = [], isLoading: loadingResources } = useQuery({
    queryKey: ["library-resources-for-connect"],
    queryFn: () => resourcesFn({ data: {} }),
    enabled: open,
  });

  const options = target === "lesson" ? targets?.lessons ?? [] : targets?.bulletins ?? [];

  const connectM = useMutation({
    mutationFn: () => connectFn({ data: { classId, resourceId, target, targetId } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["class-library-link", classId] });
      qc.invalidateQueries({ queryKey: ["class-assignments"] });
      qc.invalidateQueries({ queryKey: ["class-library-targets", classId] });
      toast.success(res.message);
      setOpen(false);
      setTargetId("");
      setResourceId("");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "הפעולה נכשלה"),
  });

  const submit = () => {
    setError(null);
    if (!resourceId) { setError("בחר חומר הוראה מהספרייה"); return; }
    if (!targetId) {
      setError(target === "lesson" ? "בחר שיעור לחיבור" : "בחר עלון לחיבור");
      return;
    }
    connectM.mutate();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-xl">
          <Link2 className="ms-1 h-4 w-4" aria-hidden="true" /> חבר ספרייה עכשיו
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>חבר ספרייה לכיתה</DialogTitle>
          <DialogDescription>
            בחר חומר הוראה מהספרייה, ואת השיעור או העלון שאליו הוא יחובר. החיבור נבדק מול הכיתה לפני השמירה.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border bg-muted/30 p-3">
          <LibraryLinkExplanation classId={classId} />
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="connect-target-kind">חבר דרך</Label>
            <select
              id="connect-target-kind"
              value={target}
              onChange={(e) => { setTarget(e.target.value as Target); setTargetId(""); setError(null); }}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="lesson">שיעור במערכת השבועית</option>
              <option value="bulletin">עלון שבועי</option>
            </select>
          </div>

          <div>
            <Label htmlFor="connect-target">{target === "lesson" ? "שיעור" : "עלון"}</Label>
            <select
              id="connect-target"
              value={targetId}
              onChange={(e) => { setTargetId(e.target.value); setError(null); }}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{loadingTargets ? "טוען…" : "בחר…"}</option>
              {options.map((o) =>
                "weekStart" in o ? (
                  <option key={o.id} value={o.id}>
                    {o.title} · {o.weekStart}{o.linked ? " (כבר מחובר)" : ""}
                  </option>
                ) : (
                  <option key={o.id} value={o.id}>{o.title} · {o.startDate}</option>
                ),
              )}
            </select>
            {!loadingTargets && options.length === 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                {target === "lesson"
                  ? "אין שיעורים בכיתה — צור שיעור במערכת השבועית ואז חזור לכאן."
                  : "אין עלונים בכיתה — צור עלון שבועי ואז חזור לכאן."}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="connect-resource">חומר הוראה מהספרייה</Label>
            <select
              id="connect-resource"
              value={resourceId}
              onChange={(e) => { setResourceId(e.target.value); setError(null); }}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{loadingResources ? "טוען…" : "בחר…"}</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>{r.title}</option>
              ))}
            </select>
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          <Button onClick={submit} disabled={connectM.isPending}>
            {connectM.isPending && <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden="true" />}
            השלם חיבור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}