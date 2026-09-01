import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type PayloadValue = string | number | boolean | null;

/** פריט בתור האישורים — כרגע רק אירועים חריגים (intent = "add_incident"). */
export type PendingUpdateItem = {
  id: string;
  class_id: string;
  class_name: string;
  intent: string;
  summary: string;
  student_name: string | null;
  original_text: string | null;
  payload: Record<string, PayloadValue>;
  created_at: string;
};

const SEVERITY_HE: Record<string, string> = { low: "קלה", medium: "בינונית", high: "חמורה" };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeDate(v: unknown): string {
  const r = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(String(v ?? ""));
  return r.success ? r.data : todayIso();
}

/** רשימת הפריטים הממתינים לאישור בכיתות של המלמד המחובר. */
export const listPendingUpdates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingUpdateItem[]> => {
    const { supabase } = context;

    const { data, error } = await supabase
      .from("pending_updates")
      .select("id,class_id,intent,summary,student_name,original_text,payload,created_at,classes(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[DB Error]", error);
      throw new Error("טעינת תור האישורים נכשלה");
    }

    return (data ?? []).map((row) => {
      const cls = row.classes as { name?: string } | null;
      const payload = row.payload as Record<string, PayloadValue> | null;
      return {
        id: row.id,
        class_id: row.class_id,
        class_name: cls?.name ?? "",
        intent: row.intent,
        summary: row.summary,
        student_name: row.student_name,
        original_text: row.original_text,
        payload: payload ?? {},
        created_at: row.created_at,
      };
    });
  });

const idInput = z.object({ id: z.string().uuid(), reviewNotes: z.string().max(2000).optional() });

/** בעלות: הכיתה של הפריט חייבת להיות של המלמד המחובר. */
async function loadOwnedPending(
  supabase: SupabaseClient<Database>,
  id: string,
  userId: string,
) {
  const { data: row, error } = await supabase
    .from("pending_updates")
    .select("id,class_id,intent,payload,student_name,status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[DB Error]", error);
    throw new Error("הפעולה נכשלה. נסה שוב.");
  }
  if (!row) throw new Error("הפריט לא נמצא");

  const { data: cls, error: cErr } = await supabase
    .from("classes")
    .select("id")
    .eq("id", row.class_id)
    .eq("owner_id", userId)
    .maybeSingle();

  if (cErr) {
    console.error("[DB Error]", cErr);
    throw new Error("הפעולה נכשלה. נסה שוב.");
  }
  if (!cls) throw new Error("אין הרשאה לפריט זה");
  if (row.status !== "pending") throw new Error("הפריט כבר טופל");

  return row;
}

/** מאשרת פריט: כותבת בפועל ל-discipline_events ומסמנת approved. */
export const approvePendingUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = await loadOwnedPending(supabase, data.id, userId);
    const payload = (row.payload ?? {}) as Record<string, unknown>;

    if (row.intent === "add_incident") {
      const severityParsed = z
        .enum(["low", "medium", "high"])
        .safeParse(String(payload.severity ?? "medium"));
      if (!severityParsed.success) throw new Error("דרגת חומרה לא תקינה");
      const severityHe = SEVERITY_HE[severityParsed.data];

      const description = String(payload.description ?? "").slice(0, 1900);
      if (!description.trim()) throw new Error("חסר תיאור לאירוע החריג");

      const studentId = z.string().uuid().safeParse(String(payload.student_id ?? ""));
      if (!studentId.success) throw new Error("מזהה תלמיד לא תקין");

      const { error } = await supabase.from("discipline_events").insert({
        class_id: row.class_id,
        student_id: studentId.data,
        type: "negative",
        category: String(payload.category ?? "incident").slice(0, 80),
        description: `[אירוע חריג · חומרה ${severityHe}] ${description}`,
        date: safeDate(payload.date),
      });
      if (error) {
        console.error("[DB Error]", error);
        throw new Error("רישום האירוע נכשל. נסה שוב.");
      }
    } else {
      throw new Error("סוג פריט שאינו נתמך לאישור");
    }

    const { error: uErr } = await supabase
      .from("pending_updates")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        ...(data.reviewNotes ? { review_notes: data.reviewNotes.slice(0, 2000) } : {}),
      })
      .eq("id", data.id);

    if (uErr) {
      console.error("[DB Error]", uErr);
      throw new Error("עדכון הסטטוס נכשל");
    }

    return { ok: true as const };
  });

/** דוחה פריט — לא נכתב דבר ל-discipline_events. */
export const rejectPendingUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => idInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await loadOwnedPending(supabase, data.id, userId);

    const { error } = await supabase
      .from("pending_updates")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        ...(data.reviewNotes ? { review_notes: data.reviewNotes.slice(0, 2000) } : {}),
      })
      .eq("id", data.id);

    if (error) {
      console.error("[DB Error]", error);
      throw new Error("דחיית הפריט נכשלה");
    }

    return { ok: true as const };
  });
