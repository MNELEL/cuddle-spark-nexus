import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AUDIT_SOURCE_TEACHERS } from "@/lib/audit-sources";

type InstitutionScope = { institutionId: string; role: "admin" | "principal" };

/** Derives the caller's institution from their own roles (never from client input). */
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

async function requireScope(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<InstitutionScope> {
  const scope = await resolveScope(supabase, userId);
  if (!scope) throw new Error("אין לך הרשאת מנהל מוסד");
  return scope;
}

/** Institution-scoped admin gate: only a system admin may record/edit meetings. */
async function requireAdminScope(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<InstitutionScope> {
  const scope = await requireScope(supabase, userId);
  if (scope.role !== "admin") throw new Error("רק מנהל מערכת יכול לתעד פגישות");
  return scope;
}

export type TeacherMeeting = {
  id: string;
  meetingDate: string;
  summary: string;
  actionItems: string | null;
  followUpDate: string | null;
  adminName: string;
  createdAt: string;
};

const listSchema = z.object({ teacherId: z.string().uuid("מזהה מלמד לא תקין") });

/** Every 1:1 meeting of a teacher in the caller's institution. Any manager may read. */
export const listTeacherMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data, context }): Promise<TeacherMeeting[]> => {
    const { supabase, userId } = context;
    const scope = await requireScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("teacher_meetings")
      .select("id, meeting_date, summary, action_items, follow_up_date, admin_id, created_at")
      .eq("institution_id", scope.institutionId)
      .eq("teacher_id", data.teacherId)
      .order("meeting_date", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const meetings = rows ?? [];
    const adminIds = Array.from(new Set(meetings.map((m) => m.admin_id)));
    const names: Record<string, string> = {};
    if (adminIds.length > 0) {
      // Display names only — no emails or other account PII.
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from("profiles").select("id, display_name").in("id", adminIds);
      if (pErr) { console.error("[DB Error]", pErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
      for (const p of profiles ?? []) names[p.id] = p.display_name ?? "";
    }

    return meetings.map((m) => ({
      id: m.id,
      meetingDate: m.meeting_date,
      summary: m.summary,
      actionItems: m.action_items ?? null,
      followUpDate: m.follow_up_date ?? null,
      adminName: names[m.admin_id] || "מנהל המוסד",
      createdAt: m.created_at,
    }));
  });

export type TeacherMeetingsGroup = {
  teacherId: string;
  teacherName: string;
  meetings: TeacherMeeting[];
};

/** כל הפגישות במוסד של הקורא, מקובצות לפי מלמד. כל מנהל מוסד רשאי לצפות. */
export const listInstitutionMeetings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeacherMeetingsGroup[]> => {
    const { supabase, userId } = context;
    const scope = await requireScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("teacher_meetings")
      .select("id, meeting_date, summary, action_items, follow_up_date, admin_id, teacher_id, created_at")
      .eq("institution_id", scope.institutionId)
      .order("meeting_date", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    const meetings = rows ?? [];
    const ids = Array.from(new Set(meetings.flatMap((m) => [m.admin_id, m.teacher_id])));
    const names: Record<string, string> = {};
    if (ids.length > 0) {
      // Display names only — no emails or other account PII.
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from("profiles").select("id, display_name").in("id", ids);
      if (pErr) { console.error("[DB Error]", pErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
      for (const p of profiles ?? []) names[p.id] = p.display_name ?? "";
    }

    const groups = new Map<string, TeacherMeetingsGroup>();
    for (const m of meetings) {
      let g = groups.get(m.teacher_id);
      if (!g) {
        g = {
          teacherId: m.teacher_id,
          teacherName: names[m.teacher_id] || "מלמד",
          meetings: [],
        };
        groups.set(m.teacher_id, g);
      }
      g.meetings.push({
        id: m.id,
        meetingDate: m.meeting_date,
        summary: m.summary,
        actionItems: m.action_items ?? null,
        followUpDate: m.follow_up_date ?? null,
        adminName: names[m.admin_id] || "מנהל המוסד",
        createdAt: m.created_at,
      });
    }
    return Array.from(groups.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName, "he"));
  });

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין");

const createSchema = z.object({
  teacherId: z.string().uuid("מזהה מלמד לא תקין"),
  meetingDate: dateString,
  summary: z.string().trim().min(2, "נדרש סיכום פגישה").max(4000, "הסיכום ארוך מדי"),
  actionItems: z.string().trim().max(4000, "המטלות ארוכות מדי").optional(),
  followUpDate: dateString.optional(),
});

export const createTeacherMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireAdminScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: role, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", data.teacherId)
      .eq("role", "teacher")
      .eq("institution_id", scope.institutionId)
      .limit(1)
      .maybeSingle();
    if (rErr) { console.error("[DB Error]", rErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!role) throw new Error("המלמד אינו משויך למוסד שלך");

    const { data: inserted, error } = await supabaseAdmin
      .from("teacher_meetings")
      .insert({
        institution_id: scope.institutionId,
        teacher_id: data.teacherId,
        admin_id: userId,
        meeting_date: data.meetingDate,
        summary: data.summary,
        action_items: data.actionItems?.trim() || null,
        follow_up_date: data.followUpDate ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) { console.error("[DB Error]", error); throw new Error("שמירת הפגישה נכשלה. נסה שוב."); }

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo("תועדה פגישה 1:1 עם מלמד", {
      source: AUDIT_SOURCE_TEACHERS,
      userId,
      context: {
        action: "teacher.meeting_created",
        institution_id: scope.institutionId,
        teacher_id: data.teacherId,
        meeting_id: inserted?.id ?? null,
        meeting_date: data.meetingDate,
      },
    });

    return { ok: true as const, id: inserted?.id ?? null };
  });

const updateSchema = z.object({
  id: z.string().uuid("מזהה פגישה לא תקין"),
  summary: z.string().trim().min(2, "נדרש סיכום פגישה").max(4000, "הסיכום ארוך מדי").optional(),
  actionItems: z.string().trim().max(4000, "המטלות ארוכות מדי").optional(),
  followUpDate: dateString.nullable().optional(),
});

/** Ensures the meeting belongs to the caller's institution before any write. */
async function requireOwnedMeeting(
  supabaseAdmin: SupabaseClient<Database>,
  meetingId: string,
  institutionId: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("teacher_meetings")
    .select("id, institution_id")
    .eq("id", meetingId)
    .maybeSingle();
  if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
  if (!data || data.institution_id !== institutionId) throw new Error("הפגישה אינה משויכת למוסד שלך");
}

export const updateTeacherMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireAdminScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOwnedMeeting(supabaseAdmin as unknown as SupabaseClient<Database>, data.id, scope.institutionId);

    const patch: {
      summary?: string;
      action_items?: string | null;
      follow_up_date?: string | null;
    } = {};
    if (data.summary !== undefined) patch.summary = data.summary;
    if (data.actionItems !== undefined) patch.action_items = data.actionItems.trim() || null;
    if (data.followUpDate !== undefined) patch.follow_up_date = data.followUpDate;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    const { error } = await supabaseAdmin
      .from("teacher_meetings")
      .update(patch)
      .eq("id", data.id)
      .eq("institution_id", scope.institutionId);
    if (error) { console.error("[DB Error]", error); throw new Error("עדכון הפגישה נכשל. נסה שוב."); }

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo("עודכנה פגישה 1:1 עם מלמד", {
      source: AUDIT_SOURCE_TEACHERS,
      userId,
      context: {
        action: "teacher.meeting_updated",
        institution_id: scope.institutionId,
        meeting_id: data.id,
      },
    });
    return { ok: true as const };
  });

const deleteSchema = z.object({ id: z.string().uuid("מזהה פגישה לא תקין") });

export const deleteTeacherMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireAdminScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireOwnedMeeting(supabaseAdmin as unknown as SupabaseClient<Database>, data.id, scope.institutionId);

    const { error } = await supabaseAdmin
      .from("teacher_meetings")
      .delete()
      .eq("id", data.id)
      .eq("institution_id", scope.institutionId);
    if (error) { console.error("[DB Error]", error); throw new Error("מחיקת הפגישה נכשלה. נסה שוב."); }

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo("נמחקה פגישה 1:1 עם מלמד", {
      source: AUDIT_SOURCE_TEACHERS,
      userId,
      context: {
        action: "teacher.meeting_deleted",
        institution_id: scope.institutionId,
        meeting_id: data.id,
      },
    });
    return { ok: true as const };
  });

export type MeetingsReportTeacher = {
  teacherId: string;
  teacherName: string;
  classNames: string[];
  meetingCount: number;
  lastMeetingDate: string | null;
  openFollowUps: string[];
};

export type MeetingsReport = {
  teachers: MeetingsReportTeacher[];
  totalMeetings: number;
  aiSummary: string | null;
};

const reportSchema = z.object({ withAi: z.boolean().optional() });

/** דוח פגישות במוסד לפי מלמדים וכיתות, עם תקציר AI אופציונלי. */
export const getInstitutionMeetingsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reportSchema.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<MeetingsReport> => {
    const { supabase, userId } = context;
    const scope = await requireScope(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("teacher_meetings")
      .select("id, teacher_id, meeting_date, summary, action_items, follow_up_date")
      .eq("institution_id", scope.institutionId)
      .order("meeting_date", { ascending: false });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    const meetings = rows ?? [];

    const teacherIds = Array.from(new Set(meetings.map((m) => m.teacher_id)));
    const names: Record<string, string> = {};
    const classNames: Record<string, string[]> = {};
    if (teacherIds.length > 0) {
      const [{ data: profiles, error: pErr }, { data: classes, error: cErr }] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, display_name").in("id", teacherIds),
        supabaseAdmin
          .from("classes")
          .select("name, owner_id, status")
          .eq("institution_id", scope.institutionId)
          .in("owner_id", teacherIds),
      ]);
      if (pErr) { console.error("[DB Error]", pErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
      if (cErr) { console.error("[DB Error]", cErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
      for (const p of profiles ?? []) names[p.id] = p.display_name ?? "";
      for (const c of classes ?? []) {
        if (c.status === "archived") continue;
        (classNames[c.owner_id] ??= []).push(c.name);
      }
    }

    const teachers: MeetingsReportTeacher[] = teacherIds.map((id) => {
      const own = meetings.filter((m) => m.teacher_id === id);
      return {
        teacherId: id,
        teacherName: names[id] || "מלמד",
        classNames: classNames[id] ?? [],
        meetingCount: own.length,
        lastMeetingDate: own[0]?.meeting_date ?? null,
        openFollowUps: own
          .filter((m) => m.follow_up_date)
          .map((m) => m.follow_up_date as string)
          .slice(0, 5),
      };
    }).sort((a, b) => b.meetingCount - a.meetingCount);

    let aiSummary: string | null = null;
    if (data.withAi && meetings.length > 0) {
      const lines = teachers.map((t) => {
        const own = meetings.filter((m) => m.teacher_id === t.teacherId).slice(0, 6);
        const detail = own
          .map((m) => `  - ${m.meeting_date}: ${m.summary}${m.action_items ? ` | מטלות: ${m.action_items}` : ""}${m.follow_up_date ? ` | מעקב: ${m.follow_up_date}` : ""}`)
          .join("\n");
        return `מלמד: ${t.teacherName} (כיתות: ${t.classNames.join(", ") || "ללא"}) — ${t.meetingCount} פגישות\n${detail}`;
      }).join("\n");

      try {
        const { callLovableAI } = await import("@/lib/ai-gateway.server");
        aiSummary = await callLovableAI({
          messages: [
            {
              role: "system",
              content:
                "אתה עוזר ניהולי בתלמוד תורה. סכם בעברית תקציר קצר ומעשי למנהל המוסד על פגישות 1:1 עם המלמדים, " +
                "לפי מלמדים וכיתות. השתמש רק בנתונים שקיבלת, אל תמציא עובדות. " +
                "החזר עד 8 שורות: נושאים חוזרים, מטלות פתוחות ומעקבים שדורשים תשומת לב.",
            },
            { role: "user", content: lines },
          ],
        });
      } catch (e) {
        console.error("[AI Error]", e);
        aiSummary = null;
      }
    }

    return { teachers, totalMeetings: meetings.length, aiSummary };
  });
