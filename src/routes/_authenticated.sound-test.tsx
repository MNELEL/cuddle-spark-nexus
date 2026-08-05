import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Volume2, VolumeX, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import {
  SOUND_EVENTS, SOUND_LIBRARY, defaultSoundFor, isMuted, getMasterVolume,
} from "@/lib/sounds";
import { useAppSounds } from "@/hooks/use-app-sounds";

export const Route = createFileRoute("/_authenticated/sound-test")({
  component: SoundTestPage,
  head: () => ({
    meta: [
      { title: "בדיקת צלילי אירועים · הכיתה שלי" },
      { name: "description", content: "מסך בדיקה להשמעת דוגמת צליל לכל אירוע באפליקציה — סיום טיימר, הענקת תג ומעבר שיעור — עם סטטוס מוכנות." },
      { property: "og:title", content: "בדיקת צלילי אירועים · הכיתה שלי" },
      { property: "og:description", content: "השמעת דוגמה לכל אירוע צליל וסטטוס מוכנות." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function SoundTestPage() {
  const { playEvent, preferences } = useAppSounds();
  const [muted, setMutedState] = useState(false);
  const [master, setMaster] = useState(0.6);
  const [lastPlayed, setLastPlayed] = useState<string | null>(null);

  useEffect(() => {
    setMutedState(isMuted());
    setMaster(getMasterVolume());
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">בדיקת צלילי אירועים</h1>
        <p className="text-sm text-muted-foreground">
          כאן אפשר להשמיע דוגמה לכל אירוע באפליקציה בדיוק כפי שהוא יישמע בפועל, ולראות אם הוא מוכן להשמעה.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">סטטוס כללי</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {muted ? (
            <Badge variant="destructive" className="gap-1">
              <VolumeX className="h-3.5 w-3.5" aria-hidden /> הצלילים מושתקים
            </Badge>
          ) : (
            <Badge className="gap-1">
              <Volume2 className="h-3.5 w-3.5" aria-hidden /> שמע פעיל
            </Badge>
          )}
          <Badge variant="outline">עוצמה כללית: {Math.round(master * 100)}%</Badge>
          <Button asChild variant="outline" size="sm">
            <Link to="/sound-board">
              <SlidersHorizontal className="ms-1 h-4 w-4" aria-hidden /> הגדרות סאונד
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2" aria-live="polite">
        {SOUND_EVENTS.map((ev) => {
          const pref = preferences.find((p) => p.event_key === ev.key);
          const soundId = pref?.sound_id ?? defaultSoundFor(ev.key);
          const sound = SOUND_LIBRARY.find((s) => s.id === soundId);
          const enabled = pref?.enabled ?? true;
          const vol = pref?.volume ?? 0.6;
          const ready = enabled && !muted && vol > 0 && master > 0;
          const status = muted
            ? "מושתק כללית"
            : !enabled
              ? "כבוי לאירוע זה"
              : vol === 0
                ? "עוצמה 0%"
                : "מוכן";
          return (
            <Card key={ev.key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span className="flex items-center gap-2">
                    <span className="text-xl" aria-hidden>{sound?.emoji ?? "🔔"}</span>
                    {ev.label}
                  </span>
                  <Badge variant={ready ? "default" : "secondary"} className="gap-1">
                    {ready && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
                    {status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  צליל: {sound?.label ?? soundId}
                  {pref ? "" : " (ברירת מחדל)"} · עוצמה {Math.round(vol * 100)}%
                </p>
                <Button
                  className="w-full"
                  variant={ready ? "default" : "outline"}
                  onClick={() => {
                    playEvent(ev.key);
                    setLastPlayed(ev.label);
                  }}
                  aria-label={`השמע דוגמה לאירוע ${ev.label}`}
                >
                  <Play className="ms-1 h-4 w-4" aria-hidden /> השמע דוגמה
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground" role="status">
        {lastPlayed ? `הושמעה דוגמה עבור: ${lastPlayed}` : "טרם הושמעה דוגמה."}
      </p>
    </div>
  );
}
