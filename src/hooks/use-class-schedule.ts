import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getScheduleRange } from "@/lib/schedule-view.functions";

/**
 * קריאה משותפת של מערכת השעות. מפתח השאילתה מתחיל ב-"schedule", וכל שינוי שנשמר באפליקציה
 * מרענן אותו (ראו MutationCache ב-router.tsx), כך שכל מסך פתוח מציג את המערכת העדכנית.
 */
export function useScheduleRange(classId: string | undefined, from: string | null, to: string | null) {
  const fn = useServerFn(getScheduleRange);
  return useQuery({
    queryKey: ["schedule", classId, from, to],
    enabled: !!classId && !!from && !!to,
    staleTime: 30_000,
    queryFn: () => fn({ data: { classId: classId!, from: from!, to: to! } }),
  });
}
