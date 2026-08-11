import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type BrandTheme = {
  /** Default color + icon for achievement badges. */
  badge_color: string;
  badge_icon: string;
  /** Reward-card / print card styling. */
  card_color: string;
  card_border_color: string;
  /** Per-subject label colors, keyed by subject name. */
  subject_colors: Record<string, string>;
  /** Optional per-document header/footer overrides. */
  doc_overrides: Record<string, { header?: string; footer?: string; signer?: string }>;
};

export type BrandSettings = {
  school_name: string;
  header_line: string;
  logo_data_url: string;
  principal_name_default: string;
  teacher_name_default: string;
  primary_color: string;
  theme: BrandTheme;
};

/** Fields an institution admin may lock so teachers cannot override them. */
export const LOCKABLE_BRAND_FIELDS = ["school_name", "logo_data_url"] as const;
export type LockableBrandField = typeof LOCKABLE_BRAND_FIELDS[number];

export const EMPTY_THEME: BrandTheme = {
  badge_color: "#f59e0b",
  badge_icon: "award",
  card_color: "#fffbeb",
  card_border_color: "#f59e0b",
  subject_colors: {},
  doc_overrides: {},
};

export const EMPTY_BRAND: BrandSettings = {
  school_name: "",
  header_line: "",
  logo_data_url: "",
  principal_name_default: "",
  teacher_name_default: "",
  primary_color: "#f59e0b",
  theme: EMPTY_THEME,
};

const BRAND_COLUMNS =
  "school_name,header_line,logo_data_url,principal_name_default,teacher_name_default,primary_color,theme,locked_fields";

type RawBrand = Partial<Omit<BrandSettings, "theme">> & {
  theme?: unknown;
  locked_fields?: string[] | null;
};

function normalizeTheme(raw: unknown): BrandTheme {
  const t = (raw ?? {}) as Partial<BrandTheme>;
  return {
    badge_color: t.badge_color ?? EMPTY_THEME.badge_color,
    badge_icon: t.badge_icon ?? EMPTY_THEME.badge_icon,
    card_color: t.card_color ?? EMPTY_THEME.card_color,
    card_border_color: t.card_border_color ?? EMPTY_THEME.card_border_color,
    subject_colors: (t.subject_colors ?? {}) as Record<string, string>,
    doc_overrides: (t.doc_overrides ?? {}) as BrandTheme["doc_overrides"],
  };
}

function normalize(raw: RawBrand | null): BrandSettings | null {
  if (!raw) return null;
  return {
    school_name: raw.school_name ?? "",
    header_line: raw.header_line ?? "",
    logo_data_url: raw.logo_data_url ?? "",
    principal_name_default: raw.principal_name_default ?? "",
    teacher_name_default: raw.teacher_name_default ?? "",
    primary_color: raw.primary_color ?? "#f59e0b",
    theme: normalizeTheme(raw.theme),
  };
}

async function resolveInstitutionId(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("institution_id")
    .eq("user_id", userId)
    .not("institution_id", "is", null)
    .limit(1);
  return data?.[0]?.institution_id ?? null;
}

async function fetchInstitutionBrand(supabase: SupabaseClient<Database>, institutionId: string) {
  const { data, error } = await supabase
    .from("brand_settings")
    .select(BRAND_COLUMNS)
    .eq("institution_id", institutionId)
    .eq("scope", "institution")
    .maybeSingle();
  if (error) { console.error("[brand]", error); return { brand: null, locked: [] as string[] }; }
  const raw = (data ?? null) as RawBrand | null;
  return { brand: normalize(raw), locked: raw?.locked_fields ?? [] };
}

/**
 * The teacher's effective brand: institution defaults, overridden by personal
 * settings, except for fields the institution admin locked.
 */
export const getBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("brand_settings")
      .select(BRAND_COLUMNS)
      .eq("user_id", userId)
      .eq("scope", "user")
      .maybeSingle();
    if (error) { console.error("[brand]", error); throw new Error("טעינת המיתוג נכשלה"); }
    const own = normalize((data ?? null) as RawBrand | null);

    const institutionId = await resolveInstitutionId(supabase, userId);
    const institution = institutionId
      ? await fetchInstitutionBrand(supabase, institutionId)
      : { brand: null, locked: [] as string[] };

    const base = institution.brand ?? EMPTY_BRAND;
    const locked = new Set(institution.locked ?? []);
    const inherited: string[] = [];

    const pick = <K extends keyof BrandSettings>(key: K): BrandSettings[K] => {
      if (locked.has(key as string) && institution.brand) {
        inherited.push(key as string);
        return base[key];
      }
      const mine = own?.[key];
      if (mine === undefined || mine === "" ) {
        if (institution.brand) inherited.push(key as string);
        return base[key];
      }
      return mine;
    };

    const effective: BrandSettings = {
      school_name: pick("school_name"),
      header_line: pick("header_line"),
      logo_data_url: pick("logo_data_url"),
      principal_name_default: pick("principal_name_default"),
      teacher_name_default: pick("teacher_name_default"),
      primary_color: pick("primary_color"),
      theme: own?.theme ?? base.theme,
    };

    return {
      ...effective,
      own: own ?? EMPTY_BRAND,
      hasOwn: !!own,
      institution: institution.brand,
      institutionId,
      lockedFields: Array.from(locked),
      inheritedFields: Array.from(new Set(inherited)),
    };
  });

const themeSchema = z.object({
  badge_color: z.string().max(20).default(EMPTY_THEME.badge_color),
  badge_icon: z.string().max(40).default(EMPTY_THEME.badge_icon),
  card_color: z.string().max(20).default(EMPTY_THEME.card_color),
  card_border_color: z.string().max(20).default(EMPTY_THEME.card_border_color),
  subject_colors: z.record(z.string().max(60), z.string().max(20)).default({}),
  doc_overrides: z
    .record(
      z.string().max(40),
      z.object({
        header: z.string().max(200).optional(),
        footer: z.string().max(200).optional(),
        signer: z.string().max(120).optional(),
      }),
    )
    .default({}),
});

const saveSchema = z.object({
  school_name: z.string().max(120).default(""),
  header_line: z.string().max(200).default(""),
  // Data URL up to ~500KB base64 payload
  logo_data_url: z.string().max(700_000).default(""),
  principal_name_default: z.string().max(120).default(""),
  teacher_name_default: z.string().max(120).default(""),
  primary_color: z.string().max(20).default("#f59e0b"),
  theme: themeSchema.optional(),
});

export const saveBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      user_id: context.userId,
      scope: "user",
      ...data,
      theme: (data.theme ?? EMPTY_THEME) as never,
    };
    const { error } = await context.supabase
      .from("brand_settings")
      .upsert(row as never, { onConflict: "user_id" });
    if (error) { console.error("[brand]", error); throw new Error("שמירת המיתוג נכשלה"); }

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo("הגדרות מיתוג אישיות עודכנו", {
      source: "settings_update",
      userId: context.userId,
      context: { tab: "brand", scope: "personal", fields: Object.keys(data) },
    });
    return { ok: true };
  });

/* ---------------- Institution-level branding ---------------- */

async function requireInstitutionAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, institution_id")
    .eq("user_id", userId);
  if (error) { console.error("[brand]", error); throw new Error("טעינת ההרשאות נכשלה"); }
  const row = (data ?? []).find(
    (r) => r.institution_id && (r.role === "principal" || r.role === "admin"),
  );
  if (!row?.institution_id) throw new Error("אין לך הרשאת מנהל מוסד");
  return row.institution_id;
}

export const getInstitutionBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const institutionId = await resolveInstitutionId(supabase, userId);
    if (!institutionId) return { institutionId: null, brand: EMPTY_BRAND, lockedFields: [], canEdit: false };

    const { brand, locked } = await fetchInstitutionBrand(supabase, institutionId);
    let canEdit = false;
    try {
      await requireInstitutionAdmin(supabase, userId);
      canEdit = true;
    } catch { canEdit = false; }

    return {
      institutionId,
      brand: brand ?? EMPTY_BRAND,
      lockedFields: locked,
      canEdit,
    };
  });

const saveInstitutionSchema = saveSchema.extend({
  locked_fields: z.array(z.enum(LOCKABLE_BRAND_FIELDS)).default([]),
});

export const saveInstitutionBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveInstitutionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const institutionId = await requireInstitutionAdmin(supabase, userId);

    const { locked_fields, theme, ...rest } = data;
    const row = {
      institution_id: institutionId,
      scope: "institution",
      user_id: null,
      locked_fields,
      ...rest,
      theme: (theme ?? EMPTY_THEME) as never,
    };
    const { error } = await supabase
      .from("brand_settings")
      .upsert(row as never, { onConflict: "institution_id" });
    if (error) { console.error("[brand]", error); throw new Error("שמירת מיתוג המוסד נכשלה"); }

    const { logInfo } = await import("@/lib/logger.server");
    await logInfo("הגדרות מיתוג המוסד עודכנו", {
      source: "settings_update",
      userId,
      context: {
        tab: "brand",
        scope: "institution",
        institutionId,
        fields: Object.keys(rest),
        lockedFields: locked_fields,
      },
    });
    return { ok: true };
  });
