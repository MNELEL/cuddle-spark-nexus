import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { NAV_EXEMPT_ROUTES, TOOLS, normalizePathname, toolByPath } from "@/lib/tool-registry";

/** `_authenticated.reports.$classId.tsx` → `/reports/$classId` */
function routePath(file: string): string {
  const base = file.replace(/\.tsx?$/, "").replace(/^_authenticated\./, "");
  const parts = base.split(".").filter((p) => p !== "index");
  return `/${parts.join("/")}`.replace(/\/$/, "") || "/";
}

describe("route-link coverage", () => {
  it("has no orphan authenticated routes", () => {
    const covered = new Set<string>([...TOOLS.map((t) => t.to), ...NAV_EXEMPT_ROUTES]);
    const orphans = readdirSync("src/routes")
      .filter((f) => f.startsWith("_authenticated") && /\.tsx?$/.test(f) && f !== "_authenticated.tsx")
      .map(routePath)
      .filter((p) => !covered.has(p));
    expect(orphans, `orphan routes: ${orphans.join(", ")}`).toEqual([]);
  });

  it("the check script exits 0", () => {
    expect(() => execFileSync("node", ["scripts/check-route-links.mjs"])).not.toThrow();
  });

  it("resolves live pathnames back to their tool entry", () => {
    expect(toolByPath(normalizePathname("/analytics/abc-123"))?.label).toBe("אנליטיקת כיתה");
    expect(toolByPath(normalizePathname("/settings/theme"))?.section).toBe("settings");
    expect(toolByPath(normalizePathname("/classes"))).toBeUndefined();
  });
});
