import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AUDIT_SOURCE_MANUAL_INSIGHT } from "./audit-sources";

/** תובנה יומית שהמלמד הזין בעצמו (insight_type = "manual"). */
export type ManualInsight = {
  id: string;
  class_id: string;
  class_name: string;
  student_id: string | null;
  student_name: string | null;
  insight_date: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  is_dismissed: boolean;
  created_at: string;
};

const MANUAL_TYPE = "manual";
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");
const severity = z.enum(["low", "medium", "high"]);

async function assertOwnsClass(
  supabase: { from: (t: string) => any },
  classId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (error) { console.error("[DB Error]", error); throw new Error("בדיקת ההרשאות נכשלה."); }
  if (!data) throw new Error("הכיתה לא נמצאה");
}

/** תובנות ידניות לטווח תאריכים (או ליום בודד) בכיתה. */
export const listManualInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ classId: z.string().uuid(), from: isoDate, to: isoDate }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ManualInsight[]> => {
    await assertOwnsClass(context.supabase as never, data.classId, context.userId);
    const { data: rows, error } = await (context.supabase as any)
      .from("orchestrator_insights")
      .select(
        "id,class_id,student_id,insight_date,severity,title,description,is_dismissed,created_at," +
          "classes(name),students(name)",
      )
      .eq("class_id", data.classId)
      .eq("insight_type", MANUAL_TYPE)
      .gte("insight_date", data.from)
      .lte("insight_date", data.to)
      .order("insight_date", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת התובנות נכשלה."); }

    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id,
      class_id: r.class_id,
      class_name: r.classes?.name ?? "",
      student_id: r.student_id,
      student_name: r.students?.name ?? null,
      insight_date: String(r.insight_date).slice(0, 10),
      severity: r.severity,
      title: r.title,
      description: r.description,
      is_dismissed: !!r.is_dismissed,
      created_at: r.created_at,
    }));
  });

/** יצירת תובנה יומית ידנית. */
export const createManualInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        classId: z.string().uuid(),
        studentId: z.string().uuid().nullable().optional(),
        date: isoDate,
        severity,
        title: z.string().trim().min(2, "כתוב כותרת").max(200),
        description: z.string().trim().max(2000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwnsClass(supabase as never, data.classId, userId);

    const { data: row, error } = await (supabase as any)
      .from("orchestrator_insights")
      .insert({
        owner_id: userId,
        class_id: data.classId,
        student_id: data.studentId ?? null,
        insight_type: MANUAL_TYPE,
        insight_date: data.date,
        severity: data.severity,
        title: data.title,
        description: data.description,
      })
      .select("id")
      .single();
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת התובנה נכשלה."); }

    await (supabase as any).from("app_logs").insert({
      user_id: userId,
      source: AUDIT_SOURCE_MANUAL_INSIGHT,
      level: "info",
      message: `תובנה יומית נוספה (${data.date}): ${data.title}`,
      context: { insight_id: row.id, class_id: data.classId, student_id: data.studentId ?? null },
    });

    return { id: row.id as string };
  });

/** עדכון תובנה ידנית קיימת. */
export const updateManualInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        severity,
        title: z.string().trim().min(2, "כתוב כותרת").max(200),
        description: z.string().trim().max(2000).default(""),
        date: isoDate,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: updated, error } = await (supabase as any)
      .from("orchestrator_insights")
      .update({
        severity: data.severity,
        title: data.title,
        description: data.description,
        insight_date: data.date,
      })
      .eq("id", data.id)
      .eq("owner_id", userId)
      .eq("insight_type", MANUAL_TYPE)
      .select("id,class_id");
    if (error) { console.error("[DB Error]", error); throw new Error("עדכון התובנה נכשל."); }
    if (!updated || updated.length === 0) throw new Error("התובנה לא נמצאה");

    await (supabase as any).from("app_logs").insert({
      user_id: userId,
      source: AUDIT_SOURCE_MANUAL_INSIGHT,
      level: "info",
      message: `תובנה יומית עודכנה (${data.date}): ${data.title}`,
      context: { insight_id: data.id, class_id: updated[0].class_id },
    });

    return { ok: true };
  });

/** מחיקת תובנה ידנית. */
export const deleteManualInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: removed, error } = await (supabase as any)
      .from("orchestrator_insights")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", userId)
      .eq("insight_type", MANUAL_TYPE)
      .select("id,title");
    if (error) { console.error("[DB Error]", error); throw new Error("מחיקת התובנה נכשלה."); }
    if (!removed || removed.length === 0) throw new Error("התובנה לא נמצאה");

    await (supabase as any).from("app_logs").insert({
      user_id: userId,
      source: AUDIT_SOURCE_MANUAL_INSIGHT,
      level: "info",
      message: `תובנה יומית נמחקה: ${removed[0].title}`,
      context: { insight_id: data.id },
    });

    return { ok: true };
  });

/** היסטוריית שינויים של תובנות יומיות ידניות. */
export const listManualInsightHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwnsClass(context.supabase as never, data.classId, context.userId);
    const { data: rows, error } = await (context.supabase as any)
      .from("app_logs")
      .select("id,message,created_at,context")
      .eq("source", AUDIT_SOURCE_MANUAL_INSIGHT)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת ההיסטוריה נכשלה."); }
    return ((rows ?? []) as any[])
      .filter((r) => !r.context?.class_id || r.context.class_id === data.classId)
      .map((r) => ({ id: r.id as string, message: r.message as string, created_at: r.created_at as string }));
  });
