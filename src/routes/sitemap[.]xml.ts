import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { routeTree } from "@/routeTree.gen";

const BASE_URL = "https://cuddle-spark-nexus.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

/**
 * Walk the generated route tree and return every static, indexable full path.
 * This is what makes the sitemap self-updating: adding, renaming, or removing a
 * file under src/routes/ regenerates src/routeTree.gen.ts, and the next request
 * to /sitemap.xml picks the change up automatically — no manual edits here.
 *
 * Excluded:
 *   - the sitemap route itself
 *   - dynamic segments ($param, splat $)
 *   - authenticated subtree (blocked by robots.txt; not indexable)
 *   - API / hook routes
 *   - private share/token routes (/p/$token, /share/*)
 */
function collectStaticRoutes(): string[] {
  const out = new Set<string>();
  const visit = (route: unknown) => {
    if (!route || typeof route !== "object") return;
    const r = route as { id?: string; fullPath?: string; children?: unknown };
    const id = r.id ?? "";
    const fullPath = r.fullPath ?? "";

    const isDynamic = fullPath.includes("$");
    const isAuthenticated = id.startsWith("/_authenticated");
    const isApi = fullPath.startsWith("/api");
    const isPrivateShare = fullPath.startsWith("/p/") || fullPath.startsWith("/share/");
    const isSitemap = fullPath === "/sitemap.xml";
    const isRootPlaceholder = fullPath === "" || fullPath === "__root__";

    if (
      fullPath &&
      !isDynamic &&
      !isAuthenticated &&
      !isApi &&
      !isPrivateShare &&
      !isSitemap &&
      !isRootPlaceholder
    ) {
      // Normalize "/blog/" style entries produced by index children to "/blog".
      const normalized =
        fullPath.length > 1 && fullPath.endsWith("/") ? fullPath.slice(0, -1) : fullPath;
      out.add(normalized);
    }

    const children = r.children;
    if (Array.isArray(children)) {
      for (const c of children) visit(c);
    } else if (children && typeof children === "object") {
      for (const c of Object.values(children)) visit(c);
    }
  };
  visit(routeTree);
  return Array.from(out).sort();
}

/**
 * Priority / changefreq hints per path prefix. Anything not matched falls back
 * to sensible defaults, so newly added routes get reasonable metadata without
 * a code change here.
 */
function hintsFor(path: string): { changefreq: SitemapEntry["changefreq"]; priority: string } {
  if (path === "/") return { changefreq: "weekly", priority: "1.0" };
  if (path === "/login") return { changefreq: "monthly", priority: "0.5" };
  if (path === "/privacy") return { changefreq: "yearly", priority: "0.3" };
  if (path === "/support" || path === "/toolkit" || path === "/sound-board") {
    return { changefreq: "monthly", priority: "0.5" };
  }
  if (path === "/blog") return { changefreq: "weekly", priority: "0.8" };
  if (path.startsWith("/blog/")) return { changefreq: "monthly", priority: "0.7" };
  if (path === "/help") return { changefreq: "weekly", priority: "0.8" };
  if (path.startsWith("/help/")) return { changefreq: "monthly", priority: "0.7" };
  if (path === "/parents-guide") return { changefreq: "monthly", priority: "0.8" };
  if (path.startsWith("/parents-guide/")) return { changefreq: "monthly", priority: "0.7" };
  if (path === "/partners") return { changefreq: "monthly", priority: "0.8" };
  if (path.startsWith("/partners/")) return { changefreq: "monthly", priority: "0.7" };
  if (path.startsWith("/tools/")) return { changefreq: "monthly", priority: "0.7" };
  return { changefreq: "monthly", priority: "0.5" };
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // 1. Static routes — derived automatically from the generated route tree.
        const entries: SitemapEntry[] = collectStaticRoutes().map((path) => ({
          path,
          ...hintsFor(path),
        }));

        // 2. Dynamic content — one entry per published row that maps to a $param route.
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("classes")
            .select("public_slug")
            .eq("public_enabled", true)
            .not("public_slug", "is", null);
          for (const row of data ?? []) {
            if (row.public_slug) {
              entries.push({ path: `/c/${row.public_slug}`, changefreq: "weekly", priority: "0.6" });
            }
          }
        } catch {
          // Silently skip if DB unavailable at build time
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            // Short TTL so new routes or newly-published classes show up within
            // ~5 minutes without waiting for a redeploy.
            "Cache-Control": "public, max-age=300, s-maxage=300",
          },
        });
      },
    },
  },
});