import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSoundPreferences } from "@/lib/sound-preferences.functions";
import { defaultSoundFor, playSound, type SoundEventKey } from "@/lib/sounds";

/**
 * Plays the sound the הרב mapped to an app event (points, badges, timers…).
 * Falls back to the built-in default when no preference is saved.
 */
export function useAppSounds() {
  const fetchPrefs = useServerFn(listSoundPreferences);
  const { data: prefs = [] } = useQuery({
    queryKey: ["sound-preferences"],
    queryFn: () => fetchPrefs(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const playEvent = useCallback(
    (eventKey: SoundEventKey | string) => {
      const pref = prefs.find((p) => p.event_key === eventKey);
      if (pref && !pref.enabled) return;
      playSound(pref?.sound_id ?? defaultSoundFor(eventKey), pref?.volume ?? 0.6);
    },
    [prefs],
  );

  return { playEvent, preferences: prefs };
}
