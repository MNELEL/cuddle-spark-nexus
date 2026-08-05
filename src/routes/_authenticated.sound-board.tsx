import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Play, Volume2, VolumeX, Loader2 } from "lucide-react";
import {
  SOUND_LIBRARY, SOUND_CATEGORY_LABELS, SOUND_EVENTS, defaultSoundFor,
  playSound, isMuted, setMuted, getMasterVolume, setMasterVolume,
  type SoundCategory,
} from "@/lib/sounds";
import { listSoundPreferences, saveSoundPreference } from "@/lib/sound-preferences.functions";

export const Route = createFileRoute("/_authenticated/sound-board")({
  component: SoundBoardPage,
  head: () => ({
    meta: [
      { title: "ניהול סאונד ואפקטים · הכיתה שלי" },
      { name: "description", content: "ספריית צלילים לכיתה ומיפוי אירועים לצלילים — הישגים, התראות ומעברים ומוזיקת רקע." },
      { property: "og:title", content: "ניהול סאונד ואפקטים · הכיתה שלי" },
      { property: "og:description", content: "ספריית צלילים ומיפוי אירועים — הישגים, מעברים ומוזיקה." },
      { property: "og:url", content: "https://cuddle-spark-nexus.lovable.app/sound-board" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const CATEGORIES: SoundCategory[] = ["achievement", "transition", "music"];

function SoundBoardPage() {
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(0.6);

  useEffect(() => {
    setMutedState(isMuted());
    setVolumeState(getMasterVolume());
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ניהול סאונד ואפקטים</h1>
          <p className="text-sm text-muted-foreground">
            ספריית צלילים לכיתה, ומיפוי אירועים באפליקציה לצליל — כך שכל הענקת נקודות, תג או סיום טיימר יישמעו כמו שהרב בחר.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/sound-test">
            <Play className="ms-1 h-4 w-4" aria-hidden /> מסך בדיקת אירועים
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">שליטה כללית</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {muted ? <VolumeX className="h-5 w-5 text-muted-foreground" aria-hidden /> : <Volume2 className="h-5 w-5 text-primary" aria-hidden />}
            <Label htmlFor="mute-all" className="cursor-pointer">השתקת כל הצלילים</Label>
            <Switch
              id="mute-all"
              checked={muted}
              onCheckedChange={(v) => { setMuted(v); setMutedState(v); }}
              aria-label="השתקת כל הצלילים באפליקציה"
            />
          </div>
          <div className="flex min-w-56 items-center gap-3">
            <Label htmlFor="master-volume" className="whitespace-nowrap text-sm">עוצמה כללית</Label>
            <Slider
              id="master-volume"
              value={[Math.round(volume * 100)]}
              min={0} max={100} step={5}
              onValueChange={([v]) => { const n = (v ?? 60) / 100; setMasterVolume(n); setVolumeState(n); }}
              aria-label="עוצמת שמע כללית"
            />
            <span className="w-10 text-end text-sm tabular-nums">{Math.round(volume * 100)}%</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="library" dir="rtl">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="library">ספריית צלילים</TabsTrigger>
          <TabsTrigger value="mapping">מיפוי אירועים</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-4 space-y-6">
          {CATEGORIES.map((cat) => (
            <section key={cat} className="space-y-3">
              <h2 className="text-lg font-semibold">{SOUND_CATEGORY_LABELS[cat]}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SOUND_LIBRARY.filter((s) => s.category === cat).map((s) => (
                  <Card key={s.id} className="transition-transform hover:scale-[1.01]">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className="text-2xl" aria-hidden>{s.emoji}</span>{s.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                      <Button
                        className="w-full"
                        onClick={() => playSound(s.id)}
                        aria-label={`השמע את הצליל ${s.label}`}
                      >
                        <Play className="ms-1 h-4 w-4" aria-hidden /> השמע
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </TabsContent>

        <TabsContent value="mapping" className="mt-4">
          <EventMapping />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EventMapping() {
  const fetchPrefs = useServerFn(listSoundPreferences);
  const savePref = useServerFn(saveSoundPreference);
  const qc = useQueryClient();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data: prefs = [], isLoading } = useQuery({
    queryKey: ["sound-preferences"],
    queryFn: () => fetchPrefs(),
  });

  const saveMut = useMutation({
    mutationFn: (v: { event_key: string; sound_id: string; enabled: boolean; volume: number }) =>
      savePref({ data: v }),
    onMutate: (v) => setSavingKey(v.event_key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sound-preferences"] });
      toast.success("ההעדפה נשמרה");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "השמירה נכשלה"),
    onSettled: () => setSavingKey(null),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">טוען העדפות…</p>;
  }

  return (
    <div className="space-y-3" aria-live="polite">
      {SOUND_EVENTS.map((ev) => {
        const pref = prefs.find((p) => p.event_key === ev.key);
        const soundId = pref?.sound_id ?? defaultSoundFor(ev.key);
        const enabled = pref?.enabled ?? true;
        const vol = pref?.volume ?? 0.6;
        const saving = savingKey === ev.key;
        return (
          <Card key={ev.key}>
            <CardContent className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center">
              <div className="min-w-52 flex-1">
                <p className="font-medium">{ev.label}</p>
                <p className="text-xs text-muted-foreground">
                  ברירת מחדל: {SOUND_LIBRARY.find((s) => s.id === ev.defaultSound)?.label}
                </p>
              </div>

              <Select
                value={soundId}
                onValueChange={(v) => saveMut.mutate({ event_key: ev.key, sound_id: v, enabled, volume: vol })}
              >
                <SelectTrigger className="w-full lg:w-56" aria-label={`בחירת צליל עבור ${ev.label}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOUND_LIBRARY.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.emoji} {s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex min-w-44 items-center gap-2">
                <Slider
                  value={[Math.round(vol * 100)]}
                  min={0} max={100} step={10}
                  onValueChange={([v]) =>
                    saveMut.mutate({ event_key: ev.key, sound_id: soundId, enabled, volume: (v ?? 60) / 100 })
                  }
                  aria-label={`עוצמת הצליל עבור ${ev.label}`}
                />
                <span className="w-10 text-end text-xs tabular-nums">{Math.round(vol * 100)}%</span>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={enabled}
                  onCheckedChange={(v) => saveMut.mutate({ event_key: ev.key, sound_id: soundId, enabled: v, volume: vol })}
                  aria-label={enabled ? `כבה צליל עבור ${ev.label}` : `הפעל צליל עבור ${ev.label}`}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="min-h-9 min-w-9"
                  onClick={() => playSound(soundId, vol)}
                  aria-label={`השמעה לדוגמה של הצליל עבור ${ev.label}`}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
