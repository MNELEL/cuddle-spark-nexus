/**
 * Global preference: is the Gregorian ("לועזי") date shown alongside the Hebrew one?
 *
 * The Hebrew date is ALWAYS the primary display across the app. The Gregorian
 * date is opt-in — the user turns it on when they want to know it.
 */
import { useSyncExternalStore } from "react";
import { hebrewDate } from "@/lib/hebrew-date";

const KEY = "showGregorianDates";
const EVENT = "gregorian-visibility-change";

const listeners = new Set<() => void>();

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (typeof window !== "undefined") {
    window.addEventListener(EVENT, cb);
    window.addEventListener("storage", cb);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener(EVENT, cb);
      window.removeEventListener("storage", cb);
    }
  };
}

export function setShowGregorian(next: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* ignore private-mode failures */
  }
  window.dispatchEvent(new Event(EVENT));
  listeners.forEach((cb) => cb());
}

/** `true` when the user asked to also see Gregorian dates. SSR-safe (false). */
export function useShowGregorian(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** ISO date/timestamp -> "י״ב כסלו תשפ״ו" (Gregorian appended only when opted in). */
export function useDateLabel() {
  const showGreg = useShowGregorian();
  return (value: string | Date | null | undefined) => {
    const heb = hebrewDate(value);
    if (!heb) return "";
    if (!showGreg) return heb;
    const d = value instanceof Date ? value : new Date(String(value));
    if (isNaN(d.getTime())) return heb;
    return `${heb} (${d.toLocaleDateString("he-IL")})`;
  };
}
