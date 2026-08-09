import { getSharedAudioContext } from "@/lib/warm-dashboard-media";

export type SoundCategory = "achievement" | "transition" | "music";

export const SOUND_CATEGORY_LABELS: Record<SoundCategory, string> = {
  achievement: "הישגים וניצחונות",
  transition: "התראה ומעבר",
  music: "מוזיקה כללית",
};

type Recipe =
  | { kind: "beep"; freq: number; duration: number; type?: OscillatorType }
  | { kind: "chime"; notes: number[]; gap?: number; duration?: number }
  | { kind: "alarm"; cycles: number }
  | { kind: "arpeggio"; notes: number[]; gap: number; repeats: number };

export type SoundDef = {
  id: string;
  label: string;
  description: string;
  emoji: string;
  category: SoundCategory;
  recipe: Recipe;
};

const N = { c5: 523, d5: 587, e5: 659, f5: 698, g5: 784, a5: 880, c6: 1046, e6: 1318 };

export const SOUND_LIBRARY: SoundDef[] = [
  // הישגים וניצחונות
  { id: "fanfare", label: "פנפרה", description: "אקורד ניצחון עולה", emoji: "🎺", category: "achievement",
    recipe: { kind: "arpeggio", notes: [N.c5, N.e5, N.g5, N.c6], gap: 0.09, repeats: 2 } },
  { id: "applause", label: "כל הכבוד!", description: "אקורד מז׳ורי נעים", emoji: "👏", category: "achievement",
    recipe: { kind: "chime", notes: [N.c5, N.e5, N.g5, N.c6], gap: 0.08 } },
  { id: "level_up", label: "עלייה בדרגה", description: "צליל התקדמות קצר", emoji: "⭐", category: "achievement",
    recipe: { kind: "arpeggio", notes: [N.g5, N.c6, N.e6], gap: 0.07, repeats: 1 } },
  { id: "point", label: "נקודה", description: "טפיחה קלה על כל נקודה", emoji: "✨", category: "achievement",
    recipe: { kind: "beep", freq: N.e6, duration: 0.16, type: "triangle" } },

  // התראה ומעבר
  { id: "silence", label: "שקט!", description: "צליל חד למשיכת תשומת לב", emoji: "🔕", category: "transition",
    recipe: { kind: "beep", freq: N.a5, duration: 0.5 } },
  { id: "start", label: "פתיחת שיעור", description: "אקורד עולה רגוע", emoji: "📚", category: "transition",
    recipe: { kind: "chime", notes: [N.c5, N.e5, N.g5] } },
  { id: "end", label: "סיום שיעור", description: "אקורד יורד", emoji: "🏁", category: "transition",
    recipe: { kind: "chime", notes: [N.g5, N.e5, N.c5] } },
  { id: "work", label: "זמן עבודה", description: "צליל רך לסימון התחלת עבודה", emoji: "✍️", category: "transition",
    recipe: { kind: "beep", freq: 440, duration: 0.8, type: "sine" } },
  { id: "break", label: "הפסקה", description: "פעמון הפסקה", emoji: "☕", category: "transition",
    recipe: { kind: "chime", notes: [N.e5, N.a5] } },
  { id: "alert", label: "התראה", description: "התראה דחופה", emoji: "🚨", category: "transition",
    recipe: { kind: "alarm", cycles: 3 } },

  // מוזיקה כללית
  { id: "tefilla", label: "לפני תפילה", description: "צליל עדין ומרגיע", emoji: "🕊️", category: "music",
    recipe: { kind: "chime", notes: [N.c5, N.g5, N.c6], duration: 0.9 } },
  { id: "calm_loop", label: "רקע רגוע", description: "מוטיב שקט לזמן לימוד עצמי", emoji: "🎼", category: "music",
    recipe: { kind: "arpeggio", notes: [N.c5, N.e5, N.g5, N.e5], gap: 0.35, repeats: 3 } },
  { id: "niggun", label: "ניגון קצר", description: "מוטיב שמח לפתיחת יום", emoji: "🎵", category: "music",
    recipe: { kind: "arpeggio", notes: [N.c5, N.d5, N.e5, N.g5, N.e5, N.c5], gap: 0.18, repeats: 2 } },
];

export function getSound(id: string): SoundDef | undefined {
  return SOUND_LIBRARY.find((s) => s.id === id);
}

/** App events that can be mapped to a sound. */
export const SOUND_EVENTS = [
  { key: "points_awarded", label: "הענקת נקודות לתלמיד", defaultSound: "point" },
  { key: "badge_awarded", label: "הענקת תג", defaultSound: "fanfare" },
  { key: "reward_redeemed", label: "מימוש פרס", defaultSound: "applause" },
  { key: "campaign_complete", label: "השלמת מבצע כיתתי", defaultSound: "level_up" },
  { key: "timer_end", label: "סיום טיימר שיעור", defaultSound: "end" },
  { key: "lesson_transition", label: "מעבר שיעור / צלצול", defaultSound: "start" },
  { key: "attention", label: "בקשת שקט", defaultSound: "silence" },
  { key: "study_background", label: "רקע לזמן לימוד", defaultSound: "calm_loop" },
] as const;

export type SoundEventKey = (typeof SOUND_EVENTS)[number]["key"];

export function defaultSoundFor(eventKey: string): string {
  return SOUND_EVENTS.find((e) => e.key === eventKey)?.defaultSound ?? "point";
}

/* ------------------------------- playback ------------------------------- */

const MUTE_KEY = "app-sounds-muted";
const VOLUME_KEY = "app-sounds-volume";

export function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}
export function setMuted(muted: boolean) {
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch { /* ignore */ }
}
export function getMasterVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) && v > 0 ? Math.min(1, v) : 0.6;
  } catch { return 0.6; }
}
export function setMasterVolume(v: number) {
  try { localStorage.setItem(VOLUME_KEY, String(Math.min(1, Math.max(0, v)))); } catch { /* ignore */ }
}

/** Plays a sound from the library. `volume` is 0..1 and is scaled by the master volume. */
/* --------------------- uploaded (custom) sounds registry --------------------- */

const customUrls = new Map<string, string>();

/** Caches a signed playback URL for an uploaded sound so `playSound` can use it. */
export function registerCustomSoundUrl(soundId: string, url: string) {
  customUrls.set(soundId, url);
}

export function isCustomSound(soundId: string): boolean {
  return soundId.startsWith("custom:");
}

/** Plays an uploaded audio file, repeating it `repeats` times to lengthen it. */
function playCustom(url: string, gain: number, repeats: number) {
  let left = Math.max(1, Math.round(repeats));
  const audio = new Audio(url);
  audio.volume = Math.min(1, Math.max(0, gain));
  audio.addEventListener("ended", () => {
    left -= 1;
    if (left > 0) { audio.currentTime = 0; void audio.play().catch(() => {}); }
  });
  void audio.play().catch(() => { /* blocked until user interaction */ });
}

/**
 * Plays a sound from the library, or an uploaded sound when `id` starts with `custom:`.
 * `volume` is 0..1 and is scaled by the master volume.
 * `durationScale` stretches built-in sounds (and repeats uploaded ones) — 1 = original length.
 */
export function playSound(id: string, volume = 1, durationScale = 1) {
  if (isMuted()) return;
  const gain = Math.min(1, Math.max(0, volume)) * getMasterVolume();
  if (gain <= 0) return;
  const scale = Number.isFinite(durationScale) ? Math.min(5, Math.max(0.5, durationScale)) : 1;

  if (isCustomSound(id)) {
    const url = customUrls.get(id);
    if (url) playCustom(url, gain, scale);
    return;
  }

  const def = getSound(id);
  if (!def) return;
  try {
    const ctx = getSharedAudioContext() ?? new AudioContext();
    ctx.resume?.().catch(() => {});
    const r = def.recipe;
    if (r.kind === "beep") {
      tone(ctx, r.freq, r.duration * scale, r.type ?? "sine", 0, gain);
    } else if (r.kind === "chime") {
      const gap = (r.gap ?? 0.15) * scale;
      r.notes.forEach((f, i) => tone(ctx, f, (r.duration ?? 0.4) * scale, "sine", i * gap, gain));
    } else if (r.kind === "arpeggio") {
      const gap = r.gap * scale;
      const repeats = Math.max(1, Math.round(r.repeats * scale));
      let step = 0;
      for (let rep = 0; rep < repeats; rep++) {
        for (const f of r.notes) {
          tone(ctx, f, Math.max(0.2, gap), "sine", step * gap, gain);
          step++;
        }
      }
    } else {
      const cycles = Math.max(1, Math.round(r.cycles * scale));
      for (let i = 0; i < cycles; i++) {
        tone(ctx, 880, 0.18, "square", i * 0.45, gain);
        tone(ctx, 660, 0.18, "square", i * 0.45 + 0.22, gain);
      }
    }
  } catch { /* audio unavailable — silent */ }
}

function tone(
  ctx: AudioContext, freq: number, dur: number,
  type: OscillatorType, delay: number, gain: number,
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  g.connect(ctx.destination);
  const t0 = ctx.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.25 * gain), t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
