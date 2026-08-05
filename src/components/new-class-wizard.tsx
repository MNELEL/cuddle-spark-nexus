import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  createClass, suggestParentClass, listRolloverStudents,
} from "@/lib/classes.functions";
import { defaultAcademicYear } from "@/lib/year-rollover";

type LinkMode = "suggested" | "other" | "none";

export function NewClassWizard() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState(defaultAcademicYear());
  const [mode, setMode] = useState<LinkMode>("none");
  const [otherId, setOtherId] = useState<string>("");
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [archiveParent, setArchiveParent] = useState(true);

  const suggestFn = useServerFn(suggestParentClass);
  const studentsFn = useServerFn(listRolloverStudents);
  const createFn = useServerFn(createClass);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const trimmed = name.trim();
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(trimmed), 350);
    return () => clearTimeout(t);
  }, [trimmed]);

  const { data: suggestion, isFetching: suggesting } = useQuery({
    queryKey: ["parent-suggestion", debounced],
    queryFn: () => suggestFn({ data: { name: debounced } }),
    enabled: open && debounced.length > 0,
  });

  useEffect(() => {
    if (suggestion?.suggested) setMode("suggested");
  }, [suggestion?.suggested?.id]);

  const parentId = mode === "suggested" ? suggestion?.suggested?.id ?? "" : mode === "other" ? otherId : "";

  const { data: srcStudents = [], isFetching: loadingStudents } = useQuery({
    queryKey: ["rollover-students", parentId],
    queryFn: () => studentsFn({ data: { classId: parentId } }),
    enabled: open && !!parentId,
  });

  useEffect(() => { setExcluded(new Set()); }, [parentId]);

  const copyIds = useMemo(
    () => srcStudents.filter((s) => !excluded.has(s.id)).map((s) => s.id),
    [srcStudents, excluded],
  );

  const reset = () => {
    setName(""); setDebounced(""); setYear(defaultAcademicYear());
    setMode("none"); setOtherId(""); setExcluded(new Set()); setArchiveParent(true);
  };

  const createM = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          name: trimmed,
          academic_year: year.trim() || undefined,
          parent_class_id: parentId || null,
          copy_student_ids: parentId ? copyIds : undefined,
          archive_parent: parentId ? archiveParent : false,
        },
      }),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["classes"] });
      const copied = (row as { copiedStudents?: number } | null)?.copiedStudents ?? 0;
      toast.success(copied > 0 ? `הכיתה נוצרה עם ${copied} תלמידים` : "הכיתה נוצרה");
      setOpen(false);
      reset();
      if (row?.id) navigate({ to: "/classes/$classId", params: { classId: row.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const candidates = suggestion?.candidates ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="rounded-xl">
          <Plus className="ms-1 h-4 w-4" /> הוסף כיתה
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>כיתה חדשה</DialogTitle>
          <DialogDescription>
            אם זו כיתה שעולה משנה קודמת, אפשר לקשר אותה ולהעביר את רשימת התלמידים.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-class-name">שם הכיתה</Label>
              <Input
                id="new-class-name"
                className="rounded-xl"
                placeholder="למשל: כיתה ב1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-class-year">שנת לימוד</Label>
              <Input
                id="new-class-year"
                className="rounded-xl"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">קישור לכיתה קודמת</span>
              {suggesting && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
            </div>

            <RadioGroup value={mode} onValueChange={(v) => setMode(v as LinkMode)} className="space-y-2">
              {suggestion?.suggested && (
                <div className="flex items-start gap-2">
                  <RadioGroupItem value="suggested" id="mode-suggested" className="mt-1" />
                  <Label htmlFor="mode-suggested" className="font-normal leading-relaxed">
                    קשר ל<span className="font-semibold">{suggestion.suggested.name}</span>
                    {suggestion.suggested.academicYear && (
                      <Badge variant="secondary" className="ms-2">{suggestion.suggested.academicYear}</Badge>
                    )}
                    <span className="block text-xs text-muted-foreground">הצעה אוטומטית לפי סדר הכיתות</span>
                  </Label>
                </div>
              )}
              <div className="flex items-start gap-2">
                <RadioGroupItem value="other" id="mode-other" className="mt-1" />
                <Label htmlFor="mode-other" className="font-normal">בחר כיתה אחרת</Label>
              </div>
              {mode === "other" && (
                <Select value={otherId} onValueChange={setOtherId}>
                  <SelectTrigger className="rounded-xl" aria-label="בחירת כיתה קודמת">
                    <SelectValue placeholder="בחר כיתה" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.academicYear ? ` · ${c.academicYear}` : ""}
                        {c.status === "archived" ? " (בארכיון)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-start gap-2">
                <RadioGroupItem value="none" id="mode-none" className="mt-1" />
                <Label htmlFor="mode-none" className="font-normal">כיתה עצמאית — בלי קישור</Label>
              </div>
            </RadioGroup>
          </div>

          {parentId && (
            <div className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">תלמידים שעולים לכיתה החדשה</span>
                <span className="text-xs text-muted-foreground font-mono-tabular">
                  {copyIds.length} מתוך {srcStudents.length}
                </span>
              </div>
              {loadingStudents ? (
                <p className="text-sm text-muted-foreground">טוען תלמידים…</p>
              ) : srcStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">אין תלמידים בכיתה הקודמת.</p>
              ) : (
                <ScrollArea className="h-40 pe-2">
                  <div className="space-y-1.5">
                    {srcStudents.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={!excluded.has(s.id)}
                          onCheckedChange={(v) =>
                            setExcluded((prev) => {
                              const next = new Set(prev);
                              if (v) next.delete(s.id); else next.add(s.id);
                              return next;
                            })
                          }
                        />
                        <span>{s.name}</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <label className="flex items-center gap-2 pt-1 text-sm">
                <Checkbox checked={archiveParent} onCheckedChange={(v) => setArchiveParent(!!v)} />
                <span>העבר את הכיתה הקודמת לארכיון (הנתונים נשמרים לצפייה)</span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>ביטול</Button>
          <Button
            className="rounded-xl"
            disabled={!trimmed || createM.isPending || (mode === "other" && !otherId)}
            onClick={() => createM.mutate()}
          >
            {createM.isPending ? "יוצר…" : "צור כיתה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}