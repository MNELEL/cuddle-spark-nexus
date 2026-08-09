import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ToolAccess } from "@/lib/tool-registry";

/**
 * Everything the UI needs to decide which tool pages are usable for the
 * signed-in user. Cheap: two indexed count/select queries under RLS.
 */
export const getToolAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ToolAccess> => {
    const { supabase, userId } = context;

    const [{ count, error: classesError }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from("classes").select("id", { count: "exact", head: true }).limit(1),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    if (classesError) throw new Error(classesError.message);
    if (rolesError) throw new Error(rolesError.message);

    const list = (roles ?? []).map((r) => r.role as string);
    return {
      hasClasses: (count ?? 0) > 0,
      isAdmin: list.includes("admin"),
      isPrincipal: list.includes("principal"),
    };
  });
