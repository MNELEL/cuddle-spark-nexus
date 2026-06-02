import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, Plus, Trash2, Copy, Eye, EyeOff, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getClass } from "@/lib/classes.functions";
import { listStudents } from "@/lib/students.functions";
import { listParentTokens, createParentToken, revokeParentToken, deleteParentToken } from "@/lib/parents.functions";

export const Route = createFileRoute("/_authenticated/parents/$classId")({
  component: ParentsAdmin,
});

type Token = { id: string; class_id: string; student_id: string | null; token: string; label: string; revoked: boolean; created_at: string };

function ParentsAdmin() {
  const { classId } = Route.useParams();
  const getC = useServerFn(getClass);
  const listS = useServerFn(listStudents);
  const list = useServerFn(listParentTokens);
  const create = useServerFn(createParentToken);
  const revoke = useServerFn(revokeParentToken);
  const remove = useServerFn(deleteParentToken);
  const qc = useQueryClient();

  const { data: cls } = useQuery({ queryKey: ["class", classId], queryFn: () => getC({ data: { id: classId } }) });
  const { data: students = [] } = useQuery({ queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }) });
  const { data: tokens = [] } = useQuery({ queryKey: ["parent-tokens", classId], queryFn: () => list({ data: { classId } }) });

  const [studentId, setStudentId] = useState<string>("__class__");
  const [label, setLabel] = useState("");

  const createM = useMutation({
    mutationFn: () => create({ data: { classId, studentId: studentId === "__class__" ? null : studentId, label } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parent-tokens", classId] });
      setLabel(""); setStudentId("__class__");
      toast.success("הקישור נוצר");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });
  const revokeM = useMutation({
    mutationFn: (v: { id: string; revoked: boolean }) => revoke({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parent-tokens", classId] }),
  });
  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["parent-tokens", classId] }); toast.success("נמחק"); },
  });

  const nameOf = (id: string | null) =>
    id ? (students as { id: string; name: string }[]).find((s) => s.id === id)?.name ?? "?" : "כל הכיתה";

  const buildUrl = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/p/${token}` : `/p/${token}`;

  async function copyLink(token: string) {
    try { await navigator.clipboard.writeText(buildUrl(token)); toast.success("הועתק"); }
    catch { toast.error("ההעתקה נכשלה"); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
      </div>

      <div className="rounded-2xl border bg-card bg-mesh p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber/15 p-3"><Users className="h-6 w-6 text-amber" /></div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">פורטל הורים — {cls?.name ?? "..."}</h1>
            <p className="text-sm text-muted-foreground">צרו קישור צפייה בלבד לכל הורה. ההורה לא צריך משתמש.</p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>תלמיד</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__class__">כל הכיתה (עלונים בלבד)</SelectItem>
                  {(students as { id: string; name: string }[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>תווית (לשימוש פנימי)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="הורי משפחת כהן" />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={() => createM.mutate()} disabled={createM.isPending}>
                <Plus className="ms-1 h-4 w-4" /> צור קישור
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {tokens.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">עדיין אין קישורים פעילים.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {(tokens as Token[]).map((t) => (
            <Card key={t.id} className={t.revoked ? "opacity-60" : ""}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{nameOf(t.student_id)}</span>
                      {t.label && <Badge variant="secondary">{t.label}</Badge>}
                      {t.revoked && <Badge variant="outline">מושבת</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground font-mono-tabular truncate" dir="ltr">
                      /p/{t.token}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => copyLink(t.token)} title="העתק קישור">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => revokeM.mutate({ id: t.id, revoked: !t.revoked })} title={t.revoked ? "הפעל" : "השבת"}>
                      {t.revoked ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeM.mutate(t.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}