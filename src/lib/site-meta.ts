/**
 * Single source of truth for the site-wide title & description.
 * These values are asserted by `npm run check:seo` (scripts/check-seo-meta.mjs)
 * so they can never silently drift.
 */
export const SITE_TITLE = "הכיתה שלי · ניהול כיתה חכם לתלמודי תורה וחיידרים";

export const SITE_DESCRIPTION =
  "כלי ניהול כיתה מותאם לתלמודי תורה, חיידרים ובתי ספר — סידור הושבה AI, מעקב פדגוגי, דוחות חכמים, וחוויית 3D עוצרת נשימה.";

export const SITE_NAME = "הכיתה שלי";

export const SITE_URL = "https://cuddle-spark-nexus.lovable.app";

/** SEO length budgets used by the automated check. */
export const META_LIMITS = {
  titleMax: 60,
  descriptionMin: 50,
  descriptionMax: 160,
} as const;
