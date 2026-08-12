import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { History, Save, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  getIngestAiSettings, updateIngestAiSettings, listIngestAiSuggestions,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from "@/lib/ingest-ai.functions";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function AiSuggestionsAuditCard() {
  const qc = useQueryClient();
  const settingsFn = useServerFn(getIngestAiSettings);
  const saveFn = useServerFn(updateIngestAiSettings);
  const logFn = useServerFn(listIngestAiSuggestions);
  const [open, setOpen] = useState(false);

  const { data: settings } = useQuery({ queryKey: ["ingest-ai-settings"], queryFn: () => settingsFn() });
  const { data: log = [] } = useQuery({
    queryKey: ["ingest-ai-suggestions"],
    queryFn: () => logFn({ data: { limit: 20 } }),
    enabled: open,
  });

  const [topicTh, setTopicTh] = useState(DEFAULT_CONFIDENCE_THRESHOLD);
  const [collTh, setCollTh] = useState(DEFAULT_CONFIDENCE_THRESHOLD);
  useEffect(() => {
    if (!settings) return;
    setTopicTh(settings.topic_confidence_threshold);
    setCollTh(settings.collection_confidence_threshold);
  }, [settings]);

  const saveM = useMutation({
    mutationFn: () => saveFn({ data: {
      topic_confidence_threshold: topicTh,
      collection_confidence_threshold: collTh,
    }}),
    onSuccess: () => {
      toast.success("סף הביטחון עודכן");
      void qc.invalidateQueries({ queryKey: ["ingest-ai-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שגיאה"),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" /> הצעות ה-AI לנושא ואוסף
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          <History className="ms-1 h-4 w-4" />
          {open ? "הסתר יומן" : "יומן הצעות"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs">
              סף ביטחון לסימון נושא אוטומטית — {pct(topicTh)}
            </Label>
            <Slider
              className="mt-2"
              value={[Math.round(topicTh * 100)]}
              min={0} max={100} step={5}
              onValueChange={(v) => setTopicTh((v[0] ?? 60) / 100)}
              aria-label="סף ביטחון לנושא"
            />
          </div>
          <div>
            <Label className="text-xs">
              סף ביטחון לסימון אוספים אוטומטית — {pct(collTh)}
            </Label>
            <Slider
              className="mt-2"
              value={[Math.round(collTh * 100)]}
              min={0} max={100} step={5}
              onValueChange={(v) => setCollTh((v[0] ?? 60) / 100)}
              aria-label="סף ביטחון לאוספים"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          מעל הסף — ההצעה של ה-AI מסומנת מראש בטופס. מתחת לסף — השדה נשאר ריק ואתה בוחר ידנית.
        </p>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            <Save className="ms-1 h-4 w-4" /> שמור סף
          </Button>
        </div>

        {open && (
          <div className="space-y-2 border-t pt-3">
            {log.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                אין עדיין רשומות ביומן. כל שמירת חומר לימוד מ"העלאה חכמה" תירשם כאן.
              </p>
            ) : (
              log.map((r) => (
                <div key={r.id} className="rounded-lg border p-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.resource_title || "ללא כותרת"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("he-IL")}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      ביטחון {pct(Number(r.topic_confidence))} · סף {pct(Number(r.confidence_threshold))}
                    </Badge>
                    <Badge variant={r.topic_changed ? "destructive" : "outline"} className="text-[10px]">
                      נושא: {r.topic_changed ? "שונה על ידך" : "אושר כפי שהוצע"}
                    </Badge>
                    <Badge variant={r.collections_changed ? "destructive" : "outline"} className="text-[10px]">
                      אוספים: {r.collections_changed ? "שונו על ידך" : "אושרו כפי שהוצעו"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    הצעת AI לנושא: {r.suggested_topic_name || (r.suggested_topic_id ? r.suggested_topic_id : "ללא")}
                    {" · "}הוצעו {r.suggested_collection_ids.length} אוספים
                    {" · "}נשמרו {r.final_collection_ids.length} אוספים
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
