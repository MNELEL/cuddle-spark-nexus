import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Generate a URL-safe random token. */
function makeToken(len = 28): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}

/* ---------- Owner-side management ---------- */

export const listParentTokens = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("parent_share_tokens").select("*").eq("class_id", data.classId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createParentToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      studentId: z.string().uuid().nullable().optional(),
      label: z.string().max(120).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const token = makeToken();
    const { data: ins, error } = await context.supabase.from("parent_share_tokens").insert({
      class_id: data.classId,
      student_id: data.studentId ?? null,
      token,
      label: data.label,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return ins;
  });

export const revokeParentToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), revoked: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("parent_share_tokens")
      .update({ revoked: data.revoked }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteParentToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("parent_share_tokens").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------- Public parent view (no auth) ---------- */

export type ParentView = {
  classId: string;
  className: string;
  studentId: string | null;
  studentName: string | null;
  grades: { subject: string; value: number; max_value: number; date: string; notes: string | null }[];
  attendance: { date: string; status: string; notes: string | null }[];
  behavior: { date: string; category: string; points: number; note: string | null }[];
  bulletins: {
    id: string; title: string; start_date: string; end_date: string;
    digest_summary: string;
    study_points: string[];
    recap_questions: { question: string; answer: string }[];
    weekly_riddle: string; weekly_riddle_answer: string;
    activities: string[];
  }[];
};

export const getParentView = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10).max(64) }).parse(d))
  .handler(async ({ data }): Promise<ParentView> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: t, error: te } = await supabaseAdmin
      .from("parent_share_tokens").select("*").eq("token", data.token).maybeSingle();
    if (te) throw new Error(te.message);
    if (!t || t.revoked) throw new Error("הקישור אינו פעיל");

    const { data: cls } = await supabaseAdmin
      .from("classes").select("id,name").eq("id", t.class_id).single();

    let studentName: string | null = null;
    if (t.student_id) {
      const { data: s } = await supabaseAdmin
        .from("students").select("name").eq("id", t.student_id).maybeSingle();
      studentName = s?.name ?? null;
    }

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 90);
    const since = sinceDate.toISOString().slice(0, 10);

    const gradesQ = supabaseAdmin.from("grades")
      .select("subject,value,max_value,date,notes,student_id")
      .eq("class_id", t.class_id).gte("date", since).order("date", { ascending: false }).limit(120);
    const attQ = supabaseAdmin.from("attendance")
      .select("date,status,notes,student_id").eq("class_id", t.class_id)
      .gte("date", since).order("date", { ascending: false }).limit(120);
    const behQ = supabaseAdmin.from("behavior_points")
      .select("date,category,points,note,student_id").eq("class_id", t.class_id)
      .gte("date", since).order("date", { ascending: false }).limit(120);
    const bulQ = supabaseAdmin.from("weekly_bulletins")
      .select("id,title,start_date,end_date,digest_summary,study_points,recap_questions,weekly_riddle,weekly_riddle_answer,activities")
      .eq("class_id", t.class_id).order("start_date", { ascending: false }).limit(8);

    const [g, a, b, bul] = await Promise.all([gradesQ, attQ, behQ, bulQ]);
    if (g.error) throw new Error(g.error.message);
    if (a.error) throw new Error(a.error.message);
    if (b.error) throw new Error(b.error.message);
    if (bul.error) throw new Error(bul.error.message);

    const filter = <T extends { student_id?: string }>(rows: T[]) =>
      t.student_id ? rows.filter((r) => r.student_id === t.student_id) : rows;

    const bulletins = (bul.data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      start_date: r.start_date,
      end_date: r.end_date,
      digest_summary: r.digest_summary,
      study_points: Array.isArray(r.study_points) ? (r.study_points as unknown[]).map(String) : [],
      recap_questions: Array.isArray(r.recap_questions)
        ? (r.recap_questions as { question?: unknown; answer?: unknown }[])
            .filter((q) => typeof q?.question === "string" && typeof q?.answer === "string")
            .map((q) => ({ question: String(q.question), answer: String(q.answer) }))
        : [],
      weekly_riddle: r.weekly_riddle,
      weekly_riddle_answer: r.weekly_riddle_answer,
      activities: Array.isArray(r.activities) ? (r.activities as unknown[]).map(String) : [],
    }));

    return {
      classId: t.class_id,
      className: cls?.name ?? "כיתה",
      studentId: t.student_id,
      studentName,
      grades: filter(g.data ?? []).map(({ student_id: _u, ...r }) => r),
      attendance: filter(a.data ?? []).map(({ student_id: _u, ...r }) => r),
      behavior: filter(b.data ?? []).map(({ student_id: _u, ...r }) => r),
      bulletins,
    };
  });