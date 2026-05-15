import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listClasses, createClass, deleteClass } from "@/lib/classes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/classes/")({
  component: ClassesPage,
});

function ClassesPage() {
  const list = useServerFn(listClasses);
  const create = useServerFn(createClass);
  const remove = useServerFn(deleteClass);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => list(),
  });

  const createM = useMutation({
    mutationFn: (n: string) => create({ data: { name: n } }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      setName("");
      toast.success("הכיתה נוצרה");
      if (row?.id) navigate({ to: "/classes/$classId", params: { classId: row.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      toast.success("הכיתה נמחקה");
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">הכיתות שלי</h1>
        <p className="text-sm text-muted-foreground">בחר כיתה כדי להתחיל לנהל תלמידים ואילוצים</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => { e.preventDefault(); if (name.trim()) createM.mutate(name.trim()); }}
            className="flex gap-2"
          >
            <Input placeholder="שם הכיתה (למשל: ז'1)" value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" disabled={createM.isPending || !name.trim()}>
              <Plus className="ms-1 h-4 w-4" /> הוסף כיתה
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-center text-muted-foreground">טוען...</p>
      ) : classes.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">עדיין אין כיתות. צור את הראשונה למעלה.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {classes.map((c) => (
            <Card key={c.id} className="transition hover:shadow-md">
              <CardContent className="flex items-center justify-between py-4">
                <Link to="/classes/$classId" params={{ classId: c.id }} className="flex flex-1 items-center justify-between">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">גריד {c.grid_cols}×{c.grid_rows}</div>
                  </div>
                  <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="ms-2 text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>למחוק את הכיתה?</AlertDialogTitle>
                      <AlertDialogDescription>פעולה זו תמחק לצמיתות את {c.name} ואת כל התלמידים והאילוצים שלה.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ביטול</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeM.mutate(c.id)}>מחק</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}