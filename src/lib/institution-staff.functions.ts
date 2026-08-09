import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Staff titles shown in the institution dashboard. */
export const STAFF_TITLES = [
  { value: "melamed", label: "מלמד" },
  { value: "rav", label: "רב" },
  { value: "ram", label: 'ר"מ' },
  { value: "principal", label: "מנהל" },
  { value: "assistant", label: "מלמד עזר" },
  { value: "staff", label: "צוות" },
] as const;

export type StaffTitle = (typeof STAFF_TITLES)[number]["value"];

export function staffTitleLabel(value: string): string {
  return STAFF_TITLES.find((t) => t.value === value)?.label ?? value;
}

export type InstitutionStaffRow = {
  id: string;
  name: string;
  title: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  active: boolean;
  userId: string | null;
  updatedAt: string;
};

type Scope = { institutionId: string };

/** The caller's institution, derived from their own roles (never from client input). */
async function resolveMembership(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ institutionId: string; isAdmin: boolean } | null> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, institution_id")
    .eq("user_id", userId);
  if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

  const rows = (data ?? []).filter((r) => r.institution_id);
  if (rows.length === 0) return null;
  const admin = rows.find((r) => r.role === "principal" || r.role === "admin");
  const chosen = admin ?? rows[0];
  return { institutionId: chosen.institution_id as string, isAdmin: Boolean(admin) };
}

async function requireAdminScope(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Scope> {
  const m = await resolveMembership(supabase, userId);
  if (!m || !m.isAdmin) throw new Error("אין לך הרשאת מנהל מוסד");
  return { institutionId: m.institutionId };
}

/** Any institution member (including a melamed) may read the staff list. */
export const listInstitutionStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InstitutionStaffRow[]> => {
    const { supabase, userId } = context;
    const m = await resolveMembership(supabase, userId);
    if (!m) return [];

    const { data, error } = await supabase
      .from("institution_staff")
      .select("id, name, title, phone, email, notes, active, user_id, updated_at")
      .eq("institution_id", m.institutionId)
      .order("name", { ascending: true });
    if (error) { console.error("[DB Error]", error); throw new Error("הפעולה נכשלה. נסה שוב."); }

    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      title: r.title,
      phone: r.phone,
      email: r.email,
      notes: r.notes,
      active: r.active,
      userId: r.user_id,
      updatedAt: r.updated_at,
    }));
  });

const titleValues = STAFF_TITLES.map((t) => t.value) as [StaffTitle, ...StaffTitle[]];

const staffInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "נדרש שם מלא").max(80, "השם ארוך מדי"),
  title: z.enum(titleValues),
  phone: z.string().trim().max(30, "מספר טלפון ארוך מדי").optional().or(z.literal("")),
  email: z.string().trim().max(255).email("כתובת מייל לא תקינה").optional().or(z.literal("")),
  notes: z.string().trim().max(500, "ההערה ארוכה מדי").optional().or(z.literal("")),
  active: z.boolean().optional(),
});

export const upsertInstitutionStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => staffInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireAdminScope(supabase, userId);

    const payload = {
      institution_id: scope.institutionId,
      name: data.name,
      title: data.title,
      phone: data.phone ? data.phone : null,
      email: data.email ? data.email : null,
      notes: data.notes ? data.notes : null,
      active: data.active ?? true,
    };

    if (data.id) {
      const { error } = await supabase
        .from("institution_staff")
        .update(payload)
        .eq("id", data.id)
        .eq("institution_id", scope.institutionId);
      if (error) { console.error("[DB Error]", error); throw new Error("עדכון איש הצוות נכשל. נסה שוב."); }
      return { ok: true as const, id: data.id };
    }

    const { data: inserted, error } = await supabase
      .from("institution_staff")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) { console.error("[DB Error]", error); throw new Error("הוספת איש הצוות נכשלה. נסה שוב."); }
    return { ok: true as const, id: inserted.id };
  });

export const deleteInstitutionStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireAdminScope(supabase, userId);
    const { error } = await supabase
      .from("institution_staff")
      .delete()
      .eq("id", data.id)
      .eq("institution_id", scope.institutionId);
    if (error) { console.error("[DB Error]", error); throw new Error("מחיקת איש הצוות נכשלה. נסה שוב."); }
    return { ok: true as const };
  });

/**
 * Renames a melamed's display name. Allowed only for a principal/admin of the
 * institution the target melamed actually belongs to.
 */
export const renameInstitutionTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      teacherId: z.string().uuid("מזהה משתמש לא תקין"),
      name: z.string().trim().min(2, "נדרש שם מלא").max(80, "השם ארוך מדי"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = await requireAdminScope(supabase, userId);

    // Verify the target belongs to the caller's institution before any privileged write.
    const { data: role, error: rErr } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", data.teacherId)
      .eq("institution_id", scope.institutionId)
      .limit(1)
      .maybeSingle();
    if (rErr) { console.error("[DB Error]", rErr); throw new Error("הפעולה נכשלה. נסה שוב."); }
    if (!role) throw new Error("המלמד אינו משויך למוסד שלך");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ display_name: data.name })
      .eq("id", data.teacherId);
    if (error) { console.error("[DB Error]", error); throw new Error("עדכון השם נכשל. נסה שוב."); }

    return { ok: true as const };
  });
