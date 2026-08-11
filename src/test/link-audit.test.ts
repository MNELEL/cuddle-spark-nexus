import { describe, expect, it } from "vitest";
import { auditLinks, extractLinks, readRoutePaths, SITE_HOST } from "../../scripts/check-links.mjs";

describe("link audit", () => {
  const result = auditLinks();

  it("finds every internal and external link with no broken targets", () => {
    expect(result.problems, JSON.stringify(result.problems, null, 2)).toEqual([]);
  });

  it("scans a meaningful number of pages and documents", () => {
    expect(result.fileCount).toBeGreaterThan(100);
    expect(result.linkCount).toBeGreaterThan(100);
    expect(result.routeCount).toBeGreaterThan(50);
  });

  it("never links to a localhost, preview or legacy domain", () => {
    const bad = result.externalUrls.filter((url: string) =>
      /localhost|127\.0\.0\.1|example\.com|classalign|id-preview--/i.test(url),
    );
    expect(bad).toEqual([]);
  });

  it("uses the canonical site host for self-referencing absolute URLs", () => {
    const selfLinks = result.externalUrls.filter((url: string) => url.includes("lovable.app"));
    for (const url of selfLinks) expect(new URL(url).hostname).toBe(SITE_HOST);
  });

  it("exposes the generated route list", () => {
    const routes = readRoutePaths();
    expect(routes).toContain("/");
    expect(routes).toContain("/blog");
  });

  it("extracts links from JSX, markdown and plain text", () => {
    const { internal, external } = extractLinks(
      `<Link to="/blog" /> <a href="/privacy">x</a> [doc](/support) https://${SITE_HOST}/tools`,
    );
    expect(internal.sort()).toEqual(["/blog", "/privacy", "/support"]);
    expect(external).toEqual([`https://${SITE_HOST}/tools`]);
  });

  it("ignores anchors, mailto links and runtime-built URLs", () => {
    const { internal, external } = extractLinks(
      `<a href="#top">t</a> <a href="mailto:a@b.co">m</a> <a href={\`/c/\${slug}\`}>c</a>`,
    );
    expect(internal).toEqual([]);
    expect(external).toEqual([]);
  });
});
