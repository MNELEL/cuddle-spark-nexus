import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** URL-safe slug: lowercase, alphanumerics + hyphens, 3-40 chars. */
const SlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "slug invalid");

/**
 * Public (unauthenticated) read of a class showcase by slug.
 * Returns only aggregated / anonymized data — never student names or PII.
 */
export const getPublicClassShowcase = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: SlugSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cls, error } = await supabaseAdmin
      .from("classes")
      .select("id, name, public_slug, public_headline, public_description, created_at")
      .eq("public_slug", data.slug)
      .eq("public_enabled", true)
      .maybeSingle();
    if (error || !cls) return null;

    const classId = cls.id;

    // Aggregate metrics — counts and averages only.
    const [studentsRes, gradesRes, attRes, bulletinsRes] = await Promise.all([
      supabaseAdmin.from("students").select("id", { count: "exact", head: true }).eq("class_id", classId),
      supabaseAdmin.from("grades").select("value, max_value, subject, date").eq("class_id", classId).order("date", { ascending: false }).limit(200),
      supabaseAdmin.from("attendance").select("status").eq("class_id", classId).limit(1000),
      supabaseAdmin.from("weekly_bulletins").select("id, title, digest_summary, study_points, start_date, end_date").eq("class_id", classId).eq("published", true).order("start_date", { ascending: false }).limit(6),
    ]);

    const studentCount = studentsRes.count ?? 0;
    const grades = gradesRes.data ?? [];
    const attendance = attRes.data ?? [];
    const bulletins = bulletinsRes.data ?? [];

    // Compute averages per subject (min 3 samples) — never per student.
    const subjectAgg = new Map<string, { sum: number; n: number }>();
    for (const g of grades) {
      const pct = (Number(g.value) / Math.max(1, Number(g.max_value))) * 100;
      if (!Number.isFinite(pct)) continue;
      const cur = subjectAgg.get(g.subject) ?? { sum: 0, n: 0 };
      cur.sum += pct;
      cur.n += 1;
      subjectAgg.set(g.subject, cur);
    }
    const subjectAverages = Array.from(subjectAgg.entries())
      .filter(([, v]) => v.n >= 3)
      .map(([subject, v]) => ({ subject, average: Math.round(v.sum / v.n), samples: v.n }))
      .sort((a, b) => b.average - a.average);

    const overallAvg = grades.length
      ? Math.round(grades.reduce((s, g) => s + (Number(g.value) / Math.max(1, Number(g.max_value))) * 100, 0) / grades.length)
      : null;

    const attendanceRate = attendance.length
      ? Math.round((attendance.filter((a) => a.status === "present").length / attendance.length) * 100)
      : null;

    return {
      className: cls.name,
      headline: cls.public_headline ?? null,
      description: cls.public_description ?? null,
      slug: cls.public_slug,
      since: cls.created_at,
      studentCount,
      overallAvg,
      attendanceRate,
      subjectAverages,
      bulletins: bulletins.map((b) => ({
        id: b.id,
        title: b.title,
        summary: b.digest_summary,
        study_points: (b.study_points as unknown as string[] | null) ?? [],
        start_date: b.start_date,
        end_date: b.end_date,
      })),
    };
  });

/** Owner: read current sharing settings for their class. */
export const getClassPublicSharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ classId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("classes")
      .select("id, name, public_slug, public_enabled, public_headline, public_description")
      .eq("id", data.classId)
      .single();
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }
    return row;
  });

/** Owner: update sharing settings. Slug uniqueness enforced by DB. */
export const updateClassPublicSharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      classId: z.string().uuid(),
      slug: SlugSchema.nullable(),
      enabled: z.boolean(),
      headline: z.string().trim().max(120).nullable(),
      description: z.string().trim().max(600).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("classes")
      .update({
        public_slug: data.slug,
        public_enabled: data.enabled,
        public_headline: data.headline,
        public_description: data.description,
      })
      .eq("id", data.classId);
    if (error) {
      console.error("[DB Error]", error);
      if (error.code === "23505") throw new Error("הכתובת כבר בשימוש. בחר כתובת אחרת.");
      throw new Error("הפעולה נכשלה. נסה שוב.");
    }
    return { ok: true };
  });