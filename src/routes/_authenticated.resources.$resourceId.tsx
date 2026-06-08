import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Printer, Trash2, Loader2, Library, Sparkles, Tag, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getResource, deleteResource, logResourceUsage,
  RESOURCE_TYPE_LABELS,
} from "@/lib/teaching-resources.functions";
import { listClasses } from "@/lib/classes.functions";

export const Route = createFileRoute("/_authenticated/resources/$resourceId")({
  component: ResourceDetailPage,
});

function ResourceDetailPage() {
  const { resourceId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getR = useServerFn(getResource);
  const delR = useServerFn(deleteResource);
  const logUsage = useServerFn(logResourceUsage);
  const listCls = useServerFn(listClasses);

  const { data: resource, isLoading } = useQuery({
    queryKey: ["teaching-resource", resourceId],
    queryFn: () => getR({ data: { id: resourceId } }),
  });
  const { data: classes = [] } = useQuery({
    queryKey: ["classes"], queryFn: () => listCls(),
  });

  const [submitClassId, setSubmitClassId] = useState<string>("");

  const deleteMut = useMutation({
    mutationFn: () => delR({ data: { id: resourceId, file_path: resource?.file_path ?? null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teaching-resources"] });
      toast.success("נמחק");
      navigate({ to: "/resources" });
    },
  });

  const submitMut = useMutation({
    mutationFn: (classId: string) =>
      logUsage({ data: { resource_id: resourceId, class_id: classId, notes: "" } }),
    onSuccess: () => toast.success("נרשם שימוש בחומר עבור הכיתה"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" /> טוען...
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <p className="text-muted-foreground mb-4">החומר לא נמצא</p>
        <Button asChild variant="outline"><Link to="/resources">חזרה לספרייה</Link></Button>
      </div>
    );
  }

  const c = resource.content ?? {};

  return (
    <div className="mx-auto max-w-4xl space-y-5 print:max-w-none">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to="/resources">
            <ArrowRight className="ms-1 h-4 w-4" /> חזרה לספרייה
          </Link>
        </Button>
        <div className="ms-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="ms-1 h-4 w-4" /> הדפס
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => { if (confirm("למחוק את החומר?")) deleteMut.mutate(); }}
          >
            <Trash2 className="ms-1 h-4 w-4" /> מחק
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card bg-mesh p-6 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Library className="h-3.5 w-3.5" /> חומר הוראה
          {resource.ai_generated && (
            <span className="inline-flex items-center gap-1 text-amber"><Sparkles className="h-3 w-3" /> נוצר עם AI</span>
          )}
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{resource.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline">{RESOURCE_TYPE_LABELS[resource.resource_type] ?? resource.resource_type}</Badge>
          {resource.subject && <Badge variant="secondary">{resource.subject}</Badge>}
          {resource.grade_level && <Badge variant="secondary">כיתה {resource.grade_level}</Badge>}
        </div>
        {resource.description && (
          <p className="mt-3 text-sm text-muted-foreground">{resource.description}</p>
        )}
        {resource.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {resource.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-0.5 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <Tag className="h-3 w-3" /> {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {c.body && (
        <Card>
          <CardContent className="prose prose-sm max-w-none py-5 leading-relaxed whitespace-pre-wrap" dir="rtl">
            {c.body}
          </CardContent>
        </Card>
      )}

      {c.materials && c.materials.length > 0 && (
        <Card>
          <CardContent className="py-5">
            <h2 className="mb-2 font-display text-lg font-bold">חומרים נדרשים</h2>
            <ul className="list-disc pe-5 space-y-1 text-sm">
              {c.materials.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {c.steps && c.steps.length > 0 && (
        <Card>
          <CardContent className="py-5">
            <h2 className="mb-2 font-display text-lg font-bold">מהלך הפעילות</h2>
            <ol className="list-decimal pe-5 space-y-2 text-sm leading-relaxed">
              {c.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </CardContent>
        </Card>
      )}

      {c.questions && c.questions.length > 0 && (
        <Card>
          <CardContent className="py-5">
            <h2 className="mb-3 font-display text-lg font-bold">שאלות</h2>
            <ol className="space-y-3 pe-5 list-decimal text-sm leading-relaxed">
              {c.questions.map((q, i) => (
                <li key={i}>
                  <div className="font-medium">{q.q}</div>
                  {q.a && (
                    <div className="mt-1 rounded bg-muted/40 p-2 text-muted-foreground print:bg-transparent">
                      <span className="text-xs font-semibold">תשובה: </span>{q.a}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Card className="print:hidden">
        <CardContent className="py-5">
          <h2 className="mb-3 font-display text-lg font-bold">הגש לכיתה</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            רישום שימוש בחומר עבור כיתה — לטובת מעקב ודוחות.
          </p>
          <div className="flex flex-wrap gap-2">
            <Select value={submitClassId} onValueChange={setSubmitClassId}>
              <SelectTrigger className="w-60"><SelectValue placeholder="בחר כיתה…" /></SelectTrigger>
              <SelectContent>
                {classes.map((cl) => (
                  <SelectItem key={cl.id} value={cl.id}>{cl.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={!submitClassId || submitMut.isPending}
              onClick={() => submitMut.mutate(submitClassId)}
            >
              {submitMut.isPending ? <Loader2 className="ms-1 h-4 w-4 animate-spin" /> : <Send className="ms-1 h-4 w-4" />}
              הגש
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}