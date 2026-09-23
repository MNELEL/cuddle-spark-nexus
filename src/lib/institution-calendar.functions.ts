/**
 * לוח השנה של המוסד: חופשות מוסדיות (תאריך-תאריך + תיאור) לכל כיתות המוסד,
 * ימי הלימוד המוגדרים לכל כיתה, ותאריך-החלוף של התלמידים שמעבירים שנה.
 *
 * הרשאות: הסקופ נגזר מ-user_roles של המשתמש המחובר (אף פעם לא מקלט הלקוח),
 * והקריאות בפועל נעשות דרך supabaseAdmin רק אחרי אימות הסקופ — בדיוק כמו
 * institution-teachers.functions.ts ו-teacher-meetings.functions.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { AUDIT_SOURCE_TEACHERS } from "@/lib/audit-sources";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");
const uuid = z.string().uuid();

type InstitutionScope = { institutionId: string; role: "admin" | "principal" };

async function resolveScope(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<InstitutionScope | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, institution_id")
    .eq("user_id", userId);
  if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

  const rows = (data ?? []).filter(
    (r) => r.institution_id && (r.role === "principal" || r.role === "admin"),
  );
  const preferred = rows.find((r) => r.role === "principal") ?? rows[0];
  if (!preferred?.institution_id) return null;
  return { institutionId: preferred.institution_id, role: preferred.role as "admin" | "principal" };
}

async function requireScope(supabase: SupabaseClient<Database>, userId: string) {
  const scope = await resolveScope(supabase, userId);
  if (!scope) throw new Error("אין לך הרשאת מנהל מוסד");
  return scope;
}

/** מנהל מוסד (principal) ומנהל מערכת (admin) רשאים לעדכן את לוח המוסד. */
async function requireAdminScope(supabase: SupabaseClient<Database>, userId: string) {
  const scope = await requireScope(supabase, userId);
  if (scope.role !== "admin" && scope.role !== "principal") {
    throw new Error("אין לך הרשאה לעדכן את לוח המוסד");
  }
  return scope;
}

export type InstitutionBreak = {
  id: string;
  classId: string;
  className: string;
  startDate: string;
  endDate: string;
  type: string;
  label: string | null;
};

export type InstitutionCalendarClass = {
  id: string;
  name: string;
  status: string;
  academicYear: string | null;
  /** כיתה שנוצרה ממעבר שנה (יש לה כיתת אם). */
  carriedOver: boolean;
  yearStart: string | null;
  yearEnd: string | null;
  activeDays: string[];
  /** תאריכי-החלוף של התלמידים בכיתה, עם מספר התלמידים בכל תאריך. */
  rolloverDates: { date: string; students: number }[];
  studentCount: number;
  breaks: InstitutionBreak[];
};

export type InstitutionCalendar = {
  canEdit: boolean;
  classes: InstitutionCalendarClass[];
  breaks: InstitutionBreak[];
};

const DEFAULT_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri"];

/** כל הכיתות במוסד עם החופשות, ימי הלימוד ותאריכי-החלוף. */
export const getInstitutionCalendar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InstitutionCalendar> => {
    const { supabase, userId } = context;
    const scope = await requireScope(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: classRows, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id,name,status,academic_year,parent_class_id")
      .eq("institution_id", scope.institutionId)
      .order("name", { ascending: true });
    if (cErr) { console.error("[DB Error]", cErr); throw new Error("טעינת לוח המוסד נכשלה"); }

    const classes = classRows ?? [];
    const ids = classes.map((c) => c.id);
    if (ids.length === 0) {
      return { canEdit: true, classes: [], breaks: [] };
    }

    const [overrides, settings, students] = await Promise.all([
      supabaseAdmin
        .from("academic_calendar_overrides")
        .select("id,class_id,start_date,end_date,type,label")
        .in("class_id", ids)
        .order("start_date", { ascending: true }),
      supabaseAdmin
        .from("class_schedule_settings")
        .select("class_id,active_days,year_start_date,year_end_date")
        .in("class_id", ids),
      supabaseAdmin.from("students").select("id,class_id,start_date").in("class_id", ids),
    ]);
    for (const r of [overrides, settings, students]) {
      if (r.error) { console.error("[DB Error]", r.error); throw new Error("טעינת לוח המוסד נכשלה"); }
    }

    const nameOf = new Map(classes.map((c) => [c.id, c.name]));
    const allBreaks: InstitutionBreak[] = (overrides.data ?? []).map((o) => ({
      id: o.id,
      classId: o.class_id,
      className: nameOf.get(o.class_id) ?? "",
      startDate: o.start_date,
      endDate: o.end_date,
      type: o.type,
      label: o.label,
    }));

    const settingsOf = new Map((settings.data ?? []).map((s) => [s.class_id, s]));

    const out: InstitutionCalendarClass[] = classes.map((c) => {
      const s = settingsOf.get(c.id);
      const roster = (students.data ?? []).filter((st) => st.class_id === c.id);
      const counts = new Map<string, number>();
      for (const st of roster) {
        const d = st.start_date ? String(st.start_date).slice(0, 10) : null;
        if (d) counts.set(d, (counts.get(d) ?? 0) + 1);
      }
      return {
        id: c.id,
        name: c.name,
        status: c.status ?? "active",
        academicYear: c.academic_year ?? null,
        carriedOver: Boolean(c.parent_class_id),
        yearStart: s?.year_start_date ?? null,
        yearEnd: s?.year_end_date ?? null,
        activeDays: (s?.active_days as string[] | null) ?? DEFAULT_DAYS,
        rolloverDates: Array.from(counts.entries())
          .map(([date, n]) => ({ date, students: n }))
          .sort((a, b) => (a.date < b.date ? -1 : 1)),
        studentCount: roster.length,
        breaks: allBreaks.filter((b) => b.classId === c.id),
      };
    });

    return { canEdit: true, classes: out, breaks: allBreaks };
  });

const breakSchema = z
  .object({
    startDate: dateStr,
    endDate: dateStr,
    label: z.string().trim().min(2, "הוסף תיאור לחופשה").max(200),
    type: z.enum(["institution_break", "holiday", "unexpected_closure"]).default("institution_break"),
    /** ריק = כל הכיתות הפעילות במוסד. */
    classIds: z.array(uuid).max(200).optional(),
    /** תאריך-החלוף שיוחל על התלמידים שמעבירים שנה. */
    rolloverDate: dateStr.nullable().optional(),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה",
    path: ["endDate"],
  });

/** חופשה מוסדית: נרשמת לכל הכיתות שנבחרו ומעדכנת את תאריך-החלוף למעבירי שנה. */
export const setInstitutionBreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => breakSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireAdminScope(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: classRows, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id,parent_class_id,status")
      .eq("institution_id", scope.institutionId)
      .eq("status", "active");
    if (cErr) { console.error("[DB Error]", cErr); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const allowed = classRows ?? [];
    const picked = data.classIds?.length
      ? allowed.filter((c) => data.classIds!.includes(c.id))
      : allowed;
    if (picked.length === 0) throw new Error("לא נמצאו כיתות פעילות לעדכון");

    const { error: iErr } = await supabaseAdmin.from("academic_calendar_overrides").insert(
      picked.map((c) => ({
        class_id: c.id,
        start_date: data.startDate,
        end_date: data.endDate,
        type: data.type,
        label: data.label,
      })),
    );
    if (iErr) { console.error("[DB Error]", iErr); throw new Error("שמירת החופשה נכשלה"); }

    // תאריך-החלוף מוחל רק על כיתות שנוצרו במעבר שנה (יש להן כיתת אם).
    let rolloverStudents = 0;
    const carried = picked.filter((c) => c.parent_class_id);
    if (data.rolloverDate && carried.length > 0) {
      const { data: updated, error: uErr } = await supabaseAdmin
        .from("students")
        .update({ start_date: data.rolloverDate })
        .in("class_id", carried.map((c) => c.id))
        .select("id");
      if (uErr) { console.error("[DB Error]", uErr); throw new Error("עדכון תאריך-החלוף נכשל"); }
      rolloverStudents = (updated ?? []).length;
    }

    await supabaseAdmin.from("app_logs").insert({
      source: AUDIT_SOURCE_TEACHERS,
      level: "info",
      message: `חופשה מוסדית נרשמה ל-${picked.length} כיתות: ${data.label}`,
      user_id: userId,
      context: {
        action: "institution.break_created",
        institution_id: scope.institutionId,
        start_date: data.startDate,
        end_date: data.endDate,
        classes: picked.length,
        rollover_date: data.rolloverDate ?? null,
        rollover_students: rolloverStudents,
      },
    });

    return { ok: true as const, classes: picked.length, rolloverStudents };
  });

/** מחיקת חופשה מוסדית מכיתה אחת — רק בתוך המוסד של המנהל. */
export const deleteInstitutionBreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireAdminScope(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("academic_calendar_overrides")
      .select("id,class_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!row) throw new Error("החופשה לא נמצאה");

    const { data: cls, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id")
      .eq("id", row.class_id)
      .eq("institution_id", scope.institutionId)
      .maybeSingle();
    if (cErr) { console.error("[DB Error]", cErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!cls) throw new Error("אין הרשאה לחופשה זו");

    const { error: dErr } = await supabaseAdmin
      .from("academic_calendar_overrides")
      .delete()
      .eq("id", data.id);
    if (dErr) { console.error("[DB Error]", dErr); throw new Error("מחיקת החופשה נכשלה"); }

    return { ok: true as const };
  });

/**
 * "אישור כיתה" מתוך פאנל המוסד: מנהל המוסד מאשר בלחיצה אחת את כל מה שנותר
 * בכיתה — פריטי העוזר החכם שממתינים, פריטי התיק (כולל פגישות 1:1) שטרם אושרו,
 * וימי התיעוד היומי שאין להם אישור מלמד.
 */
export const approveClassRemainder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ classId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireAdminScope(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyApproval } = await import("@/lib/pending-updates.functions");

    const { data: cls, error: cErr } = await supabaseAdmin
      .from("classes")
      .select("id,name,owner_id")
      .eq("id", data.classId)
      .eq("institution_id", scope.institutionId)
      .maybeSingle();
    if (cErr) { console.error("[DB Error]", cErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!cls) throw new Error("אין הרשאה לכיתה זו");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const approverName = profile?.display_name || "מנהל המוסד";
    const nowIso = new Date().toISOString();

    // 1) פריטי העוזר החכם שממתינים לאישור בכיתה
    const { data: pending } = await supabaseAdmin
      .from("pending_updates")
      .select("id,class_id,intent,payload")
      .eq("class_id", data.classId)
      .eq("status", "pending");
    let approvedPending = 0;
    const failed: string[] = [];
    for (const row of pending ?? []) {
      try {
        await applyApproval(supabaseAdmin, row, `אושר על ידי ${approverName}`);
        approvedPending += 1;
      } catch (e) {
        failed.push(e instanceof Error ? e.message : "פריט שלא ניתן לאישור");
      }
    }

    // 2) פריטי התיק (דוחות ופגישות 1:1) שטרם אושרו
    const { data: portfolio, error: pErr } = await supabaseAdmin
      .from("student_portfolio_items")
      .update({ approved_at: nowIso })
      .eq("class_id", data.classId)
      .is("approved_at", null)
      .select("id,kind");
    if (pErr) { console.error("[DB Error]", pErr); throw new Error("אישור פריטי התיק נכשל"); }
    const approvedMeetings = (portfolio ?? []).filter((p) => p.kind === "meeting").length;
    const approvedPortfolio = (portfolio ?? []).length - approvedMeetings;

    // 3) ימי תיעוד יומי שאין להם אישור מלמד (180 הימים האחרונים)
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 180).toISOString().slice(0, 10);
    const [attendance, grades, insights, approvals] = await Promise.all([
      supabaseAdmin.from("attendance").select("student_id,date").eq("class_id", data.classId).gte("date", since),
      supabaseAdmin.from("grades").select("student_id,date").eq("class_id", data.classId).gte("date", since),
      supabaseAdmin
        .from("orchestrator_insights")
        .select("student_id,insight_date")
        .eq("class_id", data.classId)
        .gte("insight_date", since),
      supabaseAdmin
        .from("daily_log_approvals")
        .select("student_id,date")
        .eq("class_id", data.classId)
        .gte("date", since),
    ]);
    for (const r of [attendance, grades, insights, approvals]) {
      if (r.error) { console.error("[DB Error]", r.error); throw new Error("טעינת התיעוד נכשלה"); }
    }

    const existing = new Set((approvals.data ?? []).map((a) => `${a.student_id}|${a.date}`));
    const pairs = new Map<string, { student_id: string; date: string }>();
    const add = (studentId: string | null, date: string | null) => {
      if (!studentId || !date) return;
      const day = String(date).slice(0, 10);
      const key = `${studentId}|${day}`;
      if (existing.has(key)) return;
      pairs.set(key, { student_id: studentId, date: day });
    };
    for (const a of attendance.data ?? []) add(a.student_id, a.date);
    for (const g of grades.data ?? []) add(g.student_id, g.date);
    for (const i of insights.data ?? []) add(i.student_id, i.insight_date);

    let approvedDays = 0;
    if (pairs.size > 0) {
      const rows = Array.from(pairs.values()).map((p) => ({
        owner_id: cls.owner_id,
        class_id: data.classId,
        student_id: p.student_id,
        date: p.date,
        approver_name: approverName,
        notes: "אושר מפאנל המוסד",
      }));
      const { data: inserted, error: aErr } = await supabaseAdmin
        .from("daily_log_approvals")
        .upsert(rows, { onConflict: "student_id,date" })
        .select("id");
      if (aErr) { console.error("[DB Error]", aErr); throw new Error("אישור התיעוד היומי נכשל"); }
      approvedDays = (inserted ?? []).length;
    }

    await supabaseAdmin.from("app_logs").insert({
      source: AUDIT_SOURCE_TEACHERS,
      level: "info",
      message: `אישור כיתה מפאנל המוסד: ${cls.name}`,
      user_id: userId,
      context: {
        action: "institution.class_approved",
        institution_id: scope.institutionId,
        class_id: data.classId,
        pending: approvedPending,
        meetings: approvedMeetings,
        portfolio: approvedPortfolio,
        daily_logs: approvedDays,
      },
    });

    return {
      ok: true as const,
      approvedPending,
      approvedMeetings,
      approvedPortfolio,
      approvedDays,
      failed,
    };
  });
