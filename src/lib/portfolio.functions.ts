import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PORTFOLIO_KINDS = ["achievement", "difficulty", "assessment", "milestone", "note"] as const;
export type PortfolioKind = (typeof PORTFOLIO_KINDS)[number];

export const portfolioKindLabel: Record<PortfolioKind, string> = {
  achievement: "הישג",
  difficulty: "קושי",
  assessment: "אבחון",
  milestone: "ציון דרך",
  note: "הערה",
};

const kindEnum = z.enum(PORTFOLIO_KINDS);

/** Resolve the stable person_key of a student row the caller owns (RLS scoped). */
async function resolveStudent(
  supabase: { from: (t: string) => any },
  studentId: string,
) {
  const { data, error } = await supabase
    .from("students")
    .select("id, name, class_id, person_key")
    .eq("id", studentId)
    .maybeSingle();
  if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
  if (!data) throw new Error("התלמיד לא נמצא");
  return data as { id: string; name: string; class_id: string; person_key: string };
}

/**
 * Multi-year portfolio for a student: every item recorded under the same
 * person_key, plus the chain of class rows this person appears in.
 */
export const getStudentPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const student = await resolveStudent(context.supabase as never, data.studentId);

    const [items, siblings] = await Promise.all([
      context.supabase
        .from("student_portfolio_items")
        .select("*")
        .eq("person_key", student.person_key)
        .order("item_date", { ascending: false }),
      context.supabase
        .from("students")
        .select("id, class_id, created_at")
        .eq("person_key", student.person_key),
    ]);
    if (items.error) console.error("[DB Error]", items.error);
    if (siblings.error) console.error("[DB Error]", siblings.error);

    const classIds = Array.from(
      new Set([
        ...(siblings.data ?? []).map((s) => s.class_id),
        ...(items.data ?? []).map((i) => i.class_id).filter(Boolean),
      ]),
    ) as string[];

    let classMap: Record<string, { name: string; academic_year: string | null }> = {};
    if (classIds.length > 0) {
      const { data: classes, error } = await context.supabase
        .from("classes")
        .select("id, name, academic_year")
        .in("id", classIds);
      if (error) console.error("[DB Error]", error);
      classMap = Object.fromEntries(
        (classes ?? []).map((c) => [c.id, { name: c.name, academic_year: c.academic_year ?? null }]),
      );
    }

    const timeline = (siblings.data ?? [])
      .map((s) => ({
        studentId: s.id,
        classId: s.class_id,
        className: classMap[s.class_id]?.name ?? "כיתה",
        academicYear: classMap[s.class_id]?.academic_year ?? null,
        createdAt: s.created_at as string,
        isCurrent: s.id === student.id,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return {
      personKey: student.person_key,
      studentName: student.name,
      timeline,
      items: (items.data ?? []).map((i) => ({
        ...i,
        className: i.class_id ? (classMap[i.class_id]?.name ?? null) : null,
      })),
    };
  });

export const addPortfolioItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      studentId: z.string().uuid(),
      kind: kindEnum.default("note"),
      title: z.string().trim().min(1).max(150),
      description: z.string().max(2000).optional().default(""),
      school_year: z.string().trim().max(30).nullable().optional(),
      item_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "תאריך לא תקין").optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const student = await resolveStudent(context.supabase as never, data.studentId);
    const { data: row, error } = await context.supabase
      .from("student_portfolio_items")
      .insert({
        user_id: context.userId,
        person_key: student.person_key,
        student_id: student.id,
        class_id: student.class_id,
        kind: data.kind,
        title: data.title,
        description: data.description ?? "",
        school_year: data.school_year || null,
        ...(data.item_date ? { item_date: data.item_date } : {}),
      })
      .select("id")
      .single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return row;
  });

export const deletePortfolioItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("student_portfolio_items")
      .delete()
      .eq("id", data.id);
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return { ok: true };
  });
