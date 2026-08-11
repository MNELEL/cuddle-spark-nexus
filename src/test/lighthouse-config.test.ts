import { describe, expect, it } from "vitest";
import { buildSummary, pickRuns, verdict } from "../../scripts/lighthouse-summary.mjs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require("../../lighthouserc.cjs");

const thresholds = config.thresholds as Record<string, number>;

describe("Lighthouse CI configuration", () => {
  it("asserts every category with an explicit minimum score", () => {
    const assertions = config.ci.assert.assertions as Record<string, [string, { minScore: number }]>;
    for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
      const rule = assertions[`categories:${category}`];
      expect(rule, `missing assertion for ${category}`).toBeTruthy();
      expect(rule[0]).toBe("error");
      expect(rule[1].minScore).toBe(thresholds[category]);
      expect(rule[1].minScore).toBeGreaterThan(0.5);
    }
  });

  it("audits public pages only, never authenticated routes", () => {
    expect(config.paths.length).toBeGreaterThan(5);
    for (const path of config.paths as string[]) {
      expect(path.startsWith("/")).toBe(true);
      expect(path).not.toMatch(/classes|settings|dashboard|user-management|ingest/);
    }
  });

  it("collects each URL more than once so a flaky run cannot fail the build", () => {
    expect(config.ci.collect.numberOfRuns).toBeGreaterThan(1);
    expect(config.ci.collect.url).toHaveLength(config.paths.length);
  });

  it("builds a Markdown table and flags scores under the threshold", () => {
    const manifest = [
      { url: "http://127.0.0.1:4178/", isRepresentativeRun: true, summary: { performance: 0.95, accessibility: 0.97, "best-practices": 1, seo: 1 } },
      { url: "http://127.0.0.1:4178/blog", isRepresentativeRun: true, summary: { performance: 0.42, accessibility: 0.97, "best-practices": 1, seo: 1 } },
    ];
    const { markdown, failures } = buildSummary({ manifest, thresholds });
    expect(markdown).toContain("| Page |");
    expect(markdown).toContain("`/blog`");
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ path: "/blog", category: "performance" });
  });

  it("keeps only the representative run per URL", () => {
    const runs = pickRuns([
      { url: "http://x/", isRepresentativeRun: false, summary: { seo: 0.5 } },
      { url: "http://x/", isRepresentativeRun: true, summary: { seo: 1 } },
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.summary?.seo).toBe(1);
  });

  it("marks passing, near-miss and failing scores distinctly", () => {
    expect(verdict(1, 0.9)).toBe("✅");
    expect(verdict(0.85, 0.9)).toBe("⚠️");
    expect(verdict(0.2, 0.9)).toBe("❌");
  });
});
