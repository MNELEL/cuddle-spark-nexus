import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Award, Loader2, Plus, Sparkles, Trash2, Users, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listBadges, upsertBadge, deleteBadge, awardBadge, listBadgeAwards,
  removeBadgeAward, suggestBadgeIdeas,
} from "@/lib/badges.functions";
import {
  BADGE_CATEGORIES, BADGE_CATEGORY_LABELS, type BadgeCategory, type BadgeRow,
} from "@/lib/badge-options";

type Student = { id: string; name: string };

/** Badge catalog, AI idea suggestions, and class-wide awarding for one class. */
export function BadgesPanel({ classId, students, readOnly = false }: {
  classId: string;
  students: Student[];
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const fetchBadges = useServerFn(listBadges);
  const fetchAwards = useServerFn(listBadgeAwards);
  const save = useServerFn(upsertBadge);
  const remove = useServerFn(deleteBadge);
  const award = useServerFn(awardBadge);
  const unaward = useServerFn(removeBadgeAward);
  const suggest = useServerFn(suggestBadgeIdeas);

  const { data: badges = [], isLoading } = useQuery({
    queryKey: ["badges", classId],
    queryFn: () => fetchBadges({ data: { classId } }),
  });
  const { data: awards = [] } = useQuery({
    queryKey: ["badge-awards", classId],
    queryFn: () => fetchAwards({ data: { classId } }),
  });

  const [editing, setEditing] = useState<Partial<BadgeRow> | null>(null);
  const [awarding, setAwarding] = useState<BadgeRow | null>(null);
  const [category, setCategory] = useState<BadgeCategory>("torah");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["badges", classId] });
    qc.invalidateQueries({ queryKey: ["badge-awards", classId] });
  };

  const saveMut = useMutation({
    mutationFn: (b: Partial<BadgeRow>) => save({
      data: {
        id: b.id,
        classId,
        name: b.name ?? "",
        description: b.description ?? "",
        criteria: b.criteria ?? "",
        points_reward: b.points_reward ?? 0,
        active: b.active ?? true,
      },
    }),
    onSuccess: () => { invalidate(); setEditing(null); toast.success("התג נשמר"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("התג נמחק"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "המחיקה נכשלה"),
  });

  const ideasMut = useMutation({
    mutationFn: () => suggest({ data: { category, count: 4 } }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "קבלת הרעיונות נכשלה"),
  });

  const countFor = (badgeId: string) => awards.filter((a) => a.badge_id === badgeId).length;
  const nameOf = (studentId: string) => students.find((s) => s.id === studentId)?.name ?? "תלמיד";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="h-5 w-5 text-primary" aria-hidden /> קטלוג תגי הישג
          </CardTitle>
          {!readOnly && (
            <Button size="sm" onClick={() => setEditing({ active: true, points_reward: 0 })}>
              <Plus className="ms-1 h-4 w-4" aria-hidden /> תג חדש
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">טוען תגים…</p>
          ) : badges.length === 0 ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              אין עדיין תגים בכיתה. אפשר ליצור תג ידנית או לבקש רעיונות מה-AI למטה.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {badges.map((b) => (
                <li key={b.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 font-medium">
                        {b.name}
                        {!b.active && <Badge variant="outline">לא פעיל</Badge>}
                      </p>
                      {b.description && <p className="text-sm text-muted-foreground">{b.description}</p>}
                      {b.criteria && <p className="text-xs text-muted-foreground">קריטריון: {b.criteria}</p>}
                      <p className="text-xs text-muted-foreground">
                        הוענק {countFor(b.id)} פעמים · {b.points_reward} נקודות
                      </p>
                    </div>
                    {!readOnly && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="secondary" size="sm"
                          onClick={() => setAwarding(b)}
                          aria-label={`הענק את התג ${b.name} לתלמידים`}
                        >
                          <Users className="ms-1 h-4 w-4" aria-hidden /> הענק
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="min-h-9 min-w-9"
                          onClick={() => setEditing(b)}
                          aria-label={`ערוך את התג ${b.name}`}
                        >
                          <Sparkles className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="min-h-9 min-w-9 text-destructive"
                          onClick={() => deleteMut.mutate(b.id)}
                          aria-label={`מחק את התג ${b.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!readOnly && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden /> רעיונות לתגים לפי קטגוריה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="badge-category">קטגוריה</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as BadgeCategory)}>
                  <SelectTrigger id="badge-category" className="w-48" aria-label="בחירת קטגוריה לרעיונות תגים">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BADGE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{BADGE_CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => ideasMut.mutate()} disabled={ideasMut.isPending}>
                {ideasMut.isPending
                  ? <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden />
                  : <Sparkles className="ms-1 h-4 w-4" aria-hidden />}
                {ideasMut.isPending ? "חושב…" : "הצע רעיונות"}
              </Button>
            </div>
            {ideasMut.data && (
              <ul className="grid gap-2 md:grid-cols-2" aria-live="polite">
                {ideasMut.data.ideas.map((idea) => (
                  <li key={idea.name} className="rounded-lg border bg-muted/40 p-3">
                    <p className="font-medium">{idea.name}</p>
                    <p className="text-sm text-muted-foreground">{idea.description}</p>
                    {idea.criteria && <p className="mt-1 text-xs text-muted-foreground">קריטריון: {idea.criteria}</p>}
                    <Button
                      size="sm" variant="outline" className="mt-2"
                      onClick={() => setEditing({ ...idea, active: true, points_reward: 5 })}
                      aria-label={`צור תג מהרעיון ${idea.name}`}
                    >
                      <Plus className="ms-1 h-4 w-4" aria-hidden /> הוסף לקטלוג
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">הענקות אחרונות</CardTitle></CardHeader>
        <CardContent>
          {awards.length === 0 ? (
            <p className="text-sm text-muted-foreground">עדיין לא הוענקו תגים בכיתה זו.</p>
          ) : (
            <ul className="divide-y">
              {awards.slice(0, 25).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <strong>{nameOf(a.student_id)}</strong>{" · "}
                    {badges.find((b) => b.id === a.badge_id)?.name ?? "תג"}
                    {a.note ? ` — ${a.note}` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.awarded_at).toLocaleDateString("he-IL")}
                    </span>
                    {!readOnly && (
                      <Button
                        variant="ghost" size="icon" className="min-h-9 min-w-9"
                        onClick={() => unaward({ data: { id: a.id } }).then(invalidate)}
                        aria-label={`בטל את הענקת התג ל${nameOf(a.student_id)}`}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <BadgeEditorDialog
        value={editing}
        onClose={() => setEditing(null)}
        onSave={(v) => saveMut.mutate(v)}
        saving={saveMut.isPending}
      />
      <AwardDialog
        badge={awarding}
        students={students}
        onClose={() => setAwarding(null)}
        onAward={(payload) =>
          award({ data: { classId, badgeId: awarding!.id, ...payload } })
            .then(() => { invalidate(); setAwarding(null); toast.success("התג הוענק"); })
            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "ההענקה נכשלה"))
        }
      />
    </div>
  );
}

function BadgeEditorDialog({ value, onClose, onSave, saving }: {
  value: Partial<BadgeRow> | null;
  onClose: () => void;
  onSave: (v: Partial<BadgeRow>) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<Partial<BadgeRow>>({});
  const open = value !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); else setDraft(value ?? {}); }}
    >
      <DialogContent
        dir="rtl"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).focus();
        }}
        tabIndex={-1}
      >
        <DialogHeader><DialogTitle>{value?.id ? "עריכת תג" : "תג חדש"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="badge-name">שם התג</Label>
            <Input
              id="badge-name"
              value={draft.name ?? value?.name ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="badge-desc">תיאור</Label>
            <Textarea
              id="badge-desc"
              value={draft.description ?? value?.description ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="badge-criteria">קריטריון לקבלה</Label>
            <Input
              id="badge-criteria"
              value={draft.criteria ?? value?.criteria ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, criteria: e.target.value }))}
            />
          </div>
          <div className="flex items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="badge-points">נקודות בונוס</Label>
              <Input
                id="badge-points" type="number" min={0} max={1000} className="w-28"
                value={draft.points_reward ?? value?.points_reward ?? 0}
                onChange={(e) => setDraft((d) => ({ ...d, points_reward: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch
                id="badge-active"
                checked={draft.active ?? value?.active ?? true}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))}
                aria-label="תג פעיל"
              />
              <Label htmlFor="badge-active">תג פעיל</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ביטול</Button>
          <Button
            disabled={saving}
            onClick={() => onSave({ ...value, ...draft })}
          >
            {saving && <Loader2 className="ms-1 h-4 w-4 animate-spin" aria-hidden />}
            {saving ? "שומר…" : "שמור תג"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AwardDialog({ badge, students, onClose, onAward }: {
  badge: BadgeRow | null;
  students: Student[];
  onClose: () => void;
  onAward: (p: { studentIds: string[]; wholeClass: boolean; note: string }) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Dialog open={badge !== null} onOpenChange={(o) => { if (!o) { onClose(); setSelected([]); setNote(""); } }}>
      <DialogContent
        dir="rtl"
        onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus(); }}
        tabIndex={-1}
      >
        <DialogHeader><DialogTitle>הענקת התג {badge?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
            {students.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(s.id)}
                  onCheckedChange={() => toggle(s.id)}
                  aria-label={`בחר את ${s.name} לקבלת התג`}
                />
                {s.name}
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="award-note">הערה (אופציונלי)</Label>
            <Input id="award-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onAward({ studentIds: [], wholeClass: true, note })}
            aria-label="הענק את התג לכל תלמידי הכיתה"
          >
            <Users className="ms-1 h-4 w-4" aria-hidden /> הענק לכל הכיתה
          </Button>
          <Button disabled={selected.length === 0} onClick={() => onAward({ studentIds: selected, wholeClass: false, note })}>
            הענק ל-{selected.length} תלמידים
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
