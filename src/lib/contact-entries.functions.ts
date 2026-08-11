import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const entrySchema = z.object({
  id: z.string().uuid().optional(),
  class_id: z.string().uuid().nullable().optional(),
  category: z.string().trim().min(1, "קטגוריה נדרשת").max(60),
  name: z.string().trim().min(1, "שם נדרש").max(120),
  role: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().max(200).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  sort_order: z.number().int().min(0).max(9999).optional().default(0),
});

export const listContactEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contact_entries")
      .select("id,class_id,category,name,role,phone,email,notes,sort_order")
      .eq("owner_id", context.userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveContactEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => entrySchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = { ...data, owner_id: context.userId, class_id: data.class_id ?? null };
    const { data: saved, error } = data.id
      ? await context.supabase
          .from("contact_entries")
          .update(row)
          .eq("id", data.id)
          .eq("owner_id", context.userId)
          .select("id")
          .maybeSingle()
      : await context.supabase.from("contact_entries").insert(row).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return saved;
  });

export const saveContactEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ entries: entrySchema.array().max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.entries.length === 0) return { inserted: 0 };
    const rows = data.entries.map((e, i) => ({
      ...e,
      id: undefined,
      owner_id: context.userId,
      class_id: e.class_id ?? null,
      sort_order: e.sort_order ?? i,
    }));
    const { error } = await context.supabase.from("contact_entries").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const deleteContactEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("contact_entries")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
