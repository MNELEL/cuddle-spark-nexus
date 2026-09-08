import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  elapsedSince,
  hebrewDayInfo,
  hebrewYearBounds,
  isoOf,
  type ElapsedSpan,
  type HebrewDayInfo,
} from "@/lib/hebrew-calendar";

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
  /** תאריך-החלוף — היום שממנו נמדד המרחק. ברירת המחדל נגזרת מהלוח האמיתי (א׳ תשרי). */
  elapsedFrom: Date;
  elapsedFromInfo: HebrewDayInfo;
  /** האם תאריך-החלוף הוזן ידנית (אחרת הוא מתעדכן לבד מהלוח). */
  isElapsedCustom: boolean;
  /** המרחק בין תאריך-החלוף לתאריך הפעיל — מתחשב אוטומטית. */
  elapsed: ElapsedSpan;
  setElapsedFrom: (d: Date) => void;
  resetElapsedFrom: () => void;
};

/**
 * התאריך נשמר יחד עם היום שבו נבחר, כך שהבחירה תקפה רק לאותו יום.
 * ביום חדש הלוח חוזר אוטומטית לתאריך העברי האמיתי — הלוח האמיתי הוא המקור.
 */
const STORAGE_KEY = "hebrew-anchor-date";
/** תאריך-החלוף נשמר ללא תפוגה; כשאין ערך שמור הוא נגזר מהלוח האמיתי. */
const ELAPSED_KEY = "hebrew-anchor-elapsed-from";

const Ctx = createContext<AnchorContext | null>(null);

export function HebrewAnchorProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(() => new Date());
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [elapsedIso, setElapsedIso] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    const [iso, savedOn] = stored.split("|");
    // בחירה ידנית שנשמרה ביום אחר אינה תקפה יותר — הלוח חוזר לעצמו.
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) && savedOn === isoOf(new Date())) {
      setSelectedIso(iso);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const next = new Date();
      setNow(next);
      // חצות: מסירים בחירה ידנית של אתמול כדי שהלוח יתעדכן לבד.
      setSelectedIso((prev) => {
        if (!prev) return prev;
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored && stored.split("|")[1] !== isoOf(next)) {
          window.localStorage.removeItem(STORAGE_KEY);
          return null;
        }
        return prev;
      });
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(ELAPSED_KEY);
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) setElapsedIso(stored);
  }, []);

  const setElapsedFrom = useCallback((d: Date) => {
    const iso = isoOf(d);
    setElapsedIso(iso);
    try {
      window.localStorage.setItem(ELAPSED_KEY, iso);
    } catch {
      /* מצב פרטי — נשאר בזיכרון בלבד */
    }
  }, []);

  const resetElapsedFrom = useCallback(() => {
    setElapsedIso(null);
    try {
      window.localStorage.removeItem(ELAPSED_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setDate = useCallback((d: Date) => {
    const iso = isoOf(d);
    setSelectedIso(iso);
    try {
      window.localStorage.setItem(STORAGE_KEY, `${iso}|${isoOf(new Date())}`);
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
    // ברירת המחדל של תאריך-החלוף: תחילת שנת הלימודים העברית של התאריך הפעיל —
    // כך שהוא מתעדכן לבד עם התקדמות הלוח, בלי הזנה ידנית.
    const autoFrom = hebrewYearBounds(date).start;
    const elapsedFrom = elapsedIso ? new Date(`${elapsedIso}T00:00:00`) : autoFrom;
    return {
      date, now, isCustom, info: hebrewDayInfo(date), setDate, reset,
      elapsedFrom,
      elapsedFromInfo: hebrewDayInfo(elapsedFrom),
      isElapsedCustom: !!elapsedIso,
      elapsed: elapsedSince(elapsedFrom, date),
      setElapsedFrom, resetElapsedFrom,
    };
  }, [now, selectedIso, elapsedIso, setDate, reset, setElapsedFrom, resetElapsedFrom]);

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
    elapsedFrom: hebrewYearBounds(fallbackNow).start,
    elapsedFromInfo: hebrewDayInfo(hebrewYearBounds(fallbackNow).start),
    isElapsedCustom: false,
    elapsed: elapsedSince(hebrewYearBounds(fallbackNow).start, fallbackNow),
    setElapsedFrom: () => {},
    resetElapsedFrom: () => {},
  };
}
