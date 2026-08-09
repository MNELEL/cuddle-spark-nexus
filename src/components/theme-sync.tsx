import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getThemePreference } from "@/lib/theme-preference.functions";
import { THEMES, useTheme, type ThemeName } from "@/hooks/use-theme";

/**
 * Applies the theme saved on the account right after authentication, so the
 * choice follows the user across devices. Runs once per session: after that,
 * local changes win until the user saves a new preference.
 */
export function ThemeSync() {
  const { theme, setTheme } = useTheme();
  const fetchPref = useServerFn(getThemePreference);
  const applied = useRef(false);

  const { data } = useQuery({
    queryKey: ["theme-preference"],
    queryFn: () => fetchPref(),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (applied.current || !data) return;
    applied.current = true;
    const remote = data.theme as ThemeName | null;
    if (remote && remote !== theme && THEMES.some((t) => t.id === remote)) setTheme(remote);
  }, [data, theme, setTheme]);

  return null;
}
