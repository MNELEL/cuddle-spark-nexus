import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus, Pencil, Trash2, Loader2, Users } from "lucide-react";
import {
  listInstitutionStaff,
  upsertInstitutionStaff,
  deleteInstitutionStaff,
  STAFF_TITLES,
  staffTitleLabel,
  type InstitutionStaffRow,
  type StaffTitle,
} from "@/lib/institution-staff.functions";

type FormState = {
  id?: string;
  name: string;
  title: StaffTitle;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
};

const EMPTY: FormState = { name: "", title: "melamed", phone: "", email: "", notes: "", active: true };

/** Editable directory of melamdim and rabbanim for the principal's institution. */
export function InstitutionStaffCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const fetchStaff = useServerFn(listInstitutionStaff);
  const saveStaff = useServerFn(upsertInstitutionStaff);
  const removeStaff = useServerFn(deleteInstitutionStaff);

  const [form, setForm] = useState<FormState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InstitutionStaffRow | null>(null);

  const staffQ = useQuery({ queryKey: ["institution-staff"], queryFn: () => fetchStaff() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["institution-staff"] });
  };

  const saveMutation = useMutation({
    mutationFn: (f: FormState) =>
      saveStaff({
        data: {
          id: f.id,
          name: f.name.trim(),
          title: f.title,
          phone: f.phone.trim(),
          email: f.email.trim(),
          notes: f.notes.trim(),
          active: f.active,
        },
      }),
    onSuccess: () => { toast.success("הצוות עודכן"); invalidate(); setForm(null); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeStaff({ data: { id } }),
    onSuccess: () => { toast.success("איש הצוות הוסר"); invalidate(); setPendingDelete(null); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "המחיקה נכשלה"),
  });

  const rows = staffQ.data ?? [];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" aria-hidden="true" /> מלמדים ורבנים במוסד
        </CardTitle>
        {canEdit && (
          <Button size="sm" className="rounded-xl" onClick={() => setForm({ ...EMPTY })}>
            <UserPlus className="ms-1 h-4 w-4" aria-hidden="true" /> הוספת איש צוות
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-xs text-muted-foreground">
          הרשימה מאפשרת לתעד כל מלמד, רב או ר״מ במוסד — גם בלי חשבון במערכת. השמות זמינים לבחירה
          בשדה "מלמד הכיתה" בדשבורד הכיתה.
        </p>

        {staffQ.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="טוען את צוות המוסד">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : staffQ.isError ? (
          <p className="py-4 text-center text-sm text-destructive">טעינת הצוות נכשלה. רענן את הדף.</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            אין עדיין רשומות צוות. {canEdit ? "הוסיפו מלמד או רב כדי להתחיל." : ""}
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{s.name}</span>
                    <Badge variant="outline">{staffTitleLabel(s.title)}</Badge>
                    {!s.active && <Badge variant="secondary">לא פעיל</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[s.phone, s.email, s.notes].filter(Boolean).join(" · ") || "אין פרטי קשר"}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setForm({
                          id: s.id,
                          name: s.name,
                          title: (s.title as StaffTitle) ?? "melamed",
                          phone: s.phone ?? "",
                          email: s.email ?? "",
                          notes: s.notes ?? "",
                          active: s.active,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="ms-1">עריכה</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPendingDelete(s)}>
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                      <span className="ms-1">הסרה</span>
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{form?.id ? "עריכת איש צוות" : "הוספת איש צוות"}</DialogTitle>
            <DialogDescription>שם ותפקיד הם שדות חובה. שאר הפרטים אופציונליים.</DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="staff-name">שם מלא</Label>
                <Input
                  id="staff-name"
                  className="mt-2"
                  value={form.name}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="לדוגמה: הרב יוסף כהן"
                />
              </div>
              <div>
                <Label htmlFor="staff-title">תפקיד</Label>
                <Select value={form.title} onValueChange={(v) => setForm({ ...form, title: v as StaffTitle })}>
                  <SelectTrigger id="staff-title" className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAFF_TITLES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="staff-phone">טלפון</Label>
                  <Input
                    id="staff-phone"
                    className="mt-2"
                    value={form.phone}
                    maxLength={30}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="staff-email">מייל</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    className="mt-2"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="staff-notes">הערות</Label>
                <Textarea
                  id="staff-notes"
                  className="mt-2"
                  value={form.notes}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="שיעורים, ימי נוכחות, כיתות באחריותו…"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                פעיל במוסד בשנה זו
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>ביטול</Button>
            <Button
              onClick={() => {
                if (!form) return;
                if (form.name.trim().length < 2) return toast.error("נדרש שם מלא");
                saveMutation.mutate(form);
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden="true" />}
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>להסיר את {pendingDelete?.name} מרשימת הצוות?</AlertDialogTitle>
            <AlertDialogDescription>
              ההסרה משפיעה על הרשימה בלבד — כיתות, חשבונות ונתוני תלמידים נשארים ללא שינוי.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
            >
              הסרה
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
