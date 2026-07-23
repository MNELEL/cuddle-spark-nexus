import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Pencil, Printer, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { listGroups, upsertGroup, deleteGroup, setStudentGroups } from "@/lib/groups.functions";
import { listStudents } from "@/lib/students.functions";
import { copyList, printList, type PrintSection } from "@/lib/print-list";

type Group = { id: string; class_id: string; name: string; color: string };
type Membership = { student_id: string; group_id: string };

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export function GroupsTab({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const listG = useServerFn(listGroups);
  const listS = useServerFn(listStudents);
  const removeG = useServerFn(deleteGroup);

  const { data } = useQuery({ queryKey: ["groups", classId], queryFn: () => listG({ data: { classId } }) });
  const { data: students = [] } = useQuery({ queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }) }) as { data: { id: string; name: string }[] };

  const groups: Group[] = data?.groups ?? [];
  const memberships: Membership[] = data?.memberships ?? [];

  const membersByGroup = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const x of memberships) {
      const arr = m.get(x.group_id) ?? [];
      arr.push(x.student_id);
      m.set(x.group_id, arr);
    }
    return m;
  }, [memberships]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);

  const removeM = useMutation({
    mutationFn: (id: string) => removeG({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups", classId] }); toast.success("הקבוצה נמחקה"); },
  });

  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "?";

  const sections = (): PrintSection[] =>
    groups.map((g) => ({
      title: g.name,
      items: (membersByGroup.get(g.id) ?? []).map(nameOf),
    }));

  const doPrint = () => {
    if (!groups.length) return toast.error("אין קבוצות");
    printList("קבוצות הכיתה", sections());
  };
  const doCopy = async () => {
    if (!groups.length) return toast.error("אין קבוצות");
    await navigator.clipboard.writeText(copyList(sections()));
    toast.success("הועתק");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" size="sm" onClick={doPrint}><Printer className="ms-1 h-4 w-4" /> הדפסה</Button>
        <Button variant="outline" size="sm" onClick={doCopy}><Copy className="ms-1 h-4 w-4" /> העתק שמות</Button>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="ms-1 h-4 w-4" /> קבוצה חדשה</Button>
          </DialogTrigger>
          <GroupDialog classId={classId} editing={editing} students={students}
            initialMembers={editing ? (membersByGroup.get(editing.id) ?? []) : []}
            onClose={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">אין קבוצות עדיין.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {groups.map((g) => {
            const members = membersByGroup.get(g.id) ?? [];
            return (
              <Card key={g.id}>
                <CardContent className="flex items-start justify-between py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full" style={{ background: g.color }} />
                      <span className="font-semibold">{g.name}</span>
                      <Badge variant="secondary">{members.length} חברים</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {members.map((id) => <Badge key={id} variant="outline">{nameOf(id)}</Badge>)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" aria-label="ערוך קבוצה" onClick={() => { setEditing(g); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="מחק קבוצה" className="text-destructive" onClick={() => removeM.mutate(g.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GroupDialog({
  classId, editing, students, initialMembers, onClose,
}: {
  classId: string; editing: Group | null;
  students: { id: string; name: string }[];
  initialMembers: string[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(upsertGroup);
  const setMembers = useServerFn(setStudentGroups);
  const [name, setName] = useState(editing?.name ?? "");
  const [color, setColor] = useState(editing?.color ?? PALETTE[0]);
  const [members, setMembersState] = useState<string[]>(initialMembers);

  const m = useMutation({
    mutationFn: async () => {
      // upsert group; if creating, we need its id. Refetch and find by name.
      if (editing) {
        await upsert({ data: { id: editing.id, class_id: classId, name: name.trim(), color } });
        // sync each student's membership: easier to just delete+insert for each member
        // We do per-student diff: members to add/remove.
        // For simplicity, set membership for all students that are members + remove others.
        const before = new Set(initialMembers);
        const after = new Set(members);
        for (const sid of students.map((s) => s.id)) {
          const wasIn = before.has(sid);
          const isIn = after.has(sid);
          if (wasIn === isIn) continue;
          // get current groups for student, then add/remove this group
          // simpler: query+merge via setStudentGroups requires group ids list
          // We'll do a focused approach using a small helper below.
          await toggleMembership(sid, editing.id, isIn);
        }
      } else {
        await upsert({ data: { class_id: classId, name: name.trim(), color } });
        // fetch newly created group id (latest with this name in this class)
        const { data: newGroups } = await (await import("@/integrations/supabase/client")).supabase
          .from("groups").select("id").eq("class_id", classId).eq("name", name.trim()).order("created_at", { ascending: false }).limit(1);
        const newId = newGroups?.[0]?.id;
        if (newId && members.length) {
          for (const sid of members) await toggleMembership(sid, newId, true);
        }
      }

      async function toggleMembership(student_id: string, group_id: string, add: boolean) {
        const supabase = (await import("@/integrations/supabase/client")).supabase;
        const { data: existing } = await supabase.from("student_groups").select("group_id").eq("student_id", student_id);
        const cur = new Set((existing ?? []).map((r) => r.group_id));
        if (add) cur.add(group_id); else cur.delete(group_id);
        await setMembers({ data: { student_id, group_ids: Array.from(cur) } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", classId] });
      toast.success(editing ? "עודכן" : "נוצר");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const toggle = (id: string) => setMembersState((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);

  return (
    <DialogContent className="max-h-[80vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{editing ? "עריכת קבוצה" : "קבוצה חדשה"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>שם</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label>צבע</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button key={c} type="button"
                className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </div>
        <div>
          <Label>חברי קבוצה</Label>
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded border p-2">
            {students.length === 0 ? (
              <p className="text-xs text-muted-foreground">אין תלמידים</p>
            ) : students.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-accent">
                <Checkbox checked={members.includes(s.id)} onCheckedChange={() => toggle(s.id)} />
                <span className="text-sm">{s.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>ביטול</Button>
        <Button onClick={() => m.mutate()} disabled={!name.trim() || m.isPending}>שמור</Button>
      </DialogFooter>
    </DialogContent>
  );
}