import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSharedAudioContext } from "@/lib/warm-dashboard-media";

export const Route = createFileRoute("/_authenticated/sound-board")({
  component: SoundBoardPage,
});

type Sound =
  | { kind: "beep"; freq: number; duration: number; type?: OscillatorType }
  | { kind: "chime"; notes: number[]; gap?: number }
  | { kind: "alarm"; cycles: number };

const EVENTS: { id: string; emoji: string; label: string; description: string; sound: Sound }[] = [
  { id: "silence", emoji: "🔕", label: "שקט!", description: "צליל חד למשיכת תשומת לב", sound: { kind: "beep", freq: 880, duration: 0.5 } },
  { id: "start",   emoji: "📚", label: "פתיחת שיעור", description: "אקורד עולה רגוע", sound: { kind: "chime", notes: [523, 659, 784] } },
  { id: "end",     emoji: "🏁", label: "סיום שיעור", description: "אקורד יורד", sound: { kind: "chime", notes: [784, 659, 523] } },
  { id: "applause",emoji: "👏", label: "כל הכבוד!", description: "אקורד מז'ורי נעים", sound: { kind: "chime", notes: [523, 659, 784, 1046], gap: 0.08 } },
  { id: "work",    emoji: "✍️", label: "זמן עבודה", description: "צליל רך לסימון התחלת עבודה", sound: { kind: "beep", freq: 440, duration: 0.8, type: "sine" } },
  { id: "break",   emoji: "☕", label: "הפסקה", description: "פעמון הפסקה", sound: { kind: "chime", notes: [659, 880] } },
  { id: "alert",   emoji: "🚨", label: "התראה", description: "התראה דחופה", sound: { kind: "alarm", cycles: 3 } },
  { id: "tefilla", emoji: "🕊️", label: "תפילה", description: "צליל עדין לפני תפילה", sound: { kind: "chime", notes: [523, 784, 1046] } },
];

export default function SoundBoardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">לוח צלילים לכיתה</h1>
        <p className="text-sm text-muted-foreground">לחיצה משמיעה צליל לכיתה — מתאים לציון מעברים, תפילה, וסיום שיעור.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EVENTS.map((ev) => (
          <Card key={ev.id} className="transition-transform hover:scale-[1.01]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-2xl" aria-hidden>{ev.emoji}</span>{ev.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">{ev.description}</p>
              <Button onClick={() => play(ev.sound)} className="w-full">השמע</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function play(s: Sound) {
  try {
    const ctx = getSharedAudioContext() ?? new AudioContext();
    ctx.resume?.().catch(() => {});
    if (s.kind === "beep") {
      tone(ctx, s.freq, s.duration, s.type ?? "sine", 0);
    } else if (s.kind === "chime") {
      const gap = s.gap ?? 0.15;
      s.notes.forEach((f, i) => tone(ctx, f, 0.4, "sine", i * gap));
    } else {
      for (let i = 0; i < s.cycles; i++) {
        tone(ctx, 880, 0.18, "square", i * 0.45);
        tone(ctx, 660, 0.18, "square", i * 0.45 + 0.22);
      }
    }
  } catch { /* ignore */ }
}

function tone(ctx: AudioContext, freq: number, dur: number, type: OscillatorType, delay: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  o.connect(g); g.connect(ctx.destination);
  const t0 = ctx.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0); o.stop(t0 + dur + 0.02);
}