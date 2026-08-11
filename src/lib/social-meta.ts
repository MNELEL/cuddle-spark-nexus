/**
 * Shared Open Graph / Twitter Card image tags.
 *
 * Every shareable page must expose a real image with explicit dimensions,
 * otherwise crawlers render a blank or cropped preview. `bun run check:og`
 * (scripts/check-og-tags.mjs) asserts these tags on every public route.
 */
import ogSiteDefault from "@/assets/og/site-default.jpg.asset.json";
import { SITE_TITLE, SITE_URL } from "@/lib/site-meta";

/** Absolute https URL of the site-wide 1200x630 share image. */
export const SITE_OG_IMAGE = `${SITE_URL}${ogSiteDefault.url}`;

export const OG_IMAGE_WIDTH = "1200";
export const OG_IMAGE_HEIGHT = "630";

/**
 * Full set of image tags for a share preview.
 * @param alt Human description of the image (defaults to the site title).
 * @param image Absolute https URL; defaults to the site-wide share image.
 */
export function socialImageMeta(alt: string = SITE_TITLE, image: string = SITE_OG_IMAGE) {
  return [
    { property: "og:image", content: image },
    { property: "og:image:width", content: OG_IMAGE_WIDTH },
    { property: "og:image:height", content: OG_IMAGE_HEIGHT },
    { property: "og:image:alt", content: alt },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: image },
  ];
}
