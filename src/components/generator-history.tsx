import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { History, Search, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  listGeneratorVersions, deleteGeneratorVersion,
  type GeneratorKind, type GeneratorVersion,
} from "@/lib/generator-versions.functions";

/** Version history for a generator: search, restore for editing, delete. */
export function GeneratorHistory({
  kind,
  activeVersionId,
  onRestore,
}: {
  kind: GeneratorKind;
  activeVersionId: string | null;
  onRestore: (version: GeneratorVersion) => void;
}) {
  const listFn = useServerFn(listGeneratorVersions);
  const deleteFn = useServerFn(deleteGeneratorVersion);
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");

  const { data: versions = [], isLoading } = useQuery<GeneratorVersion[]>({
    queryKey: ["generator-versions", kind, search],
    queryFn: () => listFn({ data: { kind, search } }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["generator-versions", kind] });
      toast.success("הגרסה נמחקה");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "המחיקה נכשלה"),
  });

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-5 w-5" aria-hidden /> היסטוריית גרסאות
          <Badge variant="secondary">{versions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => { e.preventDefault(); setSearch(term); }}
        >
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="חיפוש בגרסאות (כותרת או תוכן)…"
            aria-label="חיפוש בהיסטוריית הגרסאות"
          />
          <Button type="submit" variant="outline" aria-label="חפש בהיסטוריית הגרסאות">
            <Search className="h-4 w-4" aria-hidden />
          </Button>
        </form>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">טוען היסטוריה…</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search ? "לא נמצאו גרסאות התואמות לחיפוש." : "עדיין לא נשמרו גרסאות. כל הפקה נשמרת כאן אוטומטית."}
          </p>
        ) : (
          <ul className="divide-y rounded-md border" aria-live="polite">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-48 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    {v.title || "ללא כותרת"}
                    {activeVersionId === v.id && <Badge>בעריכה</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleString("he-IL")} · {v.body.length} תווים
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{v.body.slice(0, 180)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => { onRestore(v); toast.success("הגרסה נטענה לעריכה"); }}
                    aria-label={`חזור לגרסה ${v.title || "ללא כותרת"} לעריכה`}
                  >
                    <RotateCcw className="ms-1 h-4 w-4" aria-hidden /> חזור לגרסה
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="min-h-9 min-w-9"
                    onClick={() => delMut.mutate(v.id)}
                    disabled={delMut.isPending}
                    aria-label={`מחק את הגרסה ${v.title || "ללא כותרת"}`}
                  >
                    {delMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
