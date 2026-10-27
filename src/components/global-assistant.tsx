import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AiAssistantDock } from "@/components/ai-assistant-dock";
import { listClasses } from "@/lib/classes.functions";

const LAST_KEY = "assistant-last-class";
// מסכים שהנתיב שלהם מכיל מזהה כיתה. מזהים אחרים (למשל מלמד) לא נחשבים.
const CLASS_PATH = /^\/(?:classes|weekly-schedule|pacing|calendar|bulletins|daily|reports)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** העוזר האישי בכל מסך. הכיתה נלקחת מהנתיב, ובמסכים כלליים מהכיתה האחרונה שנפתחה. */
export function GlobalAssistant() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const listCls = useServerFn(listClasses);
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => listCls() });
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => { try { setLast(localStorage.getItem(LAST_KEY)); } catch { /* אחסון חסום */ } }, []);

  const fromPath = path.match(CLASS_PATH)?.[1] ?? null;
  useEffect(() => {
    if (!fromPath) return;
    setLast(fromPath);
    try { localStorage.setItem(LAST_KEY, fromPath); } catch { /* אחסון חסום */ }
  }, [fromPath]);

  const list = classes as { id: string; status?: string }[];
  const usable = (id: string | null) => !!id && list.some((c) => c.id === id && c.status !== "archived");
  const classId = usable(fromPath) ? fromPath : usable(last) ? last : list.find((c) => c.status !== "archived")?.id ?? null;
  if (!classId) return null;
  return <AiAssistantDock key={classId} classId={classId} />;
}
