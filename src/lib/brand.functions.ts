import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BrandSettings = {
  school_name: string;
  header_line: string;
  logo_data_url: string;
  principal_name_default: string;
  teacher_name_default: string;
  primary_color: string;
};

export const EMPTY_BRAND: BrandSettings = {
  school_name: "",
  header_line: "",
  logo_data_url: "",
  principal_name_default: "",
  teacher_name_default: "",
  primary_color: "#f59e0b",
};

export const getBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BrandSettings> => {
    const { data, error } = await context.supabase
      .from("brand_settings")
      .select("school_name,header_line,logo_data_url,principal_name_default,teacher_name_default,primary_color")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) { console.error("[brand]", error); throw new Error("טעינת המיתוג נכשלה"); }
    if (!data) return EMPTY_BRAND;
    const d = data as Partial<BrandSettings>;
    return {
      school_name: d.school_name ?? "",
      header_line: d.header_line ?? "",
      logo_data_url: d.logo_data_url ?? "",
      principal_name_default: d.principal_name_default ?? "",
      teacher_name_default: d.teacher_name_default ?? "",
      primary_color: d.primary_color ?? "#f59e0b",
    };
  });

const saveSchema = z.object({
  school_name: z.string().max(120).default(""),
  header_line: z.string().max(200).default(""),
  // Data URL up to ~500KB base64 payload
  logo_data_url: z.string().max(700_000).default(""),
  principal_name_default: z.string().max(120).default(""),
  teacher_name_default: z.string().max(120).default(""),
  primary_color: z.string().max(20).default("#f59e0b"),
});

export const saveBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = { user_id: context.userId, ...data };
    const { error } = await context.supabase
      .from("brand_settings")
      .upsert(row as never, { onConflict: "user_id" });
    if (error) { console.error("[brand]", error); throw new Error("שמירת המיתוג נכשלה"); }
    return { ok: true };
  });
