import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSoundPreferences } from "@/lib/sound-preferences.functions";
import { listCustomSoundsWithUrls } from "@/lib/custom-sounds.functions";
import {
  defaultSoundFor, playSound, registerCustomSoundUrl, isCustomSound, type SoundEventKey,
} from "@/lib/sounds";

/**
 * Plays the sound the הרב mapped to an app event (points, badges, timers…).
 * Falls back to the built-in default when no preference is saved.
 */
export function useAppSounds() {
  const fetchPrefs = useServerFn(listSoundPreferences);
  const fetchCustom = useServerFn(listCustomSoundsWithUrls);
  const { data: prefs = [] } = useQuery({
    queryKey: ["sound-preferences"],
    queryFn: () => fetchPrefs(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Uploaded sounds need signed URLs registered before they can be played.
  const hasCustom = prefs.some((p) => isCustomSound(p.sound_id));
  const { data: customSounds = [] } = useQuery({
    queryKey: ["custom-sounds-urls"],
    queryFn: () => fetchCustom(),
    enabled: hasCustom,
    staleTime: 30 * 60_000,
    retry: false,
  });
  for (const s of customSounds) {
    if (s.url) registerCustomSoundUrl(`custom:${s.id}`, s.url);
  }

  const playEvent = useCallback(
    (eventKey: SoundEventKey | string) => {
      const pref = prefs.find((p) => p.event_key === eventKey);
      if (pref && !pref.enabled) return;
      playSound(
        pref?.sound_id ?? defaultSoundFor(eventKey),
        pref?.volume ?? 0.6,
        pref?.duration_scale ?? 1,
      );
    },
    [prefs],
  );

  return { playEvent, preferences: prefs };
}
