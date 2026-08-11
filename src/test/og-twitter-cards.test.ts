import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditOgAssets, auditOgTags, extractMeta, IMAGE_RULES } from "../../scripts/check-og-tags.mjs";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, SITE_OG_IMAGE, socialImageMeta } from "@/lib/social-meta";

describe("Open Graph & Twitter Cards", () => {
  const result = auditOgTags();

  it("has valid share metadata on every public route", () => {
    expect(result.problems, JSON.stringify(result.problems, null, 2)).toEqual([]);
  });

  it("audits a meaningful number of routes and share images", () => {
    expect(result.routeCount).toBeGreaterThan(20);
    expect(result.assetCount).toBeGreaterThan(5);
  });

  it("keeps every share image asset in a crawler-safe format and size", () => {
    const { problems } = auditOgAssets();
    expect(problems).toEqual([]);
  });

  it("uses the recommended 1200x630 geometry in the shared helper", () => {
    expect(OG_IMAGE_WIDTH).toBe(String(IMAGE_RULES.recommended.width));
    expect(OG_IMAGE_HEIGHT).toBe(String(IMAGE_RULES.recommended.height));
    const ratio = Number(OG_IMAGE_WIDTH) / Number(OG_IMAGE_HEIGHT);
    expect(ratio).toBeGreaterThan(IMAGE_RULES.ratioMin);
    expect(ratio).toBeLessThan(IMAGE_RULES.ratioMax);
  });

  it("emits a complete, self-consistent tag set from socialImageMeta()", () => {
    const tags = socialImageMeta("תמונת שיתוף");
    const byKey = Object.fromEntries(
      tags.map((t) => [("property" in t ? t.property : t.name) as string, t.content]),
    );
    expect(byKey["og:image"]).toBe(SITE_OG_IMAGE);
    expect(byKey["twitter:image"]).toBe(SITE_OG_IMAGE);
    expect(byKey["og:image:alt"]).toBe("תמונת שיתוף");
    expect(byKey["twitter:card"]).toBe("summary_large_image");
    expect(SITE_OG_IMAGE.startsWith("https://hakitasheli.lovable.app/")).toBe(true);
  });

  it("points the default share image at a real jpeg asset of a sane size", () => {
    const asset = JSON.parse(readFileSync("src/assets/og/site-default.jpg.asset.json", "utf8"));
    expect(IMAGE_RULES.formats).toContain(asset.content_type);
    expect(asset.size).toBeGreaterThan(IMAGE_RULES.minBytes);
    expect(asset.size).toBeLessThan(IMAGE_RULES.maxBytes);
    expect(SITE_OG_IMAGE).toContain(asset.url);
  });

  it("flags a summary_large_image card with no image", () => {
    const tags = extractMeta('{ name: "twitter:card", content: "summary_large_image" }', {});
    expect(tags["twitter:card"]).toBe("summary_large_image");
    expect(tags["og:image"]).toBeUndefined();
  });
});
