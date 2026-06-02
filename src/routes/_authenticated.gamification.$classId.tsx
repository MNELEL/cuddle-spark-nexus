import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import { ArrowRight, Plus, Trash2, Trophy, Gift, Sparkles, Maximize2, Pencil, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getClass } from "@/lib/classes.functions";
import { listStudents } from "@/lib/students.functions";
import {
  listCampaigns, upsertCampaign, deleteCampaign,
  listRewards, upsertReward, deleteReward,
  listRedemptions, redeemReward, deleteRedemption,
  getLeaderboard,
} from "@/lib/gamification.functions";

export const Route = createFileRoute("/_authenticated/gamification/$classId")({
  component: GamificationPage,
});

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (d: number) => {
  const x = new Date(); x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

function GamificationPage() {
  const { classId } = Route.useParams();
  const getC = useServerFn(getClass);
  const lb = useServerFn(getLeaderboard);
  const { data: cls } = useQuery({ queryKey: ["class", classId], queryFn: () => getC({ data: { id: classId } }) });
  const { data: leaders = [] } = useQuery({
    queryKey: ["leaderboard", classId],
    queryFn: () => lb({ data: { classId } }),
  });
  const [kiosk, setKiosk] = useState(false);

  if (kiosk) return <KioskBoard classId={classId} onExit={() => setKiosk(false)} title={cls?.name ?? ""} />;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/classes/$classId" params={{ classId }} className="text-sm text-muted-foreground hover:underline flex items-center gap-1">
          <ArrowRight className="h-4 w-4" /> חזרה לכיתה
        </Link>
        <div className="ms-auto">
          <Button variant="outline" size="sm" onClick={() => setKiosk(true)}>
            <Maximize2 className="ms-1 h-4 w-4" /> מצב מסך לכיתה
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card bg-mesh p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber/15 p-3"><Trophy className="h-6 w-6 text-amber" /></div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">גיימיפיקציה — {cls?.name ?? "..."}</h1>
            <p className="text-sm text-muted-foreground">קמפיינים, נקודות, פרסים ולוח הישגים לתלמידי הכיתה.</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="leaderboard" dir="rtl">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="leaderboard">לוח הישגים</TabsTrigger>
          <TabsTrigger value="campaigns">קמפיינים</TabsTrigger>
          <TabsTrigger value="rewards">קטלוג פרסים</TabsTrigger>
          <TabsTrigger value="redemptions">מימושים</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" className="mt-4">
          <LeaderboardCard leaders={leaders} />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <CampaignsTab classId={classId} />
        </TabsContent>

        <TabsContent value="rewards" className="mt-4">
          <RewardsTab classId={classId} />
        </TabsContent>

        <TabsContent value="redemptions" className="mt-4">
          <RedemptionsTab classId={classId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Leaderboard ---------------- */

function LeaderboardCard({ leaders }: { leaders: { student_id: string; name: string; earned: number; spent: number; net: number }[] }) {
  const top = leaders.slice(0, 3);
  const rest = leaders.slice(3);
  const max = Math.max(1, ...leaders.map((l) => l.net));

  if (leaders.length === 0) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">אין תלמידים עדיין.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {top.map((l, i) => (
          <Card key={l.student_id} className={i === 0 ? "border-amber/60 shadow-glow-amber" : ""}>
            <CardContent className="pt-6 text-center">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber/15">
                {i === 0 ? <Trophy className="h-6 w-6 text-amber" /> : <Star className="h-5 w-5 text-amber" />}
              </div>
              <div className="font-display text-xl font-bold">{l.name}</div>
              <div className="mt-1 font-mono-tabular text-2xl text-amber">{l.net}</div>
              <div className="mt-1 text-xs text-muted-foreground">צבר {l.earned} · מימש {l.spent}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      {rest.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {rest.map((l, i) => (
                <div key={l.student_id} className="flex items-center gap-3">
                  <div className="w-8 text-center font-mono-tabular text-sm text-muted-foreground">#{i + 4}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{l.name}</span>
                      <span className="font-mono-tabular text-sm">{l.net}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-amber" style={{ width: `${Math.max(2, (l.net / max) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------------- Campaigns ---------------- */

type Campaign = {
  id: string; class_id: string; name: string; description: string; prize: string;
  target_points: number; start_date: string; end_date: string; active: boolean;
};

function CampaignsTab({ classId }: { classId: string }) {
  const list = useServerFn(listCampaigns);
  const remove = useServerFn(deleteCampaign);
  const lb = useServerFn(getLeaderboard);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns", classId],
    queryFn: () => list({ data: { classId } }),
  });

  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns", classId] }); toast.success("הקמפיין נמחק"); },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="ms-1 h-4 w-4" /> קמפיין חדש</Button>
          </DialogTrigger>
          <CampaignDialog classId={classId} editing={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>
      {campaigns.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">אין קמפיינים. צור את הראשון.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(campaigns as Campaign[]).map((c) => (
            <CampaignCard key={c.id} c={c} classId={classId} lb={lb}
              onEdit={() => { setEditing(c); setOpen(true); }}
              onDelete={() => removeM.mutate(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignCard({
  c, classId, lb, onEdit, onDelete,
}: {
  c: Campaign; classId: string;
  lb: (a: { data: { classId: string; startDate?: string; endDate?: string } }) => Promise<{ name: string; net: number }[]>;
  onEdit: () => void; onDelete: () => void;
}) {
  const { data: leaders = [] } = useQuery({
    queryKey: ["campaign-leaders", c.id],
    queryFn: () => lb({ data: { classId, startDate: c.start_date, endDate: c.end_date } }),
  });
  const topScore = leaders[0]?.net ?? 0;
  const progress = Math.min(100, Math.round((topScore / Math.max(1, c.target_points)) * 100));

  return (
    <Card className={c.active ? "" : "opacity-60"}>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber" />
              <h3 className="font-display text-lg font-bold truncate">{c.name}</h3>
              {!c.active && <Badge variant="secondary">לא פעיל</Badge>}
            </div>
            {c.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        {c.prize && (
          <div className="flex items-center gap-2 rounded-lg bg-amber/10 px-3 py-2 text-sm">
            <Gift className="h-4 w-4 text-amber" />
            <span className="font-medium">פרס:</span> <span className="truncate">{c.prize}</span>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono-tabular">
            <span>{c.start_date} → {c.end_date}</span>
            <span>{topScore} / {c.target_points}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-to-l from-amber to-amber-glow" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {leaders.length > 0 && (
          <div className="text-xs text-muted-foreground">
            מוביל: <span className="font-medium text-foreground">{leaders[0].name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CampaignDialog({ classId, editing, onClose }: { classId: string; editing: Campaign | null; onClose: () => void }) {
  const upsert = useServerFn(upsertCampaign);
  const qc = useQueryClient();
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [prize, setPrize] = useState(editing?.prize ?? "");
  const [target, setTarget] = useState(editing?.target_points ?? 100);
  const [start, setStart] = useState(editing?.start_date ?? today());
  const [end, setEnd] = useState(editing?.end_date ?? plusDays(30));
  const [active, setActive] = useState(editing?.active ?? true);

  const m = useMutation({
    mutationFn: () => upsert({ data: {
      id: editing?.id, classId, name: name.trim(), description, prize,
      target_points: Number(target), start_date: start, end_date: end, active,
    }}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns", classId] });
      toast.success(editing ? "עודכן" : "הקמפיין נוצר");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "עריכת קמפיין" : "קמפיין חדש"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>שם הקמפיין</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="מבצע מתמיד" />
        </div>
        <div>
          <Label>תיאור</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>פרס</Label>
            <Input value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="גלידה לכיתה" />
          </div>
          <div>
            <Label>יעד נקודות</Label>
            <Input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>מתאריך</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label>עד תאריך</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="active" checked={active} onCheckedChange={setActive} />
          <Label htmlFor="active" className="cursor-pointer">פעיל</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>ביטול</Button>
        <Button onClick={() => m.mutate()} disabled={!name.trim() || m.isPending}>{editing ? "שמור" : "צור"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------------- Rewards ---------------- */

type Reward = { id: string; class_id: string; name: string; description: string; points_cost: number; stock: number | null; active: boolean };

function RewardsTab({ classId }: { classId: string }) {
  const list = useServerFn(listRewards);
  const remove = useServerFn(deleteReward);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Reward | null>(null);

  const { data: rewards = [] } = useQuery({
    queryKey: ["rewards", classId],
    queryFn: () => list({ data: { classId } }),
  });

  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rewards", classId] }); toast.success("נמחק"); },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="ms-1 h-4 w-4" /> פרס חדש</Button>
          </DialogTrigger>
          <RewardDialog classId={classId} editing={editing} onClose={() => { setOpen(false); setEditing(null); }} />
        </Dialog>
      </div>
      {rewards.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">עדיין אין פרסים בקטלוג.</CardContent></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {(rewards as Reward[]).map((r) => (
            <Card key={r.id} className={r.active ? "" : "opacity-60"}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-amber" />
                    <span className="font-semibold">{r.name}</span>
                    <Badge className="bg-amber text-amber-foreground">{r.points_cost} נק'</Badge>
                    {r.stock !== null && <Badge variant="secondary">מלאי: {r.stock}</Badge>}
                  </div>
                  {r.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{r.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeM.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RewardDialog({ classId, editing, onClose }: { classId: string; editing: Reward | null; onClose: () => void }) {
  const upsert = useServerFn(upsertReward);
  const qc = useQueryClient();
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [cost, setCost] = useState(editing?.points_cost ?? 20);
  const [stock, setStock] = useState<string>(editing?.stock?.toString() ?? "");
  const [active, setActive] = useState(editing?.active ?? true);

  const m = useMutation({
    mutationFn: () => upsert({ data: {
      id: editing?.id, classId, name: name.trim(), description,
      points_cost: Number(cost), stock: stock === "" ? null : Number(stock), active,
    }}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards", classId] });
      toast.success(editing ? "עודכן" : "הפרס נוסף"); onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{editing ? "עריכת פרס" : "פרס חדש"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>שם הפרס</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="מדבקה, ספר, שעה במחשב..." />
        </div>
        <div>
          <Label>תיאור</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>עלות בנקודות</Label>
            <Input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
          </div>
          <div>
            <Label>מלאי (ריק = ללא הגבלה)</Label>
            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="∞" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="ractive" checked={active} onCheckedChange={setActive} />
          <Label htmlFor="ractive" className="cursor-pointer">פעיל</Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>ביטול</Button>
        <Button onClick={() => m.mutate()} disabled={!name.trim() || m.isPending}>{editing ? "שמור" : "הוסף"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------------- Redemptions ---------------- */

type Redemption = { id: string; student_id: string; prize_name: string; points_spent: number; date: string; notes: string };

function RedemptionsTab({ classId }: { classId: string }) {
  const listS = useServerFn(listStudents);
  const listR = useServerFn(listRewards);
  const listRd = useServerFn(listRedemptions);
  const redeem = useServerFn(redeemReward);
  const remove = useServerFn(deleteRedemption);
  const qc = useQueryClient();

  const { data: students = [] } = useQuery({ queryKey: ["students", classId], queryFn: () => listS({ data: { classId } }) });
  const { data: rewards = [] } = useQuery({ queryKey: ["rewards", classId], queryFn: () => listR({ data: { classId } }) });
  const { data: redemptions = [] } = useQuery({ queryKey: ["redemptions", classId], queryFn: () => listRd({ data: { classId } }) });

  const [studentId, setStudentId] = useState("");
  const [rewardId, setRewardId] = useState("");
  const [notes, setNotes] = useState("");

  const nameOf = (id: string) => (students as { id: string; name: string }[]).find((s) => s.id === id)?.name ?? "?";
  const selectedReward = (rewards as Reward[]).find((r) => r.id === rewardId);

  const redeemM = useMutation({
    mutationFn: () => redeem({ data: {
      classId, studentId,
      rewardId: rewardId || undefined,
      prize_name: selectedReward?.name ?? "פרס",
      points_spent: selectedReward?.points_cost ?? 0,
      notes,
    }}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["redemptions", classId] });
      qc.invalidateQueries({ queryKey: ["leaderboard", classId] });
      setStudentId(""); setRewardId(""); setNotes("");
      toast.success("הפרס מומש");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  const removeM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["redemptions", classId] });
      qc.invalidateQueries({ queryKey: ["leaderboard", classId] });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>תלמיד</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>
                  {(students as { id: string; name: string }[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>פרס</Label>
              <Select value={rewardId} onValueChange={setRewardId}>
                <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>
                  {(rewards as Reward[]).filter((r) => r.active).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name} · {r.points_cost} נק'</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <Label>הערה</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={() => redeemM.mutate()} disabled={!studentId || !rewardId || redeemM.isPending}>
                <Gift className="ms-1 h-4 w-4" /> מימוש
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {redemptions.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">אין מימושים עדיין.</CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {(redemptions as Redemption[]).map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{nameOf(r.student_id)} · {r.prize_name}</div>
                  <div className="text-xs text-muted-foreground font-mono-tabular">{r.date} · {r.points_spent} נק'</div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeM.mutate(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Kiosk Mode ---------------- */

function KioskBoard({ classId, title, onExit }: { classId: string; title: string; onExit: () => void }) {
  const lb = useServerFn(getLeaderboard);
  const { data: leaders = [], refetch } = useQuery({
    queryKey: ["leaderboard", classId, "kiosk"],
    queryFn: () => lb({ data: { classId } }),
  });
  useEffect(() => {
    const t = setInterval(() => refetch(), 15000);
    return () => clearInterval(t);
  }, [refetch]);

  const top = useMemo(() => leaders.slice(0, 10), [leaders]);
  const max = Math.max(1, ...top.map((l) => l.net));

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto" dir="rtl">
      <div className="mx-auto max-w-5xl p-6 md:p-10">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-amber" />
          <h1 className="font-display text-3xl md:text-5xl font-bold text-gradient-amber">{title} — לוח ההישגים</h1>
          <Button variant="ghost" className="ms-auto" onClick={onExit}>יציאה</Button>
        </div>
        <div className="mt-8 space-y-3">
          {top.length === 0 && <p className="text-center text-muted-foreground">אין תלמידים עדיין.</p>}
          {top.map((l, i) => (
            <div key={l.student_id} className={`rounded-2xl border p-4 md:p-5 ${i === 0 ? "border-amber/70 shadow-glow-amber bg-amber/5" : "bg-card"}`}>
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 md:h-16 md:w-16 items-center justify-center rounded-full font-display text-2xl font-bold ${i === 0 ? "bg-amber text-amber-foreground" : "bg-muted"}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-display text-2xl md:text-3xl font-bold truncate">{l.name}</div>
                    <div className="font-mono-tabular text-2xl md:text-4xl text-amber">{l.net}</div>
                  </div>
                  <div className="mt-2 h-2 md:h-3 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-gradient-to-l from-amber to-amber-glow transition-all" style={{ width: `${Math.max(2, (l.net / max) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}