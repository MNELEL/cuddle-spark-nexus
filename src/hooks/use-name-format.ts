import { useCallback, useEffect, useState } from "react";
import type { NameFormat } from "@/lib/student-name";

const KEY = "student-name-format";
const EVENT = "student-name-format-change";

function read(): NameFormat {
  try {
    return localStorage.getItem(KEY) === "last_first" ? "last_first" : "first_last";
  } catch {
    return "first_last";
  }
}

/** בחירת תצוגת השם נשמרת במכשיר ומשותפת לכל המסכים. */
export function useNameFormat(): [NameFormat, (f: NameFormat) => void] {
  const [format, setFormat] = useState<NameFormat>("first_last");
  useEffect(() => {
    setFormat(read());
    const sync = () => setFormat(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = useCallback((f: NameFormat) => {
    try { localStorage.setItem(KEY, f); } catch { /* אחסון חסום */ }
    setFormat(f);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [format, update];
}
