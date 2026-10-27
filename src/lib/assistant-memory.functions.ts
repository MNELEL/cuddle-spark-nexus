import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callLovableAI } from "./ai-gateway.server";

/**
 * שיחות וזיכרון של העוזר האישי.
 * שיחות נשמרות למשתמש בלבד ואפשר להמשיך אותן. זיכרון הוא קבוצת משפטים קצרים על סגנון העבודה וההעדפות של הרב,
 * שנלמדים מהשיחות ומוזנים לעוזר בכל שיחה. לא נשמרים שמות תלמידים או פרטים אישיים.
 */
export type AssistantThreadRow = { id: string; title: string; class_id: string | null; updated_at: string };
export type AssistantMessageRow = { role: "user" | "assistant"; content: string; created_at: string };
export type AssistantMemoryKind = "style" | "fact" | "preference";
export type AssistantMemoryRow = { id: string; kind: AssistantMemoryKind; content: string; created_at: string };

const uuid = z.string().uuid();
const MEMORY_CAP = 60;

export const listAssistantThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AssistantThreadRow[]> => {
    const { data, error } = await (context.supabase as any)
      .from("assistant_threads").select("id,title,class_id,updated_at")
      .eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(30);
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת השיחות נכשלה."); }
    return (data ?? []) as AssistantThreadRow[];
  });

export const getAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<AssistantMessageRow[]> => {
    const { data: rows, error } = await (context.supabase as any)
      .from("assistant_messages").select("role,content,created_at")
      .eq("thread_id", data.id).eq("user_id", context.userId)
      .order("created_at", { ascending: true }).limit(60);
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת השיחה נכשלה."); }
    return (rows ?? []) as AssistantMessageRow[];
  });

export const deleteAssistantThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("assistant_threads").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) { console.error("[DB Error]", error); throw new Error("מחיקת השיחה נכשלה."); }
    return { ok: true };
  });

export const listAssistantMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AssistantMemoryRow[]> => {
    const { data, error } = await (context.supabase as any)
      .from("assistant_memory").select("id,kind,content,created_at")
      .eq("user_id", context.userId).order("created_at", { ascending: false }).limit(MEMORY_CAP);
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת הזיכרון נכשלה."); }
    return (data ?? []) as AssistantMemoryRow[];
  });

export const addAssistantMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ content: z.string().trim().min(3).max(400), kind: z.enum(["style", "fact", "preference"]).default("fact") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("assistant_memory").insert({ user_id: context.userId, kind: data.kind, content: data.content });
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת הזיכרון נכשלה."); }
    return { ok: true };
  });

export const deleteAssistantMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("assistant_memory").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) { console.error("[DB Error]", error); throw new Error("מחיקת הזיכרון נכשלה."); }
    return { ok: true };
  });

/** מחלץ משיחה עד שלושה משפטים קבועים על סגנון העבודה וההעדפות של הרב, ושומר אותם בזיכרון. */
export const learnFromThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: msgs, error } = await supabase
      .from("assistant_messages").select("role,content")
      .eq("thread_id", data.threadId).eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(24);
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת השיחה נכשלה."); }
    const list = ((msgs ?? []) as { role: string; content: string }[]).reverse();
    if (list.filter((m) => m.role === "user").length < 2) return { added: 0 };

    const [{ data: known }] = await Promise.all([
      supabase.from("assistant_memory").select("content").eq("user_id", context.userId).limit(MEMORY_CAP),
    ]);
    const knownSet = new Set(((known ?? []) as { content: string }[]).map((k) => k.content.trim()));

    const raw = (await callLovableAI({
      jsonResponse: true,
      messages: [
        {
          role: "system",
          content: `אתה מחלץ מידע שימושי לטווח ארוך מתוך שיחה בין רב/מלמד לבין העוזר האישי שלו.
החזר עד 3 משפטים קצרים בעברית על סגנון העבודה, ההעדפות והנהלים הקבועים של הרב (איך הוא אוהב שיכתבו לו, איך הוא מארגן שבוע, מה חשוב לו בעלון וכדומה).
חוקים: אל תכלול שמות תלמידים, כתובות או פרטים אישיים. אל תכלול עובדות חד-פעמיות או משימות של היום. אם אין מה לשמור, החזר מערך ריק.
פורמט: {"items":[{"kind":"style|fact|preference","content":"..."}]}`,
        },
        { role: "user", content: list.map((m) => `${m.role === "user" ? "הרב" : "העוזר"}: ${m.content.slice(0, 600)}`).join("\n") },
      ],
    })) || "{}";
    let items: { kind?: string; content?: string }[] = [];
    try { items = (JSON.parse(raw) as { items?: typeof items }).items ?? []; } catch { /* ignore */ }

    const rows = items
      .filter((i) => typeof i.content === "string" && i.content.trim().length >= 3 && i.content.trim().length <= 400)
      .filter((i) => !knownSet.has(i.content!.trim()))
      .slice(0, 3)
      .map((i) => ({
        user_id: context.userId,
        kind: i.kind === "style" || i.kind === "preference" ? i.kind : "fact",
        content: i.content!.trim(),
        source_thread_id: data.threadId,
      }));
    if (rows.length) {
      const { error: insErr } = await supabase.from("assistant_memory").insert(rows);
      if (insErr) { console.error("[DB Error]", insErr); return { added: 0 }; }
      // שומרים רק את החדשים ביותר
      const { data: all } = await supabase.from("assistant_memory").select("id").eq("user_id", context.userId).order("created_at", { ascending: false });
      const extra = ((all ?? []) as { id: string }[]).slice(MEMORY_CAP).map((r) => r.id);
      if (extra.length) await supabase.from("assistant_memory").delete().in("id", extra).eq("user_id", context.userId);
    }
    return { added: rows.length };
  });

/* ---- עזרים לשרת (לא קריאות לקוח) ---- */

export async function buildAssistantMemoryString(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("assistant_memory").select("kind,content").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(20);
  const rows = (data ?? []) as { kind: string; content: string }[];
  return rows.length ? rows.map((r) => `- ${r.content}`).join("\n") : "";
}

/** שומר זוג הודעות (שאלה ותשובה) בשיחה קיימת, או פותח שיחה חדשה. מחזיר את מזהה השיחה. */
export async function appendAssistantMessages(
  supabase: any, userId: string,
  p: { threadId?: string | null; classId: string | null; userText: string; assistantText: string },
): Promise<string | null> {
  try {
    let threadId = p.threadId ?? null;
    if (threadId) {
      const { data } = await supabase.from("assistant_threads").select("id").eq("id", threadId).eq("user_id", userId).maybeSingle();
      if (!data) threadId = null;
    }
    if (!threadId) {
      const { data, error } = await supabase.from("assistant_threads")
        .insert({ user_id: userId, class_id: p.classId, title: p.userText.trim().slice(0, 60) })
        .select("id").single();
      if (error) throw error;
      threadId = data.id as string;
    }
    const { error: mErr } = await supabase.from("assistant_messages").insert([
      { thread_id: threadId, user_id: userId, role: "user", content: p.userText.slice(0, 4000) },
      { thread_id: threadId, user_id: userId, role: "assistant", content: p.assistantText.slice(0, 6000) },
    ]);
    if (mErr) throw mErr;
    await supabase.from("assistant_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId).eq("user_id", userId);
    return threadId;
  } catch (e) {
    console.error("[assistant thread save]", e);
    return p.threadId ?? null;
  }
}
