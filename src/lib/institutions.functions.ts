import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function verifyAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("אין הרשאות מנהל");
}

export const listInstitutions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    // RLS decides visibility: members see their own institution, admins see all.
    const { data, error } = await supabase
      .from("institutions")
      .select("id, name, created_at")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const createInstitutionSchema = z.object({
  name: z.string().trim().min(2, "שם קצר מדי").max(120, "שם ארוך מדי"),
});

export const createInstitution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInstitutionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await verifyAdmin(supabase, userId);

    const { data: created, error } = await supabase
      .from("institutions")
      .insert({ name: data.name })
      .select("id, name, created_at")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });
