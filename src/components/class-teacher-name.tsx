import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, UserRound, Loader2 } from "lucide-react";
import { updateClass } from "@/lib/classes.functions";
import { listInstitutionStaff, staffTitleLabel } from "@/lib/institution-staff.functions";

/**
 * Shows the melamed of the class in the class dashboard header and lets the
 * teacher change it. Falls back to the institution staff list for quick picks.
 */
export function ClassTeacherName({
  classId,
  teacherName,
  readOnly,
}: {
  classId: string;
  teacherName: string | null;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(teacherName ?? "");
  const qc = useQueryClient();
  const save = useServerFn(updateClass);
  const fetchStaff = useServerFn(listInstitutionStaff);

  useEffect(() => { setValue(teacherName ?? ""); }, [teacherName]);

  const staffQ = useQuery({
    queryKey: ["institution-staff"],
    queryFn: () => fetchStaff(),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (name: string) => save({ data: { id: classId, teacher_name: name } }),
    onSuccess: () => {
      toast.success("שם המלמד עודכן");
      qc.invalidateQueries({ queryKey: ["class", classId] });
      qc.invalidateQueries({ queryKey: ["institution-classes"] });
      setOpen(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "העדכון נכשל"),
  });

  const label = teacherName?.trim() ? teacherName : "לא הוגדר מלמד";

  return (
    <>
      <span className="inline-flex items-center gap-1.5 text-sm text-primary-foreground/85">
        <UserRound className="h-4 w-4" aria-hidden="true" />
        <span>מלמד: {label}</span>
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-primary-foreground/90 hover:bg-primary-foreground/10"
            onClick={() => setOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="ms-1">{teacherName?.trim() ? "שינוי" : "הוספה"}</span>
          </Button>
        )}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>שם המלמד של הכיתה</DialogTitle>
            <DialogDescription>
              השם יופיע בדשבורד הכיתה, בדוחות ובתעודות. אפשר לבחור מרשימת הצוות של המוסד או להזין שם חדש.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="class-teacher-name">שם מלא</Label>
              <Input
                id="class-teacher-name"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder='לדוגמה: הרב יוסף כהן'
                className="mt-2"
                maxLength={80}
              />
            </div>

            {staffQ.isLoading ? (
              <p className="text-xs text-muted-foreground">טוען את צוות המוסד…</p>
            ) : (staffQ.data ?? []).length > 0 ? (
              <div>
                <div className="mb-2 text-xs text-muted-foreground">בחירה מצוות המוסד</div>
                <div className="flex flex-wrap gap-2">
                  {(staffQ.data ?? []).filter((s) => s.active).map((s) => (
                    <Button
                      key={s.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setValue(s.name)}
                    >
                      {s.name} · {staffTitleLabel(s.title)}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
            <Button
              onClick={() => {
                const next = value.trim();
                if (next.length > 0 && next.length < 2) return toast.error("נדרש שם מלא");
                mutation.mutate(next);
              }}
              disabled={mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden="true" />}
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
