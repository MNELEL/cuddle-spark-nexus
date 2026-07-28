import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Wand2, RotateCcw, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { runSeatingWizard, type WizardResult } from "@/lib/seating-wizard.functions";
import { setSeat } from "@/lib/students.functions";
import { getPrefs, savePrefs } from "@/lib/seating-wizard-prefs.functions";

type Props = {
  classId: string;
  studentNameById: Map<string, string>;
};

const DEFAULT_WEIGHTS = { academic: 25, behavioral: 25, social: 25 };

export function SeatingWizardModal({ classId, studentNameById }: Props) {
  const qc = useQueryClient();
  const runWizard = useServerFn(runSeatingWizard);
  const setSeatFn = useServerFn(setSeat);
  const getPrefsFn = useServerFn(getPrefs);
  const savePrefsFn = useServerFn(savePrefs);

  const [open, setOpen] = useState(false);
  const [weightAcademic, setWeightAcademic] = useState(DEFAULT_WEIGHTS.academic);
  const [weightBehavioral, setWeightBehavioral] = useState(DEFAULT_WEIGHTS.behavioral);
  const [weightSocial, setWeightSocial] = useState(DEFAULT_WEIGHTS.social);
  const [balanceHeight, setBalanceHeight] = useState(true);
  const [freeInstruction, setFreeInstruction] = useState("");
  const [result, setResult] = useState<WizardResult | null>(null);

  const { data: prefs } = useQuery({
    queryKey: ["seating-wizard-prefs"],
    queryFn: () => getPrefsFn(),
    enabled: open,
  });

  useEffect(() => {
    if (prefs) {
      setWeightAcademic(prefs.weight_academic);
      setWeightBehavioral(prefs.weight_behavioral);
      setWeightSocial(prefs.weight_social);
      setBalanceHeight(prefs.balance_height);
    }
  }, [prefs]);

  const runM = useMutation({
    mutationFn: () =>
      runWizard({
        data: {
          classId,
          weightAcademic,
          weightBehavioral,
          weightSocial,
          balanceHeight,
          freeInstruction,
        },
      }),
    onSuccess: (res) => setResult(res),
    onError: (e) => toast.error(e instanceof Error ? e.message : "האשף נכשל, נסה שוב"),
  });

  const applyM = useMutation({
    mutationFn: async () => {
      if (!result) return;
      await savePrefsFn({
        data: {
          weight_academic: weightAcademic,
          weight_behavioral: weightBehavioral,
          weight_social: weightSocial,
          balance_height: balanceHeight,
        },
      });
      for (const p of result.placements) {
        await setSeatFn({ data: { class_id: classId, student_id: p.studentId, seat_row: p.row, seat_col: p.col } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students", classId] });
      toast.success("הסידור הוחל בהצלחה");
      setOpen(false);
      setResult(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה בשמירה"),
  });

  const retry = () => setResult(null);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setResult(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Wand2 className="ms-1 h-4 w-4" /> אשף הושבה AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            אשף הושבה חכם
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-5 py-2">
            <div className="space-y-4">
              <WeightSlider label="שקלול אקדמי" value={weightAcademic} onChange={setWeightAcademic} />
              <WeightSlider label="שקלול התנהגותי" value={weightBehavioral} onChange={setWeightBehavioral} />
              <WeightSlider label="שקלול חברתי" value={weightSocial} onChange={setWeightSocial} />
              <div className="flex items-center justify-between">
                <Label htmlFor="balance-height">איזון גובה בין שורות</Label>
                <Switch id="balance-height" checked={balanceHeight} onCheckedChange={setBalanceHeight} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="free-instruction">הנחיה חופשית למורה (אופציונלי)</Label>
                <Textarea
                  id="free-instruction"
                  value={freeInstruction}
                  onChange={(e) => setFreeInstruction(e.target.value.slice(0, 500))}
                  placeholder="לדוגמה: השאר את דני ויוסי בשורה הראשונה, קרוב ללוח"
                  maxLength={500}
                  rows={3}
                />
                <div className="text-left text-[10px] text-muted-foreground">{freeInstruction.length}/500</div>
              </div>
            </div>

            <Button className="w-full" onClick={() => runM.mutate()} disabled={runM.isPending}>
              <Sparkles className="ms-1 h-4 w-4" />
              {runM.isPending ? "מסדר..." : "הרץ סידור AI"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <Card>
              <CardContent className="space-y-1 py-3 text-sm">
                <div className="flex items-center gap-1.5 font-semibold">
                  {result.usedAI ? (
                    <Badge variant="default" className="gap-1"><Sparkles className="h-3 w-3" /> סודר על ידי AI</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1"><Info className="h-3 w-3" /> סודר באלגוריתם מקומי</Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{result.reasoning}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="grid grid-cols-3 gap-2 py-3 text-center text-xs">
                <div>
                  <div className="text-lg font-bold text-amber-600">{result.classAnalysis.strugglingCount}</div>
                  <div className="text-muted-foreground">מתקשים</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-600">{result.classAnalysis.excellingCount}</div>
                  <div className="text-muted-foreground">מצטיינים</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-600">{result.classAnalysis.attentionCount}</div>
                  <div className="text-muted-foreground">קשיי קשב</div>
                </div>
              </CardContent>
            </Card>

            <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-xs">
              {result.placements.map((p) => (
                <div key={p.studentId} className="flex justify-between border-b py-1 last:border-0">
                  <span>{studentNameById.get(p.studentId) ?? p.studentId}</span>
                  <span className="text-muted-foreground">שורה {p.row + 1}, עמודה {p.col + 1}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={retry} disabled={applyM.isPending}>
                <RotateCcw className="ms-1 h-4 w-4" /> שנה ערכים ונסה שוב
              </Button>
              <Button className="flex-1" onClick={() => applyM.mutate()} disabled={applyM.isPending}>
                <CheckCircle2 className="ms-1 h-4 w-4" /> {applyM.isPending ? "שומר..." : "אשר וסדר"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <Label>{label}</Label>
        <span className="text-xs font-medium text-muted-foreground">{value}%</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={0} max={100} step={5} />
    </div>
  );
}
