import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evaluateAttendanceDecline, describeDecline } from "./attendance-decline";

export type DailyInsight = {
  id: string;
  class_id: string;
  class_name: string;
  student_id: string | null;
  student_name: string | null;
  insight_type: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  suggested_action: string | null;
  action_link: string | null;
  created_at: string;
};

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * סורקת את כל כיתות המלמד המחובר ומייצרת תובנות "ירידה בנוכחות".
 * ההשוואה: 7 הימים האחרונים מול 30 הימים שלפניהם.
 */
export const generateDailyBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: classes, error: cErr } = await supabase
      .from("classes")
      .select("id,name,status")
      .eq("owner_id", userId);
    if (cErr) { console.error("[DB Error]", cErr); throw new Error("הסריקה נכשלה. נסה שוב."); }

    const activeClasses = (classes ?? []).filter((c) => c.status !== "archived");
    if (activeClasses.length === 0) return { created: 0, scanned: 0 };

    const recentFrom = isoDaysAgo(7);
    const baseFrom = isoDaysAgo(37);

    type NewInsight = {
      owner_id: string;
      class_id: string;
      student_id: string;
      insight_type: string;
      severity: "medium" | "high";
      title: string;
      description: string;
      suggested_action: string;
      action_link: string;
    };

    const pending: NewInsight[] = [];
    let scanned = 0;

    for (const cls of activeClasses) {
      const [studentsRes, attRes] = await Promise.all([
        supabase.from("students").select("id,name").eq("class_id", cls.id),
        supabase
          .from("attendance")
          .select("student_id,date,status")
          .eq("class_id", cls.id)
          .gte("date", baseFrom),
      ]);
      if (studentsRes.error || attRes.error) {
        console.error("[DB Error]", studentsRes.error ?? attRes.error);
        throw new Error("הסריקה נכשלה. נסה שוב.");
      }

      const students = studentsRes.data ?? [];
      const rows = attRes.data ?? [];
      scanned += students.length;

      for (const st of students) {
        const mine = rows.filter((r) => r.student_id === st.id);
        const recent = mine.filter((r) => r.date >= recentFrom).map((r) => r.status);
        const base = mine.filter((r) => r.date < recentFrom).map((r) => r.status);

        const decline = evaluateAttendanceDecline(recent, base);
        if (!decline) continue;

        pending.push({
          owner_id: userId,
          class_id: cls.id,
          student_id: st.id,
          insight_type: "attendance_decline",
          severity: decline.severity,
          title: `ירידה בנוכחות - ${st.name}`,
          description: describeDecline(decline),
          suggested_action: "בדוק מה קרה בשבוע האחרון וצור קשר עם ההורים",
          action_link: `/classes/${cls.id}?tab=tracking`,
        });
      }
    }

    if (pending.length === 0) return { created: 0, scanned };

    // מונע כפילויות: תובנה פעילה מאותו סוג לאותו תלמיד מ-7 הימים האחרונים.
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existing, error: eErr } = await supabase
      .from("orchestrator_insights")
      .select("student_id")
      .eq("insight_type", "attendance_decline")
      .eq("is_dismissed", false)
      .gte("created_at", sinceIso)
      .in("student_id", pending.map((p) => p.student_id));
    if (eErr) { console.error("[DB Error]", eErr); throw new Error("הסריקה נכשלה. נסה שוב."); }

    const seen = new Set((existing ?? []).map((r) => r.student_id));
    const toInsert = pending.filter((p) => !seen.has(p.student_id));
    if (toInsert.length === 0) return { created: 0, scanned };

    // אין מדיניות INSERT ללקוח — הכתיבה נעשית בשרת בלבד, עם owner_id מהטוקן.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insErr } = await supabaseAdmin
      .from("orchestrator_insights")
      .insert(toInsert as never);
    if (insErr) { console.error("[DB Error]", insErr); throw new Error("שמירת התובנות נכשלה."); }

    return { created: toInsert.length, scanned };
  });

/** כל התובנות הפעילות של המלמד המחובר, ממוינות לפי חומרה ואז תאריך. */
export const listDailyBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyInsight[]> => {
    const { data, error } = await context.supabase
      .from("orchestrator_insights")
      .select(
        "id,class_id,student_id,insight_type,severity,title,description,suggested_action,action_link,created_at," +
          "classes(name),students(name)",
      )
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("טעינת התובנות נכשלה."); }

    const rows = (data ?? []) as unknown as (Omit<DailyInsight, "class_name" | "student_name"> & {
      classes: { name: string } | null;
      students: { name: string } | null;
    })[];

    return rows
      .map((r) => ({
        id: r.id,
        class_id: r.class_id,
        class_name: r.classes?.name ?? "",
        student_id: r.student_id,
        student_name: r.students?.name ?? null,
        insight_type: r.insight_type,
        severity: r.severity,
        title: r.title,
        description: r.description,
        suggested_action: r.suggested_action,
        action_link: r.action_link,
        created_at: r.created_at,
      }))
      .sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3) ||
          b.created_at.localeCompare(a.created_at),
      );
  });

/** מסלק תובנה בודדת — רק אם היא של המשתמש המחובר. */
export const dismissInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("orchestrator_insights")
      .update({ is_dismissed: true } as never)
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .select("id");
    if (error) { console.error("[DB Error]", error); throw new Error("סילוק התובנה נכשל."); }
    if (!updated || updated.length === 0) throw new Error("התובנה לא נמצאה");
    return { ok: true };
  });
