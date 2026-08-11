/**
 * Automated SEO regression tests: canonical tags, meta tags, the sitemap and
 * robots.txt — asserting there are no duplicates and no wrong URLs.
 *
 * The heavy lifting lives in scripts/check-seo-urls.mjs so CI (`bun run
 * check:seo:urls`) and these tests can never disagree.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error — plain ESM audit script, no types needed
import { auditSeoUrls, routePathFromFile, siteUrl } from "../../scripts/check-seo-urls.mjs";

const read = (p: string) => readFileSync(p, "utf8");
const audit = auditSeoUrls() as { errors: string[]; stats: Record<string, number> };

describe("SEO URL audit", () => {
  it("reports no canonical / meta / sitemap / robots problems", () => {
    expect(audit.errors).toEqual([]);
  });

  it("scans a meaningful number of public routes", () => {
    expect(audit.stats.publicChecked).toBeGreaterThan(15);
    expect(audit.stats.canonicals).toBeGreaterThan(15);
    expect(audit.stats.sitemapPaths).toBeGreaterThan(15);
  });
});

describe("route path derivation", () => {
  it("maps dotted filenames to URLs", () => {
    expect(routePathFromFile("index.tsx")).toBe("/");
    expect(routePathFromFile("blog.index.tsx")).toBe("/blog");
    expect(routePathFromFile("tools.group-maker.tsx")).toBe("/tools/group-maker");
    expect(routePathFromFile("blog.classroom-management-strategies.checklist.tsx")).toBe(
      "/blog/classroom-management-strategies/checklist",
    );
  });

  it("strips the _authenticated layout segment and skips dynamic files", () => {
    expect(routePathFromFile("_authenticated.settings.index.tsx")).toBe("/settings");
    expect(routePathFromFile("help.$slug.tsx")).toBeNull();
  });
});

describe("canonical uniqueness", () => {
  const canonicals = [
    ...read("src/routes/tools.index.tsx").matchAll(/rel: "canonical"/g),
  ];

  it("no route declares more than one canonical link", () => {
    expect(canonicals.length).toBe(1);
  });

  it("the root route never declares a canonical or og:image", () => {
    const root = read("src/routes/__root.tsx");
    expect(root).not.toMatch(/rel:\s*"canonical"/);
    expect(root).not.toMatch(/property:\s*"og:image"/);
  });
});

describe("sitemap and robots", () => {
  const sitemap = read("src/routes/sitemap[.]xml.ts");
  const robots = read("public/robots.txt");
  const site = siteUrl() as string;

  it("uses the canonical site origin", () => {
    expect(sitemap).toContain(`const BASE_URL = "${site}"`);
    expect(robots).toContain(`Sitemap: ${site}/sitemap.xml`);
  });

  it("lists every blog post exactly once", () => {
    const posts = [...read("src/lib/blog-posts.ts").matchAll(/path:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(posts.length).toBeGreaterThan(5);
    for (const p of posts) {
      const hits = [...sitemap.matchAll(new RegExp(`"${p}"`, "g"))];
      expect(hits.length, `sitemap entries for ${p}`).toBe(1);
    }
  });

  it("keeps private areas crawler-blocked and out of the sitemap", () => {
    for (const p of ["/classes", "/reports", "/share/", "/p/"]) {
      expect(robots).toContain(`Disallow: ${p}`);
    }
    expect(sitemap).not.toMatch(/"\/settings"/);
    expect(sitemap).not.toMatch(/"\/login"/);
  });
});
