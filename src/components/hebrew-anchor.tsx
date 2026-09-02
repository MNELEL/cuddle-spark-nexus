import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { hebrewDayInfo, isoOf, type HebrewDayInfo } from "@/lib/hebrew-calendar";

/**
 * מקור אמת יחיד לתאריך העברי הפעיל בכל האפליקציה.
 * כל שינוי בתאריך (או בתאריך-החלוף) מתגלגל בזמן אמת לכל מסך שקורא ל-useHebrewAnchor,
 * במקום להציג תאריך עברי סטטי בכל מסך בנפרד.
 */
type AnchorContext = {
  /** התאריך הפעיל — התאריך הנבחר, או היום כשלא נבחר דבר. */
  date: Date;
  /** התאריך הלועזי של "עכשיו", מתעדכן כל דקה. */
  now: Date;
  /** האם המשתמש בחר תאריך שאינו היום. */
  isCustom: boolean;
  info: HebrewDayInfo;
  setDate: (d: Date) => void;
  reset: () => void;
};

const STORAGE_KEY = "hebrew-anchor-date";

const Ctx = createContext<AnchorContext | null>(null);

export function HebrewAnchorProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(() => new Date());
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) setSelectedIso(stored);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const setDate = useCallback((d: Date) => {
    const iso = isoOf(d);
    setSelectedIso(iso);
    try {
      window.localStorage.setItem(STORAGE_KEY, iso);
    } catch {
      /* מצב פרטי — נשאר בזיכרון בלבד */
    }
  }, []);

  const reset = useCallback(() => {
    setSelectedIso(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<AnchorContext>(() => {
    const todayIso = isoOf(now);
    const isCustom = !!selectedIso && selectedIso !== todayIso;
    const date = isCustom ? new Date(`${selectedIso}T00:00:00`) : now;
    return { date, now, isCustom, info: hebrewDayInfo(date), setDate, reset };
  }, [now, selectedIso, setDate, reset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** קורא את התאריך העברי הפעיל. עובד גם ללא Provider (חוזר להיום). */
export function useHebrewAnchor(): AnchorContext {
  const ctx = useContext(Ctx);
  const fallbackNow = useMemo(() => new Date(), []);
  if (ctx) return ctx;
  return {
    date: fallbackNow,
    now: fallbackNow,
    isCustom: false,
    info: hebrewDayInfo(fallbackNow),
    setDate: () => {},
    reset: () => {},
  };
}
