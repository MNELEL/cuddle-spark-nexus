import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSimilarResources } from "@/lib/library-extras.functions";
import { RESOURCE_TYPE_LABELS, type ResourceType } from "@/lib/teaching-resources.functions";

export function SimilarResources({ resourceId }: { resourceId: string }) {
  const fn = useServerFn(getSimilarResources);
  const { data = [], isLoading } = useQuery({
    queryKey: ["similar-resources", resourceId],
    queryFn: () => fn({ data: { id: resourceId, limit: 6 } }),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground print:hidden">
        <Loader2 className="h-3 w-3 animate-spin" /> מחפש חומרים דומים…
      </div>
    );
  }
  if (data.length === 0) return null;

  return (
    <Card className="print:hidden">
      <CardContent className="py-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber" />
          <h2 className="font-display text-lg font-bold">חומרים דומים בספרייה שלך</h2>
        </div>
        <ul className="space-y-2">
          {data.map((r) => (
            <li key={r.id}>
              <Link
                to="/resources/$resourceId"
                params={{ resourceId: r.id }}
                className="flex items-start justify-between gap-3 rounded-md border bg-card p-3 transition hover:border-amber/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.title}</div>
                  {r.summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.summary}</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      {RESOURCE_TYPE_LABELS[r.resource_type as ResourceType] ?? r.resource_type}
                    </Badge>
                    {r.subject && (
                      <Badge variant="secondary" className="text-[10px]">
                        {r.subject}
                      </Badge>
                    )}
                    {r.grade_level && (
                      <Badge variant="secondary" className="text-[10px]">
                        כיתה {r.grade_level}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      התאמה {Math.round(r.similarity * 100)}%
                    </Badge>
                  </div>
                </div>
                <ArrowLeft className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
