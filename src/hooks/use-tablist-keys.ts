import { useCallback } from "react";

/**
 * ניווט מקלדת עבור רשימת טאבים (role="tablist") בממשק RTL.
 * מחזיר onKeyDown שמטפל בחצים (הפוך ל-RTL), Home ו-End,
 * ומעביר גם מיקוד וגם בחירה לטאב הבא/הקודם (דפוס automatic activation).
 */
export function useTablistKeys<T extends string>(
  ids: readonly T[],
  current: T,
  onSelect: (id: T) => void,
) {
  return useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
      if (!keys.includes(e.key)) return;
      const index = ids.indexOf(current);
      if (index < 0) return;
      let next = index;
      // RTL: חץ שמאלה מתקדם, חץ ימינה חוזר
      if (e.key === "ArrowLeft") next = (index + 1) % ids.length;
      else if (e.key === "ArrowRight") next = (index - 1 + ids.length) % ids.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = ids.length - 1;
      if (next === index) return;
      e.preventDefault();
      const target = ids[next]!;
      onSelect(target);
      const list = e.currentTarget.closest('[role="tablist"]') ?? e.currentTarget;
      const tabs = list.querySelectorAll<HTMLElement>('[role="tab"]');
      tabs[next]?.focus();
    },
    [ids, current, onSelect],
  );
}
