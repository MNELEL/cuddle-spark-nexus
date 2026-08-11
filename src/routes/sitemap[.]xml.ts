import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { ARTICLES as HELP_ARTICLES } from "@/routes/help.$slug";
import { GUIDES as PARENTS_GUIDES } from "@/routes/parents-guide.$slug";

const BASE_URL = "https://hakitasheli.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

/**
 * Every public, indexable static route in the app.
 *
 * Deliberately explicit: walking src/routeTree.gen.ts from inside a route
 * module of that same tree is circular and made /sitemap.xml return 500.
 * Keep this list in sync when adding or removing a public route under
 * src/routes/.
 *
 * Excluded on purpose:
 *   - the /_authenticated subtree (session-only; each route sends noindex)
 *   - /login, /reset-password, /theme-test (utility screens)
 *   - /p/$token and /share/* (private share links)
 *   - the sitemap route itself
 */
const STATIC_ROUTES: string[] = [
  "/",
  "/privacy",
  "/content-policy",
  "/support",
  "/blog",
  "/blog/ai-seating-arrangements-guide",
  "/blog/classdojo-comparison",
  "/blog/classroom-management-strategies",
  "/blog/classroom-management-strategies/checklist",
  "/blog/classroom-tools-teachers",
  "/blog/digital-hall-pass-guide",
  "/blog/free-tools-comparison",
  "/blog/parasha-report-templates",
  "/blog/progress-tracking-guide",
  "/blog/torah-study-reward-charts",
  "/blog/weekly-report-template",
  "/contact",
  "/help",
  "/parents-guide",
  "/partners",
  "/partners/case-studies",
  "/partners/districts",
  "/partners/schools",
  "/tools",
  "/tools/exam-generator",
  "/tools/group-maker",
];

/**
 * Priority / changefreq hints per path prefix. Anything not matched falls back
 * to sensible defaults, so newly added routes get reasonable metadata without
 * a code change here.
 */
function hintsFor(path: string): { changefreq: SitemapEntry["changefreq"]; priority: string } {
  if (path === "/") return { changefreq: "weekly", priority: "1.0" };
  if (path === "/login") return { changefreq: "monthly", priority: "0.5" };
  if (path === "/privacy") return { changefreq: "yearly", priority: "0.3" };
  if (path === "/content-policy") return { changefreq: "yearly", priority: "0.3" };
  if (path === "/support" || path === "/toolkit" || path === "/sound-board") {
    return { changefreq: "monthly", priority: "0.5" };
  }
  if (path === "/blog") return { changefreq: "weekly", priority: "0.8" };
  if (path.startsWith("/blog/")) return { changefreq: "monthly", priority: "0.7" };
  if (path === "/help") return { changefreq: "weekly", priority: "0.8" };
  if (path.startsWith("/help/")) return { changefreq: "monthly", priority: "0.7" };
  if (path === "/parents-guide") return { changefreq: "monthly", priority: "0.8" };
  if (path.startsWith("/parents-guide/")) return { changefreq: "monthly", priority: "0.7" };
  if (path === "/contact") return { changefreq: "yearly", priority: "0.6" };
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
        const entries: SitemapEntry[] = STATIC_ROUTES.map((path) => ({
          path,
          ...hintsFor(path),
        }));

        // 2. Dynamic content — one entry per published row that maps to a $param route.
        // 2a. Static-content $slug routes (help centre, parents guide). Adding a
        // new article to those maps automatically extends the sitemap.
        for (const slug of Object.keys(HELP_ARTICLES)) {
          entries.push({ path: `/help/${slug}`, changefreq: "monthly", priority: "0.7" });
        }
        for (const slug of Object.keys(PARENTS_GUIDES)) {
          entries.push({ path: `/parents-guide/${slug}`, changefreq: "monthly", priority: "0.7" });
        }

        // 2b. DB-backed dynamic routes — one entry per real row, emitted only
        // while that row is publicly accessible without a session.
        //
        // Public reachability rules (mirror the routes' own loaders):
        //   /c/$slug                 -> classes.public_enabled = true AND public_slug not null
        //   /classes/$classId        -> lives under /_authenticated; a signed-out
        //                               crawler is redirected to /login, so the row's
        //                               public surface is /c/$slug (emitted above),
        //                               never the raw id URL.
        //   /bulletins/$classId      -> same: authenticated-only. A bulletin becomes
        //                               public through its class showcase page, so the
        //                               class's /c/$slug entry covers it.
        // Both authenticated routes also send robots: noindex, so emitting them
        // would put conflicting signals in the sitemap.
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: publicClasses } = await supabaseAdmin
            .from("classes")
            .select("id, public_slug")
            .eq("public_enabled", true)
            .not("public_slug", "is", null);

          const rows = (publicClasses ?? []).filter(
            (r): r is { id: string; public_slug: string } => Boolean(r.public_slug),
          );

          for (const row of rows) {
            entries.push({ path: `/c/${row.public_slug}`, changefreq: "weekly", priority: "0.6" });
          }

          // Bulletins belonging to a publicly shared class: they surface inside the
          // showcase page, so we keep the class URL fresh rather than inventing a
          // per-bulletin URL that has no public route.
          if (rows.length > 0) {
            const { data: bulletins } = await supabaseAdmin
              .from("weekly_bulletins")
              .select("class_id")
              .in(
                "class_id",
                rows.map((r) => r.id),
              );
            const withBulletins = new Set((bulletins ?? []).map((b) => b.class_id));
            for (const row of rows) {
              if (withBulletins.has(row.id)) {
                const entry = entries.find((e) => e.path === `/c/${row.public_slug}`);
                if (entry) entry.changefreq = "daily";
              }
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